class ResourceMonitoringDashboard {
    constructor() {
        this.api = null;
        this.charts = {};
        this.refreshInterval = null;
        this.hostData = [];
        this.isLoading = false;
        
        // 排序状态管理
        this.sortState = {
            field: 'name',     // 默认按名称排序
            order: 'asc'       // 'asc' 或 'desc'
        };
        
        // 初始化
        this.init();
    }

    async init() {
        console.log('初始化资源监控大屏...');
        
        // 应用国际化
        this.applyI18n();
        
        // 获取API实例
        this.api = await this.getApiInstance();
        if (!this.api) {
            this.showError(i18n.t('errors.connectionFailed'));
            return;
        }

        // 初始化图表
        this.initCharts();
        
        // 初始化键盘快捷键
        this.initKeyboardShortcuts();
        
        // 加载数据
        await this.loadDashboardData();
        
        // 设置自动刷新
        await this.startAutoRefresh();
        
        // 监听设置变化
        this.initSettingsListener();
        
        // 更新刷新时间显示
        this.updateRefreshTime();
    }

    // 应用国际化
    applyI18n() {
        document.title = i18n.t('pageTitle.screen2');
        
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

    async getApiInstance() {
        try {
            // 获取设置
            const settings = await this.getSettings();
            if (!settings.apiUrl || !settings.apiToken) {
                throw new Error(i18n.t('errors.incompleteApiConfig'));
            }
            
            // 创建API实例
            const api = new ZabbixAPI(settings.apiUrl, atob(settings.apiToken));
            return api;
        } catch (error) {
            console.error('获取API实例失败:', error);
            return null;
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

    initCharts() {
        console.log('初始化图表...');
        
        // CPU使用率趋势图
        const cpuElement = document.getElementById('cpuUtilizationChart');
        if (cpuElement) {
            this.charts.cpu = echarts.init(cpuElement);
        }
        
        // 内存使用率分布图
        const memoryElement = document.getElementById('memoryUtilizationChart');
        if (memoryElement) {
            this.charts.memory = echarts.init(memoryElement);
        }
        
        // CPU使用率分布图
        const cpuDistributionElement = document.getElementById('cpuDistributionChart');
        if (cpuDistributionElement) {
            this.charts.cpuDistribution = echarts.init(cpuDistributionElement);
        }
        
        // 内存使用率趋势图
        const memoryTrendElement = document.getElementById('memoryTrendChart');
        if (memoryTrendElement) {
            this.charts.memoryTrend = echarts.init(memoryTrendElement);
        }

        // 告警趋势图
        const alertTrendElement = document.getElementById('alertTrendChart');
        if (alertTrendElement) {
            this.charts.alertTrend = echarts.init(alertTrendElement);
        }

        // 监听窗口大小变化
        window.addEventListener('resize', () => {
            Object.values(this.charts).forEach(chart => {
                if (chart) chart.resize();
            });
        });
    }

    // 初始化键盘快捷键
    initKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // 只在非输入元素上响应快捷键
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            // Alt + 数字键快速切换排序字段
            if (e.altKey && !e.ctrlKey && !e.shiftKey) {
                switch (e.key) {
                    case '1':
                        e.preventDefault();
                        this.sortState.field = 'name';
                        this.refreshHostOverview();
                        break;
                    case '2':
                        e.preventDefault();
                        this.sortState.field = 'ip';
                        this.refreshHostOverview();
                        break;
                    case '3':
                        e.preventDefault();
                        this.sortState.field = 'cpu';
                        this.refreshHostOverview();
                        break;
                    case '4':
                        e.preventDefault();
                        this.sortState.field = 'memory';
                        this.refreshHostOverview();
                        break;
                    case '5':
                        e.preventDefault();
                        this.sortState.field = 'status';
                        this.refreshHostOverview();
                        break;
                }
            }

            // Ctrl + 上/下箭头切换排序方向
            if (e.ctrlKey && !e.altKey && !e.shiftKey) {
                if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    this.sortState.order = 'asc';
                    this.refreshHostOverview();
                } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    this.sortState.order = 'desc';
                    this.refreshHostOverview();
                }
            }
        });
    }

    async loadDashboardData() {
        if (this.isLoading) return;
        
        this.isLoading = true;
        console.log('开始加载资源监控数据...');

        try {
            // 获取主机列表基本信息
            const basicHosts = await this.api.getHostsDetails();
            console.log(`获取到${basicHosts.length}台主机基本数据`);
            
            // 重要：使用我们的方法获取完整的监控数据
            const hosts = await this.enrichHostsWithMonitoringData(basicHosts);
            console.log(`完成监控数据enrichment，共${hosts.length}台主机`);
            
            this.hostData = hosts;
            
            // 更新主机概览
            this.updateHostOverview(hosts);
            
            // 更新各种图表
            await Promise.all([
                this.updateCpuChart(hosts),
                this.updateMemoryChart(hosts),
                this.updateCpuDistributionChart(hosts),
                this.updateMemoryTrendChart(hosts),
                this.updateAlertTrendChart()
            ]);
            
            console.log(`资源监控数据加载完成，共${hosts.length}台主机`);
            this.updateRefreshTime();
        } catch (error) {
            console.error('加载数据失败:', error);
            this.showError(i18n.t('errors.loadFailed') + ': ' + error.message);
        } finally {
            this.isLoading = false;
        }
    }

    async enrichHostsWithMonitoringData(hosts) {
        console.log('开始获取主机监控数据...');
        
        // 批量获取主机监控数据
        const enrichedHosts = await Promise.all(
            hosts.map(async (host) => {
                try {
                    // 获取所有监控项，然后筛选需要的
                    const allItems = await this.api.getItems(host.hostid);
                    
                    // 查找CPU相关监控项
                    const cpuItem = this.findBestItem(allItems, [
                        'system.cpu.util',
                        'system.cpu.util[,idle]',
                        'system.cpu.util[,system]',
                        'system.cpu.utilization'
                    ]);
                    
                    // 查找内存相关监控项
                    const memoryItem = this.findBestItem(allItems, [
                        'vm.memory.util',
                        'vm.memory.utilization',
                        'vm.memory.pused',
                        'system.memory.util'
                    ]);
                    
                    // 获取网络接口监控项
                    const networkInItems = allItems.filter(item => 
                        item.key_.includes('net.if.in') && !item.key_.includes('packets')
                    );
                    const networkOutItems = allItems.filter(item => 
                        item.key_.includes('net.if.out') && !item.key_.includes('packets')
                    );
                    
                    // 计算CPU使用率（如果是idle，需要转换为util）
                    let cpuValue = '0.0';
                    if (cpuItem) {
                        const rawValue = parseFloat(cpuItem.lastvalue || 0);
                        if (cpuItem.key_.includes('idle')) {
                            // 如果是idle，转换为使用率
                            cpuValue = (100 - rawValue).toFixed(1);
                        } else {
                            cpuValue = rawValue.toFixed(1);
                        }
                    }
                    
                    // 获取内存使用率
                    const memoryValue = memoryItem ? parseFloat(memoryItem.lastvalue || 0).toFixed(1) : '0.0';
                    
                    return {
                        ...host,
                        cpu: cpuValue,
                        memory: memoryValue,
                        networkIn: networkInItems.length > 0 ? networkInItems[0].itemid : null,
                        networkOut: networkOutItems.length > 0 ? networkOutItems[0].itemid : null,
                        lastUpdate: new Date().toISOString(),
                        // 保存监控项信息用于调试
                        cpuItemKey: cpuItem ? cpuItem.key_ : null,
                        memoryItemKey: memoryItem ? memoryItem.key_ : null
                    };
                } catch (error) {
                    console.error(`获取主机 ${host.name} 监控数据失败:`, error);
                    return {
                        ...host,
                        cpu: '0.0',
                        memory: '0.0',
                        networkIn: null,
                        networkOut: null,
                        lastUpdate: new Date().toISOString()
                    };
                }
            })
        );
        
        console.log('主机监控数据获取完成');
        return enrichedHosts;
    }

    // 辅助方法：在监控项列表中查找最佳匹配
    findBestItem(items, keyPatterns) {
        // 优先级匹配：精确匹配 > 前缀匹配 > name匹配 > 包含匹配 > 模糊匹配
        for (const pattern of keyPatterns) {
            // 1. 精确匹配key
            const exactMatch = items.find(item => item.key_ === pattern);
            if (exactMatch && exactMatch.lastvalue !== null && exactMatch.lastvalue !== undefined) {
                return exactMatch;
            }
            
            // 2. 前缀匹配key
            const prefixMatch = items.find(item => item.key_.startsWith(pattern));
            if (prefixMatch && prefixMatch.lastvalue !== null && prefixMatch.lastvalue !== undefined) {
                return prefixMatch;
            }
            
            // 3. name字段匹配（支持常见的监控项名称格式）
            const nameMatch = items.find(item => 
                item.name && (
                    item.name === pattern ||
                    item.name.includes(pattern)
                ) &&
                item.lastvalue !== null && 
                item.lastvalue !== undefined
            );
            if (nameMatch) {
                return nameMatch;
            }
            
            // 4. 包含匹配（用于处理带参数的key）
            if (pattern.includes('[')) {
                const baseKey = pattern.split('[')[0];
                const containsMatch = items.find(item => 
                    item.key_.includes(baseKey) && 
                    item.lastvalue !== null && 
                    item.lastvalue !== undefined
                );
                if (containsMatch) {
                    return containsMatch;
                }
            }
        }
        
        console.log(`未找到匹配的监控项，搜索模式: ${keyPatterns.join(', ')}`);
        console.log(`可用监控项示例: ${items.slice(0, 5).map(i => i.key_).join(', ')}`);
        return null;
    }

    updateHostOverview(hosts) {
        const container = document.getElementById('hostOverviewList');
        const countElement = document.getElementById('totalHostsCount');
        
        if (!container || !countElement) return;

        // 更新总数
        countElement.textContent = hosts.length;

        // 清空容器
        container.innerHTML = '';

        if (hosts.length === 0) {
            container.innerHTML = `<div class="error-state"><i class="fas fa-exclamation-triangle"></i><div class="error-message">${i18n.t('dashboard2.messages.noHostData')}</div></div>`;
            return;
        }

        // 添加排序控制界面到标题右侧
        this.createSortControlsInHeader();

        // 对主机数据进行排序
        const sortedHosts = this.sortHosts(hosts);

        // 大规模主机处理策略
        if (sortedHosts.length > 100) {
            this.renderLargeScaleHostOverview(sortedHosts, container);
        } else {
            this.renderStandardHostOverview(sortedHosts, container);
        }
    }

    // 在标题右侧创建排序控制界面
    createSortControlsInHeader() {
        // 查找overview-header容器
        const overviewHeader = document.querySelector('.overview-header');
        if (!overviewHeader) return;

        // 移除已存在的排序控件
        const existingSortControls = overviewHeader.querySelector('.sort-controls-header');
        if (existingSortControls) {
            existingSortControls.remove();
        }

        // 创建排序控件容器
        const sortControls = document.createElement('div');
        sortControls.className = 'sort-controls-header';
        sortControls.innerHTML = `
            <div class="sort-field-group">
                <select class="sort-field-select" id="hostSortField">
                    <option value="name" ${this.sortState.field === 'name' ? 'selected' : ''}>${i18n.t('dashboard2.sortBy.name')}</option>
                    <option value="ip" ${this.sortState.field === 'ip' ? 'selected' : ''}>${i18n.t('dashboard2.sortBy.ip')}</option>
                    <option value="cpu" ${this.sortState.field === 'cpu' ? 'selected' : ''}>${i18n.t('dashboard2.sortBy.cpu')}</option>
                    <option value="memory" ${this.sortState.field === 'memory' ? 'selected' : ''}>${i18n.t('dashboard2.sortBy.memory')}</option>
                    <option value="status" ${this.sortState.field === 'status' ? 'selected' : ''}>${i18n.t('dashboard2.sortBy.status')}</option>
                </select>
            </div>
            <div class="sort-order-group">
                <button class="sort-order-btn ${this.sortState.order === 'asc' ? 'active' : ''}" 
                        data-order="asc" id="sortAscBtn" title="${i18n.t('dashboard2.sortAsc')}">
                    <i class="fas fa-sort-up"></i>
                </button>
                <button class="sort-order-btn ${this.sortState.order === 'desc' ? 'active' : ''}" 
                        data-order="desc" id="sortDescBtn" title="${i18n.t('dashboard2.sortDesc')}">
                    <i class="fas fa-sort-down"></i>
                </button>
            </div>
        `;
        
        // 将排序控件插入到overview-count之后
        const overviewCount = overviewHeader.querySelector('.overview-count');
        if (overviewCount) {
            overviewCount.parentNode.insertBefore(sortControls, overviewCount.nextSibling);
        } else {
            // 如果找不到overview-count，就添加到末尾
            overviewHeader.appendChild(sortControls);
        }
        
        // 添加事件监听
        this.attachSortEventListeners(sortControls);
    }

    // 附加排序事件监听器
    attachSortEventListeners(sortControls) {
        const fieldSelect = sortControls.querySelector('#hostSortField');
        const ascBtn = sortControls.querySelector('#sortAscBtn');
        const descBtn = sortControls.querySelector('#sortDescBtn');

        // 监听字段选择变化
        fieldSelect.addEventListener('change', (e) => {
            this.sortState.field = e.target.value;
            this.refreshHostOverview();
        });

        // 监听排序方向按钮
        ascBtn.addEventListener('click', () => {
            this.sortState.order = 'asc';
            this.updateSortButtonStates(sortControls);
            this.refreshHostOverview();
        });

        descBtn.addEventListener('click', () => {
            this.sortState.order = 'desc';
            this.updateSortButtonStates(sortControls);
            this.refreshHostOverview();
        });
    }

    // 更新排序按钮状态
    updateSortButtonStates(sortControls) {
        const ascBtn = sortControls.querySelector('#sortAscBtn');
        const descBtn = sortControls.querySelector('#sortDescBtn');
        
        ascBtn.classList.toggle('active', this.sortState.order === 'asc');
        descBtn.classList.toggle('active', this.sortState.order === 'desc');
    }

    // 刷新主机概览（不重新获取数据）
    refreshHostOverview() {
        if (this.hostData && this.hostData.length > 0) {
            this.updateHostOverview(this.hostData);
        }
    }

    // 主机排序方法
    sortHosts(hosts) {
        return [...hosts].sort((a, b) => {
            let aValue, bValue;
            
            switch (this.sortState.field) {
                case 'name':
                    aValue = a.name || '';
                    bValue = b.name || '';
                    break;
                case 'ip':
                    aValue = a.ip || '';
                    bValue = b.ip || '';
                    break;
                case 'cpu':
                    aValue = this.parsePercentageValue(a.cpu);
                    bValue = this.parsePercentageValue(b.cpu);
                    break;
                case 'memory':
                    aValue = this.parsePercentageValue(a.memory);
                    bValue = this.parsePercentageValue(b.memory);
                    break;
                case 'status':
                    // 根据CPU和内存使用率计算状态优先级
                    aValue = this.getStatusPriority(a);
                    bValue = this.getStatusPriority(b);
                    break;
                default:
                    aValue = a.name || '';
                    bValue = b.name || '';
            }

            // 根据数据类型进行比较
            let comparison = 0;
            if (typeof aValue === 'string' && typeof bValue === 'string') {
                comparison = aValue.localeCompare(bValue, 'zh-CN', { numeric: true });
            } else {
                comparison = aValue - bValue;
            }

            // 根据排序方向返回结果
            return this.sortState.order === 'asc' ? comparison : -comparison;
        });
    }

    // 获取状态优先级（用于状态排序）
    getStatusPriority(host) {
        const cpuValue = this.parsePercentageValue(host.cpu);
        const memoryValue = this.parsePercentageValue(host.memory);
        const maxUsage = Math.max(cpuValue, memoryValue);
        
        if (maxUsage > 80) return 3; // critical
        if (maxUsage > 60) return 2; // warning
        if (maxUsage > 0) return 1;  // ok
        return 0; // unknown
    }

    renderStandardHostOverview(hosts, container) {
        // 创建滚动容器
        const scrollContainer = document.createElement('div');
        scrollContainer.className = 'host-list-container';
        
        // 如果主机数量少于能够填满视图的数量，不启用滚动
        const needsScroll = hosts.length > 6; // 假设6个主机可以填满视图
        
        if (!needsScroll) {
            container.classList.add('no-scroll');
        } else {
            container.classList.remove('no-scroll');
            // 复制主机列表以实现无缝滚动
            hosts = [...hosts, ...hosts]; // 复制一遍以实现循环滚动
        }
        
        // 标准模式：显示所有主机详情
        hosts.forEach(host => {
            const hostItem = document.createElement('div');
            hostItem.className = 'host-item';
            
            // 解析CPU和内存值，移除%符号并转换为数字
            const cpuValue = this.parsePercentageValue(host.cpu);
            const memoryValue = this.parsePercentageValue(host.memory);
            
            let status = 'ok';
            if (cpuValue > 80 || memoryValue > 80) status = 'critical';
            else if (cpuValue > 60 || memoryValue > 60) status = 'warning';
            
            hostItem.innerHTML = `
                <div class="status-indicator status-${status}"></div>
                <div class="host-info">
                    <div class="host-name">${host.name}</div>
                    <div class="host-ip">${host.ip}</div>
                </div>
                <div class="resource-metrics">
                    <div class="metric-item">
                        <div class="metric-value">${cpuValue.toFixed(1)}%</div>
                        <div class="metric-label">CPU</div>
                    </div>
                    <div class="metric-item">
                        <div class="metric-value">${memoryValue.toFixed(1)}%</div>
                        <div class="metric-label">${i18n.t('dashboard2.memory')}</div>
                    </div>
                </div>
            `;
            
            scrollContainer.appendChild(hostItem);
        });
        
        container.appendChild(scrollContainer);
    }

    // 解析百分比值，处理各种格式
    parsePercentageValue(value) {
        if (value === null || value === undefined || value === '-') {
            return 0;
        }
        
        // 如果是字符串，移除%符号和空格
        if (typeof value === 'string') {
            const cleaned = value.replace('%', '').trim();
            const parsed = parseFloat(cleaned);
            return isNaN(parsed) ? 0 : parsed;
        }
        
        // 如果是数字，直接返回
        if (typeof value === 'number') {
            return isNaN(value) ? 0 : value;
        }
        
        return 0;
    }

    renderLargeScaleHostOverview(hosts, container) {
        // 大规模模式：统计概览 + 关键主机
        
        // 计算统计数据
        const stats = this.calculateHostStatistics(hosts);
        
        // 创建统计概览
        const statsOverview = document.createElement('div');
        statsOverview.className = 'large-scale-stats';
        statsOverview.innerHTML = `
            <div class="stats-grid">
                <div class="stat-item">
                    <div class="stat-icon status-ok"><i class="fas fa-check-circle"></i></div>
                    <div class="stat-info">
                        <div class="stat-number">${stats.healthy}</div>
                        <div class="stat-label">${i18n.t('dashboard2.hostStats.healthy')}</div>
                    </div>
                </div>
                <div class="stat-item">
                    <div class="stat-icon status-warning"><i class="fas fa-exclamation-triangle"></i></div>
                    <div class="stat-info">
                        <div class="stat-number">${stats.warning}</div>
                        <div class="stat-label">${i18n.t('dashboard2.hostStats.warning')}</div>
                    </div>
                </div>
                <div class="stat-item">
                    <div class="stat-icon status-critical"><i class="fas fa-times-circle"></i></div>
                    <div class="stat-info">
                        <div class="stat-number">${stats.critical}</div>
                        <div class="stat-label">${i18n.t('dashboard2.hostStats.critical')}</div>
                    </div>
                </div>
                <div class="stat-item">
                    <div class="stat-icon status-unknown"><i class="fas fa-question-circle"></i></div>
                    <div class="stat-info">
                        <div class="stat-number">${stats.unknown}</div>
                        <div class="stat-label">${i18n.t('dashboard2.hostStats.unknown')}</div>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(statsOverview);

        // 平均资源使用率
        const avgResources = document.createElement('div');
        avgResources.className = 'avg-resources';
        avgResources.innerHTML = `
            <div class="avg-title">${i18n.t('dashboard2.resourceUsage')}</div>
            <div class="avg-metrics">
                <div class="avg-metric">
                    <div class="avg-label">CPU</div>
                    <div class="avg-bar">
                        <div class="avg-fill" style="width: ${stats.avgCpu}%; background: ${this.getColorByValue(stats.avgCpu)}"></div>
                    </div>
                    <div class="avg-value">${stats.avgCpu.toFixed(1)}%</div>
                </div>
                <div class="avg-metric">
                    <div class="avg-label">内存</div>
                    <div class="avg-bar">
                        <div class="avg-fill" style="width: ${stats.avgMemory}%; background: ${this.getColorByValue(stats.avgMemory)}"></div>
                    </div>
                    <div class="avg-value">${stats.avgMemory.toFixed(1)}%</div>
                </div>
            </div>
        `;
        container.appendChild(avgResources);

        // 显示TOP问题主机（使用排序后的数据）
        const topIssueHosts = this.getTopIssueHostsFromSorted(hosts, 10);
        if (topIssueHosts.length > 0) {
            const topIssuesSection = document.createElement('div');
            topIssuesSection.className = 'top-issues-section';
            topIssuesSection.innerHTML = `
                <div class="section-title">
                    <i class="fas fa-exclamation-triangle"></i>
                    TOP ${topIssueHosts.length} 问题主机
                    <small class="sort-info">(按${this.getSortFieldDisplayName()}排序)</small>
                </div>
            `;
            
            const topIssuesList = document.createElement('div');
            topIssuesList.className = 'top-issues-list';
            
            topIssueHosts.forEach((host, index) => {
                const cpuValue = this.parsePercentageValue(host.cpu);
                const memoryValue = this.parsePercentageValue(host.memory);
                const maxUsage = Math.max(cpuValue, memoryValue);
                
                const issueItem = document.createElement('div');
                issueItem.className = 'issue-item';
                issueItem.innerHTML = `
                    <div class="issue-rank">#${index + 1}</div>
                    <div class="issue-host">
                        <div class="issue-name">${host.name}</div>
                        <div class="issue-ip">${host.ip}</div>
                    </div>
                    <div class="issue-metrics">
                        <span class="issue-cpu" title="${i18n.t('dashboard2.cpuUsage')}">${cpuValue.toFixed(1)}%</span>
                        <span class="issue-memory" title="${i18n.t('dashboard2.memoryUsage')}">${memoryValue.toFixed(1)}%</span>
                    </div>
                    <div class="issue-severity ${this.getSeverityClass(maxUsage)}">
                        ${this.getSeverityText(maxUsage)}
                    </div>
                `;
                topIssuesList.appendChild(issueItem);
            });
            
            topIssuesSection.appendChild(topIssuesList);
            container.appendChild(topIssuesSection);
        }

        // 添加虚拟滚动支持（如果需要显示更多主机）
        if (hosts.length > 50) {
            this.addVirtualScrolling(container, hosts);
        }
    }

    calculateHostStatistics(hosts) {
        let healthy = 0, warning = 0, critical = 0, unknown = 0;
        let totalCpu = 0, totalMemory = 0, validHosts = 0;

        hosts.forEach(host => {
            const cpuValue = this.parsePercentageValue(host.cpu);
            const memoryValue = this.parsePercentageValue(host.memory);
            
            if (cpuValue === 0 && memoryValue === 0 && (host.cpu === '-' || host.memory === '-')) {
                unknown++;
            } else {
                validHosts++;
                totalCpu += cpuValue;
                totalMemory += memoryValue;
                
                const maxUsage = Math.max(cpuValue, memoryValue);
                if (maxUsage > 80) critical++;
                else if (maxUsage > 60) warning++;
                else healthy++;
            }
        });

        return {
            healthy,
            warning,
            critical,
            unknown,
            avgCpu: validHosts > 0 ? totalCpu / validHosts : 0,
            avgMemory: validHosts > 0 ? totalMemory / validHosts : 0
        };
    }

    getTopIssueHosts(hosts, limit = 10) {
        return hosts
            .filter(host => {
                const cpu = this.parsePercentageValue(host.cpu);
                const memory = this.parsePercentageValue(host.memory);
                return cpu > 0 || memory > 0; // 过滤掉无数据的主机
            })
            .sort((a, b) => {
                const aMax = Math.max(this.parsePercentageValue(a.cpu), this.parsePercentageValue(a.memory));
                const bMax = Math.max(this.parsePercentageValue(b.cpu), this.parsePercentageValue(b.memory));
                return bMax - aMax;
            })
            .slice(0, limit);
    }

    // 从已排序的主机列表中获取TOP问题主机（大规模模式用）
    getTopIssueHostsFromSorted(sortedHosts, limit = 10) {
        // 如果当前排序是按照CPU或内存，直接使用排序结果
        if (this.sortState.field === 'cpu' || this.sortState.field === 'memory') {
            return sortedHosts
                .filter(host => {
                    const cpu = this.parsePercentageValue(host.cpu);
                    const memory = this.parsePercentageValue(host.memory);
                    return cpu > 0 || memory > 0;
                })
                .slice(0, limit);
        }
        
        // 否则仍然按照最大使用率排序
        return this.getTopIssueHosts(sortedHosts, limit);
    }

    // 获取排序字段的显示名称
    getSortFieldDisplayName() {
        const fieldMap = {
            'name': i18n.t('dashboard2.sortBy.name'),
            'ip': i18n.t('dashboard2.sortBy.ip'),
            'cpu': i18n.t('dashboard2.sortBy.cpu'),
            'memory': i18n.t('dashboard2.sortBy.memory'),
            'status': i18n.t('dashboard2.sortBy.status')
        };
        return fieldMap[this.sortState.field] || i18n.t('dashboard2.sortBy.name');
    }

    getColorByValue(value) {
        if (value > 80) return '#ff4444';
        if (value > 60) return '#ffa500';
        if (value > 40) return '#ffdd00';
        return '#00ff7f';
    }

    getSeverityClass(value) {
        if (value > 80) return 'severity-critical';
        if (value > 60) return 'severity-warning';
        return 'severity-normal';
    }

    getSeverityText(value) {
        if (value > 80) return i18n.t('dashboard2.severity.critical');
        if (value > 60) return i18n.t('dashboard2.severity.warning');
        return i18n.t('dashboard2.severity.normal');
    }

    addVirtualScrolling(container, hosts) {
        // 为超大规模数据添加虚拟滚动提示
        const virtualScrollHint = document.createElement('div');
        virtualScrollHint.className = 'virtual-scroll-hint';
        virtualScrollHint.innerHTML = `
            <div class="hint-content">
                <i class="fas fa-info-circle"></i>
                <span>${i18n.t('dashboard2.hostOverload').replace('{count}', hosts.length)}</span>
                <button class="view-all-btn">
                    <i class="fas fa-list"></i> ${i18n.t('dashboard2.viewAll')}
                </button>
            </div>
        `;
        
        // 添加事件监听器
        const viewAllBtn = virtualScrollHint.querySelector('.view-all-btn');
        viewAllBtn.addEventListener('click', () => {
            virtualScrollHint.style.display = 'none';
        });
        
        container.appendChild(virtualScrollHint);
    }

    async updateCpuChart(hosts) {
        if (!this.charts.cpu) return;

        try {
            // 从API获取CPU历史数据
            const cpuData = await this.getCpuHistoryData(hosts);
            
            const option = {
                backgroundColor: 'transparent',
                tooltip: {
                    trigger: 'axis',
                    backgroundColor: 'rgba(25, 25, 45, 0.95)',
                    borderColor: 'rgba(255, 140, 0, 0.3)',
                    textStyle: { color: '#fff' }
                },
                legend: {
                    data: cpuData.series.map(s => s.name),
                    textStyle: { color: '#fff' },
                    top: 20
                },
                grid: {
                    left: '3%',
                    right: '4%',
                    bottom: '10%',
                    top: '20%',
                    containLabel: true
                },
                xAxis: {
                    type: 'category',
                    data: cpuData.timeLabels,
                    axisLine: { lineStyle: { color: 'rgba(255, 140, 0, 0.3)' } },
                    axisLabel: { color: '#a0a0a0', fontSize: 10 }
                },
                yAxis: {
                    type: 'value',
                    name: i18n.t('dashboard2.cpuUsagePercent'),
                    nameTextStyle: { color: '#a0a0a0' },
                    axisLine: { lineStyle: { color: 'rgba(255, 140, 0, 0.3)' } },
                    axisLabel: { color: '#a0a0a0' },
                    splitLine: { 
                        lineStyle: { 
                            color: 'rgba(255, 140, 0, 0.1)',
                            type: 'dashed'
                        }
                    },
                    max: 100
                },
                series: cpuData.series
            };

            this.charts.cpu.setOption(option);
        } catch (error) {
            console.error('更新CPU图表失败:', error);
            this.showChartError('cpuUtilizationChart', i18n.t('dashboard2.messages.cannotLoadCpuData'));
        }
    }

    async updateMemoryChart(hosts) {
        if (!this.charts.memory) return;

        try {
            // 生成内存使用率分布数据
            const memoryData = this.getMemoryDistributionData(hosts);
            let option;
            
            if (hosts.length > 100) {
                // 大规模模式：使用柱状图
                option = {
                    backgroundColor: 'transparent',
                    tooltip: {
                        trigger: 'axis',
                        backgroundColor: 'rgba(25, 25, 45, 0.95)',
                        borderColor: 'rgba(255, 140, 0, 0.3)',
                        textStyle: { color: '#fff' },
                        formatter: function(params) {
                            const param = params[0];
                            return `<div style="font-weight: bold; margin-bottom: 8px;">${param.name}</div>
                                   <div style="margin: 4px 0;">${i18n.t('dashboard2.hostCount')}: ${param.value}${i18n.t('dashboard2.units.hosts')}</div>
                                   <div style="margin: 4px 0;">${i18n.t('dashboard2.percentage')}: ${((param.value / hosts.length) * 100).toFixed(1)}%</div>`;
                        }
                    },
                    legend: {
                        data: [i18n.t('dashboard2.hostCount')],
                        textStyle: { color: '#fff' },
                        top: 20
                    },
                    grid: {
                        left: '3%',
                        right: '4%',
                        bottom: '10%',
                        top: '20%',
                        containLabel: true
                    },
                    xAxis: {
                        type: 'category',
                        data: memoryData.map(item => item.name.replace(' (', '\n(').replace(i18n.t('dashboard2.units.hosts') + ')', i18n.t('dashboard2.units.hosts') + ')')),
                        axisLine: { lineStyle: { color: 'rgba(255, 140, 0, 0.3)' } },
                        axisLabel: { 
                            color: '#a0a0a0', 
                            fontSize: 10,
                            interval: 0,
                            rotate: 0
                        }
                    },
                    yAxis: {
                        type: 'value',
                        name: i18n.t('dashboard2.hostCount'),
                        nameTextStyle: { color: '#a0a0a0' },
                        axisLine: { lineStyle: { color: 'rgba(255, 140, 0, 0.3)' } },
                        axisLabel: { color: '#a0a0a0' },
                        splitLine: { 
                            lineStyle: { 
                                color: 'rgba(255, 140, 0, 0.1)',
                                type: 'dashed'
                            }
                        }
                    },
                    series: [{
                        name: i18n.t('dashboard2.hostCount'),
                        type: 'bar',
                        data: memoryData.map(item => ({
                            value: item.value,
                            itemStyle: { 
                                color: item.itemStyle.color,
                                borderRadius: [4, 4, 0, 0]
                            }
                        })),
                        barWidth: '60%',
                        emphasis: {
                            itemStyle: {
                                shadowBlur: 10,
                                shadowOffsetX: 0,
                                shadowColor: 'rgba(0, 0, 0, 0.5)'
                            }
                        }
                    }]
                };
            } else {
                // 标准模式：使用饼图
                option = {
                    backgroundColor: 'transparent',
                    tooltip: {
                        trigger: 'item',
                        backgroundColor: 'rgba(25, 25, 45, 0.95)',
                        borderColor: 'rgba(255, 140, 0, 0.3)',
                        textStyle: { color: '#fff' },
                        formatter: '{a} <br/>{b}: {c}' + i18n.t('dashboard2.units.hosts') + ' ({d}%)'
                    },
                    legend: {
                        orient: 'horizontal',
                        bottom: '5%',
                        left: 'center',
                        textStyle: { color: '#fff' },
                        itemGap: 20
                    },
                    series: [{
                        name: i18n.t('dashboard2.memoryDistributionChart'),
                        type: 'pie',
                        radius: ['30%', '70%'],
                        center: ['50%', '45%'],
                        data: memoryData,
                        emphasis: {
                            itemStyle: {
                                shadowBlur: 10,
                                shadowOffsetX: 0,
                                shadowColor: 'rgba(0, 0, 0, 0.5)'
                            }
                        },
                        label: {
                            show: true,
                            formatter: '{b}\n{c}' + i18n.t('dashboard2.units.hosts'),
                            color: '#fff',
                            fontSize: 11
                        },
                        labelLine: {
                            show: true,
                            lineStyle: { color: 'rgba(255, 255, 255, 0.5)' }
                        }
                    }]
                };
            }

            this.charts.memory.setOption(option);
        } catch (error) {
            console.error('更新内存图表失败:', error);
            this.showChartError('memoryUtilizationChart', i18n.t('dashboard2.messages.cannotLoadMemoryData'));
        }
    }

    async updateCpuDistributionChart(hosts) {
        if (!this.charts.cpuDistribution) return;

        try {
            // 获取CPU分布数据
            const cpuData = this.getCpuDistributionData(hosts);
            let option;
            
            if (hosts.length > 100) {
                // 大规模模式：使用柱状图
                option = {
                    backgroundColor: 'transparent',
                    tooltip: {
                        trigger: 'axis',
                        backgroundColor: 'rgba(25, 25, 45, 0.95)',
                        borderColor: 'rgba(255, 140, 0, 0.3)',
                        textStyle: { color: '#fff' },
                        formatter: function(params) {
                            const param = params[0];
                            return `<div style="font-weight: bold; margin-bottom: 8px;">${param.name}</div>
                                   <div style="margin: 4px 0;">${i18n.t('dashboard2.hostCount')}: ${param.value}${i18n.t('dashboard2.units.hosts')}</div>
                                   <div style="margin: 4px 0;">${i18n.t('dashboard2.percentage')}: ${((param.value / hosts.length) * 100).toFixed(1)}%</div>`;
                        }
                    },
                    legend: {
                        data: [i18n.t('dashboard2.hostCount')],
                        textStyle: { color: '#fff' },
                        top: 20
                    },
                    grid: {
                        left: '3%',
                        right: '4%',
                        bottom: '10%',
                        top: '20%',
                        containLabel: true
                    },
                    xAxis: {
                        type: 'category',
                        data: cpuData.map(item => item.name.replace(' (', '\n(').replace(i18n.t('dashboard2.units.hosts') + ')', i18n.t('dashboard2.units.hosts') + ')')),
                        axisLine: { lineStyle: { color: 'rgba(255, 140, 0, 0.3)' } },
                        axisLabel: { 
                            color: '#a0a0a0', 
                            fontSize: 10,
                            interval: 0,
                            rotate: 0
                        }
                    },
                    yAxis: {
                        type: 'value',
                        name: i18n.t('dashboard2.hostCount'),
                        nameTextStyle: { color: '#a0a0a0' },
                        axisLine: { lineStyle: { color: 'rgba(255, 140, 0, 0.3)' } },
                        axisLabel: { color: '#a0a0a0' },
                        splitLine: { 
                            lineStyle: { 
                                color: 'rgba(255, 140, 0, 0.1)',
                                type: 'dashed'
                            }
                        }
                    },
                    series: [{
                        name: i18n.t('dashboard2.hostCount'),
                        type: 'bar',
                        data: cpuData.map(item => ({
                            value: item.value,
                            itemStyle: { 
                                color: item.itemStyle.color,
                                borderRadius: [4, 4, 0, 0]
                            }
                        })),
                        barWidth: '60%',
                        emphasis: {
                            itemStyle: {
                                shadowBlur: 10,
                                shadowOffsetX: 0,
                                shadowColor: 'rgba(0, 0, 0, 0.5)'
                            }
                        }
                    }]
                };
            } else {
                // 标准模式：使用饼图
                option = {
                    backgroundColor: 'transparent',
                    tooltip: {
                        trigger: 'item',
                        backgroundColor: 'rgba(25, 25, 45, 0.95)',
                        borderColor: 'rgba(255, 140, 0, 0.3)',
                        textStyle: { color: '#fff' },
                        formatter: '{a} <br/>{b}: {c}' + i18n.t('dashboard2.units.hosts') + ' ({d}%)'
                    },
                    legend: {
                        orient: 'horizontal',
                        bottom: '5%',
                        left: 'center',
                        textStyle: { color: '#fff' },
                        itemGap: 20
                    },
                    series: [{
                        name: i18n.t('dashboard2.cpuDistributionChart'),
                        type: 'pie',
                        radius: ['30%', '70%'],
                        center: ['50%', '45%'],
                        data: cpuData,
                        emphasis: {
                            itemStyle: {
                                shadowBlur: 10,
                                shadowOffsetX: 0,
                                shadowColor: 'rgba(0, 0, 0, 0.5)'
                            }
                        },
                        label: {
                            show: true,
                            formatter: '{b}\n{c}' + i18n.t('dashboard2.units.hosts'),
                            color: '#fff',
                            fontSize: 11
                        },
                        labelLine: {
                            show: true,
                            lineStyle: { color: 'rgba(255, 255, 255, 0.5)' }
                        }
                    }]
                };
            }

            this.charts.cpuDistribution.setOption(option);
        } catch (error) {
            console.error('更新CPU分布图表失败:', error);
            this.showChartError('cpuDistributionChart', i18n.t('dashboard2.messages.cannotLoadCpuDistribution'));
        }
    }

    async updateMemoryTrendChart(hosts) {
        if (!this.charts.memoryTrend) return;

        try {
            // 获取内存历史数据（最近24小时）
            const memoryTrendData = await this.getMemoryTrendData(hosts);
            
            const option = {
                backgroundColor: 'transparent',
                tooltip: {
                    trigger: 'axis',
                    backgroundColor: 'rgba(25, 25, 45, 0.95)',
                    borderColor: 'rgba(0, 255, 127, 0.3)',
                    textStyle: { color: '#fff' },
                    formatter: function(params) {
                        let result = `<div style="font-weight: bold; margin-bottom: 8px;">${params[0].name}</div>`;
                        params.forEach(param => {
                            result += `<div style="margin: 4px 0;">
                                <span style="display: inline-block; width: 10px; height: 10px; background: ${param.color}; border-radius: 50%; margin-right: 8px;"></span>
                                ${param.seriesName}: ${param.value}%
                            </div>`;
                        });
                        return result;
                    }
                },
                legend: {
                    data: memoryTrendData.series.map(s => s.name),
                    textStyle: { color: '#fff' },
                    top: 20,
                    type: 'scroll',
                    orient: 'horizontal'
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
                    data: memoryTrendData.timeLabels,
                    axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.3)' }},
                    axisLabel: { color: '#a0a0a0' },
                    splitLine: { show: false }
                },
                yAxis: {
                    type: 'value',
                    name: i18n.t('dashboard2.memoryUsagePercent'),
                    nameTextStyle: { color: '#a0a0a0' },
                    axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.3)' }},
                    axisLabel: { 
                        color: '#a0a0a0',
                        formatter: '{value}%'
                    },
                    splitLine: { 
                        lineStyle: { color: 'rgba(255, 255, 255, 0.1)' }
                    },
                    min: 0,
                    max: 100
                },
                series: memoryTrendData.series.map(series => ({
                    ...series,
                    type: 'line',
                    smooth: true,
                    symbolSize: 4,
                    lineStyle: { width: 2 },
                    emphasis: {
                        focus: 'series',
                        lineStyle: { width: 3 }
                    }
                }))
            };

            this.charts.memoryTrend.setOption(option);
        } catch (error) {
            console.error('更新内存趋势图表失败:', error);
            this.showChartError('memoryTrendChart', i18n.t('dashboard2.messages.cannotLoadMemoryTrend'));
        }
    }

    // 数据处理方法
    async getCpuHistoryData(hosts) {
        const timeLabels = [];
        const series = [];
        
        // 生成最近24小时的时间标签
        for (let i = 23; i >= 0; i--) {
            const time = new Date(Date.now() - i * 60 * 60 * 1000);
            timeLabels.push(time.getHours() + ':00');
        }

        // 大规模主机处理策略
        if (hosts.length > 100) {
            // 大规模模式：显示聚合数据和TOP主机
            const aggregatedData = await this.getAggregatedCpuData(hosts, timeLabels);
            series.push(...aggregatedData);
            
            // 添加TOP 5 问题主机的详细数据
            const topHosts = this.getTopIssueHosts(hosts, 5);
            for (const [index, host] of topHosts.entries()) {
                const cpuHistory = await this.getHostCpuHistory(host, 24);
                const currentCpu = parseFloat(host.cpu || 0);
                const data = this.processHistoryData(cpuHistory, timeLabels, currentCpu);
                
                series.push({
                    name: `${host.name} (TOP${index + 1})`,
                    type: 'line',
                    data: data,
                    smooth: true,
                    lineStyle: { 
                        color: this.getTopHostColor(index),
                        width: 3,
                        type: 'solid'
                    },
                    emphasis: {
                        lineStyle: { width: 4 }
                    }
                });
            }
        } else {
            // 标准模式：显示所有主机（最多10个）
            const displayHosts = hosts.slice(0, 10);
            for (const [index, host] of displayHosts.entries()) {
                const cpuHistory = await this.getHostCpuHistory(host, 24);
                const currentCpu = parseFloat(host.cpu || 0);
                const data = this.processHistoryData(cpuHistory, timeLabels, currentCpu);
                
                series.push({
                    name: host.name,
                    type: 'line',
                    data: data,
                    smooth: true,
                    lineStyle: { 
                        color: this.getHostColor(index),
                        width: 2 
                    }
                });
            }
        }

        return { timeLabels, series };
    }

    async getHostCpuHistory(host, hours = 24) {
        try {
            // 获取CPU监控项
            const cpuItems = await this.api.getItems(host.hostid, 'system.cpu.util');
            if (cpuItems.length === 0) return [];
            
            // 获取历史数据
            const timeFrom = Math.floor((Date.now() - hours * 60 * 60 * 1000) / 1000);
            const timeTill = Math.floor(Date.now() / 1000);
            
            const history = await this.api.getHistory(cpuItems[0].itemid, 0, timeFrom, timeTill);
            return history.map(item => ({
                time: parseInt(item.clock) * 1000,
                value: parseFloat(item.value)
            })).sort((a, b) => a.time - b.time);
            
        } catch (error) {
            console.warn(`获取主机 ${host.name} CPU历史数据失败:`, error);
            return [];
        }
    }

    processHistoryData(historyData, timeLabels, currentValue = 0) {
        if (historyData.length === 0) {
            // 如果没有历史数据，返回当前值的数组
            return new Array(timeLabels.length).fill(currentValue);
        }
        
        const data = [];
        const startTime = Date.now() - 23 * 60 * 60 * 1000;
        
        for (let i = 0; i < timeLabels.length; i++) {
            const targetTime = startTime + i * 60 * 60 * 1000;
            
            // 找到最接近目标时间的数据点
            const closestData = historyData.reduce((closest, current) => {
                const currentDiff = Math.abs(current.time - targetTime);
                const closestDiff = Math.abs(closest.time - targetTime);
                return currentDiff < closestDiff ? current : closest;
            }, historyData[0]);
            
            data.push(closestData ? closestData.value.toFixed(1) : currentValue);
        }
        
        return data;
    }

    async getAggregatedCpuData(hosts, timeLabels) {
        const aggregatedSeries = [];
        const allHostsData = [];
        
        // 获取所有主机的CPU历史数据
        for (const host of hosts) {
            const historyData = await this.getHostCpuHistory(host, 24);
            const processedData = this.processHistoryData(historyData, timeLabels);
            allHostsData.push(processedData);
        }
        
        // 计算聚合数据
        const avgData = [];
        const maxData = [];
        const minData = [];
        
        for (let i = 0; i < timeLabels.length; i++) {
            const values = allHostsData.map(hostData => parseFloat(hostData[i])).filter(v => !isNaN(v));
            
            if (values.length > 0) {
                avgData.push((values.reduce((sum, val) => sum + val, 0) / values.length).toFixed(1));
                maxData.push(Math.max(...values).toFixed(1));
                minData.push(Math.min(...values).toFixed(1));
            } else {
                avgData.push(0);
                maxData.push(0);
                minData.push(0);
            }
        }

        aggregatedSeries.push(
            {
                name: i18n.t('dashboard2.chartTitles.avgCpu').replace('{count}', hosts.length),
                type: 'line',
                data: avgData,
                smooth: true,
                lineStyle: { color: '#00ff7f', width: 3 },
                areaStyle: {
                    color: {
                        type: 'linear',
                        x: 0, y: 0, x2: 0, y2: 1,
                        colorStops: [
                            { offset: 0, color: 'rgba(0, 255, 127, 0.3)' },
                            { offset: 1, color: 'rgba(0, 255, 127, 0.1)' }
                        ]
                    }
                }
            },
            {
                name: i18n.t('dashboard2.chartTitles.maxCpu'),
                type: 'line',
                data: maxData,
                smooth: true,
                lineStyle: { color: '#ff4444', width: 2, type: 'dashed' }
            },
            {
                name: i18n.t('dashboard2.chartTitles.minCpu'),
                type: 'line',
                data: minData,
                smooth: true,
                lineStyle: { color: '#4444ff', width: 2, type: 'dotted' }
            }
        );

        return aggregatedSeries;
    }

    async updateAlertTrendChart() {
        if (!this.charts.alertTrend) {
            console.warn(i18n.t('dashboard2.messages.alertTrendChartNotInit'));
            return;
        }

        try {
            // 获取告警趋势数据
            const trendData = await this.api.getAlertTrend();
            
            const option = {
                backgroundColor: 'transparent',
                tooltip: {
                    trigger: 'axis',
                    backgroundColor: 'rgba(25, 25, 45, 0.95)',
                    borderColor: 'rgba(255, 140, 0, 0.3)',
                    textStyle: { color: '#fff' },
                    formatter: function(params) {
                        const data = params[0];
                        const date = new Date(data.name);
                        const dateStr = i18n.t('dashboard2.dateFormat.monthDay')
                            .replace('{month}', date.getMonth() + 1)
                            .replace('{day}', date.getDate());
                        return `<div style="font-weight: bold; margin-bottom: 8px;">${dateStr}</div>
                               <div style="margin: 4px 0;">${i18n.t('dashboard2.chartTitles.alertCount')}: ${data.value[1]}${i18n.t('dashboard2.units.count')}</div>`;
                    }
                },
                grid: {
                    left: '3%',
                    right: '4%',
                    bottom: '15%',
                    top: '10%',
                    containLabel: true
                },
                xAxis: {
                    type: 'time',
                    boundaryGap: false,
                    axisLine: { lineStyle: { color: 'rgba(255, 140, 0, 0.3)' } },
                    axisLabel: { 
                        color: '#a0a0a0',
                        formatter: function(value) {
                            const date = new Date(value);
                            return `${date.getMonth() + 1}/${date.getDate()}`;
                        }
                    },
                    splitLine: { show: false }
                },
                yAxis: {
                    type: 'value',
                    name: i18n.t('dashboard2.chartTitles.alertCount'),
                    nameTextStyle: { color: '#a0a0a0' },
                    axisLine: { lineStyle: { color: 'rgba(255, 140, 0, 0.3)' } },
                    axisLabel: { color: '#a0a0a0' },
                    splitLine: { 
                        lineStyle: { 
                            color: 'rgba(255, 140, 0, 0.1)',
                            type: 'dashed'
                        }
                    },
                    minInterval: 1
                },
                series: [{
                    name: i18n.t('dashboard2.chartTitles.alertCount'),
                    type: 'line',
                    smooth: true,
                    data: trendData,
                    itemStyle: {
                        color: '#ff6b6b'
                    },
                    areaStyle: {
                        color: {
                            type: 'linear',
                            x: 0, y: 0, x2: 0, y2: 1,
                            colorStops: [
                                { offset: 0, color: 'rgba(255, 107, 107, 0.3)' },
                                { offset: 1, color: 'rgba(255, 107, 107, 0.1)' }
                            ]
                        }
                    },
                    lineStyle: {
                        width: 3,
                        color: '#ff6b6b'
                    },
                    showSymbol: true,
                    symbol: 'circle',
                    symbolSize: 6,
                    emphasis: {
                        itemStyle: {
                            borderColor: '#ff6b6b',
                            borderWidth: 2
                        }
                    }
                }]
            };

            this.charts.alertTrend.setOption(option);
        } catch (error) {
            console.error('更新告警趋势图表失败:', error);
            this.showChartError('alertTrendChart', i18n.t('dashboard2.messages.cannotLoadAlertTrend'));
        }
    }

    getTopHostColor(index) {
        const topColors = [
            '#ff0000', '#ff6600', '#ff9900', '#ffcc00', '#ffff00'
        ];
        return topColors[index % topColors.length];
    }

    getCpuDistributionData(hosts) {
        const data = [];
        
        if (hosts.length > 100) {
            // 大规模模式：更详细的分布统计
            const ranges = [
                { name: '0-20%', min: 0, max: 20, color: '#00ff7f' },
                { name: '20-40%', min: 20, max: 40, color: '#7fff00' },
                { name: '40-60%', min: 40, max: 60, color: '#ffdd00' },
                { name: '60-80%', min: 60, max: 80, color: '#ffa500' },
                { name: '80-95%', min: 80, max: 95, color: '#ff6347' },
                { name: '95-100%', min: 95, max: 100, color: '#ff4444' }
            ];

            ranges.forEach(range => {
                const count = hosts.filter(host => {
                    const cpu = this.parsePercentageValue(host.cpu);
                    return cpu >= range.min && cpu < range.max;
                }).length;
                
                if (count > 0) {
                    data.push({
                        name: `${range.name} (${count}${i18n.t('dashboard2.units.hosts')})`,
                        value: count,
                        itemStyle: { color: range.color },
                        emphasis: {
                            itemStyle: {
                                shadowBlur: 10,
                                shadowOffsetX: 0,
                                shadowColor: 'rgba(0, 0, 0, 0.5)'
                            }
                        }
                    });
                }
            });

            // 添加统计信息
            const cpuValues = hosts.map(h => this.parsePercentageValue(h.cpu)).filter(v => v > 0);
            if (cpuValues.length > 0) {
                const avgCpu = cpuValues.reduce((sum, val) => sum + val, 0) / cpuValues.length;
                const maxCpu = Math.max(...cpuValues);
                const minCpu = Math.min(...cpuValues);
                
                console.log(`CPU统计 - 平均: ${avgCpu.toFixed(1)}%, 最高: ${maxCpu.toFixed(1)}%, 最低: ${minCpu.toFixed(1)}%`);
            }
        } else {
            // 标准模式：原有的4段分布
            const ranges = [
                { name: '0-25%', min: 0, max: 25, color: '#00ff7f' },
                { name: '25-50%', min: 25, max: 50, color: '#ffa500' },
                { name: '50-75%', min: 50, max: 75, color: '#ff8c00' },
                { name: '75-100%', min: 75, max: 100, color: '#ff4444' }
            ];

            ranges.forEach(range => {
                const count = hosts.filter(host => {
                    const cpu = this.parsePercentageValue(host.cpu);
                    return cpu >= range.min && cpu < range.max;
                }).length;
                
                if (count > 0) {
                    data.push({
                        name: range.name,
                        value: count,
                        itemStyle: { color: range.color }
                    });
                }
            });
        }

        return data;
    }

    getMemoryDistributionData(hosts) {
        const data = [];
        
        if (hosts.length > 100) {
            // 大规模模式：更详细的分布统计
            const ranges = [
                { name: '0-20%', min: 0, max: 20, color: '#00ff7f' },
                { name: '20-40%', min: 20, max: 40, color: '#7fff00' },
                { name: '40-60%', min: 40, max: 60, color: '#ffdd00' },
                { name: '60-80%', min: 60, max: 80, color: '#ffa500' },
                { name: '80-95%', min: 80, max: 95, color: '#ff6347' },
                { name: '95-100%', min: 95, max: 100, color: '#ff4444' }
            ];

            ranges.forEach(range => {
                const count = hosts.filter(host => {
                    const memory = this.parsePercentageValue(host.memory);
                    return memory >= range.min && memory < range.max;
                }).length;
                
                if (count > 0) {
                    data.push({
                        name: `${range.name} (${count}${i18n.t('dashboard2.units.hosts')})`,
                        value: count,
                        itemStyle: { color: range.color },
                        emphasis: {
                            itemStyle: {
                                shadowBlur: 10,
                                shadowOffsetX: 0,
                                shadowColor: 'rgba(0, 0, 0, 0.5)'
                            }
                        }
                    });
                }
            });

            // 添加统计信息
            const memoryValues = hosts.map(h => this.parsePercentageValue(h.memory)).filter(v => v > 0);
            if (memoryValues.length > 0) {
                const avgMemory = memoryValues.reduce((sum, val) => sum + val, 0) / memoryValues.length;
                const maxMemory = Math.max(...memoryValues);
                const minMemory = Math.min(...memoryValues);
                
                console.log(`内存统计 - 平均: ${avgMemory.toFixed(1)}%, 最高: ${maxMemory.toFixed(1)}%, 最低: ${minMemory.toFixed(1)}%`);
            }
        } else {
            // 标准模式：原有的4段分布
            const ranges = [
                { name: '0-25%', min: 0, max: 25, color: '#00ff7f' },
                { name: '25-50%', min: 25, max: 50, color: '#ffa500' },
                { name: '50-75%', min: 50, max: 75, color: '#ff8c00' },
                { name: '75-100%', min: 75, max: 100, color: '#ff4444' }
            ];

            ranges.forEach(range => {
                const count = hosts.filter(host => {
                    const memory = this.parsePercentageValue(host.memory);
                    return memory >= range.min && memory < range.max;
                }).length;
                
                if (count > 0) {
                    data.push({
                        name: range.name,
                        value: count,
                        itemStyle: { color: range.color }
                    });
                }
            });
        }

        return data;
    }

    getSystemResourceData(hosts) {
        const indicators = hosts.slice(0, 8).map(host => ({
            name: host.name,
            max: 100
        }));

        const cpu = hosts.slice(0, 8).map(host => parseFloat(host.cpu || 0));
        const memory = hosts.slice(0, 8).map(host => parseFloat(host.memory || 0));

        return { indicators, cpu, memory };
    }

    async getMemoryTrendData(hosts) {
        const timeLabels = [];
        const series = [];
        
        // 生成最近24小时的时间标签
        for (let i = 23; i >= 0; i--) {
            const time = new Date(Date.now() - i * 60 * 60 * 1000);
            timeLabels.push(time.getHours() + ':00');
        }

        // 大规模主机处理策略
        if (hosts.length > 100) {
            // 大规模模式：显示聚合数据和TOP主机
            const aggregatedData = await this.getAggregatedMemoryData(hosts, timeLabels);
            series.push(...aggregatedData);
            
            // 添加TOP 5 内存使用率高的主机详细数据
            const topMemoryHosts = this.getTopMemoryHosts(hosts, 5);
            for (const [index, host] of topMemoryHosts.entries()) {
                const memoryHistory = await this.getHostMemoryHistory(host, 24);
                const currentMemory = this.parsePercentageValue(host.memory);
                const data = this.processHistoryData(memoryHistory, timeLabels, currentMemory);
                
                series.push({
                    name: `${host.name} (TOP${index + 1})`,
                    type: 'line',
                    data: data,
                    smooth: true,
                    lineStyle: { 
                        color: this.getTopHostColor(index),
                        width: 2 
                    }
                });
            }
        } else {
            // 小规模模式：显示每台主机的详细数据
            const displayHosts = hosts.slice(0, 10); // 最多显示10台主机
            
            for (const [index, host] of displayHosts.entries()) {
                const memoryHistory = await this.getHostMemoryHistory(host, 24);
                const currentMemory = this.parsePercentageValue(host.memory);
                const data = this.processHistoryData(memoryHistory, timeLabels, currentMemory);
                
                series.push({
                    name: host.name,
                    type: 'line',
                    data: data,
                    smooth: true,
                    lineStyle: { 
                        color: this.getHostColor(index),
                        width: 2 
                    }
                });
            }
        }

        return { timeLabels, series };
    }

    async getHostMemoryHistory(host, hours = 24) {
        try {
            // 获取内存监控项
            const memoryItems = await this.api.getItems(host.hostid, 'vm.memory.util');
            if (memoryItems.length === 0) return [];
            
            // 获取历史数据
            const timeFrom = Math.floor((Date.now() - hours * 60 * 60 * 1000) / 1000);
            const timeTill = Math.floor(Date.now() / 1000);
            
            const history = await this.api.getHistory(memoryItems[0].itemid, 0, timeFrom, timeTill);
            return history.map(item => ({
                time: parseInt(item.clock) * 1000,
                value: parseFloat(item.value)
            })).sort((a, b) => a.time - b.time);
            
        } catch (error) {
            console.warn(`获取主机 ${host.name} 内存历史数据失败:`, error);
            return [];
        }
    }

    async getAggregatedMemoryData(hosts, timeLabels) {
        const aggregatedSeries = [];
        const allHostsData = [];
        
        // 获取所有主机的内存历史数据
        for (const host of hosts) {
            const historyData = await this.getHostMemoryHistory(host, 24);
            const processedData = this.processHistoryData(historyData, timeLabels);
            allHostsData.push(processedData);
        }
        
        // 计算聚合数据
        const avgData = [];
        const maxData = [];
        const minData = [];
        
        for (let i = 0; i < timeLabels.length; i++) {
            const values = allHostsData.map(hostData => parseFloat(hostData[i])).filter(v => !isNaN(v));
            
            if (values.length > 0) {
                avgData.push((values.reduce((sum, val) => sum + val, 0) / values.length).toFixed(1));
                maxData.push(Math.max(...values).toFixed(1));
                minData.push(Math.min(...values).toFixed(1));
            } else {
                avgData.push(0);
                maxData.push(0);
                minData.push(0);
            }
        }

        aggregatedSeries.push(
            {
                name: i18n.t('dashboard2.chartTitles.avgMemory').replace('{count}', hosts.length),
                type: 'line',
                data: avgData,
                smooth: true,
                lineStyle: { color: '#00ff7f', width: 3 },
                areaStyle: {
                    color: {
                        type: 'linear',
                        x: 0, y: 0, x2: 0, y2: 1,
                        colorStops: [
                            { offset: 0, color: 'rgba(0, 255, 127, 0.3)' },
                            { offset: 1, color: 'rgba(0, 255, 127, 0.1)' }
                        ]
                    }
                }
            },
            {
                name: i18n.t('dashboard2.chartTitles.maxMemory'),
                type: 'line',
                data: maxData,
                smooth: true,
                lineStyle: { color: '#ff4444', width: 2, type: 'dashed' }
            },
            {
                name: i18n.t('dashboard2.chartTitles.minMemory'),
                type: 'line',
                data: minData,
                smooth: true,
                lineStyle: { color: '#4444ff', width: 2, type: 'dotted' }
            }
        );

        return aggregatedSeries;
    }

    getTopMemoryHosts(hosts, limit = 5) {
        return hosts
            .filter(host => {
                const memory = this.parsePercentageValue(host.memory);
                return memory > 0; // 过滤掉无数据的主机
            })
            .sort((a, b) => {
                const memoryA = this.parsePercentageValue(a.memory);
                const memoryB = this.parsePercentageValue(b.memory);
                return memoryB - memoryA; // 降序排列
            })
            .slice(0, limit);
    }

    getHostColor(index) {
        const colors = [
            '#ff8c00', '#00ff7f', '#8a2be2', '#ff6347', 
            '#1e90ff', '#ffa500', '#ff69b4', '#32cd32'
        ];
        return colors[index % colors.length];
    }

    showChartError(chartId, message) {
        const element = document.getElementById(chartId);
        if (element) {
            // 将换行符转换为HTML换行
            const formattedMessage = message.replace(/\n/g, '<br>');
            element.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-chart-line" style="opacity: 0.3; font-size: 36px; margin-bottom: 12px;"></i>
                    <div class="error-message" style="color: #a0a0a0; font-size: 14px; line-height: 1.5;">
                        ${formattedMessage}
                    </div>
                </div>
            `;
        }
    }

    showError(message) {
        console.error('Dashboard Error:', message);
        
        // 在主要区域显示错误信息
        const mainLayout = document.querySelector('.main-layout');
        if (mainLayout) {
            mainLayout.innerHTML = `
                <div class="error-state" style="grid-column: 1 / -1; min-height: 400px;">
                    <i class="fas fa-exclamation-triangle"></i>
                    <div class="error-message">${message}</div>
                    <div class="error-detail">请检查Zabbix连接设置或刷新页面重试</div>
                </div>
            `;
        }
    }

    showSuccess(message) {
        console.log('Dashboard Success:', message);
        
        // 创建成功提示浮层
        const successTip = document.createElement('div');
        successTip.className = 'dashboard-success-tip';
        successTip.innerHTML = `
            <div class="success-content">
                <i class="fas fa-check-circle"></i>
                <span>${message}</span>
            </div>
        `;
        
        // 添加样式
        successTip.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #67C23A;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 10000;
            font-size: 14px;
            font-weight: 500;
            animation: dashboardSuccessSlideIn 0.3s ease-out;
        `;
        
        // 添加动画样式
        if (!document.getElementById('dashboardSuccessStyles')) {
            const styles = document.createElement('style');
            styles.id = 'dashboardSuccessStyles';
            styles.textContent = `
                @keyframes dashboardSuccessSlideIn {
                    from {
                        opacity: 0;
                        transform: translateX(100%);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }
                .success-content {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
            `;
            document.head.appendChild(styles);
        }
        
        document.body.appendChild(successTip);
        
        // 3秒后自动移除
        setTimeout(() => {
            if (successTip.parentNode) {
                successTip.parentNode.removeChild(successTip);
            }
        }, 3000);
    }

    async startAutoRefresh() {
        try {
            const settings = await this.getSettings();
            // 刷新间隔以毫秒为单位保存，默认为30秒
            const refreshIntervalMs = parseInt(settings.refreshInterval, 10) || 30000;
            
            console.log(`Setting auto refresh interval to ${refreshIntervalMs/1000} seconds`);
            
            // 清除现有的刷新间隔
            if (this.refreshInterval) {
                clearInterval(this.refreshInterval);
            }
            
            this.refreshInterval = setInterval(() => {
                console.log('Auto refreshing dashboard data...');
                this.loadDashboardData();
                this.updateRefreshTime();
            }, refreshIntervalMs);
        } catch (error) {
            console.error('Failed to start auto refresh:', error);
            // 如果获取设置失败，使用默认30秒间隔
            if (this.refreshInterval) {
                clearInterval(this.refreshInterval);
            }
            
            this.refreshInterval = setInterval(() => {
                console.log('Auto refreshing dashboard data (fallback)...');
                this.loadDashboardData();
                this.updateRefreshTime();
            }, 30000);
        }
    }

    // 初始化设置变化监听器
    initSettingsListener() {
        // 监听Chrome storage变化
        if (chrome && chrome.storage && chrome.storage.onChanged) {
            chrome.storage.onChanged.addListener((changes, namespace) => {
                if (namespace === 'sync') {
                    // 检查是否有刷新间隔变化
                    if (changes.refreshInterval) {
                        const oldValue = changes.refreshInterval.oldValue;
                        const newValue = changes.refreshInterval.newValue;
                        console.log('Refresh interval changed:', { oldValue, newValue });
                        
                        // 重新启动自动刷新
                        this.startAutoRefresh();
                        
                        // 显示更新提示
                        const newIntervalSeconds = parseInt(newValue, 10) / 1000;
                        this.showSuccess(i18n.t('dashboard2.messages.refreshIntervalUpdated').replace('{seconds}', newIntervalSeconds));
                    }
                    
                    // 检查是否有API设置变化
                    if (changes.apiUrl || changes.apiToken) {
                        console.log('API settings changed, reinitializing...');
                        // 重新初始化API实例
                        this.reinitializeApi();
                    }
                }
            });
        }
    }

    // 重新初始化API实例
    async reinitializeApi() {
        try {
            this.api = await this.getApiInstance();
            if (this.api) {
                console.log('API instance reinitialized successfully');
                // 重新加载数据
                await this.loadDashboardData();
            } else {
                this.showError(i18n.t('errors.connectionFailed'));
            }
        } catch (error) {
            console.error('Failed to reinitialize API:', error);
            this.showError(i18n.t('dashboard2.messages.reinitializeApiFailed').replace('{error}', error.message));
        }
    }

    updateRefreshTime() {
        // 等待一小段时间确保header已经加载
        setTimeout(() => {
            const now = new Date();
            const timeString = now.toLocaleTimeString('zh-CN', {
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
                    lastRefreshElement.textContent = i18n.t('dashboard2.messages.lastRefreshTime').replace('{time}', timeString);
                }
            }
            
            // 更新左上角的刷新时间显示
            const dashboardRefreshTimeElement = document.getElementById('dashboardRefreshTime2');
            if (dashboardRefreshTimeElement) {
                const refreshValueElement = dashboardRefreshTimeElement.querySelector('.refresh-value');
                if (refreshValueElement) {
                    refreshValueElement.textContent = timeString;
                }
            }
        }, 100);
    }

    destroy() {
        // 清理资源
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        
        Object.values(this.charts).forEach(chart => {
            if (chart) chart.dispose();
        });
        
        window.removeEventListener('resize', this.resizeHandler);
    }

    // 测试方法：模拟大规模主机数据（仅用于开发测试）
    async simulateLargeScale(hostCount = 1000) {
        console.log(`模拟${hostCount}台主机的大规模环境...`);
        
        // 生成模拟数据
        const hosts = this.generateLargeScaleHostData(hostCount);
        this.hostData = hosts;
        
        // 更新显示
        this.updateHostOverview(hosts);
        
        // 更新图表
        await Promise.all([
            this.updateCpuChart(hosts),
            this.updateMemoryChart(hosts),
            this.updateCpuDistributionChart(hosts),
            this.updateMemoryTrendChart(hosts)
        ]);
        
        console.log(`大规模模拟完成: ${hosts.length}台主机`);
    }

    generateLargeScaleHostData(count = 1000) {
        console.log(`生成${count}台主机的模拟数据...`);
        const hosts = [];
        
        const hostTypes = ['Web服务器', 'DB服务器', '应用服务器', '缓存服务器', '负载均衡器'];
        const locations = ['北京', '上海', '广州', '深圳', '杭州', '成都', '武汉', '西安'];
        
        for (let i = 1; i <= count; i++) {
            const hostType = hostTypes[Math.floor(Math.random() * hostTypes.length)];
            const location = locations[Math.floor(Math.random() * locations.length)];
            
            // 生成不同负载级别的主机
            let cpuBase, memoryBase;
            const loadLevel = Math.random();
            
            if (loadLevel < 0.6) {
                // 60% 正常负载主机
                cpuBase = Math.random() * 30 + 10;      // 10-40%
                memoryBase = Math.random() * 40 + 20;   // 20-60%
            } else if (loadLevel < 0.85) {
                // 25% 中等负载主机
                cpuBase = Math.random() * 30 + 40;      // 40-70%
                memoryBase = Math.random() * 25 + 50;   // 50-75%
            } else if (loadLevel < 0.95) {
                // 10% 高负载主机
                cpuBase = Math.random() * 20 + 70;      // 70-90%
                memoryBase = Math.random() * 20 + 70;   // 70-90%
            } else {
                // 5% 严重负载主机
                cpuBase = Math.random() * 10 + 90;      // 90-100%
                memoryBase = Math.random() * 10 + 90;   // 90-100%
            }
            
            hosts.push({
                hostid: `host_${i}`,
                id: `host_${i}`,
                name: `${location}-${hostType}-${String(i).padStart(4, '0')}`,
                ip: `192.168.${Math.floor(i/254)+1}.${(i%254)+1}`,
                cpu: cpuBase.toFixed(1),
                memory: memoryBase.toFixed(1),
                status: loadLevel > 0.95 ? 'critical' : loadLevel > 0.85 ? 'warning' : 'ok',
                location: location,
                type: hostType,
                lastUpdate: new Date().toISOString()
            });
        }
        
        // 打乱数组，让数据更随机
        for (let i = hosts.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [hosts[i], hosts[j]] = [hosts[j], hosts[i]];
        }
        
        console.log(`生成完成: ${hosts.length}台主机，其中严重负载${hosts.filter(h => parseFloat(h.cpu) > 90).length}台`);
        return hosts;
    }

    // 调试方法：检查主机的监控项
    async debugHostItems(hostId) {
        try {
            console.log(`=== 调试主机 ${hostId} 的监控项 ===`);
            const items = await this.api.getItems(hostId);
            console.log(`主机 ${hostId} 共有 ${items.length} 个监控项:`);
            
            // 显示前20个监控项
            items.slice(0, 20).forEach((item, index) => {
                console.log(`${index + 1}. ${item.name} (${item.key_}) = ${item.lastvalue} ${item.units || ''}`);
            });
            
            // 查找CPU相关的监控项
            const cpuItems = items.filter(item => 
                item.key_.includes('cpu') || 
                item.name.toLowerCase().includes('cpu')
            );
            console.log(`\nCPU相关监控项 (${cpuItems.length} 个):`);
            cpuItems.forEach(item => {
                console.log(`- ${item.name} (${item.key_}) = ${item.lastvalue} ${item.units || ''}`);
            });
            
            // 查找内存相关的监控项
            const memoryItems = items.filter(item => 
                item.key_.includes('memory') || 
                item.key_.includes('mem') ||
                item.name.toLowerCase().includes('memory')
            );
            console.log(`\n内存相关监控项 (${memoryItems.length} 个):`);
            memoryItems.forEach(item => {
                console.log(`- ${item.name} (${item.key_}) = ${item.lastvalue} ${item.units || ''}`);
            });
            
            return { items, cpuItems, memoryItems };
        } catch (error) {
            console.error('调试失败:', error);
            return null;
        }
    }
}

// 初始化资源监控大屏
let resourceDashboard = null;

document.addEventListener('DOMContentLoaded', () => {
    // 等待DOM完全加载后初始化
    setTimeout(() => {
        resourceDashboard = new ResourceMonitoringDashboard();
        
        // 在开发模式下，暴露测试方法到全局
        if (typeof window !== 'undefined') {
            window.simulateLargeScale = (count) => {
                if (resourceDashboard) {
                    resourceDashboard.simulateLargeScale(count);
                }
            };
            
            window.debugHostItems = (hostId) => {
                if (resourceDashboard) {
                    return resourceDashboard.debugHostItems(hostId);
                }
            };
            
            window.refreshRealData = () => {
                if (resourceDashboard) {
                    resourceDashboard.loadDashboardData();
                }
            };
        }
    }, 100);
});

// 页面卸载时清理资源
window.addEventListener('beforeunload', () => {
    if (resourceDashboard) {
        resourceDashboard.destroy();
    }
});
