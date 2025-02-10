class ZabbixAPI {
    constructor(url, token) {
        this.url = url;
        this.token = token;
        this.requestId = 1;
    }

    async request(method, params = {}) {
        // apiinfo.version 不需要认证
        const body = {
            jsonrpc: '2.0',
            method: method,
            params: params,
            id: this.requestId++
        };

        // 除了 apiinfo.version 外，其他方法都需要认证
        if (method !== 'apiinfo.version') {
            body.auth = this.token;
        }

        try {
            // console.log(`Sending request to ${method}:`, body);  // 添加日志
            const response = await fetch(this.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            // console.log(`Response from ${method}:`, data);  // 添加日志
            
            if (data.error) {
                console.error('API Error:', JSON.stringify(data.error, null, 2));  // 格式化错误输出
                throw new Error(data.error.data || data.error.message || 'API error');
            }

            return data.result;
        } catch (error) {
            console.error('Request Error:', error);
            throw error;
        }
    }

    async testConnection() {
        try {
            // 先测试 API 版本（不需要认证）
            const version = await this.request('apiinfo.version');
            // console.log('Zabbix API version:', version);

            // 再测试认证
            const hosts = await this.request('host.get', {
                countOutput: true,
                limit: 1
            });
            // console.log('Connection test successful');
            return true;
        } catch (error) {
            console.error('Connection test failed:', error);
            throw new Error('连接失败：' + error.message);
        }
    }

    async getHosts() {
        try {
            // 获取主机基本信息
            const hostsResponse = await this.request('host.get', {
                output: ['hostid', 'host', 'name', 'status'],
                selectInterfaces: ['ip'],
                selectInventory: ['os'],
                selectItems: ['itemid', 'name', 'key_', 'lastvalue'],
                selectTriggers: ['triggerid', 'description', 'priority', 'value'],
                filter: {
                    status: 0  // 只获取启用的主机
                }
            });

            return await Promise.all(hostsResponse.map(async host => {
                // 获取主机的监控项
                const items = host.items || [];
                
                // 获取 CPU 和内存相关的监控项
                const cpuItem = items.find(item => item.key_.includes('system.cpu.util'));
                const memoryItem = items.find(item => item.key_.includes('vm.memory.util'));
                const cpuCoresItem = items.find(item => item.key_.includes('system.cpu.num'));
                const memoryTotalItem = items.find(item => item.key_.includes('vm.memory.size[total]'));

                // 获取活动的告警数量
                const activeProblems = (host.triggers || []).filter(trigger => 
                    trigger.value === '1'  // 1 表示问题状态
                ).length;

                return {
                    hostid: host.hostid,
                    name: host.name || host.host,
                    ip: host.interfaces?.[0]?.ip || '未知',
                    os: this.formatOS(host.inventory?.os) || '未知',
                    cpuCores: cpuCoresItem?.lastvalue || '未知',
                    memoryTotal: memoryTotalItem ? this.formatMemorySize(memoryTotalItem.lastvalue) : '未知',
                    cpu: cpuItem?.lastvalue ? parseFloat(cpuItem.lastvalue).toFixed(2) : '未知',
                    memory: memoryItem?.lastvalue ? parseFloat(memoryItem.lastvalue).toFixed(2) : '未知',
                    alerts: activeProblems || 0
                };
            }));
        } catch (error) {
            console.error('Failed to get hosts:', error);
            throw error;
        }
    }

    async getAlerts() {
        return await this.request('problem.get', {
            output: ['eventid', 'clock', 'name', 'severity'],
            recent: true,
            sortfield: 'eventid',
            sortorder: 'DESC',
            // 只获取活动的问题
            recent: true,
            acknowledged: false,
            suppressed: false
        });
    }

    async getAlertTrend() {
        const now = Math.floor(Date.now() / 1000);
        const weekAgo = now - 7 * 24 * 60 * 60;

        const events = await this.request('event.get', {
            output: ['clock', 'severity', 'name'],
            time_from: weekAgo,
            source: 0,        // 触发器事件
            object: 0,        // 触发器对象
            value: 1,         // PROBLEM状态
            sortfield: 'clock',
            sortorder: 'ASC'
            // 移除 recent 和 acknowledged 参数，这样可以获取所有告警
        });

        // 按天分组
        const dailyProblems = events.reduce((acc, event) => {
            const date = new Date(event.clock * 1000).toISOString().split('T')[0];
            if (!acc[date]) {
                acc[date] = 0;
            }
            acc[date]++;
            return acc;
        }, {});

        // 确保有过去7天的数据
        const dates = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            dates.push(date);
            if (!dailyProblems[date]) {
                dailyProblems[date] = 0;
            }
        }

        // 转换为图表数据格式
        return dates.map(date => ({
            name: date,
            value: [date, dailyProblems[date]]
        }));
    }

    async getAlertSeverity() {
        const problems = await this.getAlerts();
        
        const severityNames = {
            '0': '未分类',
            '1': '信息',
            '2': '警告',
            '3': '一般严重',
            '4': '严重',
            '5': '灾难'
        };

        // 初始化所有严重级别的计数为0
        const severityCounts = Object.keys(severityNames).reduce((acc, severity) => {
            acc[severity] = 0;
            return acc;
        }, {});

        // 统计各严重级别的数量
        problems.forEach(problem => {
            severityCounts[problem.severity]++;
        });

        // 转换为图表数据格式
        return Object.entries(severityCounts)
            .map(([severity, count]) => ({
                name: severityNames[severity],
                value: count
            }))
            .filter(item => item.value > 0);
    }

    async getAlertHistory() {
        const now = Math.floor(Date.now() / 1000);
        const weekAgo = now - 7 * 24 * 60 * 60;

        // 获取问题事件
        const problems = await this.request('event.get', {
            output: ['eventid', 'clock', 'name', 'severity', 'value', 'r_eventid'],
            selectHosts: ['hostid', 'host', 'name'],
            source: 0,
            object: 0,
            time_from: weekAgo,
            sortfield: ['clock', 'eventid'],
            sortorder: 'DESC',
            value: 1,
            suppressed: false
        });

        // 获取恢复事件
        const recoveryEvents = await this.request('event.get', {
            output: ['eventid', 'clock'],
            eventids: problems.map(p => p.r_eventid).filter(id => id !== '0')
        });

        // 创建恢复事件的映射
        const recoveryMap = new Map(recoveryEvents.map(e => [e.eventid, e]));

        // 为每个问题添加恢复状态和持续时间
        return problems.map(problem => {
            const recoveryEvent = recoveryMap.get(problem.r_eventid);
            const endTime = recoveryEvent ? parseInt(recoveryEvent.clock) : now;
            const duration = endTime - parseInt(problem.clock);

            return {
                ...problem,
                status: recoveryEvent ? '0' : '1',  // 0 表示已恢复，1 表示告警中
                duration: duration  // 持续时间（秒）
            };
        });
    }

    async getHostsDetails() {
        // 获取所有主机基本信息
        const hosts = await this.request('host.get', {
            output: ['hostid', 'host', 'name'],
            selectInterfaces: ['ip'],
            filter: { status: 0 }
        });

        // 获取所有主机的最新数据
        const items = await this.request('item.get', {
            output: ['hostid', 'name', 'lastvalue', 'key_'],
            hostids: hosts.map(host => host.hostid),
            filter: {
                key_: [
                    'system.cpu.util',
                    'vm.memory.utilization',  // Linux 内存使用率
                    'vm.memory.util',         // Windows 内存使用率
                    'system.cpu.num',         // Linux CPU 核心数
                    'wmi.get[root/cimv2,"Select NumberOfLogicalProcessors from Win32_ComputerSystem"]',  // Windows CPU 核心数
                    'vm.memory.size[total]',
                    'system.sw.os'
                ]
            }
        });

        // 获取当前告警数量
        const triggers = await this.request('trigger.get', {
            output: ['triggerid', 'description'],
            selectHosts: ['hostid'],
            filter: {
                value: 1,
                status: 0
            },
            monitored: true,
            skipDependent: true,
            only_true: true
        });

        // 统计每个主机的告警数量
        const alertCounts = {};
        triggers.forEach(trigger => {
            if (trigger.hosts && trigger.hosts.length > 0) {
                const hostId = trigger.hosts[0].hostid;
                alertCounts[hostId] = (alertCounts[hostId] || 0) + 1;
            }
        });

        // 整合数据
        return hosts.map(host => {
            const cpuItem = items.find(item => 
                item.hostid === host.hostid && 
                item.key_ === 'system.cpu.util'
            );

            const osItem = items.find(item =>
                item.hostid === host.hostid &&
                item.key_ === 'system.sw.os'
            );

            // 根据操作系统类型选择合适的内存使用率监控项
            const memoryItem = items.find(item => {
                if (!item || item.hostid !== host.hostid) return false;
                const isWindows = osItem?.lastvalue?.toLowerCase().includes('windows');
                return isWindows ? 
                    item.key_ === 'vm.memory.util' :      // Windows
                    item.key_ === 'vm.memory.utilization' // Linux
            });

            // 根据操作系统类型选择合适的 CPU 核心数监控项
            const cpuNumItem = items.find(item => {
                if (!item || item.hostid !== host.hostid) return false;
                const isWindows = osItem?.lastvalue?.toLowerCase().includes('windows');
                return isWindows ? 
                    item.key_ === 'wmi.get[root/cimv2,"Select NumberOfLogicalProcessors from Win32_ComputerSystem"]' :  // Windows
                    item.key_ === 'system.cpu.num'  // Linux
            });

            const memTotalItem = items.find(item =>
                item.hostid === host.hostid &&
                item.key_ === 'vm.memory.size[total]'
            );

            const formatMemorySize = (bytes) => {
                if (!bytes) return '-';
                const gb = Math.round(parseFloat(bytes) / (1024 * 1024 * 1024));
                return `${gb} GB`;
            };

            const formatPercentage = (value) => {
                if (!value) return '-';
                return parseFloat(value).toFixed(2) + '%';
            };

            const getOsType = (osInfo) => {
                if (!osInfo) return '-';
                if (osInfo.toLowerCase().includes('windows')) return 'Windows';
                if (osInfo.toLowerCase().includes('linux')) return 'Linux';
                return 'Other';
            };

            return {
                hostid: parseInt(host.hostid),
                name: host.name,
                ip: host.interfaces?.[0]?.ip || '-',
                os: getOsType(osItem?.lastvalue),
                cpuCores: cpuNumItem ? cpuNumItem.lastvalue : '-',
                memoryTotal: memTotalItem ? formatMemorySize(memTotalItem.lastvalue) : '-',
                cpu: formatPercentage(cpuItem?.lastvalue),
                memory: formatPercentage(memoryItem?.lastvalue),
                alerts: alertCounts[host.hostid] || 0
            };
        });
    }

    async getHostDetail(hostId) {
        try {
            const numericHostId = parseInt(hostId);

            // 获取主机基本信息
            const hostResponse = await this.request('host.get', {
                hostids: [numericHostId],
                output: ['host', 'name', 'status', 'available'],
                selectInterfaces: ['ip'],
                selectInventory: ['os', 'hardware', 'software', 'contact']
            });

            if (!hostResponse || !hostResponse[0]) {
                throw new Error('Host not found');
            }

            // 获取主机的监控项数据
            const itemsResponse = await this.request('item.get', {
                hostids: [numericHostId],
                output: ['itemid', 'name', 'lastvalue', 'units', 'key_'],
                filter: {
                    key_: [
                        'system.cpu.util[,idle]',    // Linux CPU 空闲率
                        'system.cpu.util',           // Windows CPU 使用率
                        'vm.memory.utilization',     // Linux 内存使用率
                        'vm.memory.util',            // Windows 内存使用率
                        'system.cpu.num',            // Linux CPU 核心数
                        'wmi.get[root/cimv2,"Select NumberOfLogicalProcessors from Win32_ComputerSystem"]',  // Windows CPU 核心数
                        'vm.memory.size[total]',
                        'system.sw.os',
                        'system.uptime'
                    ]
                }
            });

            // 找到操作系统类型
            const osItem = itemsResponse.find(item => item.key_ === 'system.sw.os');
            const isWindows = osItem?.lastvalue?.toLowerCase().includes('windows');

            // 根据操作系统类型选择正确的 CPU 使用率监控项
            const cpuItem = itemsResponse.find(item => {
                if (isWindows) {
                    return item.key_ === 'system.cpu.util';
                } else {
                    return item.key_ === 'system.cpu.util[,idle]';
                }
            });

            const memoryItem = itemsResponse.find(item => {
                if (isWindows) {
                    return item.key_ === 'vm.memory.util';
                } else {
                    return item.key_ === 'vm.memory.utilization';
                }
            });

            // 获取历史数据（最近24小时）
            const timeFrom = Math.floor(Date.now() / 1000) - 24 * 3600;
            const [cpuHistoryResponse, memoryHistoryResponse] = await Promise.all([
                this.request('history.get', {
                    itemids: [parseInt(cpuItem?.itemid)],
                    time_from: timeFrom,
                    output: 'extend',
                    history: 0,
                    sortfield: 'clock',
                    sortorder: 'ASC'
                }),
                this.request('history.get', {
                    itemids: [parseInt(memoryItem?.itemid)],
                    time_from: timeFrom,
                    output: 'extend',
                    history: 0,
                    sortfield: 'clock',
                    sortorder: 'ASC'
                })
            ]);

            // 处理历史数据
            const history = {
                time: [],
                cpu: [],
                memory: []
            };

            // 处理 CPU 历史数据
            cpuHistoryResponse.forEach(record => {
                const value = isWindows ? 
                    parseFloat(record.value) :  // Windows 直接使用值
                    (100 - parseFloat(record.value));  // Linux 需要转换空闲率为使用率
                
                history.time.push(this.formatHistoryTime(record.clock));
                history.cpu.push(value.toFixed(2));
            });

            // 处理内存历史数据
            memoryHistoryResponse.forEach((record, index) => {
                if (!history.time[index]) {
                    history.time.push(this.formatHistoryTime(record.clock));
                }
                history.memory.push(parseFloat(record.value).toFixed(2));
            });

            const host = hostResponse[0];
            const items = this.processItems(itemsResponse, isWindows);

            const result = {
                name: host.name,
                ip: host.interfaces[0]?.ip || '-',
                os: items.os || '-',
                uptime: items.uptime || 0,
                cpuCores: items.cpuCores || '-',
                memoryTotal: items.memoryTotal || '-',
                history: history,
                cpuItemId: cpuItem?.itemid,  // 添加 CPU 监控项 ID
                memoryItemId: memoryItem?.itemid,  // 添加内存监控项 ID
                isWindows: isWindows  // 添加系统类型标识
            };

            // console.log('CPU History Response:', cpuHistoryResponse);
            // console.log('Memory History Response:', memoryHistoryResponse);
            // console.log('Final Result:', result);
            return result;

        } catch (error) {
            console.error('Failed to get host details:', error);
            throw error;
        }
    }

    // 修改 processItems 方法
    processItems(items, isWindows) {
        const result = {};
        items.forEach(item => {
            switch (item.key_) {
                case 'system.cpu.util[,idle]':
                    if (!isWindows) {
                        result.cpuUsage = (100 - parseFloat(item.lastvalue)).toFixed(2);
                    }
                    break;
                case 'system.cpu.util':  // Windows CPU 使用率
                    if (isWindows) {
                        result.cpuUsage = parseFloat(item.lastvalue).toFixed(2);
                    }
                    break;
                case 'vm.memory.util':
                    result.memoryUsage = parseFloat(item.lastvalue).toFixed(2);
                    break;
                case 'system.cpu.num':
                    if (!isWindows) {
                        result.cpuCores = item.lastvalue;
                    }
                    break;
                case 'wmi.get[root/cimv2,"Select NumberOfLogicalProcessors from Win32_ComputerSystem"]':
                    if (isWindows) {
                        result.cpuCores = item.lastvalue;
                    }
                    break;
                case 'vm.memory.size[total]':
                    result.memoryTotal = this.formatBytes(item.lastvalue);
                    break;
                case 'system.uptime':
                    result.uptime = parseInt(item.lastvalue);
                    break;
                case 'system.sw.os':
                    result.os = item.lastvalue;
                    break;
            }
        });

        return result;
    }

    // 格式化时间
    formatHistoryTime(timestamp) {
        return new Date(timestamp * 1000).toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // 格式化字节大小
    formatBytes(bytes) {
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        if (bytes === 0) return '0 B';
        const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
        return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
    }

    // 添加内存大小格式化方法
    formatMemorySize(bytes) {
        if (!bytes) return '未知';
        
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
    }

    // 添加操作系统格式化方法
    formatOS(os) {
        if (!os) return '未知';
        // 提取第一个单词
        const firstWord = os.split(/[\s,\/]/)[0];
        return firstWord;
    }

    async getHostAlerts(hostId) {
        try {
            const problems = await this.request('problem.get', {
                output: ['eventid', 'name', 'clock', 'severity', 'r_clock', 'objectid'],
                hostids: [hostId],
                recent: true,
                sortfield: ['eventid'],
                sortorder: 'DESC'
            });

            // 获取所有触发器的最新数据
            const triggerIds = problems.map(p => p.objectid);
            const triggers = await this.request('trigger.get', {
                output: ['triggerid', 'lastvalue', 'units'],
                triggerids: triggerIds,
                selectItems: ['itemid', 'name', 'lastvalue', 'units']
            });

            // 创建触发器查找映射
            const triggerMap = triggers.reduce((map, t) => {
                map[t.triggerid] = t;
                return map;
            }, {});

            return problems.map(problem => {
                const trigger = triggerMap[problem.objectid];
                const item = trigger?.items?.[0];
                const value = item ? `${item.lastvalue}${item.units || ''}` : '-';

                return {
                    name: problem.name,
                    severity: this.getSeverityName(problem.severity),
                    value: value,
                    startTime: this.formatDateTime(problem.clock),
                    duration: this.calculateDuration(problem.clock)
                };
            });
        } catch (error) {
            console.error('Failed to get host alerts:', error);
            throw error;
        }
    }

    getSeverityName(severity) {
        const severities = {
            '0': { name: '未分类', class: 'severity-not-classified' },
            '1': { name: '信息', class: 'severity-information' },
            '2': { name: '警告', class: 'severity-warning' },
            '3': { name: '一般', class: 'severity-average' },
            '4': { name: '严重', class: 'severity-high' },
            '5': { name: '灾难', class: 'severity-disaster' }
        };
        return severities[severity] || severities['0'];
    }

    formatDateTime(timestamp) {
        return new Date(timestamp * 1000).toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    calculateDuration(startTime) {
        const duration = Math.floor(Date.now() / 1000) - startTime;
        const days = Math.floor(duration / 86400);
        const hours = Math.floor((duration % 86400) / 3600);
        const minutes = Math.floor((duration % 3600) / 60);
        
        let result = '';
        if (days > 0) result += `${days}天`;
        if (hours > 0) result += `${hours}小时`;
        if (minutes > 0) result += `${minutes}分钟`;
        return result || '刚刚';
    }
} 