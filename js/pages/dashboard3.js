/**
 * Dashboard3 - 综合监控大屏
 * 集成展示主机、告警、资源使用率等综合监控数据
 */
class ComprehensiveDashboard {
    constructor() {
        this.charts = {};
        this.data = {
            hosts: [],
            hostGroups: [],
            alerts: [],
            problemsStats: null
        };
        this.api = null;
        this.refreshInterval = null;
        this.alertScrollTimer = null;
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
        this.applyI18n();
        await this.fetchData();
        this.initializeCharts();
        await this.startAutoRefresh();
        this.initWindowResize();
        this.updateLastRefreshTime();
    }

    applyI18n() {
        document.title = i18n.t('pageTitle.screen3');
        const elements = document.querySelectorAll('[data-i18n]');
        elements.forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (key) {
                el.textContent = i18n.t(key);
            }
        });
    }

    initWindowResize() {
        window.addEventListener('resize', () => {
            Object.values(this.charts).forEach(chart => {
                if (chart && typeof chart.resize === 'function') {
                    chart.resize();
                }
            });
        });
    }

    async fetchData() {
        console.log(`[${new Date().toLocaleTimeString()}] Fetching comprehensive dashboard data...`);
        try {
            const settings = await this.getSettings();
            if (!settings.apiUrl || !settings.apiToken) {
                console.error(i18n.t('errors.incompleteApiConfig'));
                return;
            }

            this.api = new ZabbixAPI(settings.apiUrl, atob(settings.apiToken), settings.zabbixVersion);

            // 并行获取所有数据
            const [hostsData, hostGroupsData, problemsStats] = await Promise.all([
                this.api.getHostsWithStatus(),
                this.api.getHostGroups(),
                this.api.getProblemsStatistics()
            ]);

            this.data.hosts = hostsData;
            this.data.hostGroups = hostGroupsData;

            if (!problemsStats) {
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

            // 获取主机资源数据（CPU/内存）
            await this.fetchResourceData();

            this.updateDataCards();
            this.updateLastRefreshTime();
        } catch (error) {
            console.error('Failed to fetch comprehensive dashboard data:', error);
        }
    }

    async fetchResourceData() {
        if (!this.api || this.data.hosts.length === 0) return;

        try {
            const hostIds = this.data.hosts.map(h => h.hostid);

            // 批量获取 CPU 和内存监控项
            const [cpuItemsMap, memItemsMap] = await Promise.all([
                this.api.getItemsForHosts(hostIds, 'CPU utilization'),
                this.api.getItemsForHosts(hostIds, 'Memory utilization')
            ]);

            // 将资源数据附加到主机对象
            this.data.hosts.forEach(host => {
                const cpuItems = cpuItemsMap[host.hostid];
                const memItems = memItemsMap[host.hostid];
                host.cpuUsage = cpuItems && cpuItems.length > 0 ? parseFloat(cpuItems[0].lastvalue || 0) : null;
                host.memoryUsage = memItems && memItems.length > 0 ? parseFloat(memItems[0].lastvalue || 0) : null;
            });
        } catch (error) {
            console.warn('Failed to fetch resource data:', error);
        }
    }

    updateDataCards() {
        const totalHosts = this.data.hosts.length;
        const activeAlerts = this.data.problemsStats ? this.data.problemsStats.activeProblemsCount : 0;
        const hostGroups = this.data.hostGroups.length;

        // 计算平均 CPU 和内存
        const hostsWithCpu = this.data.hosts.filter(h => h.cpuUsage !== null && h.cpuUsage !== undefined);
        const hostsWithMem = this.data.hosts.filter(h => h.memoryUsage !== null && h.memoryUsage !== undefined);
        const avgCpu = hostsWithCpu.length > 0
            ? (hostsWithCpu.reduce((sum, h) => sum + h.cpuUsage, 0) / hostsWithCpu.length).toFixed(1)
            : '--';
        const avgMemory = hostsWithMem.length > 0
            ? (hostsWithMem.reduce((sum, h) => sum + h.memoryUsage, 0) / hostsWithMem.length).toFixed(1)
            : '--';

        document.getElementById('totalHosts3').textContent = totalHosts;
        document.getElementById('activeAlerts3').textContent = activeAlerts;
        document.getElementById('hostGroups3').textContent = hostGroups;
        document.getElementById('avgCpu3').textContent = avgCpu !== '--' ? avgCpu + '%' : '--';
        document.getElementById('avgMemory3').textContent = avgMemory !== '--' ? avgMemory + '%' : '--';

        // 更新所有图表
        this.updateCharts();
    }

    // ==================== 图表初始化 ====================

    initializeCharts() {
        const chartInits = [
            'initHostGroupHealthChart',
            'initSeverityDistributionChart',
            'initHostStatusGaugeChart',
            'initTopCpuChart',
            'initTopMemoryChart'
        ];
        chartInits.forEach(fn => {
            try { this[fn](); }
            catch (e) { console.error(`Failed to init ${fn}:`, e); }
        });
        // 告警表非 ECharts 图表，单独渲染
        try { this.renderRecentAlerts(); }
        catch (e) { console.error('Failed to render recent alerts:', e); }
    }

    updateCharts() {
        try { this.updateHostGroupHealthChart(); } catch (e) { console.error(e); }
        try { this.updateSeverityDistributionChart(); } catch (e) { console.error(e); }
        try { this.updateHostStatusGaugeChart(); } catch (e) { console.error(e); }
        try { this.updateTopCpuChart(); } catch (e) { console.error(e); }
        try { this.updateTopMemoryChart(); } catch (e) { console.error(e); }
        try { this.renderRecentAlerts(); } catch (e) { console.error(e); }
    }

    // ==================== 主机组健康度 (饼图) ====================

    initHostGroupHealthChart() {
        const el = document.getElementById('hostGroupHealthChart');
        if (!el) return;
        this.charts.hostGroupHealth = echarts.init(el);
        this.updateHostGroupHealthChart();
    }

    updateHostGroupHealthChart() {
        if (!this.charts.hostGroupHealth) return;

        // 将主机按组归类，统计每个组的健康/告警主机数
        const groupMap = {};
        this.data.hostGroups.forEach(group => {
            const groupHosts = group.hosts || [];
            const hostIdsInGroup = new Set(groupHosts.map(h => h.hostid));
            const hostsInGroup = this.data.hosts.filter(h => hostIdsInGroup.has(h.hostid));
            const problemCount = hostsInGroup.filter(h => h.problemCount > 0).length;
            groupMap[group.name] = {
                total: hostsInGroup.length,
                problem: problemCount,
                healthy: hostsInGroup.length - problemCount
            };
        });

        // 取前 8 个组（按问题数降序排列）
        const sortedGroups = Object.entries(groupMap)
            .sort(([, a], [, b]) => b.problem - a.problem)
            .slice(0, 8);

        const themeColor = '#00d4aa';
        const alertColor = '#ff4d4f';

        this.charts.hostGroupHealth.setOption({
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                backgroundColor: 'rgba(10, 30, 30, 0.9)',
                borderColor: 'rgba(0, 212, 170, 0.5)',
                textStyle: { color: '#fff' }
            },
            legend: {
                data: [
                    i18n.t('dashboard3.healthyHosts'),
                    i18n.t('dashboard3.problemHosts')
                ],
                textStyle: { color: '#ccc', fontSize: 11 },
                top: 0,
                right: 10
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '3%',
                top: '15%',
                containLabel: true
            },
            xAxis: {
                type: 'category',
                data: sortedGroups.map(([name]) => name.length > 10 ? name.substring(0, 10) + '...' : name),
                axisLabel: {
                    color: '#aaa',
                    fontSize: 10,
                    rotate: sortedGroups.length > 5 ? 25 : 0
                },
                axisLine: { lineStyle: { color: '#333' } }
            },
            yAxis: {
                type: 'value',
                axisLabel: { color: '#aaa', fontSize: 10 },
                axisLine: { lineStyle: { color: '#333' } },
                splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }
            },
            series: [
                {
                    name: i18n.t('dashboard3.healthyHosts'),
                    type: 'bar',
                    stack: 'total',
                    data: sortedGroups.map(([, v]) => v.healthy),
                    itemStyle: { color: themeColor, borderRadius: [0, 0, 0, 0] },
                    barMaxWidth: 30
                },
                {
                    name: i18n.t('dashboard3.problemHosts'),
                    type: 'bar',
                    stack: 'total',
                    data: sortedGroups.map(([, v]) => v.problem),
                    itemStyle: { color: alertColor, borderRadius: [2, 2, 0, 0] },
                    barMaxWidth: 30
                }
            ]
        });
    }

    // ==================== 告警严重性分布 (环形图) ====================

    initSeverityDistributionChart() {
        const el = document.getElementById('severityDistributionChart');
        if (!el) return;
        this.charts.severityDistribution = echarts.init(el);
        this.updateSeverityDistributionChart();
    }

    updateSeverityDistributionChart() {
        if (!this.charts.severityDistribution) return;

        const counts = { disaster: 0, high: 0, average: 0, warning: 0, information: 0 };
        this.data.alerts.forEach(alert => {
            switch (alert.severity) {
                case '5': counts.disaster++; break;
                case '4': counts.high++; break;
                case '3': counts.average++; break;
                case '2': counts.warning++; break;
                case '1': counts.information++; break;
            }
        });

        const total = Object.values(counts).reduce((a, b) => a + b, 0);

        this.charts.severityDistribution.setOption({
            tooltip: {
                trigger: 'item',
                formatter: '{a} <br/>{b}: {c} ({d}%)',
                backgroundColor: 'rgba(10, 30, 30, 0.9)',
                borderColor: 'rgba(0, 212, 170, 0.5)',
                textStyle: { color: '#fff' }
            },
            legend: { show: false },
            graphic: [{
                type: 'text',
                left: 'center',
                top: 'center',
                style: {
                    text: total > 0 ? total.toString() : '',
                    fontSize: 28,
                    fontWeight: 'bold',
                    fill: '#fff',
                    textAlign: 'center'
                }
            }],
            series: [{
                name: i18n.t('dashboard3.severityDistribution'),
                type: 'pie',
                radius: ['50%', '72%'],
                center: ['50%', '50%'],
                data: [
                    { value: counts.disaster, name: i18n.t('severity.disaster'), itemStyle: { color: '#ff4d4f' } },
                    { value: counts.high, name: i18n.t('severity.high'), itemStyle: { color: '#ff7a45' } },
                    { value: counts.average, name: i18n.t('severity.average'), itemStyle: { color: '#ffa940' } },
                    { value: counts.warning, name: i18n.t('severity.warning'), itemStyle: { color: '#ffc53d' } },
                    { value: counts.information, name: i18n.t('severity.information'), itemStyle: { color: '#73d13d' } }
                ].filter(d => d.value > 0),
                label: {
                    show: true,
                    color: '#ddd',
                    fontSize: 16,
                    formatter: '{b}: {c}'
                },
                labelLine: {
                    lineStyle: { color: '#555' }
                },
                emphasis: {
                    label: { show: true, fontSize: 13, fontWeight: 'bold' }
                }
            }]
        });
    }

    // ==================== 主机健康率 (仪表盘) ====================

    initHostStatusGaugeChart() {
        const el = document.getElementById('hostStatusGaugeChart');
        if (!el) return;
        this.charts.hostStatusGauge = echarts.init(el);
        this.updateHostStatusGaugeChart();
    }

    updateHostStatusGaugeChart() {
        if (!this.charts.hostStatusGauge) return;

        const total = this.data.hosts.length;
        const healthy = this.data.hosts.filter(h => h.isEnabled && h.problemCount === 0).length;
        const rate = total > 0 ? ((healthy / total) * 100).toFixed(1) : 0;

        this.charts.hostStatusGauge.setOption({
            series: [{
                type: 'gauge',
                startAngle: 200,
                endAngle: -20,
                min: 0,
                max: 100,
                pointer: { show: false },
                progress: {
                    show: true,
                    overlap: false,
                    roundCap: true,
                    clip: false,
                    itemStyle: {
                        color: {
                            type: 'linear',
                            x: 0, y: 0, x2: 1, y2: 0,
                            colorStops: [
                                { offset: 0, color: '#ff4d4f' },
                                { offset: 0.5, color: '#faad14' },
                                { offset: 1, color: '#00d4aa' }
                            ]
                        }
                    }
                },
                axisLine: {
                    lineStyle: {
                        width: 16,
                        color: [[1, 'rgba(255,255,255,0.05)']]
                    }
                },
                axisTick: { show: false },
                splitLine: { show: false },
                axisLabel: { show: false },
                detail: {
                    valueAnimation: true,
                    formatter: function(value) {
                        return '{value|' + value + '%}\n{label|' + i18n.t('dashboard3.healthRate') + '}';
                    },
                    rich: {
                        value: {
                            fontSize: 32,
                            fontWeight: 'bold',
                            color: '#fff',
                            padding: [0, 0, 8, 0]
                        },
                        label: {
                            fontSize: 12,
                            color: '#aaa'
                        }
                    },
                    offsetCenter: [0, '10%']
                },
                data: [{ value: parseFloat(rate) }],
                title: { show: false }
            },
            // 底部信息
            {
                type: 'gauge',
                startAngle: 200,
                endAngle: -20,
                min: 0,
                max: 100,
                pointer: { show: false },
                progress: { show: false },
                axisLine: { show: false },
                axisTick: { show: false },
                splitLine: { show: false },
                axisLabel: { show: false },
                detail: {
                    valueAnimation: false,
                    formatter: function() {
                        const problemCount = total - healthy;
                        return '{healthy|' + healthy + '} {healthyLabel|' + i18n.t('dashboard3.healthy') + '}' +
                               '  {problem|' + problemCount + '} {problemLabel|' + i18n.t('dashboard3.problem') + '}';
                    },
                    rich: {
                        healthy: {
                            fontSize: 20,
                            fontWeight: 'bold',
                            color: '#00d4aa'
                        },
                        healthyLabel: {
                            fontSize: 20,
                            color: '#00d4aa'
                        },
                        problem: {
                            fontSize: 20,
                            fontWeight: 'bold',
                            color: '#ff4d4f'
                        },
                        problemLabel: {
                            fontSize: 20,
                            color: '#ff4d4f'
                        }
                    },
                    offsetCenter: [0, '55%']
                },
                data: [{ value: 0 }],
                title: { show: false }
            }]
        });
    }

    // ==================== TOP10 CPU 使用率 (水平柱状图) ====================

    initTopCpuChart() {
        const el = document.getElementById('topCpuChart');
        if (!el) return;
        this.charts.topCpu = echarts.init(el);
        this.updateTopCpuChart();
    }

    updateTopCpuChart() {
        if (!this.charts.topCpu) return;

        const hostsWithCpu = this.data.hosts
            .filter(h => h.cpuUsage !== null && h.cpuUsage !== undefined)
            .sort((a, b) => b.cpuUsage - a.cpuUsage)
            .slice(0, 10)
            .reverse(); // 反转让最高的在上面

        this.charts.topCpu.setOption({
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                backgroundColor: 'rgba(10, 30, 30, 0.9)',
                borderColor: 'rgba(0, 212, 170, 0.5)',
                textStyle: { color: '#fff' },
                formatter: function(params) {
                    const p = params[0];
                    return `${p.name}<br/>CPU: ${p.value.toFixed(1)}%`;
                }
            },
            grid: {
                left: '3%',
                right: '12%',
                bottom: '3%',
                top: '3%',
                containLabel: true
            },
            xAxis: {
                type: 'value',
                max: 100,
                axisLabel: { color: '#aaa', fontSize: 10, formatter: '{value}%' },
                axisLine: { lineStyle: { color: '#333' } },
                splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }
            },
            yAxis: {
                type: 'category',
                data: hostsWithCpu.map(h => {
                    const name = h.name || h.host;
                    return name.length > 14 ? name.substring(0, 14) + '..' : name;
                }),
                axisLabel: { color: '#ccc', fontSize: 10 },
                axisLine: { lineStyle: { color: '#333' } }
            },
            series: [{
                type: 'bar',
                data: hostsWithCpu.map(h => ({
                    value: h.cpuUsage,
                    itemStyle: {
                        color: this.getBarColor(h.cpuUsage)
                    }
                })),
                barMaxWidth: 18,
                label: {
                    show: true,
                    position: 'right',
                    formatter: '{c}%',
                    color: '#ccc',
                    fontSize: 10
                }
            }]
        });
    }

    // ==================== TOP10 内存使用率 (水平柱状图) ====================

    initTopMemoryChart() {
        const el = document.getElementById('topMemoryChart');
        if (!el) return;
        this.charts.topMemory = echarts.init(el);
        this.updateTopMemoryChart();
    }

    updateTopMemoryChart() {
        if (!this.charts.topMemory) return;

        const hostsWithMem = this.data.hosts
            .filter(h => h.memoryUsage !== null && h.memoryUsage !== undefined)
            .sort((a, b) => b.memoryUsage - a.memoryUsage)
            .slice(0, 10)
            .reverse();

        this.charts.topMemory.setOption({
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                backgroundColor: 'rgba(10, 30, 30, 0.9)',
                borderColor: 'rgba(0, 212, 170, 0.5)',
                textStyle: { color: '#fff' },
                formatter: function(params) {
                    const p = params[0];
                    return `${p.name}<br/>${i18n.t('dashboard3.memory')}: ${p.value.toFixed(1)}%`;
                }
            },
            grid: {
                left: '3%',
                right: '12%',
                bottom: '3%',
                top: '3%',
                containLabel: true
            },
            xAxis: {
                type: 'value',
                max: 100,
                axisLabel: { color: '#aaa', fontSize: 10, formatter: '{value}%' },
                axisLine: { lineStyle: { color: '#333' } },
                splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }
            },
            yAxis: {
                type: 'category',
                data: hostsWithMem.map(h => {
                    const name = h.name || h.host;
                    return name.length > 14 ? name.substring(0, 14) + '..' : name;
                }),
                axisLabel: { color: '#ccc', fontSize: 10 },
                axisLine: { lineStyle: { color: '#333' } }
            },
            series: [{
                type: 'bar',
                data: hostsWithMem.map(h => ({
                    value: h.memoryUsage,
                    itemStyle: {
                        color: this.getBarColor(h.memoryUsage, true)
                    }
                })),
                barMaxWidth: 18,
                label: {
                    show: true,
                    position: 'right',
                    formatter: '{c}%',
                    color: '#ccc',
                    fontSize: 10
                }
            }]
        });
    }

    // ==================== 最近告警列表 ====================

    renderRecentAlerts() {
        const container = document.getElementById('recentAlertsList');
        if (!container) return;

        // 停止之前的滚动
        this.stopAlertScroll();

        const recentAlerts = this.data.alerts
            .sort((a, b) => parseInt(b.clock) - parseInt(a.clock))
            .slice(0, 20);

        if (recentAlerts.length === 0) {
            container.innerHTML = `
                <div class="no-alerts-message">
                    <i class="fas fa-check-circle" style="color: #00d4aa;"></i>
                    <span>${i18n.t('dashboard3.noAlerts')}</span>
                </div>
            `;
            return;
        }

        const alertsHTML = recentAlerts.map(alert => {
            const severityClass = this.getSeverityClass(alert.severity);
            const hostName = alert.hostName || i18n.t('dashboard1.unknownData.unknownHost');
            const problemName = alert.name || i18n.t('dashboard1.unknownData.unknownProblem');
            const alertTime = new Date(parseInt(alert.clock) * 1000);
            const timeText = this.formatTimeAgo(alertTime);

            return `
                <div class="alert-item">
                    <div class="alert-severity-dot ${severityClass}"></div>
                    <div class="alert-info">
                        <div class="alert-host" title="${hostName}">${hostName}</div>
                        <div class="alert-message" title="${problemName}">${problemName}</div>
                        <div class="alert-time">${timeText}</div>
                    </div>
                </div>
            `;
        }).join('');

        // 使用双份内容实现无缝循环滚动
        container.innerHTML = `
            <div class="alert-scroll-wrapper">
                <div class="alert-scroll-content">${alertsHTML}</div>
                <div class="alert-scroll-content">${alertsHTML}</div>
            </div>
        `;

        // 启动滚动
        this.startAlertScroll(container);
    }

    startAlertScroll(container) {
        const wrapper = container.querySelector('.alert-scroll-wrapper');
        if (!wrapper) return;

        const firstContent = wrapper.querySelector('.alert-scroll-content');
        if (!firstContent) return;

        let scrollPos = 0;
        const speed = 0.5; // px per frame

        const scroll = () => {
            scrollPos += speed;
            // 当滚动超过第一份内容的高度时，重置位置
            if (scrollPos >= firstContent.offsetHeight) {
                scrollPos = 0;
            }
            wrapper.style.transform = `translateY(-${scrollPos}px)`;
            this.alertScrollTimer = requestAnimationFrame(scroll);
        };

        // 鼠标悬停时暂停滚动
        container.addEventListener('mouseenter', () => {
            if (this.alertScrollTimer) {
                cancelAnimationFrame(this.alertScrollTimer);
                this.alertScrollTimer = null;
            }
        });

        // 鼠标离开时恢复滚动
        container.addEventListener('mouseleave', () => {
            if (!this.alertScrollTimer) {
                this.alertScrollTimer = requestAnimationFrame(scroll);
            }
        });

        this.alertScrollTimer = requestAnimationFrame(scroll);
    }

    stopAlertScroll() {
        if (this.alertScrollTimer) {
            cancelAnimationFrame(this.alertScrollTimer);
            this.alertScrollTimer = null;
        }
    }

    // ==================== 辅助方法 ====================

    getBarColor(value, isMemory = false) {
        if (value >= 90) return '#ff4d4f';
        if (value >= 70) return '#ff7a45';
        if (value >= 50) return '#faad14';
        return isMemory ? '#722ed1' : '#00d4aa';
    }

    getSeverityClass(severity) {
        switch (severity) {
            case '5': return 'disaster';
            case '4': return 'high';
            case '3': return 'average';
            case '2': return 'warning';
            case '1': return 'information';
            default: return 'not-classified';
        }
    }

    formatTimeAgo(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMin = Math.floor(diffMs / (1000 * 60));

        if (diffMin < 60) {
            return i18n.t('dashboard1.timeFormat.minutesAgo').replace('{minutes}', diffMin);
        } else if (diffMin < 1440) {
            return i18n.t('dashboard1.timeFormat.hoursAgo').replace('{hours}', Math.floor(diffMin / 60));
        } else {
            return i18n.t('dashboard1.timeFormat.daysAgo').replace('{days}', Math.floor(diffMin / 1440));
        }
    }

    updateLastRefreshTime() {
        setTimeout(() => {
            const now = new Date();
            const timeString = now.toLocaleTimeString(i18n.currentLang === 'zh' ? 'zh-CN' : 'en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            });

            // 更新 header 刷新时间
            if (window.headerInstance && typeof window.headerInstance.updateLastRefreshTime === 'function') {
                window.headerInstance.updateLastRefreshTime();
            } else {
                const el = document.getElementById('lastRefreshTime');
                if (el) {
                    el.textContent = i18n.t('dashboard3.lastRefreshTime').replace('{time}', timeString);
                }
            }

            // 更新左上角刷新时间
            const refreshEl = document.getElementById('dashboardRefreshTime3');
            if (refreshEl) {
                const valueEl = refreshEl.querySelector('.refresh-value');
                if (valueEl) valueEl.textContent = timeString;
            }
        }, 100);
    }

    async startAutoRefresh() {
        try {
            const settings = await this.getSettings();
            const refreshIntervalMs = parseInt(settings.refreshInterval, 10) || 30000;
            console.log(`Dashboard3 auto refresh: ${refreshIntervalMs / 1000}s`);

            this.refreshInterval = setInterval(() => {
                console.log('Auto refreshing comprehensive dashboard...');
                this.fetchData();
            }, refreshIntervalMs);
        } catch (error) {
            console.error('Failed to start auto refresh:', error);
            this.refreshInterval = setInterval(() => {
                this.fetchData();
            }, 30000);
        }
    }

    destroy() {
        this.stopAlertScroll();
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        Object.values(this.charts).forEach(chart => {
            if (chart && typeof chart.dispose === 'function') {
                chart.dispose();
            }
        });
    }
}

// 页面加载后初始化
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Initializing Comprehensive Dashboard (dashboard3)...');

    // 等待 header 加载
    let attempts = 0;
    while (!window.headerInstance && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }

    const dashboard = new ComprehensiveDashboard();
    await dashboard.initialize();
    console.log('Comprehensive Dashboard initialized successfully');

    window.dashboardInstance = dashboard;

    window.addEventListener('beforeunload', () => {
        if (window.dashboardInstance) {
            window.dashboardInstance.destroy();
        }
    });
});
