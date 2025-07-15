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
            // 先获取所需的监控项
            const items = await this.request('item.get', {
                output: ['itemid', 'hostid', 'name', 'key_', 'lastvalue'],
                search: {
                    name: [
                        'CPU utilization',            // CPU使用率
                        'Memory utilization',         // 内存使用率
                        'Number of CPUs',             // CPU核心数
                        'System name',                // 主机名称
                        'System description',         // 系统详情
                        'System uptime',              // 运行时间
                        'Total memory'                // 内存总量
                    ],
                    key_: [
                        'system.cpu.util[,idle]',     // CPU使用率
                        'system.cpu.util[,system]',   // CPU使用率
                        'system.cpu.util',            // CPU使用率
                        'vm.memory.utilization',      // 内存使用率
                        'vm.memory.util',             // 内存使用率
                        'system.cpu.num',             // CPU核心数
                        'wmi.get[root/cimv2,"Select NumberOfLogicalProcessors from Win32_ComputerSystem"]',  // Windows CPU 核心数
                        'system.name',                // 主机名称
                        'system.hostname',            // 主机名称
                        'system.uname',               // 系统详情
                        'system.sw.os',               // 系统详情
                        'system.uptime',              // 运行时间
                        'system.net.uptime',          // 运行时间
                        'system.descr[sysDescr.0]',    // 系统详情
                        'vm.memory.size[total]'       // 内存总量
                    ]
                },
                searchByAny: true,                    // 匹配任意关键字
                monitored: true,                      // 只获取已监控的项目
                webitems: false,                      // 排除 web 监控项
                filter_flags: {
                    not_supported: false              // 排除不支持的项目
                }
            });

            // 创建主机ID到监控项的映射
            const hostItemsMap = items.reduce((map, item) => {
                if (!map[item.hostid]) {
                    map[item.hostid] = [];
                }
                map[item.hostid].push(item);
                return map;
            }, {});

            // 获取主机基本信息
            const hostsResponse = await this.request('host.get', {
                output: ['hostid', 'host', 'name', 'status'],
                selectInterfaces: ['ip'],
                selectInventory: ['os'],
                selectTriggers: ['triggerid', 'description', 'priority', 'value'],
                filter: {
                    status: 0  // 只获取启用的主机
                }
            });

            return await Promise.all(hostsResponse.map(async host => {
                const items = hostItemsMap[host.hostid] || [];
                
                // 通过名称或key获取监控项
                const cpuItem = items.find(item => item.name.includes('CPU utilization')) ||
                              items.find(item => item.key_ === 'system.cpu.util[,system]') ||
                              items.find(item => item.key_ === 'system.cpu.util') ||
                              items.find(item => item.key_.startsWith('system.cpu.util[')) ||
                              items.find(item => {
                                  if (item.key_ === 'system.cpu.util[,idle]') {
                                      item.lastvalue = (100 - parseFloat(item.lastvalue)).toString();
                                      return true;
                                  }
                                  return false;
                              });
                const memoryUtilItem = items.find(item => item.name.includes('Memory utilization')) ||
                                     items.find(item => item.key_ === 'vm.memory.utilization') ||
                                     items.find(item => item.key_.startsWith('vm.memory.util[')) ||
                                     items.find(item => item.key_ === 'vm.memory.util');

                const hostnameItem = items.find(item => item.name.includes('System name')) ||
                                   items.find(item => item.key_ === 'system.hostname') ||
                                   items.find(item => item.key_ === 'system.name');

                const osItem = items.find(item => item.name.includes('System description')) ||
                             items.find(item => item.key_ === 'system.uname') ||
                             items.find(item => item.key_ === 'system.sw.os') ||
                             items.find(item => item.key_ === 'system.descr[sysDescr.0]');

                const cpuCoresItem = items.find(item => item.name.includes('Number of CPUs')) ||
                                   items.find(item => item.key_ === 'system.cpu.num') ||
                                   items.find(item => item.key_ === 'wmi.get[root/cimv2,"Select NumberOfLogicalProcessors from Win32_ComputerSystem"]');

                const memoryTotalItem = items.find(item => item.name.includes('Total memory')) ||
                                      items.find(item => item.key_ === 'vm.memory.size[total]');
                
                // 计算内存使用率，优先使用直接的使用率值
                let memoryUsage = '-';
                if (memoryUtilItem?.lastvalue) {
                    memoryUsage = parseFloat(memoryUtilItem.lastvalue).toFixed(2);
                }
                
                const cpuCores = cpuCoresItem?.lastvalue || '-';
                const hostname = hostnameItem?.lastvalue || '-';

                // 获取活动的告警数量
                const activeProblems = (host.triggers || []).filter(trigger => 
                    trigger.value === '1'  // 1 表示问题状态
                ).length;

                // 添加运行时间监控项获取
                const uptimeItem = items.find(item => item.name.includes('System uptime')) ||
                                 items.find(item => item.key_ === 'system.uptime') ||
                                 items.find(item => item.key_.startsWith('system.net.uptime'));

                return {
                    hostid: host.hostid,
                    name: host.name || host.host,
                    hostname: hostname,
                    ip: host.interfaces?.[0]?.ip || '-',
                    os: osItem?.lastvalue || '-',  // 直接使用 System description 的值
                    cpuCores: cpuCores !== '-' ? `${cpuCores}` : '-',
                    memoryTotal: memoryTotalItem ? this.formatMemorySize(memoryTotalItem.lastvalue) : '-',
                    cpu: cpuItem?.lastvalue ? parseFloat(cpuItem.lastvalue).toFixed(2) : '-',
                    memory: memoryUsage,
                    alerts: activeProblems || 0,
                    uptime: uptimeItem ? this.calculateDuration(Math.floor(Date.now() / 1000) - parseInt(uptimeItem.lastvalue)) : '-'
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
                cpu: cpuItem?.lastvalue ? parseFloat(cpuItem.lastvalue).toFixed(2) : '-',
                memory: formatPercentage(memoryItem?.lastvalue),
                alerts: alertCounts[host.hostid] || 0
            };
        });
    }

    async getHostDetail(hostId) {
        try {
            const [hostResponse, itemsResponse] = await Promise.all([
                this.request('host.get', {
                    output: ['hostid', 'host', 'name', 'status'],
                    selectInterfaces: ['ip'],
                    hostids: [hostId]
                }),
                this.request('item.get', {
                    output: ['itemid', 'name', 'key_', 'lastvalue', 'units'],
                    hostids: [hostId],
                    search: {
                        name: [
                            'CPU utilization',            // CPU使用率
                            'Memory utilization',         // 内存使用率
                            'Number of CPUs',             // CPU核心数
                            'System name',                // 主机名称
                            'System description',         // 系统详情
                            'System uptime',              // 运行时间
                            'Total memory'                // 内存总量
                        ],
                        key_: [
                            'system.cpu.util[,idle]',     // CPU使用率
                            'system.cpu.util[,system]',   // CPU使用率
                            'system.cpu.util',            // CPU使用率
                            'vm.memory.utilization',      // 内存使用率
                            'vm.memory.util',             // 内存使用率
                            'system.cpu.num',             // CPU核心数
                            'wmi.get[root/cimv2,"Select NumberOfLogicalProcessors from Win32_ComputerSystem"]',  // Windows CPU 核心数
                            'system.name',                // 主机名称
                            'system.hostname',            // 主机名称
                            'system.uname',               // 系统详情
                            'system.sw.os',               // 系统详情
                            'system.uptime',              // 运行时间
                            'system.net.uptime',          // 运行时间
                            'system.descr[sysDescr.0]',    // 系统详情
                            'vm.memory.size[total]'       // 内存总量
                        ]
                    },
                    searchByAny: true
                })
            ]);

            if (!hostResponse || !hostResponse.length) {
                throw new Error('Host not found');
            }

            const host = hostResponse[0];
            // 通过名称或key获取监控项
            const cpuItem = itemsResponse.find(item => item.name.includes('CPU utilization')) ||
                          itemsResponse.find(item => item.key_ === 'system.cpu.util[,system]') ||
                          itemsResponse.find(item => item.key_ === 'system.cpu.util') ||
                          itemsResponse.find(item => item.key_.startsWith('system.cpu.util[')) ||
                          itemsResponse.find(item => {
                              if (item.key_ === 'system.cpu.util[,idle]') {
                                  item.lastvalue = (100 - parseFloat(item.lastvalue)).toString();
                                  return true;
                              }
                              return false;
                          });

            const memoryItem = itemsResponse.find(item => item.name.includes('Memory utilization')) ||
                            itemsResponse.find(item => item.key_ === 'vm.memory.utilization') ||
                            itemsResponse.find(item => item.key_.startsWith('vm.memory.util[')) ||
                            itemsResponse.find(item => item.key_ === 'vm.memory.util');

            const cpuCoresItem = itemsResponse.find(item => item.name.includes('Number of CPUs')) ||
                                itemsResponse.find(item => item.key_ === 'system.cpu.num') ||
                                itemsResponse.find(item => item.key_ === 'wmi.get[root/cimv2,"Select NumberOfLogicalProcessors from Win32_ComputerSystem"]');

            const hostnameItem = itemsResponse.find(item => item.name.includes('System name')) ||
                                itemsResponse.find(item => item.key_ === 'system.hostname') ||
                                itemsResponse.find(item => item.key_ === 'system.name');

            const osItem = itemsResponse.find(item => item.name.includes('System description')) ||
                          itemsResponse.find(item => item.key_ === 'system.uname') ||
                          itemsResponse.find(item => item.key_ === 'system.sw.os') ||
                          itemsResponse.find(item => item.key_ === 'system.descr[sysDescr.0]');

            const uptimeItem = itemsResponse.find(item => item.name.includes('System uptime')) ||
                              itemsResponse.find(item => item.key_ === 'system.uptime') ||
                              itemsResponse.find(item => item.key_.startsWith('system.net.uptime'));

            const memoryTotalItem = itemsResponse.find(item => item.name.includes('Total memory')) ||
                                   itemsResponse.find(item => item.key_ === 'vm.memory.size[total]');

            // 初始化历史数据结构
            const history = { time: [], cpu: [], memory: [] };
            
            // 只有当监控项存在时才获取历史数据
            if (cpuItem || memoryItem) {
                // 获取历史数据（最近24小时）
                const timeFrom = Math.floor(Date.now() / 1000) - 24 * 3600;
                const historyRequests = [];
                
                if (cpuItem) {
                    historyRequests.push(
                        this.request('history.get', {
                            itemids: [parseInt(cpuItem.itemid)],
                            time_from: timeFrom,
                            output: 'extend',
                            history: 0,
                            sortfield: 'clock',
                            sortorder: 'ASC'
                        })
                    );
                }
                
                if (memoryItem) {
                    historyRequests.push(
                        this.request('history.get', {
                            itemids: [parseInt(memoryItem.itemid)],
                            time_from: timeFrom,
                            output: 'extend',
                            history: 0,
                            sortfield: 'clock',
                            sortorder: 'ASC'
                        })
                    );
                }
                
                const responses = await Promise.all(historyRequests);
                const cpuHistoryResponse = cpuItem ? responses[0] : [];
                const memoryHistoryResponse = memoryItem ? responses[cpuItem ? 1 : 0] : [];

                // 处理 CPU 历史数据
                if (cpuItem) {
                    cpuHistoryResponse.forEach(record => {
                        const value = parseFloat(record.value);
                        history.time.push(this.formatHistoryTime(record.clock));
                        history.cpu.push(value.toFixed(2));
                    });
                }

                // 处理内存历史数据
                if (memoryItem) {
                    memoryHistoryResponse.forEach((record, index) => {
                        if (!history.time[index]) {
                            history.time.push(this.formatHistoryTime(record.clock));
                        }
                        history.memory.push(parseFloat(record.value).toFixed(2));
                    });
                }
            }

            const result = {
                name: host.name,
                ip: host.interfaces[0]?.ip || '-',
                os: osItem?.lastvalue || '-',
                uptime: uptimeItem?.lastvalue || 0,
                cpuCores: cpuCoresItem?.lastvalue || '-',
                memoryTotal: this.formatMemorySize(memoryTotalItem?.lastvalue) || '-',
                history: history,
                cpuItemId: cpuItem?.itemid,
                memoryItemId: memoryItem?.itemid,
            };

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
        if (!bytes) return '-';
        
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
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
        if (days > 0) result += `${days}${i18n.t('time.days')} `;
        if (hours > 0) result += `${hours}${i18n.t('time.hours')} `;
        if (minutes > 0) result += `${minutes}${i18n.t('time.minutes')}`;
        return result.trim() || i18n.t('time.lessThanOneMinute');
    }

    getAvailabilityText(available) {
        switch (available) {
            case '0': return '未知';
            case '1': return '可用';
            case '2': return '不可用';
            default: return '未知';
        }
    }

    async getHostGroups() {
        try {
            const hostGroups = await this.request('hostgroup.get', {
                output: ['groupid', 'name'],
                real_hosts: true,  // 只获取包含真实主机的组
                selectHosts: ['hostid', 'name', 'status'],  // 选择主机信息
            });
            return hostGroups;
        } catch (error) {
            console.error('Failed to get host groups:', error);
            throw error;
        }
    }

    async getHostsWithStatus() {
        try {
            const hosts = await this.request('host.get', {
                output: ['hostid', 'host', 'name', 'status', 'available'],
                selectInterfaces: ['interfaceid', 'ip', 'dns', 'port', 'type', 'main', 'available'],
                selectGroups: ['groupid', 'name'],
                selectTriggers: ['triggerid', 'description', 'priority', 'value'],
                // 不过滤状态，获取所有主机
            });

            // 获取每个主机的活动问题
            const hostProblemsMap = {};
            for (const host of hosts) {
                try {
                    const problems = await this.request('problem.get', {
                        output: ['eventid', 'severity'],
                        hostids: [host.hostid],
                        recent: true,
                        suppressed: false
                    });
                    hostProblemsMap[host.hostid] = problems.length;
                } catch (error) {
                    console.warn(`Failed to get problems for host ${host.hostid}:`, error);
                    hostProblemsMap[host.hostid] = 0;
                }
            }

            return hosts.map(host => {
                // 分析接口可用性
                const interfaces = host.interfaces || [];
                const agentInterface = interfaces.find(iface => iface.type === '1'); // Zabbix agent
                const snmpInterface = interfaces.find(iface => iface.type === '2');  // SNMP
                const ipmiInterface = interfaces.find(iface => iface.type === '3');  // IPMI
                const jmxInterface = interfaces.find(iface => iface.type === '4');   // JMX
                
                // 判断主要接口的可用性
                // available: 0=未知, 1=可用, 2=不可用
                let isAvailable = true;
                let unavailableInterfaces = [];
                let unknownInterfaces = [];
                
                if (agentInterface) {
                    if (agentInterface.available === '2') {
                        isAvailable = false;
                        unavailableInterfaces.push('Zabbix agent');
                    } else if (agentInterface.available === '0') {
                        unknownInterfaces.push('Zabbix agent');
                    }
                }
                
                if (snmpInterface) {
                    if (snmpInterface.available === '2') {
                        isAvailable = false;
                        unavailableInterfaces.push('SNMP');
                    } else if (snmpInterface.available === '0') {
                        unknownInterfaces.push('SNMP');
                    }
                }
                
                if (ipmiInterface) {
                    if (ipmiInterface.available === '2') {
                        isAvailable = false;
                        unavailableInterfaces.push('IPMI');
                    } else if (ipmiInterface.available === '0') {
                        unknownInterfaces.push('IPMI');
                    }
                }
                
                if (jmxInterface) {
                    if (jmxInterface.available === '2') {
                        isAvailable = false;
                        unavailableInterfaces.push('JMX');
                    } else if (jmxInterface.available === '0') {
                        unknownInterfaces.push('JMX');
                    }
                }
                
                // 如果没有主要接口，但主机是启用状态，也认为有问题
                if (interfaces.length === 0 && host.status === '0') {
                    isAvailable = false;
                    unavailableInterfaces.push('无接口');
                }

                // 只有当接口状态为"不可用"(2)时才认为是监控失效
                // "未知"(0)状态不算作监控失效

                return {
                    ...host,
                    problemCount: hostProblemsMap[host.hostid] || 0,
                    isEnabled: host.status === '0',  // 0=启用, 1=禁用
                    isAvailable: isAvailable,        // 只有当接口状态为不可用(2)时才为false
                    unavailableInterfaces: unavailableInterfaces,
                    unknownInterfaces: unknownInterfaces,
                    interfaces: interfaces,
                    groups: host.groups || [],
                    // 详细的接口状态
                    interfaceStatus: {
                        agent: agentInterface ? {
                            available: agentInterface.available,
                            availableText: this.getAvailabilityText(agentInterface.available),
                            ip: agentInterface.ip,
                            port: agentInterface.port
                        } : null,
                        snmp: snmpInterface ? {
                            available: snmpInterface.available,
                            availableText: this.getAvailabilityText(snmpInterface.available),
                            ip: snmpInterface.ip,
                            port: snmpInterface.port
                        } : null,
                        ipmi: ipmiInterface ? {
                            available: ipmiInterface.available,
                            availableText: this.getAvailabilityText(ipmiInterface.available),
                            ip: ipmiInterface.ip,
                            port: ipmiInterface.port
                        } : null,
                        jmx: jmxInterface ? {
                            available: jmxInterface.available,
                            availableText: this.getAvailabilityText(jmxInterface.available),
                            ip: jmxInterface.ip,
                            port: jmxInterface.port
                        } : null
                    }
                };
            });
        } catch (error) {
            console.error('Failed to get hosts with status:', error);
            throw error;
        }
    }

    async getProblemsStatistics() {
        try {
            // 第一步：获取活动问题的基础信息
            const activeProblems = await this.request('problem.get', {
                output: ['eventid', 'objectid', 'clock', 'r_eventid', 'severity', 'name'],
                recent: true,
                suppressed: false
            });

            if (activeProblems.length === 0) {
                // 如果没有活动问题，直接返回
                const resolvedEvents = await this.request('event.get', {
                    output: ['eventid', 'clock', 'value'],
                    source: 0,
                    object: 0,
                    value: 0,
                    time_from: Math.floor(Date.now() / 1000) - 24 * 60 * 60,
                    sortfield: 'clock',
                    sortorder: 'DESC'
                });

                return {
                    activeProblemsCount: 0,
                    resolvedProblemsCount: resolvedEvents.length,
                    totalProblemsToday: resolvedEvents.length,
                    activeProblems: [],
                    resolvedProblems: resolvedEvents
                };
            }

            // 第二步：批量获取触发器信息
            const triggerIds = activeProblems.map(problem => problem.objectid);
            const triggers = await this.request('trigger.get', {
                output: ['triggerid', 'description', 'expression'],
                triggerids: triggerIds,
                selectHosts: ['hostid', 'name', 'host']
            });

            // 第三步：获取所有相关主机的接口信息
            const hostIds = [...new Set(triggers.flatMap(trigger => 
                trigger.hosts ? trigger.hosts.map(host => host.hostid) : []
            ))];

            let hostInterfaces = [];
            if (hostIds.length > 0) {
                hostInterfaces = await this.request('hostinterface.get', {
                    output: ['hostid', 'ip', 'dns', 'main'],
                    hostids: hostIds,
                    filter: { main: 1 }
                });
            }

            // 第四步：创建查找映射以提高性能
            const triggerMap = new Map(triggers.map(trigger => [trigger.triggerid, trigger]));
            const interfaceMap = new Map(hostInterfaces.map(iface => [iface.hostid, iface]));

            // 第五步：组合数据
            const enrichedActiveProblems = activeProblems.map(problem => {
                const trigger = triggerMap.get(problem.objectid);
                const host = trigger && trigger.hosts && trigger.hosts[0];
                const hostInterface = host ? interfaceMap.get(host.hostid) : null;

                return {
                    ...problem,
                    hostName: host ? (host.name || host.host) : '未知主机',
                    hostIp: hostInterface ? (hostInterface.ip || hostInterface.dns) : '--',
                    name: problem.name || (trigger ? trigger.description : '未知问题')
                };
            });

            // 第六步：获取最近24小时已解决的事件
            const resolvedEvents = await this.request('event.get', {
                output: ['eventid', 'clock', 'value'],
                source: 0,  // 触发器事件
                object: 0,  // 触发器对象
                value: 0,   // 恢复状态（0=OK, 1=PROBLEM）
                time_from: Math.floor(Date.now() / 1000) - 24 * 60 * 60, // 最近24小时
                sortfield: 'clock',
                sortorder: 'DESC'
            });

            const resolvedProblemsCount = resolvedEvents.length;

            console.log('Problems statistics debug:', {
                activeProblemsCount: enrichedActiveProblems.length,
                resolvedEventsCount: resolvedEvents.length,
                sampleActiveProblems: enrichedActiveProblems.slice(0, 3), // 显示前3个活动问题
                resolvedEvents: resolvedEvents.slice(0, 3)  // 显示前3个恢复事件
            });

            return {
                activeProblemsCount: enrichedActiveProblems.length,
                resolvedProblemsCount: resolvedProblemsCount,
                totalProblemsToday: enrichedActiveProblems.length + resolvedProblemsCount,
                activeProblems: enrichedActiveProblems,
                resolvedProblems: resolvedEvents
            };
        } catch (error) {
            console.error('Failed to get problems statistics:', error);
            throw error;
        }
    }
} 