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
                // 显示设置对话框
                window.settingsManager.showDialog();
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
            const timeStr = `${now.toISOString().slice(0, 10)} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
            this.lastRefreshTimeElement.textContent = `最后刷新时间: ${timeStr}`;
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
            document.getElementById('settingsModal').classList.add('active');
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
        document.getElementById('detailHostName').textContent = '-';
        document.getElementById('detailHostIP').textContent = '-';
        document.getElementById('detailHostOS').textContent = '-';
        document.getElementById('detailUptime').textContent = '-';
        document.getElementById('detailCPUCores').textContent = '-';
        document.getElementById('detailMemoryTotal').textContent = '-';

        // 清空图表
        const cpuChart = echarts.init(document.getElementById('detailCPUChart'));
        const memoryChart = echarts.init(document.getElementById('detailMemoryChart'));
        cpuChart.clear();
        memoryChart.clear();

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
            document.getElementById('detailHostName').textContent = hostDetails.name;
            document.getElementById('detailHostIP').textContent = hostDetails.ip;
            document.getElementById('detailHostOS').textContent = hostDetails.os;
            document.getElementById('detailUptime').textContent = this.formatUptime(hostDetails.uptime);
            
            // 更新硬件信息
            document.getElementById('detailCPUCores').textContent = hostDetails.cpuCores;
            document.getElementById('detailMemoryTotal').textContent = hostDetails.memoryTotal;

            // 初始化性能图表
            this.initPerformanceCharts(hostDetails);

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

    // 修改主机列表渲染函数，添加点击事件
    renderHostsList(hosts) {
        const hostsListElement = document.getElementById('hostsList');
        hostsListElement.innerHTML = hosts.map(host => `
            <tr class="${parseInt(host.alerts) > 0 ? 'has-alerts' : 'no-alerts'}">
                <td><a href="#" class="host-name" data-host-id="${parseInt(host.hostid)}" style="color: var(--primary-color); text-decoration: none;">${host.name}</a></td>
                <td>${host.ip}</td>
                <td>${host.os}</td>
                <td>${host.cpuCores}</td>
                <td>${host.memoryTotal}</td>
                <td style="min-width: 150px">${getProgressBarHTML(host.cpu)}</td>
                <td style="min-width: 150px">${getProgressBarHTML(host.memory)}</td>
                <td>${host.alerts}</td>
            </tr>
        `).join('');

        // 添加主机名称点击事件
        document.querySelectorAll('.host-name').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const hostId = parseInt(e.target.dataset.hostId);
                // console.log('Clicked Host ID:', hostId); // 添加调试日志
                this.showHostDetail(hostId);
            });
        });
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
        const titleText = chartType === 'cpu' ? 'CPU利用率' : '内存利用率';
        document.getElementById('zoomChartTitle').textContent = `性能监控 - ${titleText}`;

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
                title: {
                    text: titleText,
                    left: 'center',
                    top: 10,
                    textStyle: {
                        fontSize: 16,
                        fontWeight: 'bold'
                    }
                },
                tooltip: {
                    trigger: 'axis',
                    formatter: function(params) {
                        const value = params[0].value;
                        const time = params[0].name;
                        return `${time}<br/>${titleText}: ${value}%`;
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
                        value: this.currentChartType === 'cpu' && !this.isWindows ?
                            (100 - parseFloat(record.value)).toFixed(2) :
                            parseFloat(record.value).toFixed(2)
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
        this.refreshManager = new RefreshManager(() => this.loadHosts());
        this.init();
        this.initHostDetailModal();
        this.initZoomChartModal();
        this.currentItemId = null;
        this.currentChartType = null;
        this.currentCpuItemId = null;
        this.currentMemoryItemId = null;
        this.isWindows = false;
        this.hostGroups = [];  // 存储主机组数据
        this.hosts = [];       // 存储所有主机数据
        this.initFilters();    // 初始化筛选功能
    }

    async init() {
        await this.loadHosts();
        await this.refreshManager.start();
    }

    async loadHosts() {
        try {
            const settings = await this.getSettings();
            if (!settings.apiUrl || !settings.apiToken) {
                if (this.header.settingsModal) {
                    this.header.settingsModal.classList.add('active');
                }
                return;
            }
            const api = new ZabbixAPI(settings.apiUrl, atob(settings.apiToken));
            
            // 使用 getHostsDetails 替代 getHosts
            const hosts = await api.getHostsDetails();
            
            this.renderHosts(hosts);
            // 更新最后刷新时间
            this.header.updateLastRefreshTime();
        } catch (error) {
            console.error('加载主机列表失败:', error);
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
                const alerts = host.alerts ? `<span class="alert-count">${host.alerts}</span>` : '无';

                return `
                    <tr>
                        <td>
                            <a href="#" class="host-name" data-host-id="${host.hostid}" style="color: var(--primary-color); text-decoration: none;">
                                ${host.name}
                            </a>
                        </td>
                        <td>${host.ip || '未知'}</td>
                        <td>${host.os || '未知'}</td>
                        <td>${host.cpuCores || '未知'}</td>
                        <td>${host.memoryTotal || '未知'}</td>
                        <td>${cpuUsage}</td>
                        <td>${memoryUsage}</td>
                        <td>${alerts}</td>
            </tr>
                `;
            }).join('');

            // 添加主机名称点击事件
            document.querySelectorAll('.host-name').forEach(link => {
                link.addEventListener('click', async (e) => {
                    e.preventDefault();
                    const hostId = e.target.dataset.hostId;
                    await this.showHostDetail(hostId);
                });
            });
        }
    }

    // 初始化主机详情对话框
    initHostDetailModal() {
        const closeBtn = document.getElementById('closeHostDetailModal');
        const modal = document.getElementById('hostDetailModal');

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

    // 显示主机详情
    async showHostDetail(hostId) {
        const modal = document.getElementById('hostDetailModal');
        modal.style.display = 'flex';

        // 清空详情页数据
        document.getElementById('detailHostName').textContent = '-';
        document.getElementById('detailHostIP').textContent = '-';
        document.getElementById('detailHostOS').textContent = '-';
        document.getElementById('detailUptime').textContent = '-';
        document.getElementById('detailCPUCores').textContent = '-';
        document.getElementById('detailMemoryTotal').textContent = '-';

        // 清空图表
        const cpuChart = echarts.init(document.getElementById('detailCPUChart'));
        const memoryChart = echarts.init(document.getElementById('detailMemoryChart'));
        cpuChart.clear();
        memoryChart.clear();

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
            document.getElementById('detailHostName').textContent = hostDetails.name;
            document.getElementById('detailHostIP').textContent = hostDetails.ip;
            document.getElementById('detailHostOS').textContent = hostDetails.os;
            document.getElementById('detailUptime').textContent = this.formatUptime(hostDetails.uptime);
            
            // 更新硬件信息
            document.getElementById('detailCPUCores').textContent = hostDetails.cpuCores;
            document.getElementById('detailMemoryTotal').textContent = hostDetails.memoryTotal;

            // 初始化性能图表
            this.initPerformanceCharts(hostDetails);

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

    // 添加 showZoomChart 方法
    async showZoomChart(chartType) {
        this.currentChartType = chartType;
        const modal = document.getElementById('zoomChartModal');
        modal.style.display = 'flex';

        // 根据图表类型设置标题
        const titleText = chartType === 'cpu' ? 'CPU利用率' : '内存利用率';
        document.getElementById('zoomChartTitle').textContent = `性能监控 - ${titleText}`;

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
                title: {
                    text: titleText,
                    left: 'center',
                    top: 10,
                    textStyle: {
                        fontSize: 16,
                        fontWeight: 'bold'
                    }
                },
                tooltip: {
                    trigger: 'axis',
                    formatter: function(params) {
                        const value = params[0].value;
                        const time = params[0].name;
                        return `${time}<br/>${titleText}: ${value}%`;
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
                        value: this.currentChartType === 'cpu' && !this.isWindows ?
                            (100 - parseFloat(record.value)).toFixed(2) :
                            parseFloat(record.value).toFixed(2)
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

    // 初始化筛选功能
    async initFilters() {
        const groupSelect = document.getElementById('hostGroupSelect');
        const hostSelect = document.getElementById('hostSelect');

        // 添加事件监听
        groupSelect.addEventListener('change', () => this.onGroupChange());
        hostSelect.addEventListener('change', () => this.onHostChange());

        try {
            const settings = await this.getSettings();
            const api = new ZabbixAPI(settings.apiUrl, atob(settings.apiToken));
            
            // 获取所有主机组
            const groups = await api.request('hostgroup.get', {
                output: ['groupid', 'name'],
                sortfield: 'name'
            });

            // 更新主机组下拉框
            this.hostGroups = groups;
            groupSelect.innerHTML = `
                <option value="all">所有主机组</option>
                ${groups.map(group => `
                    <option value="${group.groupid}">${group.name}</option>
                `).join('')}
            `;
        } catch (error) {
            console.error('Failed to load host groups:', error);
        }
    }

    // 主机组变更处理
    async onGroupChange() {
        const groupSelect = document.getElementById('hostGroupSelect');
        const hostSelect = document.getElementById('hostSelect');
        const selectedGroupId = groupSelect.value;

        try {
            const settings = await this.getSettings();
            const api = new ZabbixAPI(settings.apiUrl, atob(settings.apiToken));

            // 获取选中组的主机
            let hosts;
            if (selectedGroupId === 'all') {
                hosts = await api.request('host.get', {
                    output: ['hostid', 'name', 'status'],
                    selectInterfaces: ['ip'],
                    selectInventory: ['os', 'os_full', 'hw_arch'],
                    selectHostGroups: ['groupid', 'name'],
                    sortfield: 'name'
                });
            } else {
                hosts = await api.request('host.get', {
                    output: ['hostid', 'name', 'status'],
                    selectInterfaces: ['ip'],
                    selectInventory: ['os', 'os_full', 'hw_arch'],
                    selectHostGroups: ['groupid', 'name'],
                    groupids: selectedGroupId,
                    sortfield: 'name'
                });
            }

            // 获取所有监控项
            const items = await api.request('item.get', {
                output: ['itemid', 'hostid', 'name', 'key_', 'lastvalue'],
                groupids: selectedGroupId === 'all' ? undefined : selectedGroupId,
                search: {
                    key_: ['system.cpu.util', 'vm.memory.util']
                },
                searchByAny: true
            });

            // 格式化主机数据
            const formattedHosts = hosts.map(host => {
                // 找到当前主机的监控项
                const hostItems = items.filter(item => item.hostid === host.hostid);
                const cpuItem = hostItems.find(item => item.key_.includes('system.cpu.util'));
                const memoryItem = hostItems.find(item => item.key_.includes('vm.memory.util'));

                return {
                    hostid: host.hostid,
                    name: host.name,
                    ip: host.interfaces[0]?.ip || '-',
                    os: host.inventory.os_full || host.inventory.os || '-',
                    cpuCores: '2', // 这里可以添加获取CPU核心数的逻辑
                    memoryTotal: '2 GB', // 这里可以添加获取内存总量的逻辑
                    cpu: cpuItem ? parseFloat(cpuItem.lastvalue).toFixed(2) : '-',
                    memory: memoryItem ? parseFloat(memoryItem.lastvalue).toFixed(2) : '-',
                    alerts: 0 // 这里可以添加获取告警数的逻辑
                };
            });

            // 更新主机下拉框
            this.hosts = formattedHosts;
            hostSelect.innerHTML = `
                <option value="all">所有主机</option>
                ${formattedHosts.map(host => `
                    <option value="${host.hostid}">${host.name}</option>
                `).join('')}
            `;

            // 更新主机列表
            this.renderHosts(formattedHosts);

        } catch (error) {
            console.error('Failed to load hosts:', error);
        }
    }

    // 主机选择变更处理
    async onHostChange() {
        const hostSelect = document.getElementById('hostSelect');
        const selectedHostId = hostSelect.value;
        const groupSelect = document.getElementById('hostGroupSelect');
        const selectedGroupId = groupSelect.value;

        try {
            if (selectedHostId === 'all') {
                // 获取当前组的所有监控项
                const settings = await this.getSettings();
                const api = new ZabbixAPI(settings.apiUrl, atob(settings.apiToken));

                // 获取监控项，根据当前选中的组进行过滤
                const items = await api.request('item.get', {
                    output: ['itemid', 'hostid', 'name', 'key_', 'lastvalue'],
                    groupids: selectedGroupId === 'all' ? undefined : selectedGroupId,
                    search: {
                        key_: ['system.cpu.util', 'vm.memory.util']
                    },
                    searchByAny: true
                });

                // 更新所有主机的监控数据
                const updatedHosts = this.hosts.map(host => {
                    const hostItems = items.filter(item => item.hostid === host.hostid);
                    const cpuItem = hostItems.find(item => item.key_.includes('system.cpu.util'));
                    const memoryItem = hostItems.find(item => item.key_.includes('vm.memory.util'));

                    return {
                        ...host,
                        cpu: cpuItem ? parseFloat(cpuItem.lastvalue).toFixed(2) : '-',
                        memory: memoryItem ? parseFloat(memoryItem.lastvalue).toFixed(2) : '-'
                    };
                });

                // 显示更新后的主机列表
                this.renderHosts(updatedHosts);
            } else {
                const settings = await this.getSettings();
                const api = new ZabbixAPI(settings.apiUrl, atob(settings.apiToken));

                // 获取选中主机的监控项
                const items = await api.request('item.get', {
                    output: ['itemid', 'hostid', 'name', 'key_', 'lastvalue'],
                    hostids: selectedHostId,  // 指定主机ID
                    search: {
                        key_: ['system.cpu.util', 'vm.memory.util']
                    },
                    searchByAny: true
                });

                // 找到选中的主机
                const selectedHost = this.hosts.find(host => host.hostid === selectedHostId);
                if (selectedHost) {
                    // 更新主机的监控数据
                    const cpuItem = items.find(item => item.key_.includes('system.cpu.util'));
                    const memoryItem = items.find(item => item.key_.includes('vm.memory.util'));

                    const updatedHost = {
                        ...selectedHost,
                        cpu: cpuItem ? parseFloat(cpuItem.lastvalue).toFixed(2) : '-',
                        memory: memoryItem ? parseFloat(memoryItem.lastvalue).toFixed(2) : '-'
                    };

                    // 显示更新后的主机数据
                    this.renderHosts([updatedHost]);
                }
            }
        } catch (error) {
            console.error('Failed to load host items:', error);
        }
    }
}

// 根据当前页面初始化相应的类
document.addEventListener('DOMContentLoaded', () => {
    const currentPath = window.location.pathname;
    
    if (currentPath.includes('index.html')) {
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
    const textPosition = percentage < 15 
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
