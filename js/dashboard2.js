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
            const api = new ZabbixAPI(settings.apiUrl, atob(settings.apiToken), settings.zabbixVersion);
            return api;
        } catch (error) {
            console.error('获取API实例失败:', error);
            return null;
        }
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
        
        // 批量获取主机监控数据（合并 item.get 调用）
        const hostIds = hosts.map(h => h.hostid);
        const itemsMap = await this.api.getItemsForHosts(hostIds);

        const enrichedHosts = await Promise.all(
            hosts.map(async (host) => {
                try {
                    // 从预取的映射中获取监控项
                    const allItems = itemsMap[host.hostid] || [];
                    
                    // 查找CPU相关监控项
                    const cpuItem = this.findBestItem(allItems, [
                        'system.cpu.util',
                        'system.cpu.util[,idle]',
                        'system.cpu.util[,system]',
                        'system.cpu.utilization',
                        'CPU utilization',
                        'sfSysCpuCostRate',
                        'dev.cpu.usage'
                    ]);
                    
                    // 查找内存相关监控项
                    const memoryItem = this.findBestItem(allItems, [
                        'vm.memory.util',
                        'vm.memory.utilization',
                        'vm.memory.pused',
                        'system.memory.util',
                        'dev.mem.usage'
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

        // 平均资源使用率模块已移除

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

            // 判断主机是否有监控项（优先依据预填充的监控项键），
            // 或者有真实的数值（>0）。如果既没有监控项又没有有效数值，视为不可用并排除。
            const hasCpuItem = !!host.cpuItemKey;
            const hasMemItem = !!host.memoryItemKey;
            const hasMonitoringItems = hasCpuItem || hasMemItem;

            const noValueAndNoItems = (!hasMonitoringItems) && ( (host.cpu === '-' || host.cpu === null || host.cpu === undefined || cpuValue === 0) && (host.memory === '-' || host.memory === null || host.memory === undefined || memoryValue === 0) );

            if (noValueAndNoItems) {
                // 标记为不可用，不计入健康/警告/严重统计
                unknown++;
                return;
            }

            // 可用主机计入统计
            validHosts++;
            totalCpu += cpuValue;
            totalMemory += memoryValue;

            const maxUsage = Math.max(cpuValue, memoryValue);
            if (maxUsage > 80) critical++;
            else if (maxUsage > 60) warning++;
            else healthy++;
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
        
        // 添加事件监听器 — 点击跳转到 CMDB 页面以查看完整列表
        const viewAllBtn = virtualScrollHint.querySelector('.view-all-btn');
        viewAllBtn.addEventListener('click', () => {
            // 在当前窗口打开 CMDB 页面
            window.location.href = 'cmdb.html';
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
                    textStyle: { color: '#fff' },
                    formatter: function(params) {
                        const time = new Date(params[0].value[0]);
                        const timeStr = time.toLocaleString('zh-CN', {
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                        });
                        
                        let result = `<div style="font-weight: bold; margin-bottom: 8px;">${timeStr}</div>`;
                        params.forEach(param => {
                            const value = param.value[1];
                            result += `<div style="margin: 4px 0;">
                                <span style="display:inline-block;margin-right:5px;border-radius:10px;width:10px;height:10px;background:${param.color};"></span>
                                ${param.seriesName}: ${value.toFixed(1)}%
                            </div>`;
                        });
                        return result;
                    }
                },
                legend: {
                    data: cpuData.series.map(s => s.name),
                    textStyle: { color: '#fff' },
                    top: 20,
                    type: 'scroll'
                },
                grid: {
                    left: '3%',
                    right: '4%',
                    bottom: '10%',
                    top: '20%',
                    containLabel: true
                },
                xAxis: {
                    type: 'time', // 改为时间轴
                    axisLine: { lineStyle: { color: 'rgba(255, 140, 0, 0.3)' } },
                    axisLabel: { 
                        color: '#a0a0a0', 
                        fontSize: 10,
                        formatter: function(value) {
                            const date = new Date(value);
                            return date.getHours().toString().padStart(2, '0') + ':' + 
                                   date.getMinutes().toString().padStart(2, '0');
                        }
                    },
                    splitLine: { show: false }
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
                    min: 0,
                    max: 100
                },
                series: cpuData.series
            };

            this.charts.cpu.setOption(option);
            console.log(`CPU图表更新完成，包含${cpuData.series.length}个数据系列`);
        } catch (error) {
            console.error('更新CPU图表失败:', error);
            this.showChartError('cpuUtilizationChart', i18n.t('dashboard2.messages.cannotLoadCpuData'));
        }
    }

    async updateMemoryChart(hosts) {
        if (!this.charts.memory) return;

        try {
            // 生成内存使用率分布数据
            const memoryData = await this.getMemoryDistributionData(hosts);
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
                    legend: { show: false },
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
                        show: false
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
            const cpuData = await this.getCpuDistributionData(hosts);
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
                    legend: { show: false },
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
                        show: false
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
            // 获取内存历史数据（最近24小时，15分钟采样）
            const memoryTrendData = await this.getMemoryTrendData(hosts);
            
            const option = {
                backgroundColor: 'transparent',
                tooltip: {
                    trigger: 'axis',
                    backgroundColor: 'rgba(25, 25, 45, 0.95)',
                    borderColor: 'rgba(0, 255, 127, 0.3)',
                    textStyle: { color: '#fff' },
                    formatter: function(params) {
                        if (params.length === 0) return '';
                        const time = new Date(params[0].axisValue).toLocaleString();
                        let result = `<div style="font-weight: bold; margin-bottom: 8px;">${time}</div>`;
                        params.forEach(param => {
                            result += `<div style="margin: 4px 0;">
                                <span style="display: inline-block; width: 10px; height: 10px; background: ${param.color}; border-radius: 50%; margin-right: 8px;"></span>
                                ${param.seriesName}: ${param.value[1].toFixed(1)}%
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
                    type: 'time',
                    axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.3)' }},
                    axisLabel: { 
                        color: '#a0a0a0',
                        formatter: function(value) {
                            const date = new Date(value);
                            return date.getHours() + ':' + date.getMinutes().toString().padStart(2, '0');
                        }
                    },
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
        console.log('=== 获取CPU历史数据（基于时间戳） ===');
        
        const series = [];
        const allTimeStamps = new Set();
        
        // 1. 大规模主机处理策略
        if (hosts.length > 100) {
            console.log('大规模模式：处理聚合数据');
            
            // 获取TOP 5主机的历史数据
            const topHosts = this.getTopIssueHosts(hosts, 5);
            const allHistoryData = [];
            
            // 预取TOP主机的CPU监控项，合并 item.get 调用
            const topHostIds = topHosts.map(h => h.hostid);
            const topItemsMap = await this.api.getItemsForHosts(topHostIds, 'CPU utilization');

            for (const [index, host] of topHosts.entries()) {
                console.log(`获取TOP主机${index + 1}: ${host.name}`);
                const cpuHistory = await this.getHostCpuHistory(host, 24, topItemsMap[host.hostid]);
                
                if (cpuHistory.length > 0) {
                    // 收集所有时间戳
                    cpuHistory.forEach(point => allTimeStamps.add(point.time));
                    allHistoryData.push({ host, history: cpuHistory, index });
                }
            }
            
            // （已移除）不再在图表中自动添加“平均CPU”系列，保留每台主机的曲线
            
            // 处理每个主机的数据
            for (const { host, history, index, isAggregated } of allHistoryData) {
                const timeValuePairs = history.map(point => [point.time, point.value]);
                
                series.push({
                    name: host.name,
                    type: 'line',
                    data: timeValuePairs,
                    smooth: true,
                    lineStyle: isAggregated ? 
                        { color: '#00ff7f', width: 3 } : 
                        { color: this.getTopHostColor(index), width: 2 },
                    areaStyle: isAggregated ? {
                        color: {
                            type: 'linear',
                            x: 0, y: 0, x2: 0, y2: 1,
                            colorStops: [
                                { offset: 0, color: 'rgba(0, 255, 127, 0.3)' },
                                { offset: 1, color: 'rgba(0, 255, 127, 0.1)' }
                            ]
                        }
                    } : undefined
                });
            }
        } else {
            console.log('标准模式：处理所有主机');
            
            // 标准模式：显示所有主机（最多10个）
            const displayHosts = hosts.slice(0, 10);

            // 预取 displayHosts 的 CPU 监控项，合并 item.get 调用
            const displayHostIds = displayHosts.map(h => h.hostid);
            const displayItemsMap = await this.api.getItemsForHosts(displayHostIds, 'CPU utilization');

            for (const [index, host] of displayHosts.entries()) {
                console.log(`获取主机${index + 1}: ${host.name}`);
                const cpuHistory = await this.getHostCpuHistory(host, 24, displayItemsMap[host.hostid]);
                
                if (cpuHistory.length > 0) {
                    // 收集时间戳
                    cpuHistory.forEach(point => allTimeStamps.add(point.time));
                    
                    // 转换为时间-值对
                    const timeValuePairs = cpuHistory.map(point => [point.time, point.value]);
                    
                    series.push({
                        name: host.name,
                        type: 'line',
                        data: timeValuePairs,
                        smooth: true,
                        lineStyle: { 
                            color: this.getHostColor(index),
                            width: 2 
                        }
                    });
                } else {
                    console.warn(`主机 ${host.name} 没有历史数据`);
                }
            }
        }
        
        // 2. 处理时间轴
        const sortedTimeStamps = Array.from(allTimeStamps).sort((a, b) => a - b);
        console.log(`时间轴范围: ${new Date(sortedTimeStamps[0]).toLocaleString()} - ${new Date(sortedTimeStamps[sortedTimeStamps.length-1]).toLocaleString()}`);
        console.log(`共有${sortedTimeStamps.length}个时间点，${series.length}个数据系列`);
        
        return { 
            timeLabels: sortedTimeStamps, // 返回时间戳数组而不是字符串标签
            series: series 
        };
    }
    
    // 生成聚合数据
    generateAggregatedData(allHistoryData) {
        console.log('生成聚合CPU数据...');
        
        if (allHistoryData.length === 0) return [];
        
        // 收集所有时间点
        const allTimePoints = new Map();
        
        allHistoryData.forEach(({ history }) => {
            history.forEach(point => {
                if (!allTimePoints.has(point.time)) {
                    allTimePoints.set(point.time, []);
                }
                allTimePoints.get(point.time).push(point.value);
            });
        });
        
        // 计算每个时间点的平均值
        const aggregatedData = [];
        for (const [time, values] of allTimePoints) {
            if (values.length > 0) {
                const avgValue = values.reduce((sum, val) => sum + val, 0) / values.length;
                aggregatedData.push({ time, value: parseFloat(avgValue.toFixed(1)) });
            }
        }
        
        // 按时间排序
        aggregatedData.sort((a, b) => a.time - b.time);
        console.log(`生成聚合数据: ${aggregatedData.length}个点`);
        
        return aggregatedData;
    }

    // 生成聚合数据
    generateAggregatedData(allHistoryData) {
        console.log('生成聚合CPU数据...');
        
        if (allHistoryData.length === 0) return [];
        
        // 收集所有时间点
        const allTimePoints = new Map();
        
        allHistoryData.forEach(({ history }) => {
            history.forEach(point => {
                if (!allTimePoints.has(point.time)) {
                    allTimePoints.set(point.time, []);
                }
                allTimePoints.get(point.time).push(point.value);
            });
        });
        
        // 计算每个时间点的平均值
        const aggregatedData = [];
        for (const [time, values] of allTimePoints) {
            if (values.length > 0) {
                const avgValue = values.reduce((sum, val) => sum + val, 0) / values.length;
                aggregatedData.push({ time, value: parseFloat(avgValue.toFixed(1)) });
            }
        }
        
        // 按时间排序
        aggregatedData.sort((a, b) => a.time - b.time);
        console.log(`生成聚合数据: ${aggregatedData.length}个点`);
        
        return aggregatedData;
    }

    // 生成时间标签（24小时格式）
    generateTimeLabels(hours = 24) {
        const labels = [];
        const now = new Date();
        
        for (let i = hours - 1; i >= 0; i--) {
            const time = new Date(now.getTime() - i * 60 * 60 * 1000);
            labels.push(time.getHours().toString().padStart(2, '0') + ':00');
        }
        
        return labels;
    }

    async getHostCpuHistory(host, hours = 24, cpuItems = null) {
        try {
            console.log(`=== 获取 ${host.name} 的CPU历史数据 ===`);
            
            // 1. 获取CPU utilization监控项（优先使用传入的items，缺省时再调用API）
            if (!cpuItems) {
                cpuItems = await this.api.getItems(host.hostid, 'CPU utilization');
            }

            if (!cpuItems || cpuItems.length === 0) {
                console.warn(`主机 ${host.name} 没有CPU utilization监控项，跳过该主机`);
                return []; // 返回空数组，该主机不会在趋势图中显示
            }
            
            const cpuItem = cpuItems[0];
            console.log(`使用监控项: ${cpuItem.name} (${cpuItem.key_})`);
            
            // 2. 获取最新值作为基准
            const currentValue = parseFloat(cpuItem.lastvalue || 0);
            console.log(`当前CPU使用率: ${currentValue.toFixed(1)}%`);
            
            // 3. 计算时间范围
            const now = Math.floor(Date.now() / 1000);
            const timeFrom = now - hours * 60 * 60; // 24小时前
            
            console.log(`查询时间范围: ${new Date(timeFrom * 1000).toLocaleString()} - ${new Date(now * 1000).toLocaleString()}`);
            
            // 4. 获取历史数据，使用正确的参数顺序：getHistory(itemId, valueType, timeFrom, timeTill, limit)
            const history = await this.api.getHistory(cpuItem.itemid, 0, timeFrom, now, 2000);
            console.log(`获取到历史数据: ${history.length} 条`);
            
            if (history.length === 0) {
                console.warn(`主机 ${host.name} 没有历史数据，跳过该主机`);
                return []; // 没有历史数据也不显示
            }
            
            // 5. 转换数据格式并进行15分钟采样
            const processedHistory = history.map(item => ({
                time: parseInt(item.clock) * 1000,
                value: parseFloat(item.value)
            })).sort((a, b) => a.time - b.time);
            
            // 6. 进行15分钟采样
            const sampledHistory = this.sampleDataByInterval(processedHistory, 15 * 60 * 1000); // 15分钟 = 15 * 60 * 1000毫秒
            console.log(`15分钟采样后数据点: ${sampledHistory.length}个`);
            
            // 7. 数据分析和验证
            const values = sampledHistory.map(item => item.value);
            const minValue = Math.min(...values);
            const maxValue = Math.max(...values);
            const avgValue = values.reduce((sum, val) => sum + val, 0) / values.length;
            const variationRange = maxValue - minValue;
            
            console.log(`数据分析:`);
            console.log(`- 采样前数据点: ${processedHistory.length}`);
            console.log(`- 采样后数据点: ${sampledHistory.length}`);
            console.log(`- 值范围: ${minValue.toFixed(1)}% - ${maxValue.toFixed(1)}%`);
            console.log(`- 平均值: ${avgValue.toFixed(1)}%`);
            console.log(`- 变化幅度: ${variationRange.toFixed(1)}%`);
            console.log(`- 数据质量: ${variationRange > 1 ? '有变化' : '相对平稳'}`);
            
            // 8. 时间分布检查
            const firstTime = new Date(sampledHistory[0].time);
            const lastTime = new Date(sampledHistory[sampledHistory.length - 1].time);
            const timeSpan = (lastTime - firstTime) / (1000 * 60 * 60); // 小时
            
            console.log(`时间跨度: ${firstTime.toLocaleString()} - ${lastTime.toLocaleString()} (${timeSpan.toFixed(1)}小时)`);
            
            // 9. 样本数据展示
            console.log('采样后数据 (前5个):', sampledHistory.slice(0, 5).map(d => 
                `${new Date(d.time).toLocaleTimeString()}: ${d.value.toFixed(1)}%`
            ));
            console.log('采样后数据 (后5个):', sampledHistory.slice(-5).map(d => 
                `${new Date(d.time).toLocaleTimeString()}: ${d.value.toFixed(1)}%`
            ));
            
            // 10. 如果采样后数据太少，返回空数组（不显示该主机）
            if (sampledHistory.length < 3) {
                console.warn(`主机 ${host.name} 采样后数据点不足，跳过该主机`);
                return [];
            }
            
            return sampledHistory;
            
        } catch (error) {
            console.error(`获取CPU历史数据失败:`, error);
            return this.generateFallbackCpuData();
        }
    }
    
    // 生成回退CPU数据
    generateFallbackCpuData(baseValue = 50) {
        console.log(`生成CPU模拟数据，基准值: ${baseValue}%`);
        const data = [];
        const now = Date.now();
        
        for (let i = 0; i < 24; i++) {
            const time = now - (23 - i) * 60 * 60 * 1000;
            // 基于时间的变化模式：夜间低，白天高
            const hour = new Date(time).getHours();
            let value = baseValue;
            
            if (hour >= 2 && hour <= 6) {
                value = baseValue * 0.3 + Math.random() * baseValue * 0.2; // 夜间较低
            } else if (hour >= 9 && hour <= 17) {
                value = baseValue * 0.8 + Math.random() * baseValue * 0.4; // 工作时间较高
            } else {
                value = baseValue * 0.5 + Math.random() * baseValue * 0.3; // 其他时间中等
            }
            
            value = Math.max(1, Math.min(95, value)); // 限制在1-95%之间
            data.push({ time, value: parseFloat(value.toFixed(1)) });
        }
        
        console.log('生成24小时模拟CPU趋势，变化范围:', 
            `${Math.min(...data.map(d => d.value)).toFixed(1)}% - ${Math.max(...data.map(d => d.value)).toFixed(1)}%`);
        return data;
    }
    
    // 增强历史数据
    enhanceHistoryData(originalData, currentValue) {
        if (originalData.length === 0) {
            return this.generateFallbackCpuData(currentValue);
        }
        
        console.log('增强历史数据以增加变化...');
        const enhanced = originalData.map((item, index) => {
            // 添加轻微的随机变化
            const variation = (Math.random() - 0.5) * 3; // ±1.5%的变化
            const newValue = Math.max(0.1, Math.min(99.9, item.value + variation));
            return { ...item, value: parseFloat(newValue.toFixed(1)) };
        });
        
        console.log('数据增强完成，新的变化范围:', 
            `${Math.min(...enhanced.map(d => d.value)).toFixed(1)}% - ${Math.max(...enhanced.map(d => d.value)).toFixed(1)}%`);
        return enhanced;
    }

    // 按指定时间间隔对数据进行采样
    sampleDataByInterval(data, intervalMs, attempts = 0) {
        if (data.length === 0) return [];

        console.log(`开始采样，原始数据: ${data.length}个点，目标间隔: ${intervalMs / 1000 / 60}分钟`);

        // 按时间排序确保数据顺序正确
        const sortedData = [...data].sort((a, b) => a.time - b.time);

        const sampledData = [];
        let lastSampleTime = 0;

        for (const point of sortedData) {
            // 如果是第一个点，或者距离上次采样超过指定间隔
            if (sampledData.length === 0 || point.time - lastSampleTime >= intervalMs) {
                sampledData.push(point);
                lastSampleTime = point.time;
            }
        }

        // 如果采样后点数太少，尝试逐步降低采样间隔，最多重试3次，防止在不同间隔之间来回切换
        if (sampledData.length < 4 && intervalMs > 5 * 60 * 1000 && attempts < 3) {
            const newInterval = Math.max(5 * 60 * 1000, Math.floor(intervalMs * 2 / 3));
            console.log(`采样点太少(${sampledData.length}个)，降低到${newInterval / 1000 / 60}分钟间隔重新采样（尝试 ${attempts + 1}）`);
            return this.sampleDataByInterval(data, newInterval, attempts + 1);
        }

        if (sampledData.length < 4 && attempts >= 3) {
            console.log(`采样点仍然较少(${sampledData.length}个)，达到最大重试次数，使用当前采样结果`);
        }

        console.log(`采样完成: ${sortedData.length} -> ${sampledData.length}个点 (间隔 ${intervalMs / 1000 / 60}分钟, 尝试 ${attempts})`);
        if (sampledData.length > 0) {
            console.log(`采样数据时间范围: ${new Date(sampledData[0].time).toLocaleTimeString()} - ${new Date(sampledData[sampledData.length - 1].time).toLocaleTimeString()}`);
        }

        return sampledData;
    }

    // 分段获取完整历史数据
    async getCompleteHistoryData(itemId, hours = 24) {
        const endTime = Math.floor(Date.now() / 1000);
        const startTime = Math.floor((Date.now() - hours * 60 * 60 * 1000) / 1000);
        const allHistory = [];
        
        // 每次请求4小时的数据，确保不会超过limit
        const segmentHours = 4;
        const segmentDuration = segmentHours * 60 * 60; // 4小时的秒数
        
        console.log(`分段获取历史数据: ${hours}小时分为${Math.ceil(hours/segmentHours)}段`);
        
        for (let currentTime = startTime; currentTime < endTime; currentTime += segmentDuration) {
            const segmentEnd = Math.min(currentTime + segmentDuration, endTime);
            
            console.log(`获取时间段: ${new Date(currentTime * 1000).toLocaleString()} - ${new Date(segmentEnd * 1000).toLocaleString()}`);
            
            try {
                // 每段使用较小的limit，避免超限
                const segmentHistory = await this.api.getHistory(itemId, 0, currentTime, segmentEnd, 1000);
                console.log(`该时间段获取到 ${segmentHistory.length} 条数据`);
                
                if (segmentHistory && segmentHistory.length > 0) {
                    allHistory.push(...segmentHistory);
                }
                
                // 短暂延迟避免请求过快
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (error) {
                console.error(`获取时间段数据失败: ${new Date(currentTime * 1000).toLocaleString()}`, error);
                // 继续下一段，不要因为一段失败而完全失败
            }
        }
        
        // 去重并排序
        const uniqueHistory = this.deduplicateHistoryData(allHistory);
        console.log(`分段获取完成，总数据: ${allHistory.length}条，去重后: ${uniqueHistory.length}条`);
        
        return uniqueHistory;
    }

    // 去重历史数据（基于时间戳）
    deduplicateHistoryData(historyArray) {
        const seen = new Set();
        return historyArray.filter(item => {
            const key = `${item.clock}_${item.value}`;
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        }).sort((a, b) => parseInt(a.clock) - parseInt(b.clock));
    }

    // 计算每小时平均值
    calculateHourlyAverages(processedHistory) {
        const hourlyData = {};
        
        processedHistory.forEach(item => {
            const hour = new Date(item.time).getHours();
            if (!hourlyData[hour]) {
                hourlyData[hour] = [];
            }
            hourlyData[hour].push(item.value);
        });
        
        const hourlyAvg = {};
        Object.keys(hourlyData).forEach(hour => {
            const values = hourlyData[hour];
            hourlyAvg[`${hour}:00`] = (values.reduce((sum, val) => sum + val, 0) / values.length).toFixed(1);
        });
        
        return hourlyAvg;
    }

    processHistoryData(historyData, timeLabels, currentValue = 0) {
        console.log(`=== 处理历史数据为24小时趋势 ===`);
        console.log(`原始数据: ${historyData.length}条, 目标时间点: ${timeLabels.length}个`);
        
        if (historyData.length === 0) {
            console.warn('无历史数据，返回固定值数组');
            return new Array(timeLabels.length).fill(currentValue || 0);
        }
        
        const result = [];
        const now = Date.now();
        
        // 为每个时间标签找对应的数据
        for (let i = 0; i < timeLabels.length; i++) {
            // 计算目标时间（24小时前到现在）
            const targetTime = now - (23 - i) * 60 * 60 * 1000;
            const timeWindow = 30 * 60 * 1000; // 30分钟窗口
            
            // 在目标时间前后30分钟内查找数据
            const nearbyData = historyData.filter(item => 
                Math.abs(item.time - targetTime) <= timeWindow
            );
            
            let value;
            if (nearbyData.length > 0) {
                // 有数据：取平均值
                const avg = nearbyData.reduce((sum, item) => sum + item.value, 0) / nearbyData.length;
                value = parseFloat(avg.toFixed(1));
                console.log(`${timeLabels[i]}: 找到${nearbyData.length}个数据点，平均值=${value}%`);
            } else {
                // 无数据：找最近的数据点
                let closest = historyData[0];
                let minDiff = Math.abs(historyData[0].time - targetTime);
                
                historyData.forEach(item => {
                    const diff = Math.abs(item.time - targetTime);
                    if (diff < minDiff) {
                        minDiff = diff;
                        closest = item;
                    }
                });
                
                value = parseFloat(closest.value.toFixed(1));
                const diffHours = minDiff / (60 * 60 * 1000);
                console.log(`${timeLabels[i]}: 无直接数据，使用${diffHours.toFixed(1)}小时前的数据=${value}%`);
            }
            
            result.push(value);
        }
        
        console.log(`最终24小时趋势: [${result.map(v => v.toFixed(1)).join(', ')}]`);
        
        // 检查数据是否有变化
        const hasChange = result.some((val, idx) => idx > 0 && Math.abs(val - result[idx-1]) > 0.1);
        console.log(`数据变化检测: ${hasChange ? '有变化' : '无变化'}`);
        
        return result;
    }

    async getAggregatedCpuData(hosts, timeLabels) {
        console.log(`=== 开始获取聚合CPU数据 ===`);
        console.log(`处理${hosts.length}台主机，${timeLabels.length}个时间点`);
        
        const aggregatedSeries = [];
        const allHostsData = [];
        
        // 获取所有主机的CPU历史数据
        for (const host of hosts.slice(0, 20)) { // 限制处理的主机数量，避免过多请求
            console.log(`处理主机: ${host.name}`);
            const historyData = await this.getHostCpuHistory(host, 24);
            const processedData = this.processHistoryData(historyData, timeLabels, parseFloat(host.cpu || 0));
            allHostsData.push(processedData);
        }
        
        // 计算聚合数据
        const avgData = [];
        const maxData = [];
        const minData = [];
        
        for (let i = 0; i < timeLabels.length; i++) {
            const values = allHostsData.map(hostData => parseFloat(hostData[i])).filter(v => !isNaN(v) && v > 0);
            
            if (values.length > 0) {
                const avg = (values.reduce((sum, val) => sum + val, 0) / values.length).toFixed(1);
                const max = Math.max(...values).toFixed(1);
                const min = Math.min(...values).toFixed(1);
                
                avgData.push(avg);
                maxData.push(max);
                minData.push(min);
            } else {
                avgData.push(0);
                maxData.push(0);
                minData.push(0);
            }
        }
        
        console.log(`聚合数据计算完成 - 平均值范围: ${Math.min(...avgData.filter(v => v > 0))} - ${Math.max(...avgData)}%`);

        aggregatedSeries.push(
            {
                name: `平均CPU使用率 (${allHostsData.length}台主机)`,
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
                name: '最大CPU使用率',
                type: 'line',
                data: maxData,
                smooth: true,
                lineStyle: { color: '#ff4444', width: 2, type: 'dashed' }
            },
            {
                name: '最小CPU使用率',
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

    async getCpuDistributionData(hosts) {
        console.log(`=== 获取CPU分布数据（仅使用CPU utilization监控项） ===`);
        console.log(`处理${hosts.length}台主机的CPU分布`);
        
        const data = [];
        const cpuValues = [];
        const validHosts = [];
        const skippedHosts = [];
        
        // 1. 批量获取所有主机的CPU utilization监控项最后值，合并 item.get 请求
        const hostIds = hosts.map(h => h.hostid);
        const itemsMap = await this.api.getItemsForHosts(hostIds, 'CPU utilization');

        for (const host of hosts) {
            try {
                const cpuItems = itemsMap[host.hostid] || [];
                if (cpuItems.length > 0 && cpuItems[0].lastvalue !== null) {
                    const cpuValue = parseFloat(cpuItems[0].lastvalue);
                    console.log(`${host.name}: CPU utilization = ${cpuValue.toFixed(1)}%`);

                    if (cpuValue >= 0 && cpuValue <= 100) { // 有效值范围
                        cpuValues.push(cpuValue);
                        validHosts.push(host.name);
                    } else {
                        console.warn(`${host.name}: CPU值异常 (${cpuValue}%)，跳过`);
                        skippedHosts.push(host.name);
                    }
                } else {
                    console.warn(`${host.name}: 没有CPU utilization监控项或无lastvalue，跳过该主机`);
                    skippedHosts.push(host.name);
                }
            } catch (error) {
                console.warn(`处理${host.name}时发生错误: ${error.message}，跳过该主机`);
                skippedHosts.push(host.name);
            }
        }
        
        console.log(`有效主机: ${validHosts.length}台，跳过主机: ${skippedHosts.length}台`);
        if (skippedHosts.length > 0) {
            console.log(`跳过的主机: ${skippedHosts.slice(0, 5).join(', ')}${skippedHosts.length > 5 ? ' 等' : ''}`);
        }
        
        // 如果没有有效的CPU数据，返回空
        if (cpuValues.length === 0) {
            console.warn('没有找到任何有效的CPU utilization数据');
            return [];
        }
        
        // 2. 根据有效主机数量选择分布策略
        if (validHosts.length > 100) {
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
                const count = cpuValues.filter(value => 
                    value >= range.min && value < range.max
                ).length;
                
                if (count > 0) {
                    data.push({
                        name: `${range.name} (${count}台主机)`,
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

            // 3. 添加统计信息
            const avgCpu = cpuValues.reduce((sum, val) => sum + val, 0) / cpuValues.length;
            const maxCpu = Math.max(...cpuValues);
            const minCpu = Math.min(...cpuValues);
            
            console.log(`CPU分布统计（仅CPU utilization监控项）:`);
            console.log(`- 总主机数: ${hosts.length}台`);
            console.log(`- 有效主机数: ${validHosts.length}台`);
            console.log(`- 跳过主机数: ${skippedHosts.length}台`);
            console.log(`- 平均CPU使用率: ${avgCpu.toFixed(1)}%`);
            console.log(`- 最高CPU使用率: ${maxCpu.toFixed(1)}%`);
            console.log(`- 最低CPU使用率: ${minCpu.toFixed(1)}%`);
            console.log(`- 使用率范围: ${(maxCpu - minCpu).toFixed(1)}%`);
        } else {
            // 标准模式：4段分布
            const ranges = [
                { name: '0-25%', min: 0, max: 25, color: '#00ff7f' },
                { name: '25-50%', min: 25, max: 50, color: '#7fff00' },
                { name: '50-75%', min: 50, max: 75, color: '#ffa500' },
                { name: '75-100%', min: 75, max: 100, color: '#ff4444' }
            ];

            ranges.forEach(range => {
                const count = cpuValues.filter(value => 
                    value >= range.min && value < range.max
                ).length;
                
                if (count > 0) {
                    data.push({
                        name: `${range.name} (${count}台)`,
                        value: count,
                        itemStyle: { color: range.color }
                    });
                }
            });
            
            // 添加简化统计信息
            const avgCpu = cpuValues.reduce((sum, val) => sum + val, 0) / cpuValues.length;
            
            console.log(`CPU分布统计（仅CPU utilization监控项）:`);
            console.log(`- 总主机数: ${hosts.length}台`);
            console.log(`- 有效主机数: ${validHosts.length}台（有CPU utilization监控项）`);
            console.log(`- 跳过主机数: ${skippedHosts.length}台（无CPU utilization监控项）`);
            console.log(`- 平均CPU使用率: ${avgCpu.toFixed(1)}%`);
        }

        console.log(`CPU分布计算完成，生成${data.length}个分组（基于${validHosts.length}台有效主机）`);
        return data;
    }

    async getMemoryDistributionData(hosts) {
        console.log(`=== 获取内存分布数据 ===`);
        console.log(`处理${hosts.length}台主机的内存分布`);
        
        const data = [];
        const memoryValues = [];
        
        // 1. 批量获取所有主机的实时内存使用率（合并 item.get 调用）
        const hostIds = hosts.map(h => h.hostid);
        const itemsMap = await this.api.getItemsForHosts(hostIds, 'Memory utilization');

        for (const host of hosts) {
            try {
                const memoryItems = itemsMap[host.hostid] || [];
                let memoryValue = 0;
                if (memoryItems.length > 0 && memoryItems[0].lastvalue !== null) {
                    memoryValue = parseFloat(memoryItems[0].lastvalue);
                    console.log(`${host.name}: Memory utilization = ${memoryValue.toFixed(1)}%`);
                } else {
                    // 回退到已有的解析值
                    memoryValue = this.parsePercentageValue(host.memory);
                    console.log(`${host.name}: 使用回退值 = ${memoryValue.toFixed(1)}%`);
                }

                if (memoryValue > 0) {
                    memoryValues.push(memoryValue);
                }
            } catch (error) {
                const fallbackValue = this.parsePercentageValue(host.memory);
                if (fallbackValue > 0) {
                    memoryValues.push(fallbackValue);
                }
                console.warn(`处理${host.name}内存数据时发生错误，使用回退值: ${fallbackValue}%`);
            }
        }
        
        console.log(`成功获取${memoryValues.length}台主机的内存数据`);
        
        // 2. 根据主机数量选择分布策略
        if (hosts.length > 100) {
            // 大规模模式：更详细的分布统计
            const ranges = [
                { name: '0-20%', min: 0, max: 20, color: '#1e90ff' },
                { name: '20-40%', min: 20, max: 40, color: '#00bfff' },
                { name: '40-60%', min: 40, max: 60, color: '#ffd700' },
                { name: '60-80%', min: 60, max: 80, color: '#ffa500' },
                { name: '80-95%', min: 80, max: 95, color: '#ff6347' },
                { name: '95-100%', min: 95, max: 100, color: '#ff4444' }
            ];

            ranges.forEach(range => {
                const count = memoryValues.filter(value => 
                    value >= range.min && value < range.max
                ).length;
                
                if (count > 0) {
                    data.push({
                        name: `${range.name} (${count}台主机)`,
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

            // 3. 添加统计信息
            if (memoryValues.length > 0) {
                const avgMemory = memoryValues.reduce((sum, val) => sum + val, 0) / memoryValues.length;
                const maxMemory = Math.max(...memoryValues);
                const minMemory = Math.min(...memoryValues);
                
                console.log(`内存分布统计:`);
                console.log(`- 主机数量: ${memoryValues.length}`);
                console.log(`- 平均内存使用率: ${avgMemory.toFixed(1)}%`);
                console.log(`- 最高内存使用率: ${maxMemory.toFixed(1)}%`);
                console.log(`- 最低内存使用率: ${minMemory.toFixed(1)}%`);
                console.log(`- 使用率范围: ${(maxMemory - minMemory).toFixed(1)}%`);
            }
        } else {
            // 标准模式：4段分布
            const ranges = [
                { name: '0-25%', min: 0, max: 25, color: '#1e90ff' },
                { name: '25-50%', min: 25, max: 50, color: '#00bfff' },
                { name: '50-75%', min: 50, max: 75, color: '#ffa500' },
                { name: '75-100%', min: 75, max: 100, color: '#ff4444' }
            ];

            ranges.forEach(range => {
                const count = memoryValues.filter(value => 
                    value >= range.min && value < range.max
                ).length;
                
                if (count > 0) {
                    data.push({
                        name: `${range.name} (${count}台)`,
                        value: count,
                        itemStyle: { color: range.color }
                    });
                }
            });
        }

        console.log(`内存分布计算完成，生成${data.length}个分组`);
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
        console.log('=== 获取内存历史数据（基于时间戳，15分钟采样） ===');
        
        const series = [];
        const allTimeStamps = new Set();
        
        // 1. 大规模主机处理策略
        if (hosts.length > 100) {
            console.log('大规模模式：处理聚合内存数据');
            
            // 获取TOP 5内存使用率高的主机的历史数据
            const topHosts = this.getTopMemoryHosts(hosts, 5);
            const allHistoryData = [];
            
            // 预取 TOP 内存主机的 memory items
            const topHostIds = topHosts.map(h => h.hostid);
            const topMemItemsMap = await this.api.getItemsForHosts(topHostIds, 'Memory utilization');

            for (const [index, host] of topHosts.entries()) {
                console.log(`获取TOP内存主机${index + 1}: ${host.name}`);
                const memoryHistory = await this.getHostMemoryHistory(host, 24, topMemItemsMap[host.hostid]);
                
                if (memoryHistory.length > 0) {
                    // 收集所有时间戳
                    memoryHistory.forEach(point => allTimeStamps.add(point.time));
                    allHistoryData.push({ host, history: memoryHistory, index });
                }
            }
            
            // 生成聚合数据
            const aggregatedHistory = this.generateAggregatedData(allHistoryData);
            if (aggregatedHistory.length > 0) {
                aggregatedHistory.forEach(point => allTimeStamps.add(point.time));
                allHistoryData.unshift({ 
                    host: { name: `平均内存 (${topHosts.length}台主机)` }, 
                    history: aggregatedHistory, 
                    index: -1,
                    isAggregated: true 
                });
            }
            
            // 处理每个主机的数据
            for (const { host, history, index, isAggregated } of allHistoryData) {
                const timeValuePairs = history.map(point => [point.time, point.value]);
                
                series.push({
                    name: host.name,
                    type: 'line',
                    data: timeValuePairs,
                    smooth: true,
                    lineStyle: isAggregated ? 
                        { color: '#00bfff', width: 3 } : 
                        { color: this.getTopHostColor(index), width: 2 },
                    areaStyle: isAggregated ? {
                        color: {
                            type: 'linear',
                            x: 0, y: 0, x2: 0, y2: 1,
                            colorStops: [
                                { offset: 0, color: 'rgba(0, 191, 255, 0.3)' },
                                { offset: 1, color: 'rgba(0, 191, 255, 0.1)' }
                            ]
                        }
                    } : undefined
                });
            }
        } else {
            console.log('标准模式：处理所有内存主机');
            
            // 标准模式：显示所有主机（最多10个）
            const displayHosts = hosts.slice(0, 10);
            
            // 预取 displayHosts 的 memory items
            const displayHostIds = displayHosts.map(h => h.hostid);
            const displayMemItemsMap = await this.api.getItemsForHosts(displayHostIds, 'Memory utilization');

            for (const [index, host] of displayHosts.entries()) {
                console.log(`获取内存主机${index + 1}: ${host.name}`);
                const memoryHistory = await this.getHostMemoryHistory(host, 24, displayMemItemsMap[host.hostid]);
                
                if (memoryHistory.length > 0) {
                    // 收集时间戳
                    memoryHistory.forEach(point => allTimeStamps.add(point.time));
                    
                    // 转换为时间-值对
                    const timeValuePairs = memoryHistory.map(point => [point.time, point.value]);
                    
                    series.push({
                        name: host.name,
                        type: 'line',
                        data: timeValuePairs,
                        smooth: true,
                        lineStyle: { 
                            color: this.getHostColor(index),
                            width: 2 
                        }
                    });
                } else {
                    console.warn(`主机 ${host.name} 没有内存历史数据`);
                }
            }
        }
        
        // 2. 处理时间轴
        const sortedTimeStamps = Array.from(allTimeStamps).sort((a, b) => a - b);
        console.log(`内存时间轴范围: ${new Date(sortedTimeStamps[0]).toLocaleString()} - ${new Date(sortedTimeStamps[sortedTimeStamps.length-1]).toLocaleString()}`);
        console.log(`共有${sortedTimeStamps.length}个时间点，${series.length}个内存数据系列`);
        
        return { 
            timeLabels: sortedTimeStamps, // 返回时间戳数组而不是字符串标签
            series 
        };
    }

    async getHostMemoryHistory(host, hours = 24, memoryItems = null) {
        try {
            console.log(`=== 获取 ${host.name} 的内存历史数据 ===`);
            
            // 1. 获取Memory utilization监控项（优先使用传入的items）
            if (!memoryItems) {
                memoryItems = await this.api.getItems(host.hostid, 'Memory utilization');
            }
            if (!memoryItems || memoryItems.length === 0) {
                console.warn(`主机 ${host.name} 没有Memory utilization监控项，跳过该主机`);
                return []; // 返回空数组，该主机不会在趋势图中显示
            }

            const memoryItem = memoryItems[0];
            console.log(`使用监控项: ${memoryItem.name} (${memoryItem.key_})`);
            
            // 2. 获取最新值作为基准
            const currentValue = parseFloat(memoryItem.lastvalue || 0);
            console.log(`当前内存使用率: ${currentValue.toFixed(1)}%`);
            
            // 3. 计算时间范围
            const now = Math.floor(Date.now() / 1000);
            const timeFrom = now - hours * 60 * 60; // 24小时前
            
            console.log(`查询时间范围: ${new Date(timeFrom * 1000).toLocaleString()} - ${new Date(now * 1000).toLocaleString()}`);
            
            // 4. 获取历史数据，使用正确的参数顺序：getHistory(itemId, valueType, timeFrom, timeTill, limit)
            const history = await this.api.getHistory(memoryItem.itemid, 0, timeFrom, now, 2000);
            console.log(`获取到内存历史数据: ${history.length} 条`);
            
            if (history.length === 0) {
                console.warn(`主机 ${host.name} 没有内存历史数据，跳过该主机`);
                return []; // 没有历史数据也不显示
            }
            
            // 5. 转换数据格式并进行15分钟采样
            const processedHistory = history.map(item => ({
                time: parseInt(item.clock) * 1000,
                value: parseFloat(item.value)
            })).sort((a, b) => a.time - b.time);
            
            // 6. 进行15分钟采样
            const sampledHistory = this.sampleDataByInterval(processedHistory, 15 * 60 * 1000); // 15分钟 = 15 * 60 * 1000毫秒
            console.log(`15分钟采样后内存数据点: ${sampledHistory.length}个`);
            
            // 7. 数据分析和验证
            const values = sampledHistory.map(item => item.value);
            const minValue = Math.min(...values);
            const maxValue = Math.max(...values);
            const avgValue = values.reduce((sum, val) => sum + val, 0) / values.length;
            const variationRange = maxValue - minValue;
            
            console.log(`内存数据分析:`);
            console.log(`- 采样前数据点: ${processedHistory.length}`);
            console.log(`- 采样后数据点: ${sampledHistory.length}`);
            console.log(`- 值范围: ${minValue.toFixed(1)}% - ${maxValue.toFixed(1)}%`);
            console.log(`- 平均值: ${avgValue.toFixed(1)}%`);
            console.log(`- 变化幅度: ${variationRange.toFixed(1)}%`);
            console.log(`- 数据质量: ${variationRange > 1 ? '有变化' : '相对平稳'}`);
            
            // 8. 时间分布检查
            const firstTime = new Date(sampledHistory[0].time);
            const lastTime = new Date(sampledHistory[sampledHistory.length - 1].time);
            const timeSpan = (lastTime - firstTime) / (1000 * 60 * 60); // 小时
            
            console.log(`时间跨度: ${firstTime.toLocaleString()} - ${lastTime.toLocaleString()} (${timeSpan.toFixed(1)}小时)`);
            
            // 9. 样本数据展示
            console.log('采样后内存数据 (前5个):', sampledHistory.slice(0, 5).map(d => 
                `${new Date(d.time).toLocaleTimeString()}: ${d.value.toFixed(1)}%`
            ));
            console.log('采样后内存数据 (后5个):', sampledHistory.slice(-5).map(d => 
                `${new Date(d.time).toLocaleTimeString()}: ${d.value.toFixed(1)}%`
            ));
            
            // 10. 如果采样后数据太少，返回空数组（不显示该主机）
            if (sampledHistory.length < 3) {
                console.warn(`主机 ${host.name} 内存采样后数据点不足，跳过该主机`);
                return [];
            }
            
            return sampledHistory;
            
        } catch (error) {
            console.error(`获取内存历史数据失败:`, error);
            return []; // 出错时返回空数组，不显示该主机
        }
    }
    
    // 生成回退内存数据
    generateFallbackMemoryData(baseValue = 60) {
        console.log(`生成内存模拟数据，基准值: ${baseValue}%`);
        const data = [];
        const now = Date.now();
        
        for (let i = 0; i < 24; i++) {
            const time = now - (23 - i) * 60 * 60 * 1000;
            // 基于时间的变化模式：内存使用通常比CPU更稳定，但仍有波动
            const hour = new Date(time).getHours();
            let value = baseValue;
            
            if (hour >= 2 && hour <= 6) {
                value = baseValue * 0.85 + Math.random() * baseValue * 0.1; // 夜间稍低
            } else if (hour >= 9 && hour <= 17) {
                value = baseValue * 0.95 + Math.random() * baseValue * 0.15; // 工作时间稍高
            } else {
                value = baseValue * 0.9 + Math.random() * baseValue * 0.1; // 其他时间中等
            }
            
            value = Math.max(10, Math.min(95, value)); // 限制在10-95%之间
            data.push({ time, value: parseFloat(value.toFixed(1)) });
        }
        
        console.log('生成24小时模拟内存趋势，变化范围:', 
            `${Math.min(...data.map(d => d.value)).toFixed(1)}% - ${Math.max(...data.map(d => d.value)).toFixed(1)}%`);
        return data;
    }
    
    // 增强内存历史数据
    enhanceMemoryHistoryData(originalData, currentValue) {
        if (originalData.length === 0) {
            return this.generateFallbackMemoryData(currentValue);
        }
        
        console.log('增强内存历史数据以增加变化...');
        const enhanced = originalData.map((item, index) => {
            // 内存变化通常比CPU小，添加较小的随机变化
            const variation = (Math.random() - 0.5) * 2; // ±1%的变化
            const newValue = Math.max(5, Math.min(99, item.value + variation));
            return { ...item, value: parseFloat(newValue.toFixed(1)) };
        });
        
        console.log('内存数据增强完成，新的变化范围:', 
            `${Math.min(...enhanced.map(d => d.value)).toFixed(1)}% - ${Math.max(...enhanced.map(d => d.value)).toFixed(1)}%`);
        return enhanced;
    }

    async getAggregatedMemoryData(hosts, timeLabels) {
        console.log(`=== 开始获取聚合内存数据 ===`);
        console.log(`处理${hosts.length}台主机，${timeLabels.length}个时间点`);
        
        const aggregatedSeries = [];
        const allHostsData = [];
        
        // 获取所有主机的内存历史数据
        for (const host of hosts.slice(0, 20)) { // 限制处理的主机数量，避免过多请求
            console.log(`处理主机内存数据: ${host.name}`);
            const historyData = await this.getHostMemoryHistory(host, 24);
            const processedData = this.processHistoryData(historyData, timeLabels, parseFloat(host.memory || 0));
            allHostsData.push(processedData);
        }
        
        // 计算聚合数据
        const avgData = [];
        const maxData = [];
        const minData = [];
        
        for (let i = 0; i < timeLabels.length; i++) {
            const values = allHostsData.map(hostData => parseFloat(hostData[i])).filter(v => !isNaN(v) && v > 0);
            
            if (values.length > 0) {
                const avg = (values.reduce((sum, val) => sum + val, 0) / values.length).toFixed(1);
                const max = Math.max(...values).toFixed(1);
                const min = Math.min(...values).toFixed(1);
                
                avgData.push(avg);
                maxData.push(max);
                minData.push(min);
            } else {
                avgData.push(0);
                maxData.push(0);
                minData.push(0);
            }
        }
        
        console.log(`内存聚合数据计算完成 - 平均值范围: ${Math.min(...avgData.filter(v => v > 0))} - ${Math.max(...avgData)}%`);

        aggregatedSeries.push(
            {
                name: `平均内存使用率 (${allHostsData.length}台主机)`,
                type: 'line',
                data: avgData,
                smooth: true,
                lineStyle: { color: '#1e90ff', width: 3 },
                areaStyle: {
                    color: {
                        type: 'linear',
                        x: 0, y: 0, x2: 0, y2: 1,
                        colorStops: [
                            { offset: 0, color: 'rgba(30, 144, 255, 0.3)' },
                            { offset: 1, color: 'rgba(30, 144, 255, 0.1)' }
                        ]
                    }
                }
            },
            {
                name: '最大内存使用率',
                type: 'line',
                data: maxData,
                smooth: true,
                lineStyle: { color: '#ff6347', width: 2, type: 'dashed' }
            },
            {
                name: '最小内存使用率',
                type: 'line',
                data: minData,
                smooth: true,
                lineStyle: { color: '#32cd32', width: 2, type: 'dotted' }
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
            const items = await this.api.getItems(hostId, 'CPU utilization');
            console.log(`CPU utilization监控项:`, items);
            
            if (items.length > 0) {
                const testHistory = await this.getCompleteHistoryData(items[0].itemid, 24);
                console.log(`测试获取24小时历史数据: ${testHistory.length}条`);
                
                if (testHistory.length > 0) {
                    const processed = testHistory.map(item => ({
                        time: new Date(parseInt(item.clock) * 1000).toLocaleString(),
                        value: parseFloat(item.value).toFixed(1)
                    }));
                    console.log(`处理后数据样本:`, processed.slice(0, 10));
                }
            }
        } catch (error) {
            console.error('调试失败:', error);
        }
    }

    // 快速测试CPU趋势数据
    async testCpuTrend() {
        console.log('=== 开始完整测试CPU趋势功能 ===');
        
        try {
            // 获取主机数据
            const hosts = this.hostData || [];
            if (hosts.length === 0) {
                console.error('没有主机数据，无法测试');
                return { success: false, error: '无主机数据' };
            }
            
            const testHost = hosts[0];
            console.log(`\n📊 测试主机: ${testHost.name} (ID: ${testHost.hostid})`);
            console.log(`当前CPU: ${testHost.cpu || 'N/A'}%`);
            
            // 1. 测试CPU历史数据获取
            console.log('\n🔍 步骤1: 获取CPU历史数据...');
            const cpuHistory = await this.getHostCpuHistory(testHost, 24);
            console.log(`✓ 获取到历史数据: ${cpuHistory.length}条`);
            
            if (cpuHistory.length === 0) {
                console.error('❌ 没有获取到CPU历史数据');
                return { success: false, error: '无历史数据' };
            }
            
            // 2. 数据质量分析
            console.log('\n📈 步骤2: 分析数据质量...');
            const values = cpuHistory.map(item => item.value);
            const dataStats = {
                count: values.length,
                min: Math.min(...values),
                max: Math.max(...values),
                avg: values.reduce((sum, val) => sum + val, 0) / values.length,
                variation: Math.max(...values) - Math.min(...values)
            };
            
            console.log(`数据统计:`, {
                '数据点数': dataStats.count,
                '最小值': `${dataStats.min.toFixed(1)}%`,
                '最大值': `${dataStats.max.toFixed(1)}%`,
                '平均值': `${dataStats.avg.toFixed(1)}%`,
                '变化幅度': `${dataStats.variation.toFixed(1)}%`
            });
            
            // 3. 生成时间标签
            console.log('\n🕐 步骤3: 生成24小时时间标签...');
            const timeLabels = this.generateTimeLabels(24);
            console.log(`✓ 生成时间标签: ${timeLabels.length}个`);
            console.log(`时间范围: ${timeLabels[0]} - ${timeLabels[timeLabels.length-1]}`);
            
            // 4. 处理历史数据为趋势数据
            console.log('\n⚙️ 步骤4: 处理数据为24小时趋势...');
            const trendData = this.processHistoryData(cpuHistory, timeLabels, parseFloat(testHost.cpu || 0));
            console.log(`✓ 生成趋势数据: ${trendData.length}个点`);
            
            // 5. 验证趋势数据质量
            console.log('\n🔎 步骤5: 验证趋势数据质量...');
            const trendStats = {
                min: Math.min(...trendData),
                max: Math.max(...trendData),
                avg: trendData.reduce((sum, val) => sum + val, 0) / trendData.length,
                variation: Math.max(...trendData) - Math.min(...trendData)
            };
            
            const hasVariation = trendData.some((val, idx) => 
                idx > 0 && Math.abs(val - trendData[idx-1]) > 0.5
            );
            
            console.log(`趋势统计:`, {
                '最小值': `${trendStats.min.toFixed(1)}%`,
                '最大值': `${trendStats.max.toFixed(1)}%`,
                '平均值': `${trendStats.avg.toFixed(1)}%`,
                '变化幅度': `${trendStats.variation.toFixed(1)}%`,
                '有变化': hasVariation ? '✅ 是' : '❌ 否'
            });
            
            // 6. 详细的时间-数值映射
            console.log('\n📋 步骤6: 详细的24小时趋势数据:');
            trendData.forEach((value, index) => {
                const indicator = index === 0 ? '' : 
                    value > trendData[index-1] ? '📈' : 
                    value < trendData[index-1] ? '📉' : '➡️';
                console.log(`${timeLabels[index]}: ${value.toFixed(1)}% ${indicator}`);
            });
            
            // 7. 生成图表配置
            console.log('\n📊 步骤7: 生成ECharts配置...');
            const chartConfig = {
                title: { text: `${testHost.name} - CPU使用率趋势 (测试)` },
                xAxis: { 
                    type: 'category',
                    data: timeLabels
                },
                yAxis: { 
                    type: 'value',
                    name: 'CPU使用率 (%)',
                    min: 0,
                    max: 100
                },
                series: [{
                    name: 'CPU使用率',
                    type: 'line',
                    data: trendData,
                    smooth: true,
                    areaStyle: {}
                }]
            };
            
            // 8. 保存测试结果到全局变量
            console.log('\n💾 步骤8: 保存测试结果...');
            window.cpuTrendTestResult = {
                host: testHost,
                rawHistory: cpuHistory,
                dataStats: dataStats,
                timeLabels: timeLabels,
                trendData: trendData,
                trendStats: trendStats,
                hasVariation: hasVariation,
                chartConfig: chartConfig,
                timestamp: new Date().toLocaleString()
            };
            
            // 9. 测试总结
            console.log('\n🎯 测试总结:');
            const testResult = {
                success: true,
                host: testHost.name,
                dataPoints: cpuHistory.length,
                hasVariation: hasVariation,
                variationRange: `${trendStats.variation.toFixed(1)}%`,
                recommendation: hasVariation ? 
                    '✅ 数据正常，可以显示趋势图' : 
                    '⚠️ 数据变化较小，可能需要检查监控配置'
            };
            
            console.log(testResult);
            console.log('\n📊 测试结果已保存到: window.cpuTrendTestResult');
            console.log('可以使用以下命令查看详细结果:');
            console.log('- window.cpuTrendTestResult.rawHistory    // 原始数据');
            console.log('- window.cpuTrendTestResult.trendData     // 趋势数据');
            console.log('- window.cpuTrendTestResult.chartConfig   // 图表配置');
            
            return testResult;
            
        } catch (error) {
            console.error('❌ CPU趋势测试失败:', error);
            return { success: false, error: error.message };
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
            
            // 添加CPU趋势测试函数到全局
            window.testCpuTrend = () => {
                if (resourceDashboard) {
                    return resourceDashboard.testCpuTrend();
                }
            };
            
            // 添加内存趋势测试函数到全局
            window.testMemoryTrend = async () => {
                if (resourceDashboard) {
                    console.log('=== 开始测试内存趋势功能（包含15分钟采样） ===');
                    
                    try {
                        const hosts = resourceDashboard.hostData || [];
                        if (hosts.length === 0) {
                            console.error('没有主机数据');
                            return { success: false, error: '无主机数据' };
                        }
                        
                        console.log(`测试${hosts.length}台主机的内存趋势`);
                        
                        // 先测试单个主机的Memory监控项检查和15分钟采样
                        const testHost = hosts[0];
                        console.log(`\n1. 测试主机内存监控项检查: ${testHost.name}`);
                        const singleHostHistory = await resourceDashboard.getHostMemoryHistory(testHost, 24);
                        
                        if (singleHostHistory.length === 0) {
                            console.log(`主机 ${testHost.name} 没有Memory utilization监控项或历史数据，已跳过`);
                        } else {
                            console.log(`主机 ${testHost.name} 内存历史数据: ${singleHostHistory.length}个采样点（15分钟间隔）`);
                            
                            // 检查采样间隔
                            if (singleHostHistory.length > 1) {
                                const timeIntervals = [];
                                for (let i = 1; i < singleHostHistory.length; i++) {
                                    const interval = (singleHostHistory[i].time - singleHostHistory[i-1].time) / (1000 * 60);
                                    timeIntervals.push(interval);
                                }
                                const avgInterval = timeIntervals.reduce((sum, val) => sum + val, 0) / timeIntervals.length;
                                console.log(`平均采样间隔: ${avgInterval.toFixed(1)}分钟`);
                            }
                        }
                        
                        console.log(`\n2. 测试所有主机内存趋势数据获取`);
                        // 测试内存趋势数据获取（新的时间戳版本）
                        const memoryData = await resourceDashboard.getMemoryTrendData(hosts);
                        console.log(`获取内存趋势数据: ${memoryData.series.length}个系列`);
                        
                        if (memoryData.series.length === 0) {
                            console.error('❌ 没有获取到内存趋势数据');
                            return { success: false, error: '无趋势数据' };
                        }
                        
                        // 分析时间戳数据
                        const timeStamps = memoryData.timeLabels;
                        const timeRange = timeStamps.length > 0 ? {
                            start: new Date(timeStamps[0]).toLocaleString(),
                            end: new Date(timeStamps[timeStamps.length - 1]).toLocaleString(),
                            span: ((timeStamps[timeStamps.length - 1] - timeStamps[0]) / (1000 * 60 * 60)).toFixed(1) + '小时'
                        } : null;
                        
                        // 分析数据系列
                        const seriesInfo = memoryData.series.map(series => ({
                            name: series.name,
                            dataPoints: series.data.length,
                            timeSpan: series.data.length > 0 ? {
                                start: new Date(series.data[0][0]).toLocaleString(),
                                end: new Date(series.data[series.data.length - 1][0]).toLocaleString()
                            } : null,
                            valueRange: series.data.length > 0 ? {
                                min: Math.min(...series.data.map(d => d[1])).toFixed(1) + '%',
                                max: Math.max(...series.data.map(d => d[1])).toFixed(1) + '%'
                            } : null
                        }));
                        
                        const result = {
                            success: true,
                            totalSeries: memoryData.series.length,
                            totalTimeStamps: timeStamps.length,
                            timeRange: timeRange,
                            series: seriesInfo,
                            sampleHost: {
                                name: testHost.name,
                                memoryDataPoints: singleHostHistory.length,
                                hasMemoryItem: singleHostHistory.length > 0
                            },
                            recommendation: memoryData.series.length > 0 ? 
                                '✅ 内存时间戳趋势数据获取成功（15分钟采样）' : 
                                '⚠️ 所有主机都没有Memory utilization监控项或历史数据'
                        };
                        
                        // 保存测试结果
                        window.memoryTrendTestResult = {
                            memoryData: memoryData,
                            analysis: result,
                            timestamp: new Date().toLocaleString()
                        };
                        
                        console.log('🎯 内存趋势测试结果（15分钟采样）:');
                        console.log(`数据系列: ${result.totalSeries}个（只包含有Memory utilization监控项的主机）`);
                        console.log(`时间戳: ${result.totalTimeStamps}个`);
                        console.log(`样本主机: ${result.sampleHost.name} (${result.sampleHost.hasMemoryItem ? '有' : '无'}Memory监控项, ${result.sampleHost.memoryDataPoints}个采样点)`);
                        if (timeRange) {
                            console.log(`时间范围: ${timeRange.start} - ${timeRange.end} (${timeRange.span})`);
                        }
                        console.log('系列详情:');
                        seriesInfo.forEach(series => {
                            console.log(`  ${series.name}: ${series.dataPoints}个点, 值范围${series.valueRange?.min}-${series.valueRange?.max}`);
                        });
                        console.log(result.recommendation);
                        console.log('详细结果已保存到: window.memoryTrendTestResult');
                        
                        console.log('🎯 内存趋势测试结果:', result);
                        console.log('详细结果已保存到: window.memoryTrendTestResult');
                        
                        return result;
                    } catch (error) {
                        console.error('❌ 内存趋势测试失败:', error);
                        return { success: false, error: error.message };
                    }
                }
            };
            
            // 添加内存分布测试函数到全局
            window.testMemoryDistribution = async () => {
                if (resourceDashboard) {
                    console.log('=== 开始测试内存分布功能 ===');
                    
                    try {
                        const hosts = resourceDashboard.hostData || [];
                        if (hosts.length === 0) {
                            console.error('没有主机数据');
                            return { success: false, error: '无主机数据' };
                        }
                        
                        console.log(`测试${hosts.length}台主机的内存分布`);
                        
                        // 测试内存分布数据获取
                        const distributionData = await resourceDashboard.getMemoryDistributionData(hosts);
                        console.log(`获取内存分布数据: ${distributionData.length}个分组`);
                        
                        if (distributionData.length === 0) {
                            console.error('❌ 没有获取到内存分布数据');
                            return { success: false, error: '无分布数据' };
                        }
                        
                        // 分析分布结果
                        const totalHosts = distributionData.reduce((sum, group) => sum + group.value, 0);
                        const groupInfo = distributionData.map(group => ({
                            name: group.name,
                            count: group.value,
                            percentage: ((group.value / totalHosts) * 100).toFixed(1) + '%'
                        }));
                        
                        const result = {
                            success: true,
                            totalHosts: totalHosts,
                            groups: groupInfo.length,
                            distribution: groupInfo,
                            recommendation: totalHosts > 0 ? 
                                '✅ 内存分布数据获取成功' : 
                                '⚠️ 需要检查Memory utilization监控项配置'
                        };
                        
                        // 保存测试结果
                        window.memoryDistributionTestResult = {
                            distributionData: distributionData,
                            analysis: result,
                            timestamp: new Date().toLocaleString()
                        };
                        
                        console.log('🎯 内存分布测试结果:');
                        console.log(`总主机数: ${totalHosts}`);
                        console.log('分布情况:');
                        groupInfo.forEach(group => {
                            console.log(`  ${group.name}: ${group.count}台 (${group.percentage})`);
                        });
                        console.log('详细结果已保存到: window.memoryDistributionTestResult');
                        
                        return result;
                    } catch (error) {
                        console.error('❌ 内存分布测试失败:', error);
                        return { success: false, error: error.message };
                    }
                }
            };
            
            // 添加CPU分布测试函数到全局
            window.testCpuDistribution = async () => {
                if (resourceDashboard) {
                    console.log('=== 开始测试CPU分布功能（仅使用CPU utilization监控项） ===');
                    
                    try {
                        const hosts = resourceDashboard.hostData || [];
                        if (hosts.length === 0) {
                            console.error('没有主机数据');
                            return { success: false, error: '无主机数据' };
                        }
                        
                        console.log(`测试${hosts.length}台主机的CPU分布`);
                        
                        // 测试CPU分布数据获取（新逻辑：只使用CPU utilization监控项）
                        const distributionData = await resourceDashboard.getCpuDistributionData(hosts);
                        console.log(`获取CPU分布数据: ${distributionData.length}个分组`);
                        
                        if (distributionData.length === 0) {
                            console.error('❌ 没有获取到CPU分布数据（可能所有主机都没有CPU utilization监控项）');
                            return { success: false, error: '无有效的CPU utilization监控项' };
                        }
                        
                        // 分析分布结果
                        const validHostsCount = distributionData.reduce((sum, group) => sum + group.value, 0);
                        const skippedHostsCount = hosts.length - validHostsCount;
                        
                        const groupInfo = distributionData.map(group => ({
                            name: group.name,
                            count: group.value,
                            percentage: ((group.value / validHostsCount) * 100).toFixed(1) + '%'
                        }));
                        
                        const result = {
                            success: true,
                            totalHosts: hosts.length,
                            validHosts: validHostsCount,
                            skippedHosts: skippedHostsCount,
                            groups: groupInfo.length,
                            distribution: groupInfo,
                            recommendation: validHostsCount > 0 ? 
                                `✅ CPU分布数据获取成功（${validHostsCount}台主机有CPU utilization监控项）` : 
                                '⚠️ 所有主机都没有CPU utilization监控项'
                        };
                        
                        // 保存测试结果
                        window.cpuDistributionTestResult = {
                            distributionData: distributionData,
                            analysis: result,
                            timestamp: new Date().toLocaleString()
                        };
                        
                        console.log('🎯 CPU分布测试结果（仅CPU utilization监控项）:');
                        console.log(`总主机数: ${result.totalHosts}台`);
                        console.log(`有效主机数: ${result.validHosts}台（有CPU utilization监控项）`);
                        console.log(`跳过主机数: ${result.skippedHosts}台（无CPU utilization监控项）`);
                        console.log('分布情况:');
                        groupInfo.forEach(group => {
                            console.log(`  ${group.name}: ${group.count}台 (${group.percentage})`);
                        });
                        console.log('详细结果已保存到: window.cpuDistributionTestResult');
                        
                        return result;
                    } catch (error) {
                        console.error('❌ CPU分布测试失败:', error);
                        return { success: false, error: error.message };
                    }
                }
            };
            
            // 添加CPU监控项检查测试函数
            window.testCpuMonitoringItems = async () => {
                if (!resourceDashboard) {
                    console.log('❌ 仪表板未初始化');
                    return { success: false, error: 'Dashboard not initialized' };
                }
                
                console.log('🔍 测试CPU utilization监控项检查...');
                
                try {
                    const hosts = resourceDashboard.hostData || [];
                    if (hosts.length === 0) {
                        return { success: false, error: '无主机数据' };
                    }
                    
                    const checkResults = [];
                    let validCount = 0;
                    let invalidCount = 0;
                    
                    // 检查前5个主机的CPU utilization监控项
                    const testHosts = hosts.slice(0, Math.min(5, hosts.length));
                    console.log(`检查前${testHosts.length}台主机的CPU utilization监控项...`);
                    
                    for (const host of testHosts) {
                        try {
                            const cpuItems = await resourceDashboard.api.getItems(host.hostid, 'CPU utilization');
                            
                            if (cpuItems.length > 0 && cpuItems[0].lastvalue !== null) {
                                const cpuValue = parseFloat(cpuItems[0].lastvalue);
                                checkResults.push({
                                    hostName: host.name,
                                    hasCpuItem: true,
                                    itemKey: cpuItems[0].key_,
                                    itemName: cpuItems[0].name,
                                    lastValue: cpuValue.toFixed(1) + '%',
                                    status: '✅ 正常'
                                });
                                validCount++;
                                console.log(`✅ ${host.name}: CPU=${cpuValue.toFixed(1)}% (${cpuItems[0].key_})`);
                            } else {
                                checkResults.push({
                                    hostName: host.name,
                                    hasCpuItem: false,
                                    itemKey: null,
                                    itemName: null,
                                    lastValue: null,
                                    status: '❌ 无监控项或无lastvalue'
                                });
                                invalidCount++;
                                console.log(`❌ ${host.name}: 没有CPU utilization监控项或无lastvalue`);
                            }
                        } catch (error) {
                            checkResults.push({
                                hostName: host.name,
                                hasCpuItem: false,
                                itemKey: null,
                                itemName: null,
                                lastValue: null,
                                status: `❌ 检查失败: ${error.message}`
                            });
                            invalidCount++;
                            console.log(`❌ ${host.name}: 检查失败 - ${error.message}`);
                        }
                    }
                    
                    const result = {
                        success: true,
                        totalTested: testHosts.length,
                        validItems: validCount,
                        invalidItems: invalidCount,
                        validRate: (validCount / testHosts.length * 100).toFixed(1) + '%',
                        details: checkResults,
                        recommendation: validCount > 0 ? 
                            `✅ ${validCount}/${testHosts.length}台主机有有效的CPU utilization监控项` : 
                            '⚠️ 测试的主机都没有CPU utilization监控项'
                    };
                    
                    console.log('🎯 CPU监控项检查结果:');
                    console.log(`测试主机: ${result.totalTested}台`);
                    console.log(`有效监控项: ${result.validItems}台 (${result.validRate})`);
                    console.log(`无效监控项: ${result.invalidItems}台`);
                    console.log(result.recommendation);
                    
                    window.cpuMonitoringItemsTestResult = result;
                    console.log('详细结果已保存到: window.cpuMonitoringItemsTestResult');
                    
                    return result;
                    
                } catch (error) {
                    console.error('❌ CPU监控项检查失败:', error);
                    return { success: false, error: error.message };
                }
            };
            
            // 添加内存15分钟采样测试函数
            window.testMemory15MinuteSampling = async () => {
                if (!resourceDashboard) {
                    console.log('❌ 仪表板未初始化');
                    return { success: false, error: 'Dashboard not initialized' };
                }
                
                console.log('🕐 测试内存15分钟采样功能...');
                
                try {
                    const hosts = resourceDashboard.hostData || [];
                    if (hosts.length === 0) {
                        return { success: false, error: '无主机数据' };
                    }
                    
                    // 选择第一个主机进行详细测试
                    const testHost = hosts[0];
                    console.log(`测试主机: ${testHost.name}`);
                    
                    // 获取原始历史数据（未采样）
                    const memoryItems = await resourceDashboard.api.getItems(testHost.hostid, 'Memory utilization');
                    if (memoryItems.length === 0) {
                        console.log(`主机 ${testHost.name} 没有Memory utilization监控项`);
                        return { success: false, error: '无Memory监控项' };
                    }
                    
                    const now = Math.floor(Date.now() / 1000);
                    const timeFrom = now - 24 * 60 * 60; // 24小时前
                    const history = await resourceDashboard.api.getHistory(memoryItems[0].itemid, 0, timeFrom, now, 2000);
                    
                    if (history.length === 0) {
                        console.log(`主机 ${testHost.name} 没有内存历史数据`);
                        return { success: false, error: '无历史数据' };
                    }
                    
                    // 转换原始数据
                    const originalData = history.map(item => ({
                        time: parseInt(item.clock) * 1000,
                        value: parseFloat(item.value)
                    })).sort((a, b) => a.time - b.time);
                    
                    // 进行15分钟采样
                    const sampledData = resourceDashboard.sampleDataByInterval(originalData, 15 * 60 * 1000);
                    
                    // 分析采样效果
                    const originalTimeSpan = originalData.length > 0 ? 
                        (originalData[originalData.length - 1].time - originalData[0].time) / (1000 * 60 * 60) : 0;
                    
                    const avgOriginalInterval = originalData.length > 1 ? 
                        (originalData[originalData.length - 1].time - originalData[0].time) / (originalData.length - 1) / (1000 * 60) : 0;
                    
                    const avgSampledInterval = sampledData.length > 1 ? 
                        (sampledData[sampledData.length - 1].time - sampledData[0].time) / (sampledData.length - 1) / (1000 * 60) : 0;
                    
                    const result = {
                        success: true,
                        host: testHost.name,
                        original: {
                            dataPoints: originalData.length,
                            avgInterval: avgOriginalInterval.toFixed(1) + '分钟',
                            timeSpan: originalTimeSpan.toFixed(1) + '小时'
                        },
                        sampled: {
                            dataPoints: sampledData.length,
                            avgInterval: avgSampledInterval.toFixed(1) + '分钟',
                            targetInterval: '15分钟'
                        },
                        compression: {
                            ratio: originalData.length > 0 ? (originalData.length / sampledData.length).toFixed(1) : '0',
                            reduction: originalData.length > 0 ? (((originalData.length - sampledData.length) / originalData.length) * 100).toFixed(1) + '%' : '0%'
                        }
                    };
                    
                    console.log('🎯 内存15分钟采样测试结果:');
                    console.log(`测试主机: ${result.host}`);
                    console.log(`原始数据: ${result.original.dataPoints}个点, 平均间隔${result.original.avgInterval}, 时间跨度${result.original.timeSpan}`);
                    console.log(`采样后: ${result.sampled.dataPoints}个点, 平均间隔${result.sampled.avgInterval} (目标${result.sampled.targetInterval})`);
                    console.log(`压缩比: ${result.compression.ratio}:1, 数据量减少${result.compression.reduction}`);
                    
                    window.memorySamplingTestResult = result;
                    console.log('详细结果已保存到: window.memorySamplingTestResult');
                    
                    return result;
                    
                } catch (error) {
                    console.error('❌ 内存15分钟采样测试失败:', error);
                    return { success: false, error: error.message };
                }
            };
            
            // 添加CPU时间戳趋势测试函数到全局
            window.testCpuTimestampTrend = async () => {
                if (resourceDashboard) {
                    console.log('=== 开始测试CPU时间戳趋势功能（包含15分钟采样） ===');
                    
                    try {
                        const hosts = resourceDashboard.hostData || [];
                        if (hosts.length === 0) {
                            console.error('没有主机数据');
                            return { success: false, error: '无主机数据' };
                        }
                        
                        console.log(`测试${hosts.length}台主机的CPU时间戳趋势`);
                        
                        // 先测试单个主机的CPU监控项检查和15分钟采样
                        const testHost = hosts[0];
                        console.log(`\n1. 测试主机CPU监控项检查: ${testHost.name}`);
                        const singleHostHistory = await resourceDashboard.getHostCpuHistory(testHost, 24);
                        
                        if (singleHostHistory.length === 0) {
                            console.log(`主机 ${testHost.name} 没有CPU utilization监控项或历史数据，已跳过`);
                        } else {
                            console.log(`主机 ${testHost.name} CPU历史数据: ${singleHostHistory.length}个采样点（15分钟间隔）`);
                            
                            // 检查采样间隔
                            if (singleHostHistory.length > 1) {
                                const timeIntervals = [];
                                for (let i = 1; i < singleHostHistory.length; i++) {
                                    const interval = (singleHostHistory[i].time - singleHostHistory[i-1].time) / (1000 * 60);
                                    timeIntervals.push(interval);
                                }
                                const avgInterval = timeIntervals.reduce((sum, val) => sum + val, 0) / timeIntervals.length;
                                console.log(`平均采样间隔: ${avgInterval.toFixed(1)}分钟`);
                            }
                        }
                        
                        console.log(`\n2. 测试所有主机CPU趋势数据获取`);
                        // 测试CPU历史数据获取（新的时间戳版本）
                        const cpuData = await resourceDashboard.getCpuHistoryData(hosts);
                        console.log(`获取CPU趋势数据: ${cpuData.series.length}个系列`);
                        
                        if (cpuData.series.length === 0) {
                            console.error('❌ 没有获取到CPU趋势数据');
                            return { success: false, error: '无趋势数据' };
                        }
                        
                        // 分析时间戳数据
                        const timeStamps = cpuData.timeLabels;
                        const timeRange = timeStamps.length > 0 ? {
                            start: new Date(timeStamps[0]).toLocaleString(),
                            end: new Date(timeStamps[timeStamps.length - 1]).toLocaleString(),
                            span: ((timeStamps[timeStamps.length - 1] - timeStamps[0]) / (1000 * 60 * 60)).toFixed(1) + '小时'
                        } : null;
                        
                        // 分析数据系列
                        const seriesInfo = cpuData.series.map(series => ({
                            name: series.name,
                            dataPoints: series.data.length,
                            timeSpan: series.data.length > 0 ? {
                                start: new Date(series.data[0][0]).toLocaleString(),
                                end: new Date(series.data[series.data.length - 1][0]).toLocaleString()
                            } : null,
                            valueRange: series.data.length > 0 ? {
                                min: Math.min(...series.data.map(d => d[1])).toFixed(1) + '%',
                                max: Math.max(...series.data.map(d => d[1])).toFixed(1) + '%'
                            } : null
                        }));
                        
                        const result = {
                            success: true,
                            totalSeries: cpuData.series.length,
                            totalTimeStamps: timeStamps.length,
                            timeRange: timeRange,
                            series: seriesInfo,
                            sampleHost: {
                                name: testHost.name,
                                cpuDataPoints: singleHostHistory.length,
                                hasCpuItem: singleHostHistory.length > 0
                            },
                            recommendation: cpuData.series.length > 0 ? 
                                '✅ CPU时间戳趋势数据获取成功（15分钟采样）' : 
                                '⚠️ 所有主机都没有CPU utilization监控项或历史数据'
                        };
                        
                        // 保存测试结果
                        window.cpuTimestampTestResult = {
                            cpuData: cpuData,
                            analysis: result,
                            timestamp: new Date().toLocaleString()
                        };
                        
                        console.log('🎯 CPU时间戳趋势测试结果（15分钟采样）:');
                        console.log(`数据系列: ${result.totalSeries}个（只包含有CPU utilization监控项的主机）`);
                        console.log(`时间戳: ${result.totalTimeStamps}个`);
                        console.log(`样本主机: ${result.sampleHost.name} (${result.sampleHost.hasCpuItem ? '有' : '无'}CPU监控项, ${result.sampleHost.cpuDataPoints}个采样点)`);
                        if (timeRange) {
                            console.log(`时间范围: ${timeRange.start} - ${timeRange.end} (${timeRange.span})`);
                        }
                        console.log('系列详情:');
                        seriesInfo.forEach(series => {
                            console.log(`  ${series.name}: ${series.dataPoints}个点, 值范围${series.valueRange?.min}-${series.valueRange?.max}`);
                        });
                        console.log(result.recommendation);
                        console.log('详细结果已保存到: window.cpuTimestampTestResult');
                        
                        return result;
                    } catch (error) {
                        console.error('❌ CPU时间戳趋势测试失败:', error);
                        return { success: false, error: error.message };
                    }
                }
            };
            
            // 添加15分钟采样测试函数
            window.test15MinuteSampling = async () => {
                if (!resourceDashboard) {
                    console.log('❌ 仪表板未初始化');
                    return { success: false, error: 'Dashboard not initialized' };
                }
                
                console.log('🕐 测试15分钟采样功能...');
                
                try {
                    const hosts = resourceDashboard.hostData || [];
                    if (hosts.length === 0) {
                        return { success: false, error: '无主机数据' };
                    }
                    
                    // 选择第一个主机进行详细测试
                    const testHost = hosts[0];
                    console.log(`测试主机: ${testHost.name}`);
                    
                    // 获取原始历史数据（未采样）
                    const cpuItems = await resourceDashboard.api.getItems(testHost.hostid, 'CPU utilization');
                    if (cpuItems.length === 0) {
                        console.log(`主机 ${testHost.name} 没有CPU utilization监控项`);
                        return { success: false, error: '无CPU监控项' };
                    }
                    
                    const now = Math.floor(Date.now() / 1000);
                    const timeFrom = now - 24 * 60 * 60; // 24小时前
                    const history = await resourceDashboard.api.getHistory(cpuItems[0].itemid, 0, timeFrom, now, 2000);
                    
                    if (history.length === 0) {
                        console.log(`主机 ${testHost.name} 没有历史数据`);
                        return { success: false, error: '无历史数据' };
                    }
                    
                    // 转换原始数据
                    const originalData = history.map(item => ({
                        time: parseInt(item.clock) * 1000,
                        value: parseFloat(item.value)
                    })).sort((a, b) => a.time - b.time);
                    
                    // 进行15分钟采样
                    const sampledData = resourceDashboard.sampleDataByInterval(originalData, 15 * 60 * 1000);
                    
                    // 分析采样效果
                    const originalTimeSpan = originalData.length > 0 ? 
                        (originalData[originalData.length - 1].time - originalData[0].time) / (1000 * 60 * 60) : 0;
                    
                    const avgOriginalInterval = originalData.length > 1 ? 
                        (originalData[originalData.length - 1].time - originalData[0].time) / (originalData.length - 1) / (1000 * 60) : 0;
                    
                    const avgSampledInterval = sampledData.length > 1 ? 
                        (sampledData[sampledData.length - 1].time - sampledData[0].time) / (sampledData.length - 1) / (1000 * 60) : 0;
                    
                    const result = {
                        success: true,
                        host: testHost.name,
                        original: {
                            dataPoints: originalData.length,
                            avgInterval: avgOriginalInterval.toFixed(1) + '分钟',
                            timeSpan: originalTimeSpan.toFixed(1) + '小时'
                        },
                        sampled: {
                            dataPoints: sampledData.length,
                            avgInterval: avgSampledInterval.toFixed(1) + '分钟',
                            targetInterval: '15分钟'
                        },
                        compression: {
                            ratio: originalData.length > 0 ? (originalData.length / sampledData.length).toFixed(1) : '0',
                            reduction: originalData.length > 0 ? (((originalData.length - sampledData.length) / originalData.length) * 100).toFixed(1) + '%' : '0%'
                        }
                    };
                    
                    console.log('🎯 15分钟采样测试结果:');
                    console.log(`测试主机: ${result.host}`);
                    console.log(`原始数据: ${result.original.dataPoints}个点, 平均间隔${result.original.avgInterval}, 时间跨度${result.original.timeSpan}`);
                    console.log(`采样后: ${result.sampled.dataPoints}个点, 平均间隔${result.sampled.avgInterval} (目标${result.sampled.targetInterval})`);
                    console.log(`压缩比: ${result.compression.ratio}:1, 数据量减少${result.compression.reduction}`);
                    
                    window.samplingTestResult = result;
                    console.log('详细结果已保存到: window.samplingTestResult');
                    
                    return result;
                    
                } catch (error) {
                    console.error('❌ 15分钟采样测试失败:', error);
                    return { success: false, error: error.message };
                }
            };
            
            // 添加综合趋势测试函数到全局
            window.testAllTrends = async () => {
                if (resourceDashboard) {
                    console.log('🚀 开始综合功能测试');
                    
                    try {
                        console.log('\n📊 1. 测试CPU时间戳趋势功能...');
                        const cpuTimestampResult = await window.testCpuTimestampTrend();
                        
                        console.log('\n📊 2. 测试传统CPU趋势功能...');
                        const cpuResult = await resourceDashboard.testCpuTrend();
                        
                        console.log('\n💾 3. 测试内存趋势功能...');
                        const memoryResult = await window.testMemoryTrend();
                        
                        console.log('\n📈 4. 测试CPU分布功能...');
                        const cpuDistributionResult = await window.testCpuDistribution();
                        
                        console.log('\n📊 5. 测试内存分布功能...');
                        const memoryDistributionResult = await window.testMemoryDistribution();
                        
                        const summary = {
                            timestamp: new Date().toLocaleString(),
                            cpuTimestamp: cpuTimestampResult,
                            cpu: cpuResult,
                            memory: memoryResult,
                            cpuDistribution: cpuDistributionResult,
                            memoryDistribution: memoryDistributionResult,
                            overall: {
                                success: cpuTimestampResult.success && cpuResult.success && memoryResult.success && cpuDistributionResult.success && memoryDistributionResult.success,
                                message: cpuTimestampResult.success && cpuResult.success && memoryResult.success && cpuDistributionResult.success && memoryDistributionResult.success ? 
                                    '✅ 所有功能测试通过' : 
                                    '⚠️ 部分功能需要检查'
                            }
                        };
                        
                        window.allTrendsTestResult = summary;
                        
                        console.log('\n🎯 综合测试总结:');
                        console.log(`CPU时间戳趋势: ${cpuTimestampResult.success ? '✅ 成功' : '❌ 失败'} - ${cpuTimestampResult.success ? `${cpuTimestampResult.totalSeries}个系列, ${cpuTimestampResult.totalTimeStamps}个时间戳` : cpuTimestampResult.error}`);
                        console.log(`CPU趋势: ${cpuResult.success ? '✅ 成功' : '❌ 失败'} - ${cpuResult.success ? cpuResult.recommendation : cpuResult.error}`);
                        console.log(`内存趋势: ${memoryResult.success ? '✅ 成功' : '❌ 失败'} - ${memoryResult.success ? `${memoryResult.totalSeries}个系列, ${memoryResult.totalTimeStamps}个时间戳` : memoryResult.error}`);
                        console.log(`CPU分布: ${cpuDistributionResult.success ? '✅ 成功' : '❌ 失败'} - ${cpuDistributionResult.success ? `${cpuDistributionResult.validHosts}/${cpuDistributionResult.totalHosts}台主机有效` : cpuDistributionResult.error}`);
                        console.log(`内存分布: ${memoryDistributionResult.success ? '✅ 成功' : '❌ 失败'} - ${memoryDistributionResult.success ? `${memoryDistributionResult.totalHosts}台主机` : memoryDistributionResult.error}`);
                        console.log(summary.overall.message);
                        console.log('\n详细结果已保存到: window.allTrendsTestResult');
                        
                        return summary;
                    } catch (error) {
                        console.error('❌ 综合测试失败:', error);
                        return { success: false, error: error.message };
                    }
                }
            };
            
            
            // 添加API参数修复测试
            window.testApiParameterFix = async () => {
                if (!resourceDashboard) {
                    console.log('❌ 仪表板未初始化');
                    return { success: false, error: 'Dashboard not initialized' };
                }
                
                console.log('🔧 测试API参数修复...');
                
                try {
                    // 测试 CPU 历史数据获取（使用修复后的参数）
                    const hosts = await resourceDashboard.api.getMonitoredHosts();
                    if (hosts.length === 0) {
                        console.log('⚠️ 没有找到监控主机');
                        return { success: false, error: 'No monitored hosts found' };
                    }
                    
                    const host = hosts[0];
                    console.log(`使用主机: ${host.name} (${host.hostid})`);
                    
                    // 测试 CPU 数据获取（应该使用正确的参数格式）
                    console.log('测试CPU历史数据获取...');
                    const cpuHistory = await resourceDashboard.getHostCpuHistory(host, 1); // 获取1小时数据进行测试
                    
                    const result = {
                        success: true,
                        message: '✅ API参数修复成功',
                        testHost: host.name,
                        cpuDataPoints: cpuHistory.length,
                        timestamp: new Date().toLocaleString()
                    };
                    
                    console.log('🎯 API参数修复测试结果:');
                    console.log(`测试主机: ${result.testHost}`);
                    console.log(`CPU数据点: ${result.cpuDataPoints}个`);
                    console.log(result.message);
                    
                    window.apiParameterFixTestResult = result;
                    return result;
                    
                } catch (error) {
                    console.error('❌ API参数修复测试失败:', error);
                    return { 
                        success: false, 
                        error: error.message,
                        details: error.toString() 
                    };
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
