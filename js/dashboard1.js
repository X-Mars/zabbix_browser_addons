class DashboardScreen {
    constructor() {
        this.charts = {};
        this.data = {
            hosts: [],
            alerts: [],
            hostGroups: [],
            problemsStats: null
        };
        this.refreshInterval = null;
    }

    async getSettings() {
        return new Promise((resolve, reject) => {
            chrome.storage.sync.get(['apiUrl', 'apiToken', 'refreshInterval', 'zabbixVersion'], (result) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(result);
                }
            });
        });
    }

    async initialize() {
        // 应用国际化
        this.applyI18n();
        
        await this.fetchData();
        this.initializeCharts();
        await this.startAutoRefresh();
        this.initWindowResize();
        // 初始化时显示首次加载时间
        this.updateLastRefreshTime();
    }

    // 应用国际化
    applyI18n() {
        document.title = i18n.t('pageTitle.screen1');
        
        // 查找所有带有 data-i18n 属性的元素并应用翻译
        const elementsToTranslate = document.querySelectorAll('[data-i18n]');
        elementsToTranslate.forEach(element => {
            const key = element.getAttribute('data-i18n');
            if (key) {
                if (element.tagName === 'INPUT' && element.type === 'submit') {
                    element.value = i18n.t(key);
                } else {
                    element.textContent = i18n.t(key);
                }
            }
        });
    }

    initWindowResize() {
        // 窗口大小改变时重绘所有图表
        window.addEventListener('resize', () => {
            Object.values(this.charts).forEach(chart => {
                if (chart && typeof chart.resize === 'function') {
                    chart.resize();
                }
            });
        });
    }

    async fetchData() {
        console.log(`[${new Date().toLocaleTimeString()}] Fetching dashboard data...`);
        try {
            // 获取设置并创建 API 实例
            const settings = await this.getSettings();
            if (!settings.apiUrl || !settings.apiToken) {
                console.error(i18n.t('errors.incompleteApiConfig'));
                return;
            }
            
            const api = new ZabbixAPI(settings.apiUrl, atob(settings.apiToken), settings.zabbixVersion);
            
            // 批量获取所需数据
            const [hostsData, hostGroupsData, problemsStats] = await Promise.all([
                api.getHostsWithStatus(),
                api.getHostGroups(),
                api.getProblemsStatistics()
            ]);

            this.data.hosts = hostsData;
            this.data.hostGroups = hostGroupsData;
            if (!problemsStats) {
                console.warn('getProblemsStatistics returned undefined, falling back to empty problems data');
                this.data.alerts = [];
                this.data.problemsStats = {
                    activeProblemsCount: 0,
                    resolvedProblemsCount: 0,
                    totalProblemsToday: 0,
                    activeProblems: [],
                    resolvedProblems: []
                };
            } else {
                this.data.alerts = problemsStats.activeProblems || [];
                this.data.problemsStats = problemsStats;
            }

            this.updateDataCards();
            // 更新最后刷新时间
            this.updateLastRefreshTime();
        } catch (error) {
            console.error('Failed to fetch dashboard data:', error);
            // 如果新API失败，回退到原来的方式
            try {
                const settings = await this.getSettings();
                if (settings.apiUrl && settings.apiToken) {
                    const api = new ZabbixAPI(settings.apiUrl, atob(settings.apiToken), settings.zabbixVersion);
                    const [hostsData, alertsData] = await Promise.all([
                        api.getHosts(),
                        api.getAlerts()
                    ]);
                    this.data.hosts = hostsData;
                    this.data.alerts = alertsData;
                    this.data.hostGroups = [];
                    this.updateDataCards();
                    // 更新最后刷新时间
                    this.updateLastRefreshTime();
                }
            } catch (fallbackError) {
                console.error('Fallback API also failed:', fallbackError);
            }
        }
    }

    updateDataCards() {
        // 更新数据卡片
        const totalHosts = this.data.hosts.length;
        
        // 告警中的主机：有活动问题的主机
        const alertingHosts = this.data.hosts.filter(h => h.problemCount > 0).length;
        
        const hostGroupsCount = this.data.hostGroups.length;
        
        // 使用问题统计数据
        const resolvedProblems = this.data.problemsStats ? this.data.problemsStats.resolvedProblemsCount : 0;
        
        document.getElementById('totalHosts').textContent = totalHosts;
        document.getElementById('unavailableHosts').textContent = alertingHosts; // 告警中的主机
        document.getElementById('hostGroups').textContent = hostGroupsCount;
        document.getElementById('resolvedAlerts').textContent = resolvedProblems;
        
        // 更新所有图表
        this.updateCharts();
        
        // 记录调试信息，包含告警主机详情
        const alertingHostsDetails = this.data.hosts
            .filter(h => h.problemCount > 0)
            .map(h => ({
                name: h.name || h.host,
                problemCount: h.problemCount,
                isEnabled: h.isEnabled,
                groups: h.groups ? h.groups.map(g => g.name) : []
            }));
        
        console.log('Dashboard data update:', {
            totalHosts,
            alertingHosts,
            hostGroupsCount,
            resolvedProblems,
            alertingHostsDetails // 显示告警中主机的详细信息
        });
    }

    updateCharts() {
        // 更新所有图表的数据
        try {
            if (this.charts.alertSeverity) {
                const severityCounts = this.calculateSeverityCounts();
                this.charts.alertSeverity.setOption({
                    legend: {
                        show: false
                    },
                    series: [{
                        data: [
                            { value: severityCounts.disaster, name: i18n.t('severity.disaster'), itemStyle: { color: '#ff4d4f' } },
                            { value: severityCounts.high, name: i18n.t('severity.high'), itemStyle: { color: '#ff7a45' } },
                            { value: severityCounts.average, name: i18n.t('severity.average'), itemStyle: { color: '#ffa940' } },
                            { value: severityCounts.warning, name: i18n.t('severity.warning'), itemStyle: { color: '#ffc53d' } },
                            { value: severityCounts.information, name: i18n.t('severity.information'), itemStyle: { color: '#73d13d' } }
                        ]
                    }]
                });
            }

            if (this.charts.weeklyAlertTrend) {
                this.updateWeeklyAlertTrendChart();
            }

            if (this.charts.monitorStatus) {
                this.updateMonitorStatusChart();
            }

            // alertDistribution chart removed

            // 更新待处理告警表格
            this.initPendingAlertTable();
        } catch (error) {
            console.error('Failed to update charts:', error);
        }
    }

    updateWeeklyAlertTrendChart() {
        const now = Date.now();
        const timeSlots = [];
        const totalAlertCounts = [];
        const activeAlertCounts = [];
        const resolvedAlertCounts = [];
        
        for (let i = 6; i >= 0; i--) {
            const slotTime = new Date(now - i * 24 * 60 * 60 * 1000);
            const slotStart = slotTime.getTime() / 1000;
            const slotEnd = slotStart + 24 * 60 * 60;
            
            // 统计活动告警数量（现在this.data.alerts只包含活动问题）
            const activeAlertsInSlot = this.data.alerts.filter(alert => {
                const alertTime = parseInt(alert.clock);
                return alertTime >= slotStart && alertTime < slotEnd;
            }).length;
            
            // 统计已恢复告警数量（从resolvedProblems中获取）
            const resolvedAlertsInSlot = this.data.problemsStats?.resolvedProblems ? 
                this.data.problemsStats.resolvedProblems.filter(event => {
                    const eventTime = parseInt(event.clock);
                    return eventTime >= slotStart && eventTime < slotEnd;
                }).length : 0;
            
            // 总告警数量 = 活动告警 + 已恢复告警
            const totalAlertsInSlot = activeAlertsInSlot + resolvedAlertsInSlot;
            
            timeSlots.push(slotTime.toLocaleDateString(i18n.currentLang === 'zh' ? 'zh-CN' : 'en-US', { 
                month: '2-digit', 
                day: '2-digit' 
            }));
            totalAlertCounts.push(totalAlertsInSlot);
            activeAlertCounts.push(activeAlertsInSlot);
            resolvedAlertCounts.push(resolvedAlertsInSlot);
        }

        this.charts.weeklyAlertTrend.setOption({
            xAxis: {
                data: timeSlots
            },
            series: [
                {
                    name: i18n.t('dashboard1.chartSeries.totalAlerts'),
                    data: totalAlertCounts
                },
                {
                    name: i18n.t('dashboard1.chartSeries.activeAlerts'),
                    data: activeAlertCounts
                },
                {
                    name: i18n.t('dashboard1.chartSeries.resolvedAlerts'),
                    data: resolvedAlertCounts
                }
            ]
        });
    }

    updateMonitorStatusChart() {
        const normalHosts = this.data.hosts.filter(h => h.isEnabled && h.problemCount === 0).length;
        const problemHosts = this.data.hosts.filter(h => h.problemCount > 0).length;
        const disabledHosts = this.data.hosts.filter(h => !h.isEnabled).length;

        this.charts.monitorStatus.setOption({
            series: [{
                data: [
                    { value: normalHosts, name: i18n.t('dashboard1.monitorStatus.normal'), itemStyle: { color: '#52c41a' } },
                    { value: problemHosts, name: i18n.t('dashboard1.monitorStatus.problem'), itemStyle: { color: '#ff4d4f' } },
                    { value: disabledHosts, name: i18n.t('dashboard1.monitorStatus.disabled'), itemStyle: { color: '#8c8c8c' } }
                ].filter(item => item.value > 0)
            }]
        });
    }

    // alertDistribution chart removed

    initializeCharts() {
        // 初始化所有图表，添加错误处理
        try {
            this.initAlertSeverityChart();
        } catch (error) {
            console.error('Failed to initialize alert severity chart:', error);
        }
        
        try {
            this.initWeeklyAlertTrendChart();
        } catch (error) {
            console.error('Failed to initialize weekly alert trend chart:', error);
        }
        
        try {
            this.initMonitorStatusChart();
        } catch (error) {
            console.error('Failed to initialize monitor status chart:', error);
        }
        
        try {
            this.initPendingAlertTable();
        } catch (error) {
            console.error('Failed to initialize pending alert table:', error);
        }
        
        // alertDistribution chart removed
    }

    initAlertSeverityChart() {
        const severityCounts = this.calculateSeverityCounts();
        this.charts.alertSeverity = echarts.init(document.getElementById('alertSeverityChart'));
        
        this.charts.alertSeverity.setOption({
            title: {
                // text: '告警严重性分类',
                textStyle: { color: '#fff' }
            },
            tooltip: {
                trigger: 'item',
                formatter: '{a} <br/>{b} : {c} ({d}%)'
            },
            legend: {
                show: false
            },
            series: [{
                type: 'pie',
                radius: ['50%', '70%'],
                data: [
                    { value: severityCounts.disaster, name: i18n.t('dashboard1.severity.disaster'), itemStyle: { color: '#ff4d4f' } },
                    { value: severityCounts.high, name: i18n.t('dashboard1.severity.high'), itemStyle: { color: '#ff7a45' } },
                    { value: severityCounts.average, name: i18n.t('dashboard1.severity.average'), itemStyle: { color: '#ffa940' } },
                    { value: severityCounts.warning, name: i18n.t('dashboard1.severity.warning'), itemStyle: { color: '#ffc53d' } },
                    { value: severityCounts.information, name: i18n.t('dashboard1.severity.information'), itemStyle: { color: '#73d13d' } }
                ],
                label: {
                    show: true,
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 'bold',
                    formatter: '{b}: {c}'
                },
                labelLine: {
                    show: true,
                    lineStyle: {
                        color: '#fff'
                    }
                },
                emphasis: {
                    label: {
                        show: true,
                        fontSize: 14,
                        fontWeight: 'bold'
                    }
                }
            }]
        });
    }

    initWeeklyAlertTrendChart() {
        const chartContainer = document.getElementById('weeklyAlertTrendChart');
        if (!chartContainer) return;
        
        this.charts.weeklyAlertTrend = echarts.init(chartContainer);
        
        // 生成过去7天的数据
        const now = Date.now();
        const timeSlots = [];
        const totalAlertCounts = [];
        const activeAlertCounts = [];
        const resolvedAlertCounts = [];
        
        for (let i = 6; i >= 0; i--) {
            const slotTime = new Date(now - i * 24 * 60 * 60 * 1000);
            const slotStart = slotTime.getTime() / 1000;
            const slotEnd = slotStart + 24 * 60 * 60; // 24小时
            
            // 统计活动告警数量（现在this.data.alerts只包含活动问题）
            const activeAlertsInSlot = this.data.alerts.filter(alert => {
                const alertTime = parseInt(alert.clock);
                return alertTime >= slotStart && alertTime < slotEnd;
            }).length;
            
            // 统计已恢复告警数量（从resolvedProblems中获取）
            const resolvedAlertsInSlot = this.data.problemsStats?.resolvedProblems ? 
                this.data.problemsStats.resolvedProblems.filter(event => {
                    const eventTime = parseInt(event.clock);
                    return eventTime >= slotStart && eventTime < slotEnd;
                }).length : 0;
            
            // 总告警数量 = 活动告警 + 已恢复告警
            const totalAlertsInSlot = activeAlertsInSlot + resolvedAlertsInSlot;
            
            timeSlots.push(slotTime.toLocaleDateString(i18n.currentLang === 'zh' ? 'zh-CN' : 'en-US', { 
                month: '2-digit', 
                day: '2-digit' 
            }));
            totalAlertCounts.push(totalAlertsInSlot);
            activeAlertCounts.push(activeAlertsInSlot);
            resolvedAlertCounts.push(resolvedAlertsInSlot);
        }

        this.charts.weeklyAlertTrend.setOption({
            title: {
                textStyle: { color: '#fff' }
            },
            tooltip: {
                trigger: 'axis',
                backgroundColor: 'rgba(15, 25, 38, 0.9)',
                borderColor: 'rgba(0, 168, 255, 0.5)',
                textStyle: { color: '#fff' },
                formatter: function(params) {
                    let result = `${params[0].name}<br/>`;
                    params.forEach(param => {
                        result += `<span style="color:${param.color}">●</span> ${param.seriesName}: ${param.value}<br/>`;
                    });
                    return result;
                }
            },
            legend: {
                data: [i18n.t('dashboard1.chartSeries.totalAlerts'), i18n.t('dashboard1.chartSeries.activeAlerts'), i18n.t('dashboard1.chartSeries.resolvedAlerts')],
                textStyle: { color: '#fff' },
                top: '8%'
            },
            xAxis: {
                type: 'category',
                data: timeSlots,
                axisLabel: { 
                    color: '#fff'
                },
                axisLine: { lineStyle: { color: '#fff' } }
            },
            yAxis: {
                type: 'value',
                axisLabel: { color: '#fff' },
                axisLine: { lineStyle: { color: '#fff' } },
                splitLine: { lineStyle: { color: '#333' } }
            },
            series: [
                {
                    name: i18n.t('dashboard1.chartSeries.totalAlerts'),
                    data: totalAlertCounts,
                    type: 'line',
                    smooth: true,
                    lineStyle: { 
                        color: '#00a8ff',
                        width: 3
                    },
                    itemStyle: { color: '#00a8ff' },
                    symbol: 'circle',
                    symbolSize: 6
                },
                {
                    name: i18n.t('dashboard1.chartSeries.activeAlerts'),
                    data: activeAlertCounts,
                    type: 'line',
                    smooth: true,
                    lineStyle: { 
                        color: '#ff7875',
                        width: 3
                    },
                    itemStyle: { color: '#ff4d4f' },
                    symbol: 'circle',
                    symbolSize: 6
                },
                {
                    name: i18n.t('dashboard1.chartSeries.resolvedAlerts'),
                    data: resolvedAlertCounts,
                    type: 'line',
                    smooth: true,
                    lineStyle: { 
                        color: '#73d13d',
                        width: 3
                    },
                    itemStyle: { color: '#52c41a' },
                    symbol: 'circle',
                    symbolSize: 6
                }
            ]
        });
    }

    initMonitorStatusChart() {
        const chartContainer = document.getElementById('monitorStatusChart');
        if (!chartContainer) return;
        
        this.charts.monitorStatus = echarts.init(chartContainer);
        
        // 监控状态统计 - 基于告警状态
        const normalHosts = this.data.hosts.filter(h => h.isEnabled && h.problemCount === 0).length;
        const problemHosts = this.data.hosts.filter(h => h.problemCount > 0).length;
        const disabledHosts = this.data.hosts.filter(h => !h.isEnabled).length;

        this.charts.monitorStatus.setOption({
            title: {
                // text: '监控状态概览',
                textStyle: { color: '#fff' }
            },
            tooltip: {
                trigger: 'item',
                formatter: function(params) {
                    return i18n.t('dashboard1.tooltip.hostCount')
                        .replace('{name}', params.name)
                        .replace('{value}', params.value)
                        .replace('{percent}', params.percent);
                }
            },
            legend: {
                show: false
            },
            series: [{
                type: 'pie',
                radius: ['40%', '70%'],
                center: ['50%', '45%'],
                data: [
                    { value: normalHosts, name: i18n.t('dashboard1.monitorStatus.normal'), itemStyle: { color: '#52c41a' } },
                    { value: problemHosts, name: i18n.t('dashboard1.monitorStatus.problem'), itemStyle: { color: '#ff4d4f' } },
                    { value: disabledHosts, name: i18n.t('dashboard1.monitorStatus.disabled'), itemStyle: { color: '#8c8c8c' } }
                ].filter(item => item.value > 0), // 只显示有数据的项
                label: {
                    color: '#fff',
                    formatter: '{b}: {c}' + i18n.t('dashboard1.units.hosts')
                }
            }]
        });
    }

    initPendingAlertTable() {
        const tableBody = document.getElementById('pendingAlertsBody');
        const alertCountElement = document.getElementById('alertCount');
        if (!tableBody) return;
        
        // 清空现有内容
        tableBody.innerHTML = '';
        
        // 获取最新的活动告警，限制显示前10条
        const recentAlerts = this.data.alerts
            .sort((a, b) => parseInt(b.clock) - parseInt(a.clock))
            .slice(0, 10);
        
        // 更新告警计数
        if (alertCountElement) {
            alertCountElement.textContent = this.data.alerts.length;
        }
        
        if (recentAlerts.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 40px; color: #8b9898; font-size: 14px;">
                        <i class="fas fa-check-circle" style="font-size: 24px; margin-bottom: 8px; display: block; color: #52c41a;"></i>
                        ${i18n.t('dashboard1.noData.noPendingAlerts')}
                    </td>
                </tr>
            `;
            return;
        }
        
        recentAlerts.forEach(alert => {
            const alertTime = new Date(parseInt(alert.clock) * 1000);
            const now = new Date();
            const timeDiff = Math.floor((now - alertTime) / (1000 * 60)); // 分钟差
            
            let timeText = '';
            if (timeDiff < 60) {
                timeText = i18n.t('dashboard1.timeFormat.minutesAgo').replace('{minutes}', timeDiff);
            } else if (timeDiff < 1440) {
                timeText = i18n.t('dashboard1.timeFormat.hoursAgo').replace('{hours}', Math.floor(timeDiff / 60));
            } else {
                timeText = i18n.t('dashboard1.timeFormat.daysAgo').replace('{days}', Math.floor(timeDiff / 1440));
            }
            
            // 获取严重性文本和颜色
            const getSeverityInfo = (severity) => {
                switch(severity) {
                    case '5': return { text: i18n.t('dashboard1.severity.disaster'), color: '#ff4d4f', icon: 'fas fa-skull' };
                    case '4': return { text: i18n.t('dashboard1.severity.high'), color: '#ff7a45', icon: 'fas fa-exclamation-triangle' };
                    case '3': return { text: i18n.t('dashboard1.severity.average'), color: '#ffa940', icon: 'fas fa-exclamation-circle' };
                    case '2': return { text: i18n.t('dashboard1.severity.warning'), color: '#ffc53d', icon: 'fas fa-exclamation' };
                    case '1': return { text: i18n.t('dashboard1.severity.information'), color: '#73d13d', icon: 'fas fa-info-circle' };
                    default: return { text: i18n.t('dashboard1.severity.unknown'), color: '#8c8c8c', icon: 'fas fa-question-circle' };
                }
            };
            
            const severityInfo = getSeverityInfo(alert.severity);
            
            // 使用新的数据结构获取主机信息
            const hostName = alert.hostName || i18n.t('dashboard1.unknownData.unknownHost');
            const hostIp = alert.hostIp || '--';
            const problemName = alert.name || i18n.t('dashboard1.unknownData.unknownProblem');
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td style="color: #a0aec0; font-size: 12px;">${alertTime.toLocaleString(i18n.currentLang === 'zh' ? 'zh-CN' : 'en-US', {
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                })}</td>
                <td style="color: #ffffff; font-family: 'Courier New', monospace; font-size: 12px;">${hostIp}</td>
                <td style="color: #ffffff; font-weight: 500; font-size: 12px;">${hostName}</td>
                <td style="color: #ffffff; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px;" title="${problemName}">${problemName}</td>
                <td>
                    <span style="
                        display: inline-flex;
                        align-items: center;
                        gap: 4px;
                        padding: 4px 8px;
                        border-radius: 12px;
                        font-size: 10px;
                        font-weight: 600;
                        color: #ffffff;
                        background: ${severityInfo.color};
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    ">
                        <i class="${severityInfo.icon}" style="font-size: 9px;"></i>
                        ${severityInfo.text}
                    </span>
                </td>
                <td style="color: #ffa940; font-weight: 500; font-size: 12px;">${timeText}</td>
            `;
            
            tableBody.appendChild(row);
        });
        
        console.log('Pending alerts table updated:', {
            totalAlerts: this.data.alerts.length,
            displayedAlerts: recentAlerts.length,
            sampleAlert: recentAlerts[0] // 显示第一个告警的完整数据用于调试
        });
    }

    // alertDistribution chart and its initialization removed

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

    updateLastRefreshTime() {
        // 等待一小段时间确保header已经加载
        setTimeout(() => {
            const now = new Date();
            const timeString = now.toLocaleTimeString(i18n.currentLang === 'zh' ? 'zh-CN' : 'en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            });
            
            // 更新header中的刷新时间
            if (window.headerInstance && typeof window.headerInstance.updateLastRefreshTime === 'function') {
                window.headerInstance.updateLastRefreshTime();
            } else {
                // 如果全局header实例不存在，直接更新DOM元素
                const lastRefreshElement = document.getElementById('lastRefreshTime');
                if (lastRefreshElement) {
                    lastRefreshElement.textContent = i18n.t('dashboard1.lastRefresh').replace('{time}', timeString);
                }
            }
            
            // 更新左上角的刷新时间显示
            const dashboardRefreshTimeElement = document.getElementById('dashboardRefreshTime');
            if (dashboardRefreshTimeElement) {
                const refreshValueElement = dashboardRefreshTimeElement.querySelector('.refresh-value');
                if (refreshValueElement) {
                    refreshValueElement.textContent = timeString;
                }
            }
        }, 100);
    }

    async startAutoRefresh() {
        try {
            const settings = await this.getSettings();
            // 刷新间隔以毫秒为单位保存，默认为30秒
            const refreshIntervalMs = parseInt(settings.refreshInterval, 10) || 30000;
            
            console.log(`Setting auto refresh interval to ${refreshIntervalMs/1000} seconds`);
            
            this.refreshInterval = setInterval(() => {
                console.log('Auto refreshing dashboard data...');
                this.fetchData();
            }, refreshIntervalMs);
        } catch (error) {
            console.error('Failed to start auto refresh:', error);
            // 如果获取设置失败，使用默认30秒间隔
            this.refreshInterval = setInterval(() => {
                console.log('Auto refreshing dashboard data (fallback)...');
                this.fetchData();
            }, 30000);
        }
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
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Initializing dashboard...');
    
    // 等待header加载完成
    let attempts = 0;
    const maxAttempts = 50; // 最多等待5秒
    
    while (!window.headerInstance && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }
    
    const dashboard = new DashboardScreen();
    await dashboard.initialize();
    console.log('Dashboard initialized successfully');
    
    // 将dashboard实例存储到全局，以便全屏管理器访问
    window.dashboardInstance = dashboard;
    
    // 页面卸载时清理资源
    window.addEventListener('beforeunload', () => {
        if (window.dashboardInstance) {
            window.dashboardInstance.destroy();
        }
    });
}); 