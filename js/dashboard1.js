class DashboardScreen {
    constructor() {
        this.charts = {};
        this.data = {
            hosts: [],
            alerts: [],
            hostGroups: []
        };
        this.refreshInterval = null;
    }

    async initialize() {
        await this.fetchData();
        this.initializeCharts();
        this.startAutoRefresh();
    }

    async fetchData() {
        try {
            // 批量获取所需数据
            const [hostsData, alertsData, hostGroupsData] = await Promise.all([
                api.getHosts(),
                api.getProblems(),
                api.getHostGroups()
            ]);

            this.data.hosts = hostsData;
            this.data.alerts = alertsData;
            this.data.hostGroups = hostGroupsData;

            this.updateDataCards();
        } catch (error) {
            console.error('Failed to fetch dashboard data:', error);
        }
    }

    updateDataCards() {
        // 更新数据卡片
        document.getElementById('totalHosts').textContent = this.data.hosts.length;
        document.getElementById('unavailableHosts').textContent = this.data.hosts.filter(h => h.available === '0').length;
        document.getElementById('unclassifiedHosts').textContent = this.data.hosts.filter(h => !h.groups.length).length;
        document.getElementById('hostGroups').textContent = this.data.hostGroups.length;
        document.getElementById('monitorServers').textContent = '8'; // 从配置获取
        document.getElementById('resolvedAlerts').textContent = this.data.alerts.filter(a => a.r_eventid !== '0').length;
    }

    initializeCharts() {
        // 初始化所有图表
        this.initAlertSeverityChart();
        this.initHostGroupAlertChart();
        this.initMonitorStatusChart();
        this.initAlertTrendChart();
        this.initPendingAlertTable();
        this.initAlertDistributionChart();
    }

    initAlertSeverityChart() {
        const severityCounts = this.calculateSeverityCounts();
        this.charts.alertSeverity = echarts.init(document.getElementById('alertSeverityChart'));
        
        this.charts.alertSeverity.setOption({
            title: {
                text: '告警严重性分类',
                textStyle: { color: '#fff' }
            },
            tooltip: {
                trigger: 'item'
            },
            legend: {
                orient: 'vertical',
                right: 10,
                top: 'center',
                textStyle: { color: '#fff' }
            },
            series: [{
                type: 'pie',
                radius: ['50%', '70%'],
                data: [
                    { value: severityCounts.disaster, name: '灾难', itemStyle: { color: '#ff4d4f' } },
                    { value: severityCounts.high, name: '严重', itemStyle: { color: '#ff7a45' } },
                    { value: severityCounts.average, name: '一般', itemStyle: { color: '#ffa940' } },
                    { value: severityCounts.warning, name: '警告', itemStyle: { color: '#ffc53d' } },
                    { value: severityCounts.information, name: '信息', itemStyle: { color: '#73d13d' } }
                ],
                label: {
                    color: '#fff'
                }
            }]
        });
    }

    // ... 其他图表初始化方法 ...

    calculateSeverityCounts() {
        const counts = {
            disaster: 0,
            high: 0,
            average: 0,
            warning: 0,
            information: 0
        };

        this.data.alerts.forEach(alert => {
            switch (alert.severity) {
                case '5': counts.disaster++; break;
                case '4': counts.high++; break;
                case '3': counts.average++; break;
                case '2': counts.warning++; break;
                case '1': counts.information++; break;
            }
        });

        return counts;
    }

    startAutoRefresh() {
        this.refreshInterval = setInterval(() => {
            this.fetchData();
        }, 60000); // 每分钟刷新一次
    }

    destroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        Object.values(this.charts).forEach(chart => {
            chart.dispose();
        });
    }
}

// 页面加载完成后初始化大屏
document.addEventListener('DOMContentLoaded', () => {
    const dashboard = new DashboardScreen();
    dashboard.initialize();
}); 