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
            console.log(`Sending request to ${method}:`, body);  // 添加日志
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
            console.log(`Response from ${method}:`, data);  // 添加日志
            
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
            console.log('Zabbix API version:', version);

            // 再测试认证
            const hosts = await this.request('host.get', {
                countOutput: true,
                limit: 1
            });
            console.log('Connection test successful');
            return true;
        } catch (error) {
            console.error('Connection test failed:', error);
            throw new Error('连接失败：' + error.message);
        }
    }

    async getHosts() {
        return await this.request('host.get', {
            output: ['hostid', 'host', 'name', 'status'],
            selectInterfaces: ['ip'],
            filter: {
                status: 0
            }
        });
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
} 