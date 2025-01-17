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

    async getSwitches() {
        const hosts = await this.request('host.get', {
            output: ['hostid', 'host', 'name'],
            selectInventory: ['type'],  // 只获取 type 字段
            searchInventory: {  // 使用 searchInventory 而不是 filter
                type: 'Network switch'
            }
        });

        // 过滤掉没有库存信息的主机
        return hosts.filter(host => host.inventory && host.inventory.type === 'Network switch');
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

        const problems = await this.request('problem.get', {
            output: ['clock', 'severity', 'acknowledged', 'name'],
            time_from: weekAgo,
            recent: true,
            sortfield: 'eventid',
            sortorder: 'ASC',
            acknowledged: false
        });

        // 按天分组
        const dailyProblems = problems.reduce((acc, problem) => {
            const date = new Date(problem.clock * 1000).toISOString().split('T')[0];
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
        return await this.request('event.get', {
            output: ['eventid', 'clock', 'name', 'severity', 'acknowledged'],
            selectHosts: ['hostid', 'host', 'name'],
            source: 0,  // 触发器事件
            object: 0,  // 触发器对象
            sortfield: 'eventid',
            sortorder: 'DESC',
            value: 1,   // PROBLEM状态
            suppressed: false,
            limit: 100  // 限制返回数量
        });
    }
} 