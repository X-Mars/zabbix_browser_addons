class Header {
    constructor() {
        this.init();
    }

    init() {
        this.settingsBtn = document.getElementById('settingsBtn');
        this.lastRefreshTimeElement = document.getElementById('lastRefreshTime');
        this.settingsModal = document.getElementById('settingsModal');
        this.closeModalBtn = document.getElementById('closeModal');
        this.hostsModal = document.getElementById('hostsModal');
        
        this.initNavigation();
        this.initSettingsButton();
        this.initSettingsModal();

        // 只在仪表盘页面初始化主机卡片点击事件
        if (window.location.pathname.includes('index.html')) {
            this.initHostsModal();
        }
    }

    initNavigation() {
        const currentPath = window.location.pathname;
        document.querySelectorAll('.navbar a').forEach(link => {
            if (link.getAttribute('href') === currentPath) {
                link.classList.add('active');
            }
            
            link.addEventListener('click', (e) => {
                document.querySelectorAll('.navbar a').forEach(item => 
                    item.classList.remove('active'));
                e.currentTarget.classList.add('active');
            });
        });
    }

    initSettingsButton() {
        if (this.settingsBtn) {
            this.settingsBtn.addEventListener('click', () => {
                // 使用 settingsManager 显示设置对话框
                window.settingsManager?.showDialog();
            });
        }
    }

    initSettingsModal() {
        if (this.settingsModal) {
            // 点击遮罩层关闭
            this.settingsModal.addEventListener('click', (e) => {
                if (e.target.classList.contains('modal-overlay')) {
                    this.settingsModal.classList.remove('active');
                }
            });
        }

        if (this.closeModalBtn && this.settingsModal) {
            this.closeModalBtn.addEventListener('click', () => {
                this.settingsModal.classList.remove('active');
            });
        }
    }

    initHostsModal() {
        // 修改主机数量卡片点击事件，改为跳转到主机列表页面
        const hostCard = document.querySelector('.status-card:first-child');
        if (hostCard) {  // 添加存在性检查
            hostCard.style.cursor = 'pointer';
            hostCard.addEventListener('click', () => {
                window.location.href = 'hosts.html';
            });
        }
    }

    updateLastRefreshTime() {
        if (this.lastRefreshTimeElement) {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            });
            const template = i18n.t('settings.messages.lastRefresh');
            this.lastRefreshTimeElement.textContent = template.replace('{time}', timeStr);
        }
    }
}

class RefreshManager {
    constructor(callback, defaultInterval = 300000) {
        this.callback = callback;
        this.defaultInterval = defaultInterval;
        this.timer = null;
    }

    async start() {
        const settings = await this.getSettings();
        const interval = parseInt(settings.refreshInterval) || this.defaultInterval;
        this.stop();
        this.timer = setInterval(() => this.callback(), interval);
    }

    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    async getSettings() {
        return new Promise((resolve, reject) => {
            chrome.storage.sync.get(['apiUrl', 'apiToken', 'refreshInterval'], (result) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(result);
                }
            });
        });
    }
}

class ZabbixDashboard {
    constructor() {
        this.header = new Header();
        this.refreshManager = new RefreshManager(() => this.loadDashboard());
        this.init();
        this.initI18n();
        this.charts = {};
        this.initHostsModal();
        this.currentSort = {
            column: null,
            direction: 'asc'
        };
        this.hostsData = [];  // 存储主机数据
        this.initHostDetailModal();
        this.initZoomChartModal();
        this.currentItemId = null;  // 添加存储当前 itemId 的属性
        this.currentChartType = null;  // 添加存储当前图表类型的属性
        this.currentCpuItemId = null;  // 添加存储 CPU 监控项 ID
        this.currentMemoryItemId = null;  // 添加存储内存监控项 ID
        this.isWindows = false;  // 添加存储系统类型
    }

    async init() {
        const settings = await this.getSettings();
        if (!settings.apiUrl || !settings.apiToken) {
            // 使用 settingsManager 显示设置对话框
            window.settingsManager?.showDialog();
            return;
        }
        
        await this.loadDashboard();
        await this.refreshManager.start();
    }

    async loadDashboard() {
        try {
            const settings = await this.getSettings();
            const api = new ZabbixAPI(settings.apiUrl, atob(settings.apiToken));

            // 更新最后刷新时间
            this.header.updateLastRefreshTime();

            // 加载统计数据
            const [hosts, alerts] = await Promise.all([
                api.getHosts(),
                api.getAlerts()
            ]);

            // 更新统计卡片
            document.getElementById('hostCount').textContent = hosts.length;
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
        // console.log(alerts);
        tbody.innerHTML = alerts.map(alert => `
            <tr>
                <td>${alert.hosts?.[0]?.name || '未知主机'}</td>
                <td>${alert.name}</td>
                <td><span class="severity-tag ${this.getSeverityClass(alert.severity)}">${this.getSeverityName(alert.severity)}</span></td>
                <td><span class="status-tag ${this.getStatusClass(alert.status)}">${this.getStatusName(alert.status)}</span></td>
                <td>${this.formatDuration(alert.duration)}</td>
                <td>${this.formatTime(alert.clock)}</td>
                <td>${alert.r_clock ? this.formatTime(alert.r_clock) : '-'}</td>
            </tr>
        `).join('');
    }

    getSeverityClass(severity) {
        const classes = {
            '0': 'not-classified',  // 灰色
            '1': 'information',     // 浅蓝色
            '2': 'warning',         // 黄色
            '3': 'average',         // 橙色
            '4': 'high',           // 红色
            '5': 'disaster'        // 深红色
        };
        return classes[severity] || 'not-classified';
    }

    getSeverityName(severity) {
        return i18n.t(`severity.${this.getSeverityKey(severity)}`);
    }

    getSeverityKey(severity) {
        const keys = {
            '0': 'notClassified',  // Not classified
            '1': 'information',    // Information
            '2': 'warning',        // Warning
            '3': 'average',        // Average
            '4': 'high',          // High
            '5': 'disaster'       // Disaster
        };
        return keys[severity] || 'notClassified';
    }

    formatTime(timestamp) {
        const date = new Date(timestamp * 1000);
        return `${date.toISOString().slice(0, 10)} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    }

    getAckClass(acknowledged) {
        return acknowledged === '1' ? 'acknowledged' : 'unacknowledged';
    }

    getAckName(acknowledged) {
        return acknowledged === '1' ? '已确认' : '未确认';
    }

    async getSettings() {
        return new Promise((resolve, reject) => {
            chrome.storage.sync.get(['apiUrl', 'apiToken', 'refreshInterval'], (result) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                resolve(result);
                }
            });
        });
    }

    initHostsModal() {
        // 修改主机数量卡片点击事件，改为跳转到主机列表页面
        const hostCard = document.querySelector('.status-card:first-child');
        if (hostCard) {  // 添加存在性检查
        hostCard.style.cursor = 'pointer';
            hostCard.addEventListener('click', () => {
                window.location.href = 'hosts.html';
            });
        }
    }

    getStatusClass(status) {
        // status: 0 - 已恢复, 1 - 告警中
        return status === '0' ? 'resolved' : 'problem';
    }

    getStatusName(status) {
        const statusKey = status === '0' ? 'resolved' : 'problem';
        return i18n.t(`statusTag.${statusKey}`);
    }

    formatDuration(seconds) {
        if (!seconds) return '-';
        
        const days = Math.floor(seconds / (24 * 3600));
        const hours = Math.floor((seconds % (24 * 3600)) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        const parts = [];
        if (days > 0) parts.push(`${days} ${i18n.t('time.days')}`);
        if (hours > 0) parts.push(`${hours} ${i18n.t('time.hours')}`);
        if (minutes > 0) parts.push(`${minutes} ${i18n.t('time.minutes')}`);
        
        return parts.length > 0 ? parts.join(' ') : i18n.t('time.lessThanOneMinute');
    }

    async showHostDetail(hostId) {
        const modal = document.getElementById('hostDetailModal');
        modal.classList.add('active');

        // 清空详情页数据
        const setElementContent = (id, value) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
                element.setAttribute('title', value); // 添加 title 属性用于悬浮展示
            }
        };

        // 清空图表
        const cpuChart = echarts.init(document.getElementById('detailCPUChart'));
        const memoryChart = echarts.init(document.getElementById('detailMemoryChart'));
        cpuChart.clear();
        memoryChart.clear();

        // 清空详情页数据时设置默认值和 title
        setElementContent('detailHostName', '-');
        setElementContent('detailHostIP', '-');
        setElementContent('detailHostOS', '-');
        setElementContent('detailUptime', '-');
        setElementContent('detailCPUCores', '-');
        setElementContent('detailMemoryTotal', '-');

        try {
            const settings = await this.getSettings();
            const api = new ZabbixAPI(settings.apiUrl, atob(settings.apiToken));
            
            // 获取主机详细信息
            const hostDetails = await api.getHostDetail(hostId);
            
            // 保存监控项 ID 和系统类型
            this.currentCpuItemId = hostDetails.cpuItemId;
            this.currentMemoryItemId = hostDetails.memoryItemId;
            this.isWindows = hostDetails.isWindows;

            // 更新基本信息
            setElementContent('detailHostName', hostDetails.name);
            setElementContent('detailHostIP', hostDetails.ip);
            setElementContent('detailHostOS', hostDetails.os);
            setElementContent('detailUptime', this.formatUptime(hostDetails.uptime));
            
            // 更新硬件信息
            setElementContent('detailCPUCores', hostDetails.cpuCores);
            setElementContent('detailMemoryTotal', hostDetails.memoryTotal);

            // 初始化性能图表
            this.initPerformanceCharts(hostDetails);

            // 根据监控项是否存在来控制放大按钮
            const cpuZoomBtn = document.querySelector('.zoom-btn[data-chart="cpu"]');
            const memoryZoomBtn = document.querySelector('.zoom-btn[data-chart="memory"]');
            
            if (cpuZoomBtn) {
                if (!hostDetails.cpuItemId) {
                    cpuZoomBtn.style.display = 'none';  // 或者使用 disabled
                } else {
                    cpuZoomBtn.style.display = 'block';
                }
            }
            
            if (memoryZoomBtn) {
                if (!hostDetails.memoryItemId) {
                    memoryZoomBtn.style.display = 'none';  // 或者使用 disabled
                } else {
                    memoryZoomBtn.style.display = 'block';
                }
            }

        } catch (error) {
            console.error('Failed to load host details:', error);
        }
    }

    // 初始化性能图表
    initPerformanceCharts(hostDetails) {
        const cpuChart = echarts.init(document.getElementById('detailCPUChart'));
        const memoryChart = echarts.init(document.getElementById('detailMemoryChart'));
        
        const chartOption = {
            tooltip: {
                trigger: 'axis',
                formatter: function(params) {
                    const value = params[0].value;
                    const time = params[0].name;
                    return `${time}<br/>${i18n.t('chart.tooltip.usage').replace('{value}', value)}`;
                }
            },
            grid: {
                top: 10,
                right: 10,
                bottom: 20,
                left: 40,
                containLabel: true
            },
            xAxis: {
                type: 'category',
                boundaryGap: false,
                data: hostDetails.history.time,
                axisLabel: {
                    fontSize: 10
                }
            },
            yAxis: {
                type: 'value',
                min: 0,
                max: 100,
                splitLine: {
                    lineStyle: {
                        color: '#eee'
                    }
                }
            },
            series: [{
                name: i18n.t('chart.usage'),
                type: 'line',
                smooth: true,
                areaStyle: {
                    opacity: 0.3
                },
                itemStyle: {
                    color: '#1a73e8'
                }
            }]
        };

        // 设置CPU图表数据
        cpuChart.setOption({
            ...chartOption,
            series: [{
                ...chartOption.series[0],
                data: hostDetails.history.cpu
            }]
        });

        // 设置内存图表数据
        memoryChart.setOption({
            ...chartOption,
            series: [{
                ...chartOption.series[0],
                data: hostDetails.history.memory
            }]
        });

        // 监听窗口大小变化，调整图表大小
        window.addEventListener('resize', () => {
            cpuChart.resize();
            memoryChart.resize();
        });

        // 重新初始化放大按钮事件
        this.initZoomChartModal();
    }

    // 初始化主机详情对话框
    initHostDetailModal() {
        document.getElementById('closeHostDetailModal').addEventListener('click', () => {
            document.getElementById('hostDetailModal').classList.remove('active');
        });

        document.getElementById('hostDetailModal').addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) {
                document.getElementById('hostDetailModal').classList.remove('active');
            }
        });
    }

    formatUptime(seconds) {
        if (!seconds) return '-';
        
        const days = Math.floor(seconds / (24 * 60 * 60));
        const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
        const minutes = Math.floor((seconds % (60 * 60)) / 60);
        
        let result = '';
        if (days > 0) result += `${days}天 `;
        if (hours > 0) result += `${hours}小时 `;
        if (minutes > 0) result += `${minutes}分钟`;
        
        return result.trim() || '小于1分钟';
    }

    // 初始化放大图表的模态框
    initZoomChartModal() {
        // 关闭按钮事件
        document.getElementById('closeZoomChartModal').addEventListener('click', () => {
            document.getElementById('zoomChartModal').classList.remove('active');
        });

        // 点击遮罩层关闭
        document.getElementById('zoomChartModal').addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) {
                document.getElementById('zoomChartModal').classList.remove('active');
            }
        });

        // 添加放大按钮点击事件
        document.querySelectorAll('.zoom-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const chartType = e.currentTarget.dataset.chart;
                this.showZoomChart(chartType);
            });
        });
    }

    // 显示放大的图表
    async showZoomChart(chartType) {
        this.currentChartType = chartType;
        const modal = document.getElementById('zoomChartModal');
        modal.style.display = 'flex';

        // 根据图表类型设置标题
        const titleText = chartType === 'cpu' ? i18n.t('chartTitle.cpu') : i18n.t('chartTitle.memory');
        document.getElementById('zoomChartTitle').textContent = `${i18n.t('performanceMonitor')} - ${titleText}`;

        const chart = echarts.init(document.getElementById('zoomChart'));
        chart.clear();

        try {
            const settings = await this.getSettings();
            const api = new ZabbixAPI(settings.apiUrl, atob(settings.apiToken));
            
            // 获取监控项ID
            const itemId = chartType === 'cpu' ? this.currentCpuItemId : this.currentMemoryItemId;
            
            // 默认显示24小时数据
            const now = Math.floor(Date.now() / 1000);
            const timeFrom = now - 24 * 3600;
            
            // 获取历史数据
            const historyResponse = await api.request('history.get', {
                itemids: [parseInt(itemId)],
                time_from: timeFrom,
                output: 'extend',
                history: 0,
                sortfield: 'clock',
                sortorder: 'ASC'
            });

            // 处理数据
            const historyData = historyResponse.map(record => ({
                time: this.formatHistoryTime(record.clock),
                value: this.currentChartType === 'cpu' && !this.isWindows ?
                    (100 - parseFloat(record.value)).toFixed(2) :
                    parseFloat(record.value).toFixed(2)
            }));

            // 初始化图表选项
            const option = {
                tooltip: {
                    trigger: 'axis',
                    formatter: function(params) {
                        const value = params[0].value;
                        const time = params[0].name;
                        return `${time}<br/>${titleText}: ${value}${i18n.t('units.percentage')}`;
                    }
                },
                grid: {
                    top: 30,
                    right: 20,
                    bottom: 30,
                    left: 50,
                    containLabel: true
                },
                xAxis: {
                    type: 'category',
                    boundaryGap: false,
                    data: historyData.map(item => item.time),
                    axisLabel: {
                        fontSize: 10,
                        rotate: 45
                    }
                },
                yAxis: {
                    type: 'value',
                    min: 0,
                    max: 100,
                    splitLine: {
                        lineStyle: {
                            color: '#eee'
                        }
                    }
                },
                series: [{
                    type: 'line',
                    smooth: true,
                    areaStyle: {
                        opacity: 0.3
                    },
                    itemStyle: {
                        color: '#1a73e8'
                    },
                    data: historyData.map(item => item.value)
                }]
            };

            chart.setOption(option);

            // 添加时间范围按钮事件
            document.querySelectorAll('.time-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const range = btn.dataset.range;
                    const timeFrom = this.getTimeFromByRange(range);
                    const historyResponse = await api.request('history.get', {
                        itemids: [parseInt(itemId)],
                        time_from: timeFrom,
                        time_till: now,
                        output: 'extend',
                        history: 0,
                        sortfield: 'clock',
                        sortorder: 'ASC'
                    });

                    const historyData = historyResponse.map(record => ({
                        time: this.formatHistoryTime(record.clock),
                        value: parseFloat(record.value).toFixed(2)
                    }));

                    chart.setOption({
                        xAxis: {
                            data: historyData.map(item => item.time)
                        },
                        series: [{
                            data: historyData.map(item => item.value)
                        }]
                    });

                    // 更新按钮状态
                    document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                });
            });

            // 监听窗口大小变化
            window.addEventListener('resize', () => {
                chart.resize();
            });

        } catch (error) {
            console.error('Failed to load chart data:', error);
        }
    }

    // 根据时间范围计算起始时间
    getTimeFromByRange(range) {
        const now = Math.floor(Date.now() / 1000);
        switch (range) {
            case '1h':
                return now - 3600;  // 1小时 = 3600秒
            case '24h':
                return now - 24 * 3600;
            case '7d':
                return now - 7 * 24 * 3600;
            case '15d':
                return now - 15 * 24 * 3600;
            case '30d':
                return now - 30 * 24 * 3600;
            default:
                return now - 24 * 3600;
        }
    }

    // 添加格式化时间方法
    formatHistoryTime(timestamp) {
        return new Date(timestamp * 1000).toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    initI18n() {
        // 更新页面标题
        document.title = i18n.t('pageTitle.dashboard');
        // 初始化所有带有 data-i18n 属性的元素
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            element.textContent = i18n.t(key);
        });
    }
}

// 新增 ZabbixHosts 类
class ZabbixHosts {
    constructor() {
        this.header = new Header();
        this.hosts = [];                // 存储所有主机数据
        this.refreshManager = new RefreshManager(() => this.refreshHostsList());
        this.initI18n();  // 初始化国际化
        this.init();
        this.initModals();  // 初始化主机详情和图表放大模态框
        this.initAlertDetailModal();  // 初始化告警详情模态框
    }

    // 初始化国际化
    initI18n() {
        // 更新页面标题
        document.title = i18n.t('pageTitle.hostList');
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            element.textContent = i18n.t(key);
        });
    }

    // 添加初始化模态框方法
    initModals() {
        // 初始化主机详情模态框
        const hostDetailModal = document.getElementById('hostDetailModal');
        const closeHostDetailBtn = document.getElementById('closeHostDetailModal');

        if (closeHostDetailBtn) {
            closeHostDetailBtn.addEventListener('click', () => {
                hostDetailModal.style.display = 'none';
            });
        }

        // 点击模态框遮罩层关闭
        if (hostDetailModal) {
            hostDetailModal.addEventListener('click', (e) => {
                if (e.target.classList.contains('modal-overlay')) {
                    hostDetailModal.style.display = 'none';
                }
            });
        }

        // 初始化图表放大模态框
        const zoomChartModal = document.getElementById('zoomChartModal');
        const closeZoomChartBtn = document.getElementById('closeZoomChartModal');

        if (closeZoomChartBtn) {
            closeZoomChartBtn.addEventListener('click', () => {
                zoomChartModal.style.display = 'none';
            });
        }

        // 点击模态框遮罩层关闭
        if (zoomChartModal) {
            zoomChartModal.addEventListener('click', (e) => {
                if (e.target.classList.contains('modal-overlay')) {
                    zoomChartModal.style.display = 'none';
                }
            });
        }
    }

    async init() {
        try {
            await this.loadHosts();
            await this.refreshManager.start();
        } catch (error) {
            console.error('Failed to initialize hosts page:', error);
        }
    }

    async loadHosts() {
        const settings = await this.getSettings();
        if (!settings.apiUrl || !settings.apiToken) {
            window.settingsManager?.showDialog();
            return;
        }

        try {
            const api = new ZabbixAPI(settings.apiUrl, atob(settings.apiToken));
            const hosts = await api.getHosts();
            this.hosts = hosts;
            this.renderHosts(hosts);
            // 更新最后刷新时间
            const lastRefreshTimeElement = document.getElementById('lastRefreshTime');
            if (lastRefreshTimeElement) {
                const now = new Date();
                const timeStr = now.toLocaleTimeString(i18n.currentLang === 'zh' ? 'zh-CN' : 'en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                });
                const template = i18n.t('settings.messages.lastRefresh');
                lastRefreshTimeElement.textContent = template.replace('{time}', timeStr);
            }
        } catch (error) {
            console.error('Failed to load hosts:', error);
        }
    }

    async refreshHostsList() {
        try {
            await this.loadHosts();
        } catch (error) {
            console.error('Failed to refresh hosts list:', error);
        }
    }

    async getSettings() {
        return new Promise((resolve, reject) => {
            chrome.storage.sync.get(['apiUrl', 'apiToken', 'refreshInterval'], (result) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(result);
                }
            });
        });
    }

    renderHosts(hosts) {
        const tbody = document.getElementById('hostsList');
        if (tbody) {
            tbody.innerHTML = hosts.map(host => {
                // 格式化 CPU 使用率
                const cpuUsage = host.cpu ? getProgressBarHTML(host.cpu) : '未知';
                // 格式化内存使用率
                const memoryUsage = host.memory ? getProgressBarHTML(host.memory) : '未知';
                // 格式化告警信息
                const alerts = host.alerts ? 
                    `<span class="alert-count" style="cursor: pointer" data-host-id="${host.hostid}">${host.alerts}</span>` : 
                    '无';

                return `
                    <tr>
                        <td>
                            <a href="#" class="host-name" data-host-id="${host.hostid}" style="color: var(--primary-color); text-decoration: none;">
                                ${host.name}
                            </a>
                        </td>
                        <td>${host.hostname}</td>
                        <td>${host.ip || '未知'}</td>
                        <td class="system-info"><span>${host.os || '未知'}</span></td>
                        <td>${host.cpuCores || '未知'}</td>
                        <td>${host.memoryTotal || '未知'}</td>
                        <td style="min-width: 150px">${cpuUsage}</td>
                        <td style="min-width: 150px">${memoryUsage}</td>
                        <td>${alerts}</td>
                        <td>${host.uptime}</td>
                    </tr>
                `;
            }).join('');

            // 添加主机名称点击事件
            tbody.querySelectorAll('.host-name').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const hostId = e.target.dataset.hostId;
                    this.showHostDetail(hostId);
                });
            });

            // 添加告警点击事件
            tbody.querySelectorAll('.alert-count').forEach(alert => {
                alert.addEventListener('click', (e) => {
                    const hostId = e.currentTarget.dataset.hostId;
                    this.showAlertDetail(hostId);
                });
            });
        }
    }

    // 显示主机详情
    async showHostDetail(hostId) {
        const modal = document.getElementById('hostDetailModal');
        if (!modal) return;

        modal.style.display = 'flex';  // 使用 flex 而不是 block

        // 清空详情页数据
        const setElementContent = (id, value) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
                element.setAttribute('title', value); // 添加 title 属性用于悬浮展示
            }
        };

        // 清空图表
        const cpuChart = echarts.init(document.getElementById('detailCPUChart'));
        const memoryChart = echarts.init(document.getElementById('detailMemoryChart'));
        cpuChart.clear();
        memoryChart.clear();

        // 清空详情页数据时设置默认值和 title
        setElementContent('detailHostName', '-');
        setElementContent('detailHostIP', '-');
        setElementContent('detailHostOS', '-');
        setElementContent('detailUptime', '-');
        setElementContent('detailCPUCores', '-');
        setElementContent('detailMemoryTotal', '-');

        try {
            const settings = await this.getSettings();
            const api = new ZabbixAPI(settings.apiUrl, atob(settings.apiToken));
            
            // 获取主机详细信息
            const hostDetails = await api.getHostDetail(hostId);
            
            // 保存监控项 ID 和系统类型
            this.currentCpuItemId = hostDetails.cpuItemId;
            this.currentMemoryItemId = hostDetails.memoryItemId;
            this.isWindows = hostDetails.isWindows;

            // 更新基本信息
            setElementContent('detailHostName', hostDetails.name);
            setElementContent('detailHostIP', hostDetails.ip);
            setElementContent('detailHostOS', hostDetails.os);
            setElementContent('detailUptime', this.formatUptime(hostDetails.uptime));
            
            // 更新硬件信息
            setElementContent('detailCPUCores', hostDetails.cpuCores);
            setElementContent('detailMemoryTotal', hostDetails.memoryTotal);

            // 初始化性能图表
            this.initPerformanceCharts(hostDetails);

            // 根据监控项是否存在来控制放大按钮
            const cpuZoomBtn = document.querySelector('.zoom-btn[data-chart="cpu"]');
            const memoryZoomBtn = document.querySelector('.zoom-btn[data-chart="memory"]');
            
            if (cpuZoomBtn) {
                if (!hostDetails.cpuItemId) {
                    cpuZoomBtn.style.display = 'none';  // 或者使用 disabled
                } else {
                    cpuZoomBtn.style.display = 'block';
                }
            }
            
            if (memoryZoomBtn) {
                if (!hostDetails.memoryItemId) {
                    memoryZoomBtn.style.display = 'none';  // 或者使用 disabled
                } else {
                    memoryZoomBtn.style.display = 'block';
                }
            }

        } catch (error) {
            console.error('Failed to load host details:', error);
        }
    }

    // 添加 formatUptime 方法
    formatUptime(seconds) {
        if (!seconds) return '-';
        
        const days = Math.floor(seconds / (24 * 60 * 60));
        const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
        const minutes = Math.floor((seconds % (60 * 60)) / 60);
        
        let result = '';
        if (days > 0) result += `${days}天 `;
        if (hours > 0) result += `${hours}小时 `;
        if (minutes > 0) result += `${minutes}分钟`;
        
        return result.trim() || '小于1分钟';
    }

    // 初始化性能图表
    initPerformanceCharts(hostDetails) {
        const cpuChart = echarts.init(document.getElementById('detailCPUChart'));
        const memoryChart = echarts.init(document.getElementById('detailMemoryChart'));
        
        const chartOption = {
            tooltip: {
                trigger: 'axis',
                formatter: function(params) {
                    const value = params[0].value;
                    const time = params[0].name;
                    return `${time}<br/>${i18n.t('chart.tooltip.usage').replace('{value}', value)}`;
                }
            },
            grid: {
                top: 10,
                right: 10,
                bottom: 20,
                left: 40,
                containLabel: true
            },
            xAxis: {
                type: 'category',
                boundaryGap: false,
                data: hostDetails.history.time,
                axisLabel: {
                    fontSize: 10
                }
            },
            yAxis: {
                type: 'value',
                min: 0,
                max: 100,
                splitLine: {
                    lineStyle: {
                        color: '#eee'
                    }
                }
            },
            series: [{
                name: i18n.t('chart.usage'),
                type: 'line',
                smooth: true,
                areaStyle: {
                    opacity: 0.3
                },
                itemStyle: {
                    color: '#1a73e8'
                }
            }]
        };

        // 设置CPU图表数据
        cpuChart.setOption({
            ...chartOption,
            series: [{
                ...chartOption.series[0],
                data: hostDetails.history.cpu
            }]
        });

        // 设置内存图表数据
        memoryChart.setOption({
            ...chartOption,
            series: [{
                ...chartOption.series[0],
                data: hostDetails.history.memory
            }]
        });

        // 监听窗口大小变化，调整图表大小
        window.addEventListener('resize', () => {
            cpuChart.resize();
            memoryChart.resize();
        });

        // 重新初始化放大按钮事件
        this.initZoomChartModal();
    }

    // 初始化图表放大对话框
    initZoomChartModal() {
        const closeBtn = document.getElementById('closeZoomChartModal');
        const modal = document.getElementById('zoomChartModal');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }

        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        }

        // 添加放大按钮点击事件
        document.querySelectorAll('.zoom-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const chartType = e.currentTarget.dataset.chart;
                this.showZoomChart(chartType);
            });
        });
    }

    // 显示放大图表
    async showZoomChart(chartType) {
        this.currentChartType = chartType;
        const modal = document.getElementById('zoomChartModal');
        modal.style.display = 'flex';

        // 根据图表类型设置标题
        const titleText = chartType === 'cpu' ? i18n.t('chartTitle.cpu') : i18n.t('chartTitle.memory');
        document.getElementById('zoomChartTitle').textContent = `${i18n.t('performanceMonitor')} - ${titleText}`;

        const chart = echarts.init(document.getElementById('zoomChart'));
        chart.clear();

        try {
            const settings = await this.getSettings();
            const api = new ZabbixAPI(settings.apiUrl, atob(settings.apiToken));
            
            // 获取监控项ID
            const itemId = chartType === 'cpu' ? this.currentCpuItemId : this.currentMemoryItemId;
            
            // 默认显示24小时数据
            const now = Math.floor(Date.now() / 1000);
            const timeFrom = now - 24 * 3600;
            
            // 获取历史数据
            const historyResponse = await api.request('history.get', {
                itemids: [parseInt(itemId)],
                time_from: timeFrom,
                output: 'extend',
                history: 0,
                sortfield: 'clock',
                sortorder: 'ASC'
            });

            // 处理数据
            const historyData = historyResponse.map(record => ({
                time: this.formatHistoryTime(record.clock),
                value: parseFloat(record.value).toFixed(2)
            }));

            // 初始化图表选项
            const option = {
                tooltip: {
                    trigger: 'axis',
                    formatter: function(params) {
                        const value = params[0].value;
                        const time = params[0].name;
                        return `${time}<br/>${titleText}: ${value}${i18n.t('units.percentage')}`;
                    }
                },
                grid: {
                    top: 30,
                    right: 20,
                    bottom: 30,
                    left: 50,
                    containLabel: true
                },
                xAxis: {
                    type: 'category',
                    boundaryGap: false,
                    data: historyData.map(item => item.time),
                    axisLabel: {
                        fontSize: 10,
                        rotate: 45
                    }
                },
                yAxis: {
                    type: 'value',
                    min: 0,
                    max: 100,
                    splitLine: {
                        lineStyle: {
                            color: '#eee'
                        }
                    }
                },
                series: [{
                    type: 'line',
                    smooth: true,
                    areaStyle: {
                        opacity: 0.3
                    },
                    itemStyle: {
                        color: '#1a73e8'
                    },
                    data: historyData.map(item => item.value)
                }]
            };

            chart.setOption(option);

            // 添加时间范围按钮事件
            document.querySelectorAll('.time-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const range = btn.dataset.range;
                    const timeFrom = this.getTimeFromByRange(range);
                    const historyResponse = await api.request('history.get', {
                        itemids: [parseInt(itemId)],
                        time_from: timeFrom,
                        time_till: now,
                        output: 'extend',
                        history: 0,
                        sortfield: 'clock',
                        sortorder: 'ASC'
                    });

                    const historyData = historyResponse.map(record => ({
                        time: this.formatHistoryTime(record.clock),
                        value: parseFloat(record.value).toFixed(2)
                    }));

                    chart.setOption({
                        xAxis: {
                            data: historyData.map(item => item.time)
                        },
                        series: [{
                            data: historyData.map(item => item.value)
                        }]
                    });

                    // 更新按钮状态
                    document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                });
            });

            // 监听窗口大小变化
            window.addEventListener('resize', () => {
                chart.resize();
            });

        } catch (error) {
            console.error('Failed to load chart data:', error);
        }
    }

    // 添加 getTimeFromByRange 方法
    getTimeFromByRange(range) {
        const now = Math.floor(Date.now() / 1000);
        switch (range) {
            case '1h':
                return now - 3600;
            case '24h':
                return now - 24 * 3600;
            case '7d':
                return now - 7 * 24 * 3600;
            case '15d':
                return now - 15 * 24 * 3600;
            case '30d':
                return now - 30 * 24 * 3600;
            default:
                return now - 24 * 3600;
        }
    }

    // 添加 formatHistoryTime 方法
    formatHistoryTime(timestamp) {
        return new Date(timestamp * 1000).toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    async showAlertDetail(hostId) {
        const modal = document.getElementById('alertDetailModal');
        const tbody = document.getElementById('alertsList');
        
        modal.style.display = 'flex';
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">加载中...</td></tr>';
        
        try {
            const settings = await this.getSettings();
            const api = new ZabbixAPI(settings.apiUrl, atob(settings.apiToken));
            const alerts = await api.getHostAlerts(hostId);
            
            if (alerts.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">暂无告警</td></tr>';
                return;
            }
            
            tbody.innerHTML = alerts.map(alert => `
                <tr>
                    <td>${alert.name}</td>
                    <td><span class="severity ${alert.severity.class}">${alert.severity.name}</span></td>
                    <td>${alert.value}</td>
                    <td>${alert.startTime}</td>
                    <td>${alert.duration}</td>
                </tr>
            `).join('');
            
        } catch (error) {
            console.error('Failed to load alerts:', error);
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: red;">加载失败</td></tr>';
        }
    }

    initAlertDetailModal() {
        const modal = document.getElementById('alertDetailModal');
        const closeBtn = document.getElementById('closeAlertDetailModal');
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }
        
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target.classList.contains('modal-overlay')) {
                    modal.style.display = 'none';
                }
            });
        }
    }
}

// 确保在 DOM 加载完成后再初始化
document.addEventListener('DOMContentLoaded', async function() {
    // 加载头部
    const headerContainer = document.getElementById('header-container');
    const headerResponse = await fetch('header.html');
    const headerHtml = await headerResponse.text();
    headerContainer.innerHTML = headerHtml;
    
    // 在header加载完成后初始化导航
    initializeNavigation();
    
    // 创建全局header实例
    window.headerInstance = new Header();
    
    // 确保 settingsManager 已经初始化
    if (!window.settingsManager) {
        window.settingsManager = new Settings();
    }
    
    const currentPath = window.location.pathname;
    if (currentPath.includes('index.html') || currentPath === '/') {
        new ZabbixDashboard();
    } else if (currentPath.includes('hosts.html')) {
        new ZabbixHosts();
    }
});

function getProgressBarHTML(value) {
    const percentage = parseFloat(value);
    let colorClass = 'medium';  // 默认绿色
    let textColor = '#333';     // 默认黑色文字
    
    if (percentage >= 90) {
        colorClass = 'danger';  // 红色
        textColor = 'white';    // 白色文字
    } else if (percentage >= 80) {
        colorClass = 'warning'; // 橙色
        textColor = 'white';    // 白色文字
    } else if (percentage >= 60) {
        colorClass = 'low';     // 蓝色
    }

    // 当百分比小于15%时，将文字显示在进度条外部右侧
    const textPosition = percentage < 25 
        ? `position: absolute; left: 100%; margin-left: 8px; color: #333;` 
        : `color: ${textColor}`;

    return `
        <div class="progress-bar" style="position: relative;">
            <div class="progress-fill ${colorClass}" style="width: ${percentage}%">
                <span style="white-space: nowrap; ${textPosition}">${percentage} %</span>
            </div>
        </div>
    `;
} 
