class ZabbixDashboard {
    constructor() {
        this.init();
        this.charts = {};
        this.refreshTimer = null;
    }

    async init() {
        const settings = await this.getSettings();
        if (!settings.apiUrl || !settings.apiToken) {
            document.getElementById('settingsBtn').click();
            return;
        }
        
        await this.loadDashboard();
        // 使用设置的刷新间隔
        const interval = parseInt(settings.refreshInterval) || 300000;  // 默认5分钟
        this.refreshTimer = setInterval(() => this.loadDashboard(), interval);
    }

    async loadDashboard() {
        const settings = await this.getSettings();
        const api = new ZabbixAPI(settings.apiUrl, atob(settings.apiToken));

        try {
            // 更新最后刷新时间
            this.updateLastRefreshTime();

            // 加载统计数据
            const [hosts, switches, alerts] = await Promise.all([
                api.getHosts(),
                api.getSwitches(),
                api.getAlerts()
            ]);

            // 更新统计卡片
            document.getElementById('hostCount').textContent = hosts.length;
            document.getElementById('switchCount').textContent = switches.length;
            document.getElementById('alertCount').textContent = alerts.length;

            // 更新图表
            await this.updateCharts(api);
            // 更新告警历史
            const history = await api.getAlertHistory();
            this.updateAlertsList(history);
        } catch (error) {
            console.error('加载数据失败:', error);
        }
    }

    async updateCharts(api) {
        // 更新趋势图
        const trendData = await api.getAlertTrend();
        this.charts.trend = Charts.initTrendChart(
            document.getElementById('trendChart'),
            trendData
        );

        // 更新严重程度分布图
        const severityData = await api.getAlertSeverity();
        this.charts.severity = Charts.initSeverityChart(
            document.getElementById('severityChart'),
            severityData
        );

        // 更新告警列表
        const alerts = await api.getAlerts();
        this.updateAlertsList(alerts);
    }

    updateAlertsList(alerts) {
        const tbody = document.getElementById('alertsList');
        console.log(alerts)
        tbody.innerHTML = alerts.map(alert => `
            <tr>
                <td>${alert.hosts?.[0]?.name || '未知主机'}</td>
                <td>${alert.name}</td>
                <td><span class="severity-tag ${this.getSeverityClass(alert.severity)}">${this.getSeverityName(alert.severity)}</span></td>
                <td><span class="status-tag ${this.getAckClass(alert.acknowledged)}">${this.getAckName(alert.acknowledged)}</span></td>
                <td>${this.formatTime(alert.clock)}</td>
            </tr>
        `).join('');
    }

    getSeverityClass(severity) {
        const classes = {
            '5': 'disaster',
            '4': 'high',
            '3': 'warning',
            '2': 'warning',
            '1': 'info',
            '0': 'info'
        };
        return classes[severity] || 'info';
    }

    getSeverityName(severity) {
        const names = {
            '5': '灾难',
            '4': '严重',
            '3': '一般严重',
            '2': '警告',
            '1': '信息',
            '0': '未分类'
        };
        return names[severity] || '未知';
    }

    formatTime(timestamp) {
        return new Date(timestamp * 1000).toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    getAckClass(acknowledged) {
        return acknowledged === '1' ? 'acknowledged' : 'unacknowledged';
    }

    getAckName(acknowledged) {
        return acknowledged === '1' ? '已确认' : '未确认';
    }

    async getSettings() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['apiUrl', 'apiToken', 'refreshInterval'], (result) => {
                resolve(result);
            });
        });
    }

    updateLastRefreshTime() {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        document.getElementById('lastRefreshTime').textContent = timeStr;
    }
}

// 初始化应用
new ZabbixDashboard(); 