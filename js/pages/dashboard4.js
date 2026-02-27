/**
 * Dashboard4 - 服务可用性大屏
 * 聚焦告警热力图、可用率趋势、严重性雷达等可用性维度
 */
class AvailabilityDashboard {
    constructor() {
        this.charts = {};
        this.data = {
            hosts: [],
            hostGroups: [],
            alertHistory: [],
            problemsStats: null
        };
        this.api = null;
        this.refreshInterval = null;
        this.eventScrollTimer = null;
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
        document.title = i18n.t('pageTitle.screen4');
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (key) el.textContent = i18n.t(key);
        });
    }

    initWindowResize() {
        window.addEventListener('resize', () => {
            Object.values(this.charts).forEach(chart => {
                if (chart && typeof chart.resize === 'function') chart.resize();
            });
        });
    }

    // ========== 数据获取 ==========

    async fetchData() {
        console.log(`[${new Date().toLocaleTimeString()}] Fetching availability dashboard data...`);
        try {
            const settings = await this.getSettings();
            if (!settings.apiUrl || !settings.apiToken) {
                console.error('API configuration incomplete');
                return;
            }

            this.api = new ZabbixAPI(settings.apiUrl, atob(settings.apiToken), settings.zabbixVersion);

            const [hostsWithStatus, hostGroups, problemsStats, alertHistory] = await Promise.all([
                this.api.getHostsWithStatus(),
                this.api.getHostGroups(),
                this.api.getProblemsStatistics(),
                this.api.getAlertHistory()
            ]);

            this.data.hosts = hostsWithStatus || [];
            this.data.hostGroups = hostGroups || [];
            this.data.alertHistory = alertHistory || [];

            if (problemsStats) {
                this.data.problemsStats = problemsStats;
            } else {
                this.data.problemsStats = {
                    activeProblemsCount: 0,
                    resolvedProblemsCount: 0,
                    totalProblemsToday: 0,
                    activeProblems: [],
                    resolvedProblems: []
                };
            }

            this.updateDataCards();
            this.updateLastRefreshTime();
        } catch (error) {
            console.error('Failed to fetch availability dashboard data:', error);
        }
    }

    // ========== 数据卡片更新 ==========

    updateDataCards() {
        const hosts = this.data.hosts;
        const stats = this.data.problemsStats;
        const groups = this.data.hostGroups;

        // 监控主机数
        const totalHosts = hosts.length;
        this.setCardValue('card-total-hosts', totalHosts);

        // 可用率：无问题主机 / 总主机
        const problemHostIds = new Set();
        if (stats && stats.activeProblems) {
            stats.activeProblems.forEach(p => {
                if (p.hosts) p.hosts.forEach(h => problemHostIds.add(h.hostid));
            });
        }
        const healthyCount = Math.max(0, totalHosts - problemHostIds.size);
        const availability = totalHosts > 0 ? ((healthyCount / totalHosts) * 100).toFixed(1) + '%' : '--';
        this.setCardValue('card-availability', availability);

        // 活动问题数
        this.setCardValue('card-active-problems', stats ? stats.activeProblemsCount : 0);

        // 今日已恢复
        this.setCardValue('card-resolved-today', stats ? stats.resolvedProblemsCount : 0);

        // 主机组数
        this.setCardValue('card-host-groups', groups.length);
    }

    setCardValue(id, val) {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    }

    // ========== 图表初始化 ==========

    initializeCharts() {
        this.initHeatmapChart();
        this.initRadarChart();
        this.initGroupBarChart();
        this.initAvailabilityChart();
        this.initTopProblemsChart();
        this.renderEventFeed();
    }

    // ----- 1. 7天告警时段热力图 -----
    initHeatmapChart() {
        const container = document.getElementById('chartHeatmap');
        if (!container) return;
        const chart = echarts.init(container);
        this.charts.heatmap = chart;

        const historyData = this.data.alertHistory;
        // 构建 7天 × 24小时 热力图数据
        const days = [];
        const now = new Date();
        // 生成每天的日期字符串用于精确匹配
        const dayDateStrings = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            days.push(d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
            // 用 YYYY-MM-DD 精确匹配日历日期
            dayDateStrings.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
        }
        const hours = Array.from({ length: 24 }, (_, i) => `${i}:00`);

        // 统计每天每小时的告警数（按日历日期精确匹配，避免跨天错位）
        // 同时按严重级别分别统计
        const heatData = [];
        const countMap = {};
        const severityCountMap = {}; // key: `dayIdx-hourIdx`, value: {1:n, 2:n, 3:n, 4:n, 5:n}
        if (historyData && Array.isArray(historyData)) {
            historyData.forEach(event => {
                const date = new Date(parseInt(event.clock) * 1000);
                const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                const dayIdx = dayDateStrings.indexOf(dateStr);
                const hourIdx = date.getHours();
                if (dayIdx >= 0) {
                    const key = `${dayIdx}-${hourIdx}`;
                    countMap[key] = (countMap[key] || 0) + 1;
                    if (!severityCountMap[key]) severityCountMap[key] = {};
                    const sev = event.severity || '0';
                    severityCountMap[key][sev] = (severityCountMap[key][sev] || 0) + 1;
                }
            });
        }

        for (let d = 0; d < 7; d++) {
            for (let h = 0; h < 24; h++) {
                const key = `${d}-${h}`;
                heatData.push([h, d, countMap[key] || 0]);
            }
        }

        const maxVal = Math.max(1, ...heatData.map(d => d[2]));

        const lang = (typeof i18n !== 'undefined' && i18n.currentLang) ? i18n.currentLang : 'zh';
        const severityLabels = {
            zh: { '5': '灾难', '4': '严重', '3': '一般', '2': '警告', '1': '信息' },
            en: { '5': 'Disaster', '4': 'High', '3': 'Average', '2': 'Warning', '1': 'Information' }
        };
        const sevLabels = severityLabels[lang] || severityLabels.zh;
        const severityColors = { '5': '#ff4d4f', '4': '#ff7a45', '3': '#ffa940', '2': '#ffc53d', '1': '#73d13d' };

        chart.setOption({
            tooltip: {
                position: 'top',
                appendToBody: true,
                className: 'heatmap-tooltip-4',
                formatter: p => {
                    const dayIdx = p.value[1];
                    const hourIdx = p.value[0];
                    const total = p.value[2];
                    const key = `${dayIdx}-${hourIdx}`;
                    const sevCounts = severityCountMap[key] || {};
                    let html = `<div style="font-weight:600;margin-bottom:4px">${days[dayIdx]} ${hours[hourIdx]}</div>`;
                    ['5', '4', '3', '2', '1'].forEach(s => {
                        const count = sevCounts[s] || 0;
                        if (count > 0) {
                            html += `<div style="display:flex;align-items:center;gap:6px;margin:2px 0">` +
                                `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${severityColors[s]}"></span>` +
                                `${sevLabels[s]}: <b>${count}</b></div>`;
                        }
                    });
                    if (total === 0) {
                        html += `<div style="color:#888">${i18n.t('dashboard4.noEvents') || '暂无事件'}</div>`;
                    }
                    return html;
                }
            },
            grid: { left: 60, right: 20, top: 10, bottom: 30 },
            xAxis: {
                type: 'category',
                data: hours,
                splitArea: { show: false },
                axisLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 10, interval: 2 },
                axisLine: { show: false },
                axisTick: { show: false }
            },
            yAxis: {
                type: 'category',
                data: days,
                splitArea: { show: false },
                axisLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 10 },
                axisLine: { show: false },
                axisTick: { show: false }
            },
            visualMap: {
                min: 0,
                max: maxVal,
                calculable: false,
                orient: 'horizontal',
                left: 'center',
                bottom: 0,
                show: false,
                inRange: {
                    color: ['rgba(255,170,0,0.05)', 'rgba(255,170,0,0.25)', '#ffaa00', '#ff6600', '#ff3333']
                }
            },
            series: [{
                type: 'heatmap',
                data: heatData,
                itemStyle: { borderRadius: 3, borderWidth: 2, borderColor: 'rgba(13,15,20,0.8)' },
                emphasis: {
                    itemStyle: { shadowBlur: 10, shadowColor: 'rgba(255,170,0,0.5)' }
                }
            }]
        });
    }

    // ----- 2. 告警级别雷达图 -----
    initRadarChart() {
        const container = document.getElementById('chartRadar');
        if (!container) return;
        const chart = echarts.init(container);
        this.charts.radar = chart;

        const severityLabels = {
            zh: ['信息', '警告', '一般', '严重', '灾难'],
            en: ['Info', 'Warning', 'Average', 'High', 'Disaster']
        };
        const lang = (typeof i18n !== 'undefined' && i18n.currentLang) ? i18n.currentLang : 'zh';
        const labels = severityLabels[lang] || severityLabels.zh;

        // 使用已过滤的活动问题统计各级别数量（避免延迟）
        const counts = [0, 0, 0, 0, 0]; // severity 1-5
        const stats = this.data.problemsStats;
        if (stats && stats.activeProblems) {
            stats.activeProblems.forEach(p => {
                const s = parseInt(p.severity);
                if (s >= 1 && s <= 5) counts[s - 1]++;
            });
        }

        const maxCount = Math.max(1, ...counts);

        chart.setOption({
            tooltip: {
                formatter: (params) => {
                    const data = params.data || {};
                    const values = data.value || counts;
                    let html = `<div style="font-weight:600;margin-bottom:4px">${data.name || ''}</div>`;
                    labels.forEach((label, idx) => {
                        html += `<div>${label}: <b>${values[idx]}</b></div>`;
                    });
                    return html;
                }
            },
            radar: {
                indicator: labels.map((name, idx) => ({ name: `${name}: ${counts[idx]}`, max: maxCount })),
                radius: '60%',
                center: ['50%', '55%'],
                axisName: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
                axisLine: { lineStyle: { color: 'rgba(255,170,0,0.15)' } },
                splitLine: { lineStyle: { color: 'rgba(255,170,0,0.08)' } },
                splitArea: { areaStyle: { color: ['rgba(255,170,0,0.02)', 'rgba(255,170,0,0.04)'] } }
            },
            series: [{
                type: 'radar',
                data: [{
                    value: counts,
                    name: i18n.t('dashboard4.alertCount') || '告警',
                    areaStyle: { color: 'rgba(255,170,0,0.2)' },
                    lineStyle: { color: '#ffaa00', width: 2 },
                    itemStyle: { color: '#ffaa00' },
                    symbol: 'circle',
                    symbolSize: 6,
                    label: {
                        show: true,
                        formatter: (params) => {
                            return params.value > 0 ? params.value : '';
                        },
                        color: '#ffaa00',
                        fontSize: 11,
                        fontWeight: 'bold'
                    }
                }]
            }]
        });
    }

    // ----- 3. 主机组问题分布（水平条形图）-----
    initGroupBarChart() {
        const container = document.getElementById('chartGroupBar');
        if (!container) return;
        const chart = echarts.init(container);
        this.charts.groupBar = chart;

        const groups = this.data.hostGroups || [];
        const stats = this.data.problemsStats;
        const hosts = this.data.hosts || [];

        // 构建 hostId → 所属主机组名称 的映射
        const hostGroupMap = {};
        hosts.forEach(host => {
            if (host.groups) {
                host.groups.forEach(g => {
                    if (!hostGroupMap[host.hostid]) hostGroupMap[host.hostid] = [];
                    hostGroupMap[host.hostid].push(g.name);
                });
            }
        });

        // 统计每个主机组的问题数
        const groupProblemCount = {};
        if (stats && stats.activeProblems) {
            stats.activeProblems.forEach(p => {
                const hostId = p.hostId;
                if (hostId && hostGroupMap[hostId]) {
                    hostGroupMap[hostId].forEach(groupName => {
                        groupProblemCount[groupName] = (groupProblemCount[groupName] || 0) + 1;
                    });
                }
            });
        }

        // 排序取前 8
        const sorted = Object.entries(groupProblemCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8);

        const names = sorted.map(s => s[0]).reverse();
        const values = sorted.map(s => s[1]).reverse();

        chart.setOption({
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' }
            },
            grid: { left: 10, right: 30, top: 10, bottom: 10, containLabel: true },
            xAxis: {
                type: 'value',
                axisLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 10 },
                splitLine: { lineStyle: { color: 'rgba(255,170,0,0.06)' } },
                axisLine: { show: false }
            },
            yAxis: {
                type: 'category',
                data: names,
                axisLabel: {
                    color: 'rgba(255,255,255,0.6)',
                    fontSize: 10,
                    width: 80,
                    overflow: 'truncate'
                },
                axisLine: { show: false },
                axisTick: { show: false }
            },
            series: [{
                type: 'bar',
                data: values,
                barWidth: '50%',
                itemStyle: {
                    borderRadius: [0, 4, 4, 0],
                    color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                        { offset: 0, color: 'rgba(255,170,0,0.3)' },
                        { offset: 1, color: '#ffaa00' }
                    ])
                },
                label: {
                    show: true,
                    position: 'right',
                    color: 'rgba(255,255,255,0.6)',
                    fontSize: 10
                }
            }]
        });
    }

    // ----- 4. 24小时可用率趋势（面积图）-----
    initAvailabilityChart() {
        const container = document.getElementById('chartAvailability');
        if (!container) return;
        const chart = echarts.init(container);
        this.charts.availability = chart;

        const historyData = this.data.alertHistory;
        const totalHosts = this.data.hosts.length || 1;

        // 统计过去24小时每小时的问题主机数 → 可用率
        const now = new Date();
        const hours = [];
        const availRates = [];

        for (let i = 23; i >= 0; i--) {
            const hourStart = new Date(now);
            hourStart.setHours(now.getHours() - i, 0, 0, 0);
            const hourEnd = new Date(hourStart);
            hourEnd.setHours(hourStart.getHours() + 1);

            hours.push(hourStart.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }));

            // 统计该小时内的唯一告警主机
            const problemHosts = new Set();
            if (historyData && Array.isArray(historyData)) {
                historyData.forEach(event => {
                    const eventTime = new Date(parseInt(event.clock) * 1000);
                    if (eventTime >= hourStart && eventTime < hourEnd) {
                        // 使用主机ID去重，精确统计问题主机数
                        if (event.hosts && event.hosts[0]) {
                            problemHosts.add(event.hosts[0].hostid);
                        } else {
                            problemHosts.add(event.eventid);
                        }
                    }
                });
            }

            const problemCount = Math.min(problemHosts.size, totalHosts);
            const rate = ((totalHosts - problemCount) / totalHosts * 100).toFixed(1);
            availRates.push(parseFloat(rate));
        }

        chart.setOption({
            tooltip: {
                trigger: 'axis',
                formatter: params => {
                    const p = params[0];
                    return `${p.axisValue}<br/>${i18n.t('dashboard4.availabilityRate') || '可用率'}: <b>${p.value}%</b>`;
                }
            },
            grid: { left: 45, right: 20, top: 15, bottom: 30 },
            xAxis: {
                type: 'category',
                data: hours,
                axisLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 10, interval: 3 },
                axisLine: { lineStyle: { color: 'rgba(255,170,0,0.1)' } },
                axisTick: { show: false }
            },
            yAxis: {
                type: 'value',
                min: function(value) { return Math.max(0, Math.floor(value.min - 5)); },
                max: 100,
                axisLabel: {
                    color: 'rgba(255,255,255,0.4)',
                    fontSize: 10,
                    formatter: '{value}%'
                },
                splitLine: { lineStyle: { color: 'rgba(255,170,0,0.06)' } },
                axisLine: { show: false }
            },
            series: [{
                type: 'line',
                data: availRates,
                smooth: true,
                symbol: 'none',
                lineStyle: { color: '#ffaa00', width: 2 },
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: 'rgba(255,170,0,0.25)' },
                        { offset: 1, color: 'rgba(255,170,0,0.02)' }
                    ])
                },
                markLine: {
                    silent: true,
                    symbol: 'none',
                    lineStyle: { color: 'rgba(255,80,80,0.3)', type: 'dashed' },
                    data: [{ yAxis: 95, label: { show: true, formatter: 'SLA 95%', color: 'rgba(255,80,80,0.5)', fontSize: 10 } }]
                }
            }]
        });
    }

    // ----- 5. 问题主机TOP（横向条形图）-----
    initTopProblemsChart() {
        const container = document.getElementById('chartTopProblems');
        if (!container) return;
        const chart = echarts.init(container);
        this.charts.topProblems = chart;

        const stats = this.data.problemsStats;
        const hostProblemCount = {};

        if (stats && stats.activeProblems) {
            stats.activeProblems.forEach(p => {
                const name = p.hostName || '未知主机';
                hostProblemCount[name] = (hostProblemCount[name] || 0) + 1;
            });
        }

        const sorted = Object.entries(hostProblemCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8);

        const names = sorted.map(s => s[0]).reverse();
        const values = sorted.map(s => s[1]).reverse();

        // 颜色梯度 - 问题越多越红
        const maxVal = Math.max(1, ...values);

        chart.setOption({
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' }
            },
            grid: { left: 10, right: 30, top: 10, bottom: 10, containLabel: true },
            xAxis: {
                type: 'value',
                axisLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 10 },
                splitLine: { lineStyle: { color: 'rgba(255,170,0,0.06)' } },
                axisLine: { show: false }
            },
            yAxis: {
                type: 'category',
                data: names,
                axisLabel: {
                    color: 'rgba(255,255,255,0.6)',
                    fontSize: 10,
                    width: 80,
                    overflow: 'truncate'
                },
                axisLine: { show: false },
                axisTick: { show: false }
            },
            series: [{
                type: 'bar',
                data: values.map(v => ({
                    value: v,
                    itemStyle: {
                        borderRadius: [0, 4, 4, 0],
                        color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                            { offset: 0, color: 'rgba(255,100,50,0.3)' },
                            { offset: 1, color: v / maxVal > 0.7 ? '#ff4444' : v / maxVal > 0.4 ? '#ff8800' : '#ffaa00' }
                        ])
                    }
                })),
                barWidth: '50%',
                label: {
                    show: true,
                    position: 'right',
                    color: 'rgba(255,255,255,0.6)',
                    fontSize: 10
                }
            }]
        });
    }

    // ----- 6. 实时事件流（自动滚动，仅展示过去1小时）-----
    renderEventFeed() {
        const container = document.getElementById('eventFeed');
        if (!container) return;

        // 停止之前的滚动动画
        this.stopEventScroll();

        const stats = this.data.problemsStats;
        let events = [];
        const oneHourAgo = Math.floor(Date.now() / 1000) - 3600;

        // 活动问题（仅过去1小时内产生的）
        if (stats && stats.activeProblems) {
            stats.activeProblems.forEach(p => {
                const clock = parseInt(p.clock);
                if (clock >= oneHourAgo) {
                    events.push({
                        type: 'problem',
                        severity: p.severity || '2',
                        name: p.name || 'Unknown',
                        hostName: p.hostName || '',
                        clock: clock
                    });
                }
            });
        }

        // 最近恢复的事件（仅过去1小时内的）
        if (stats && stats.recentResolvedProblems) {
            stats.recentResolvedProblems.forEach(p => {
                const clock = parseInt(p.clock);
                if (clock >= oneHourAgo) {
                    events.push({
                        type: 'resolved',
                        severity: p.severity || '0',
                        name: p.name || (i18n.t('dashboard4.resolved') || '已恢复'),
                        hostName: p.hostName || '',
                        clock: clock
                    });
                }
            });
        }

        events.sort((a, b) => b.clock - a.clock);
        events = events.slice(0, 50);

        if (events.length === 0) {
            container.innerHTML = `<div class="no-events">${i18n.t('dashboard4.noEvents') || '暂无事件'}</div>`;
            return;
        }

        const buildItems = (evts) => evts.map(event => {
            const time = new Date(event.clock * 1000);
            const timeStr = time.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
            const dateStr = time.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            const severityClass = event.type === 'resolved' ? 'resolved' : this.getSeverityClass(event.severity);
            const resolvedTag = event.type === 'resolved' ? `<span style="color:#8c8c8c;font-size:9px;margin-left:4px">[${i18n.t('dashboard4.resolved') || '已恢复'}]</span>` : '';

            return `
                <div class="event-item">
                    <div class="event-severity-dot ${severityClass}"></div>
                    <div class="event-info">
                        <div class="event-host" title="${this.escapeHtml(event.hostName)}">${this.escapeHtml(event.hostName) || '--'}${resolvedTag}</div>
                        <div class="event-name" title="${this.escapeHtml(event.name)}">${this.escapeHtml(event.name)}</div>
                        <div class="event-time">${dateStr} ${timeStr}</div>
                    </div>
                </div>
            `;
        }).join('');

        // 创建双份内容实现无缝滚动
        const itemsHtml = buildItems(events);
        container.innerHTML = `
            <div class="event-scroll-wrapper">
                <div class="event-scroll-content">${itemsHtml}</div>
                <div class="event-scroll-content">${itemsHtml}</div>
            </div>
        `;

        // 启动自动滚动
        this.startEventScroll();
    }

    startEventScroll() {
        const container = document.getElementById('eventFeed');
        if (!container) return;
        const wrapper = container.querySelector('.event-scroll-wrapper');
        if (!wrapper) return;

        let scrollPos = 0;
        let isPaused = false;
        const speed = 0.5; // px/frame

        const scrollContent = wrapper.querySelector('.event-scroll-content');
        if (!scrollContent) return;

        const animate = () => {
            if (!isPaused) {
                scrollPos += speed;
                const contentHeight = scrollContent.offsetHeight;
                if (contentHeight > 0 && scrollPos >= contentHeight) {
                    scrollPos -= contentHeight;
                }
                wrapper.style.transform = `translateY(-${scrollPos}px)`;
            }
            this.eventScrollTimer = requestAnimationFrame(animate);
        };

        this.eventScrollTimer = requestAnimationFrame(animate);

        // 鼠标悬停暂停
        container.addEventListener('mouseenter', () => { isPaused = true; });
        container.addEventListener('mouseleave', () => { isPaused = false; });
    }

    stopEventScroll() {
        if (this.eventScrollTimer) {
            cancelAnimationFrame(this.eventScrollTimer);
            this.eventScrollTimer = null;
        }
    }

    getSeverityClass(severity) {
        switch (severity) {
            case '5': return 'disaster';
            case '4': return 'high';
            case '3': return 'average';
            case '2': return 'warning';
            case '1': return 'information';
            default: return 'resolved';
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ========== 自动刷新 ==========

    async startAutoRefresh() {
        try {
            const settings = await this.getSettings();
            const interval = parseInt(settings.refreshInterval) || 300000;

            if (this.refreshInterval) clearInterval(this.refreshInterval);

            this.refreshInterval = setInterval(async () => {
                this.stopEventScroll();
                await this.fetchData();
                this.initializeCharts();
            }, interval);
        } catch (error) {
            console.error('Failed to start auto refresh:', error);
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

            // 更新header中的刷新时间
            if (window.headerInstance && typeof window.headerInstance.updateLastRefreshTime === 'function') {
                window.headerInstance.updateLastRefreshTime();
            } else {
                const lastRefreshElement = document.getElementById('lastRefreshTime');
                if (lastRefreshElement) {
                    lastRefreshElement.textContent = (i18n.t('dashboard4.lastRefreshTime') || '最后刷新: {time}').replace('{time}', timeString);
                }
            }

            // 更新左上角的刷新时间显示
            const dashboardRefreshTimeElement = document.getElementById('dashboardRefreshTime4');
            if (dashboardRefreshTimeElement) {
                const refreshValueElement = dashboardRefreshTimeElement.querySelector('.refresh-value');
                if (refreshValueElement) {
                    refreshValueElement.textContent = timeString;
                }
            }

            // 更新底部刷新时间
            const el = document.getElementById('lastRefreshTime4');
            if (el) {
                const template = i18n.t('dashboard4.lastRefreshTime') || '最后刷新: {time}';
                el.textContent = template.replace('{time}', timeString);
            }
        }, 100);
    }
}

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // 初始化全屏管理器
        const fsManager = new FullscreenManager();
        fsManager.init();

        // 等待header加载完成
        let attempts = 0;
        const maxAttempts = 50; // 最多等待5秒
        while (!window.headerInstance && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }

        // 初始化大屏
        const dashboard = new AvailabilityDashboard();
        await dashboard.initialize();

        // 将dashboard实例存储到全局
        window.dashboardInstance = dashboard;

        // 页面卸载时清理资源
        window.addEventListener('beforeunload', () => {
            if (window.dashboardInstance) {
                window.dashboardInstance.stopEventScroll();
                Object.values(window.dashboardInstance.charts).forEach(chart => {
                    if (chart && typeof chart.dispose === 'function') chart.dispose();
                });
            }
        });
    } catch (error) {
        console.error('Failed to initialize availability dashboard:', error);
    }
});
