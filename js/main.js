class ZabbixDashboard {
    constructor() {
        this.init();
        this.charts = {};
        this.refreshTimer = null;
        this.initHostsModal();
        this.currentSort = {
            column: null,
            direction: 'asc'
        };
        this.hostsData = [];  // 存储主机数据
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
                <td>${host.cpu}</td>
                <td>${host.memory}</td>
                <td>${host.alerts}</td>
            </tr>
        `).join('');
    }

    async showHostsModal() {
        const modal = document.getElementById('hostsModal');
        const tbody = document.getElementById('hostsList');
        modal.classList.add('active');

        try {
            const settings = await this.getSettings();
            const api = new ZabbixAPI(settings.apiUrl, atob(settings.apiToken));
            this.hostsData = await api.getHostsDetails();  // 存储数据
            this.renderHostsTable();  // 渲染表格
        } catch (error) {
            console.error('Failed to load hosts details:', error);
            tbody.innerHTML = '<tr><td colspan="6">加载失败</td></tr>';
        }
    }

    getStatusClass(status) {
        // status: 0 - 已恢复, 1 - 告警中
        return status === '0' ? 'resolved' : 'problem';
    }

    getStatusName(status) {
        return status === '0' ? '已恢复' : '告警中';
    }

    formatDuration(seconds) {
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