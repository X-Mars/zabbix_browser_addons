class ZabbixDashboard {
    constructor() {
        this.init();
        this.initI18n();
        this.charts = {};
        this.refreshTimer = null;
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
            document.getElementById('settingsBtn').click();
            return;
        }
        
        await this.loadDashboard();
        // 使用设置的刷新间隔
        const interval = parseInt(settings.refreshInterval) || 300000;  // 默认5分钟
        this.refreshTimer = setInterval(() => this.loadDashboard(), interval);
    }

    async loadDashboard() {
        try {
            const settings = await this.getSettings();
            const api = new ZabbixAPI(settings.apiUrl, atob(settings.apiToken));

            // 更新最后刷新时间
            this.updateLastRefreshTime();

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
        console.log(alerts);
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
        const now = new Date().toLocaleString(
            this.currentLang === 'zh' ? 'zh-CN' : 'en-US',
            { 
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            }
        );
        const element = document.getElementById('lastRefreshTime');
        element.textContent = i18n.t('settings.messages.lastRefresh').replace('{time}', now);
    }

    initHostsModal() {
        // 添加主机数量卡片点击事件
        const hostCard = document.querySelector('.status-card:first-child');
        hostCard.style.cursor = 'pointer';
        hostCard.addEventListener('click', () => this.showHostsModal());

        // 添加关闭按钮事件
        document.getElementById('closeHostsModal').addEventListener('click', () => {
            document.getElementById('hostsModal').classList.remove('active');
        });

        // 点击遮罩层关闭
        document.getElementById('hostsModal').addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) {
                document.getElementById('hostsModal').classList.remove('active');
            }
        });

        // 添加表头排序事件
        const sortableHeaders = document.querySelectorAll('.sortable');
        sortableHeaders.forEach(header => {
            header.addEventListener('click', () => this.sortTable(header.dataset.sort));
        });
    }

    // 排序函数
    sortTable(column) {
        // 如果点击的是当前排序列，则切换排序方向
        if (this.currentSort.column === column) {
            this.currentSort.direction = this.currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            this.currentSort.column = column;
            this.currentSort.direction = 'asc';
        }

        // 更新排序图标
        this.updateSortIcons(column);

        // 排序数据
        this.hostsData.sort((a, b) => {
            let valueA, valueB;

            // 特殊处理告警数量列
            if (column === 'alerts') {
                valueA = parseInt(a[column]) || 0;
                valueB = parseInt(b[column]) || 0;
            } else {
                valueA = this.getSortValue(a[column]);
                valueB = this.getSortValue(b[column]);
            }
            
            if (valueA === valueB) return 0;
            
            const direction = this.currentSort.direction === 'asc' ? 1 : -1;
            return valueA < valueB ? -1 * direction : 1 * direction;
        });

        // 重新渲染表格
        this.renderHostsTable();
    }

    // 获取排序值
    getSortValue(value) {
        if (value === '-') return -1;
        // 移除百分号和 GB 后缀
        value = String(value).replace(/%/g, '').replace(/GB/g, '').trim();
        return parseFloat(value) || 0;
    }

    // 更新排序图标
    updateSortIcons(activeColumn) {
        const headers = document.querySelectorAll('.sortable');
        headers.forEach(header => {
            const icon = header.querySelector('i');
            if (header.dataset.sort === activeColumn) {
                header.setAttribute('data-active', 'true');
                header.setAttribute('title', `点击${this.currentSort.direction === 'asc' ? '降序' : '升序'}排序`);
                icon.className = `fas fa-sort-${this.currentSort.direction === 'asc' ? 'up' : 'down'}`;
            } else {
                header.removeAttribute('data-active');
                header.setAttribute('title', '点击排序');
                icon.className = 'fas fa-sort';
            }
        });
    }

    // 渲染主机表格
    renderHostsTable() {
        const tbody = document.getElementById('hostsList');
        tbody.innerHTML = this.hostsData.map(host => `
            <tr class="${parseInt(host.alerts) > 0 ? 'has-alerts' : 'no-alerts'}">
                <td>${host.name}</td>
                <td>${host.ip}</td>
                <td>${host.os}</td>
                <td>${host.cpuCores}</td>
                <td>${host.memoryTotal}</td>
                <td style="min-width: 150px">${getProgressBarHTML(host.cpu)}</td>
                <td style="min-width: 150px">${getProgressBarHTML(host.memory)}</td>
                <td>${host.alerts}</td>
            </tr>
        `).join('');
    }

    async showHostsModal() {
        const modal = document.getElementById('hostsModal');
        modal.classList.add('active');

        try {
            const settings = await this.getSettings();
            const api = new ZabbixAPI(settings.apiUrl, atob(settings.apiToken));
            this.hostsData = await api.getHostsDetails();  // 存储数据
            
            // 使用类的 renderHostsList 方法
            this.renderHostsList(this.hostsData);  // 修改这里，使用 this.renderHostsList
            
        } catch (error) {
            console.error('Failed to load hosts details:', error);
            const tbody = document.getElementById('hostsList');
            tbody.innerHTML = `<tr><td colspan="8">${i18n.t('settings.messages.loadingFailed')}</td></tr>`;
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
                console.log('Clicked Host ID:', hostId); // 添加调试日志
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
        
        const days = Math.floor(seconds / (24 * 3600));
        const hours = Math.floor((seconds % (24 * 3600)) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        const parts = [];
        if (days > 0) parts.push(`${days}天`);
        if (hours > 0) parts.push(`${hours}小时`);
        if (minutes > 0) parts.push(`${minutes}分钟`);
        
        return parts.length > 0 ? parts.join(' ') : '小于1分钟';
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
    showZoomChart(chartType) {
        const modal = document.getElementById('zoomChartModal');
        const title = document.getElementById('zoomChartTitle');
        const chart = echarts.init(document.getElementById('zoomChart'));
        
        // 保存当前图表类型
        this.currentChartType = chartType;
        
        // 获取原始图表数据
        const originalChart = echarts.getInstanceByDom(
            document.getElementById(chartType === 'cpu' ? 'detailCPUChart' : 'detailMemoryChart')
        );
        const option = originalChart.getOption();

        // 从原始图表获取 itemId
        const itemId = chartType === 'cpu' ? this.currentCpuItemId : this.currentMemoryItemId;
        this.currentItemId = itemId;

        // 设置标题
        const titleText = i18n.t(`chartTitle.${chartType}`);
        title.textContent = `${titleText} ${i18n.t('timeRange.24h')}`;
        
        // 显示模态框
        modal.classList.add('active');

        // 设置放大图表的配置
        const zoomOption = {
            tooltip: {
                trigger: 'axis',
                formatter: function(params) {
                    const value = params[0].value;
                    const time = params[0].name;
                    return `${time}<br/>${i18n.t('chart.tooltip.usage').replace('{value}', value)}`;
                },
                textStyle: {
                    fontSize: 14
                }
            },
            grid: {
                top: 60,      // 增加顶部空间
                right: 80,    // 增加右侧空间
                bottom: 60,   // 增加底部空间
                left: 80,     // 增加左侧空间
                containLabel: true
            },
            xAxis: {
                type: 'category',
                boundaryGap: false,
                data: option.xAxis[0].data,
                axisLabel: {
                    fontSize: 12,
                    margin: 16,    // 增加标签与轴的距离
                    rotate: 45     // 斜角显示时间标签
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
                },
                axisLabel: {
                    fontSize: 12,
                    margin: 16,    // 增加标签与轴的距离
                    formatter: '{value}%'
                }
            },
            series: [{
                name: i18n.t('chart.usage'),
                type: 'line',
                smooth: true,
                symbolSize: 6,     // 增加数据点大小
                lineStyle: {
                    width: 2       // 增加线条宽度
                },
                areaStyle: {
                    opacity: 0.3
                },
                itemStyle: {
                    color: '#1a73e8'
                },
                data: option.series[0].data
            }]
        };

        // 设置图表
        chart.setOption(zoomOption);

        // 等待模态框动画完成后重新调整图表大小
        setTimeout(() => {
            chart.resize();
        }, 300);

        // 监听窗口大小变化
        window.addEventListener('resize', () => {
            chart.resize();
        });

        // 添加时间范围按钮点击事件
        document.querySelectorAll('.time-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                // 更新按钮状态
                document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');

                // 获取选择的时间范围
                const range = e.target.dataset.range;
                const timeFrom = this.getTimeFromByRange(range);

                try {
                    const settings = await this.getSettings();
                    const api = new ZabbixAPI(settings.apiUrl, atob(settings.apiToken));
                    
                    // 获取历史数据
                    const historyData = await api.request('history.get', {
                        itemids: [parseInt(this.currentItemId)],
                        time_from: timeFrom,
                        output: 'extend',
                        history: 0,
                        sortfield: 'clock',
                        sortorder: 'ASC'
                    });

                    // 更新图表标题和数据
                    await this.updateZoomChartData(chart, historyData, range);
                } catch (error) {
                    console.error('Failed to update chart:', error);
                }
            });
        });
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

    // 更新图表数据
    async updateZoomChartData(chart, historyData, range) {
        const rangeText = {
            '1h': i18n.t('1h'),
            '24h': i18n.t('24h'),
            '7d': i18n.t('7d'),
            '15d': i18n.t('15d'),
            '30d': i18n.t('30d')
        };

        // 更新标题
        const title = i18n.t(`chartTitle.${this.currentChartType}`);
        document.getElementById('zoomChartTitle').textContent = `${title} ${i18n.t(`timeRange.${range}`)}`;

        // 处理数据值
        const values = this.currentChartType === 'cpu' && !this.isWindows ?
            historyData.map(record => (100 - parseFloat(record.value)).toFixed(2)) :
            historyData.map(record => parseFloat(record.value).toFixed(2));

        // 获取 API 实例来使用其格式化方法
        const settings = await this.getSettings();
        const api = new ZabbixAPI(settings.apiUrl, atob(settings.apiToken));

        // 更新图表数据
        chart.setOption({
            xAxis: {
                data: historyData.map(record => api.formatHistoryTime(record.clock))
            },
            series: [{
                data: values
            }]
        });
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

// 初始化应用
new ZabbixDashboard(); 

// 初始化设置对话框
document.getElementById('settingsBtn').addEventListener('click', () => {
    document.getElementById('settingsModal').classList.add('active');
});

// 通过关闭按钮或点击遮罩层关闭设置对话框
document.getElementById('settingsModal').addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        document.getElementById('settingsModal').classList.remove('active');
    }
});

document.getElementById('closeModal').addEventListener('click', () => {
    document.getElementById('settingsModal').classList.remove('active');
});

// 主机列表对话框保持原有行为
document.getElementById('hostsModal').addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        document.getElementById('hostsModal').classList.remove('active');
    }
}); 

function getProgressBarHTML(value) {
    const percentage = parseFloat(value);
    let colorClass = 'medium';  // 默认绿色
    
    if (percentage >= 90) {
        colorClass = 'danger';  // 红色
    } else if (percentage >= 80) {
        colorClass = 'warning';  // 橙色
    } else if (percentage >= 60) {
        colorClass = 'low';  // 蓝色
    }

    // 当百分比小于15%时，添加额外的左边距
    const textStyle = percentage < 15 ? 'margin-left: 48px;' : '';

    return `
        <div class="progress-bar">
            <div class="progress-fill ${colorClass}" style="width: ${percentage}%">
                <span style="${textStyle}">${percentage} %</span>
            </div>
        </div>
    `;
} 