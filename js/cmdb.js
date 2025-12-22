// CMDB 页面脚本
// 安全翻译工具函数
function safeTranslate(key, zhFallback = '', enFallback = '') {
    try {
        if (typeof i18n !== 'undefined' && i18n.t) {
            const translation = i18n.t(key);
            if (translation && translation !== key) {
                return translation;
            }
        }
        const currentLang = (typeof i18n !== 'undefined' && i18n.currentLang) ? i18n.currentLang : 'zh';
        return currentLang === 'en' ? (enFallback || zhFallback) : zhFallback;
    } catch (e) {
        console.warn(`Translation failed for key: ${key}`, e);
        const currentLang = (typeof i18n !== 'undefined' && i18n.currentLang) ? i18n.currentLang : 'zh';
        return currentLang === 'en' ? (enFallback || zhFallback) : zhFallback;
    }
}

class CMDBPage {
    constructor() {
        this.hosts = [];
        this.filteredHosts = [];
        this.hostGroups = [];
        this.currentSort = { column: null, direction: 'asc' };
        this.searchTimeout = null;
        this.refreshTimer = null;
        this.onStorageChangeHandler = this.onStorageChange.bind(this);
        this.init();
    }

    async init() {
        // 初始化 i18n
        this.initI18n();
        
        // 绑定事件
        this.bindEvents();
        
        // 加载数据
        await this.loadData();

        // 启动自动刷新
        this.startAutoRefresh();

        // 监听 storage 变更以便更新刷新间隔
        if (chrome && chrome.storage && chrome.storage.onChanged) {
            chrome.storage.onChanged.addListener(this.onStorageChangeHandler);
        }

        // 在页面卸载时清理定时器
        window.addEventListener('beforeunload', () => this.stopAutoRefresh());
    }

    initI18n() {
        // 翻译页面元素
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            element.textContent = i18n.t(key);
        });

        // 翻译 placeholder
        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            element.placeholder = i18n.t(key);
        });
        // 翻译 title（例如 select 的提示）
        document.querySelectorAll('[data-i18n-title]').forEach(element => {
            const key = element.getAttribute('data-i18n-title');
            const translated = i18n.t(key);
            if (translated && translated !== key) {
                element.title = translated;
            }
        });
    }

    bindEvents() {
        // 搜索框事件 - 防抖处理
        const searchInput = document.getElementById('searchInput');
        searchInput.addEventListener('input', (e) => {
            clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(() => {
                this.filterHosts();
            }, 300);
        });

        // 主机分组下拉框事件
        document.getElementById('groupFilter').addEventListener('change', () => {
            this.filterHosts();
        });

        // 接口方式下拉框事件
        document.getElementById('interfaceFilter').addEventListener('change', () => {
            this.filterHosts();
        });

        // 排序事件
        document.querySelectorAll('.cmdb-table th.sortable').forEach(th => {
            th.addEventListener('click', () => {
                const column = th.dataset.sort;
                this.sortHosts(column);
            });
        });
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

    async loadData() {
        try {
            const settings = await this.getSettings();
            if (!settings.apiUrl || !settings.apiToken) {
                window.settingsManager?.showDialog();
                return;
            }

            const api = new ZabbixAPI(settings.apiUrl, atob(settings.apiToken));

            // 并行加载主机和主机组数据
            const [hosts, hostGroups] = await Promise.all([
                this.loadHostsWithDetails(api),
                api.getHostGroups()
            ]);

            this.hosts = hosts;
            this.hostGroups = hostGroups;
            this.filteredHosts = [...this.hosts];

            // 更新主机分组下拉框
            this.updateGroupFilter();

            // 更新统计卡片
            this.updateStats();

            // 渲染表格
            this.renderTable();
            // 更新最后刷新时间（仅在完成数据加载时更新）
            try {
                this.updateLastRefreshTime();
            } catch (e) {
                console.warn('更新最后刷新时间失败', e);
            }

        } catch (error) {
            console.error('加载CMDB数据失败:', error);
            this.showError();
        }
    }

    async loadHostsWithDetails(api) {
        try {
            // 获取主机详细信息，包括接口、分组、监控项等
            const hosts = await api.request('host.get', {
                output: ['hostid', 'host', 'name', 'status'],
                selectInterfaces: ['interfaceid', 'ip', 'dns', 'port', 'type', 'main', 'available'],
                selectGroups: ['groupid', 'name'],
                selectInventory: ['os', 'os_full', 'hardware', 'software', 'type'],
            });

            // 获取监控项数据
            const items = await api.request('item.get', {
                output: ['itemid', 'hostid', 'name', 'key_', 'lastvalue'],
                search: {
                    name: [
                        'CPU utilization',
                        'Memory utilization',
                        'Number of CPUs',
                        'System name',
                        'Version of Zabbix agent running',
                        'System description',
                        'Total memory'
                    ],
                    key_: [
                        'vm.memory.utilization',
                        'vm.memory.util',
                        'system.cpu.num',
                        'wmi.get[root/cimv2,"Select NumberOfLogicalProcessors from Win32_ComputerSystem"]',
                        'system.name',
                        'system.hostname',
                        'system.uname',
                        'system.sw.os',
                        'agent.version',
                        'vm.memory.size[total]'
                    ]
                },
                searchByAny: true,
                monitored: true
            });

            // 创建主机ID到监控项的映射
            const hostItemsMap = items.reduce((map, item) => {
                if (!map[item.hostid]) {
                    map[item.hostid] = [];
                }
                map[item.hostid].push(item);
                return map;
            }, {});

            // 处理每个主机的数据
            return hosts.map(host => {
                const hostItems = hostItemsMap[host.hostid] || [];
                
                // 获取各项监控数据
                const cpuItem = hostItems.find(item => item.name.includes('CPU utilization'));
                const memoryUtilItem = hostItems.find(item => 
                    item.name.includes('Memory utilization') ||
                    item.key_ === 'vm.memory.utilization' ||
                    item.key_ === 'vm.memory.util'
                );
                const cpuCoresItem = hostItems.find(item => 
                    item.name.includes('Number of CPUs') ||
                    item.key_ === 'system.cpu.num' ||
                    item.key_.includes('NumberOfLogicalProcessors')
                );
                const hostnameItem = hostItems.find(item => 
                    item.name.includes('System name') ||
                    item.key_ === 'system.hostname' ||
                    item.key_ === 'system.name'
                );
                const osItem = hostItems.find(item => 
                    item.name.includes('System description') ||
                    item.key_ === 'system.uname' ||
                    item.key_ === 'system.sw.os'
                );
                const memoryTotalItem = hostItems.find(item => 
                    item.name.includes('Total memory') ||
                    item.key_ === 'vm.memory.size[total]'
                );
               
                   const agentVersionItem = hostItems.find(item => 
                       (item.name && item.name.includes('Version of Zabbix agent running')) ||
                       (item.key_ && (item.key_ === 'agent.version' || item.key_.includes('agent.version')))
                   );

                // 解析接口信息
                const interfaces = host.interfaces || [];
                const mainInterface = interfaces.find(iface => iface.main === '1') || interfaces[0];
                const interfaceTypes = this.getInterfaceTypes(interfaces);

                // 解析架构信息
                const arch = this.parseArchitecture(osItem?.lastvalue || '');

                return {
                    hostid: host.hostid,
                    name: host.name || host.host,
                    hostname: hostnameItem?.lastvalue || host.host || '-',
                    ip: mainInterface?.ip || '-',
                    os: osItem?.lastvalue || '-',
                    arch: arch,
                    cpuCores: cpuCoresItem?.lastvalue ? parseInt(cpuCoresItem.lastvalue) : 0,
                    cpuCoresDisplay: cpuCoresItem?.lastvalue ? `${cpuCoresItem.lastvalue} cores` : '-',
                    memoryTotal: memoryTotalItem?.lastvalue ? parseInt(memoryTotalItem.lastvalue) : 0,
                    memoryTotalDisplay: memoryTotalItem ? this.formatMemorySize(memoryTotalItem.lastvalue) : '-',
                    cpu: cpuItem?.lastvalue ? parseFloat(cpuItem.lastvalue) : 0,
                    cpuDisplay: cpuItem?.lastvalue ? parseFloat(cpuItem.lastvalue).toFixed(2) + '%' : '-',
                    memory: memoryUtilItem?.lastvalue ? parseFloat(memoryUtilItem.lastvalue) : 0,
                    memoryDisplay: memoryUtilItem?.lastvalue ? parseFloat(memoryUtilItem.lastvalue).toFixed(2) + '%' : '-',
                    groups: host.groups || [],
                    interfaces: interfaces,
                    interfaceTypes: interfaceTypes,
                       agentVersion: agentVersionItem?.lastvalue || '-',
                    status: host.status === '0' ? 'enabled' : 'disabled',
                    available: mainInterface?.available === '1'
                };
            });
        } catch (error) {
            console.error('加载主机详情失败:', error);
            throw error;
        }
    }

    getInterfaceTypes(interfaces) {
        const types = [];
        const typeMap = {
            '1': 'agent',
            '2': 'snmp',
            '3': 'ipmi',
            '4': 'jmx'
        };
        
        interfaces.forEach(iface => {
            const type = typeMap[iface.type];
            if (type && !types.includes(type)) {
                types.push(type);
            }
        });
        
        return types;
    }

    parseArchitecture(osInfo) {
        if (!osInfo) return '-';
        
        const osLower = osInfo.toLowerCase();
        if (osLower.includes('x86_64') || osLower.includes('amd64') || osLower.includes('x64')) {
            return 'x86_64';
        } else if (osLower.includes('x86') || osLower.includes('i386') || osLower.includes('i686')) {
            return 'x86';
        } else if (osLower.includes('arm64') || osLower.includes('aarch64')) {
            return 'ARM64';
        } else if (osLower.includes('arm')) {
            return 'ARM';
        }
        return '-';
    }

    formatMemorySize(bytes) {
        if (bytes === 0) return '0';
        if (!bytes) return '-';
        const gb = parseFloat(bytes) / (1024 * 1024 * 1024);
        if (gb >= 1) {
            return gb.toFixed(2) + ' GB';
        }
        const mb = parseFloat(bytes) / (1024 * 1024);
        return mb.toFixed(2) + ' MB';
    }

    updateGroupFilter() {
        const select = document.getElementById('groupFilter');
        // 保留第一个"所有分组"选项
        select.innerHTML = `<option value="" data-i18n="cmdb.allGroups">${safeTranslate('cmdb.allGroups', '所有分组', 'All Groups')}</option>`;
        
        this.hostGroups.forEach(group => {
            const option = document.createElement('option');
            option.value = group.groupid;
            option.textContent = group.name;
            select.appendChild(option);
        });
    }

    updateStats() {
        const hosts = this.filteredHosts;
        
        // 计算总CPU核心数
        const totalCPU = hosts.reduce((sum, host) => sum + (host.cpuCores || 0), 0);
        document.getElementById('totalCPU').textContent = totalCPU;

        // 计算总内存
        const totalMemoryBytes = hosts.reduce((sum, host) => sum + (host.memoryTotal || 0), 0);
        document.getElementById('totalMemory').textContent = this.formatMemorySize(totalMemoryBytes);

        // 主机总数
        document.getElementById('totalHosts').textContent = hosts.length;

        // 主机分组数
        const uniqueGroups = new Set();
        hosts.forEach(host => {
            host.groups.forEach(group => uniqueGroups.add(group.groupid));
        });
        document.getElementById('totalGroups').textContent = uniqueGroups.size;

        // 启用主机数
        const enabledHosts = hosts.filter(host => host.status === 'enabled').length;
        document.getElementById('enabledHosts').textContent = enabledHosts;
    }

    updateLastRefreshTime() {
        const el = document.getElementById('lastRefreshTime');
        if (!el) return;
        try {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            });
            // 尝试使用设置中的文案，回退到通用 messages 或硬编码文本
            let template = (typeof i18n !== 'undefined' && i18n.t) ? i18n.t('settings.messages.lastRefresh') : null;
            if (!template || template.indexOf('{time}') === -1) {
                template = (typeof i18n !== 'undefined' && i18n.t) ? i18n.t('messages.lastRefreshTime') : null;
            }
            if (!template) template = '最后刷新时间: {time}';
            el.textContent = template.replace('{time}', timeStr);
        } catch (e) {
            console.warn('设置最后刷新时间失败', e);
        }
    }

    async startAutoRefresh() {
        try {
            // 清除已有定时器
            this.stopAutoRefresh();
            const settings = await this.getSettings();
            const refreshIntervalMs = parseInt(settings.refreshInterval, 10) || 300000;
            // 防止非法值
            const interval = Math.max(1000, refreshIntervalMs);
            this.refreshTimer = setInterval(async () => {
                try {
                    await this.loadData();
                } catch (e) {
                    console.warn('自动刷新加载数据失败', e);
                }
            }, interval);
        } catch (e) {
            console.warn('启动自动刷新失败', e);
        }
    }

    stopAutoRefresh() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
    }

    onStorageChange(changes, area) {
        if (area !== 'sync') return;
        if (changes.refreshInterval) {
            // 重启自动刷新以应用新的间隔
            this.startAutoRefresh();
        }
    }

    filterHosts() {
        // 使用后台 API 进行过滤（search/group），interfaceType 将在客户端再次确认
        const searchTerm = document.getElementById('searchInput').value.trim();
        const groupId = document.getElementById('groupFilter').value;
        const interfaceType = document.getElementById('interfaceFilter').value;

        // 显示表格加载状态
        this.showTableLoading();

        // 异步调用后端获取过滤后的主机列表
        this.fetchFilteredHosts(searchTerm, groupId, interfaceType)
            .then(hosts => {
                // 如果用户指定了接口类型，再次在客户端筛选（因为 host.get 无法直接按接口类型过滤）
                let filtered = hosts;
                if (interfaceType) {
                    filtered = hosts.filter(h => (h.interfaceTypes || []).includes(interfaceType));
                }

                this.filteredHosts = filtered;
                this.updateStats();
                this.renderTable();
            })
            .catch(err => {
                console.error('过滤主机时出错:', err);
                this.showError();
            });
    }

    showTableLoading() {
        const tbody = document.getElementById('hostsList');
        tbody.innerHTML = `
            <tr>
                <td colspan="12">
                    <div class="loading-overlay">
                        <i class="fas fa-spinner"></i>
                        <span style="margin-left:8px;">${safeTranslate('cmdb.loading', '正在加载...', 'Loading...')}</span>
                    </div>
                </td>
            </tr>
        `;
    }

    async fetchFilteredHosts(searchTerm = '', groupId = '', interfaceType = '') {
        try {
            const settings = await this.getSettings();
            if (!settings.apiUrl || !settings.apiToken) {
                window.settingsManager?.showDialog();
                return [];
            }

            const api = new ZabbixAPI(settings.apiUrl, atob(settings.apiToken));

            // 构建 host.get 的查询参数
            const hostParams = {
                output: ['hostid', 'host', 'name', 'status'],
                selectInterfaces: ['interfaceid', 'ip', 'dns', 'port', 'type', 'main', 'available'],
                selectGroups: ['groupid', 'name'],
                selectInventory: ['os', 'os_full', 'hardware', 'software', 'type'],
                monitored: true,
                limit: 1000
            };

            if (groupId) {
                hostParams.groupids = [groupId];
            }

            if (searchTerm) {
                // 让 API 在主机名上做部分匹配
                hostParams.search = { host: searchTerm };
                hostParams.searchByAny = true;
            }

            // 获取主机基本信息（带接口和分组）
            const hosts = await api.request('host.get', hostParams);

            if (!hosts || hosts.length === 0) return [];

            // 获取这些主机相关的监控项
            const hostids = hosts.map(h => h.hostid);
            const items = await api.request('item.get', {
                output: ['itemid', 'hostid', 'name', 'key_', 'lastvalue'],
                hostids: hostids,
                search: {
                    name: [
                        'CPU utilization',
                        'Memory utilization',
                        'Number of CPUs',
                        'System name',
                        'Version of Zabbix agent running',
                        'System description',
                        'Total memory'
                    ],
                    key_: [
                        'vm.memory.utilization',
                        'vm.memory.util',
                        'system.cpu.num',
                        'system.name',
                        'system.hostname',
                        'system.uname',
                        'system.sw.os',
                        'agent.version',
                        'vm.memory.size[total]'
                    ]
                },
                searchByAny: true,
                monitored: true
            });

            const hostItemsMap = items.reduce((map, item) => {
                if (!map[item.hostid]) map[item.hostid] = [];
                map[item.hostid].push(item);
                return map;
            }, {});

            // 组合主机和监控项数据，返回与 loadHostsWithDetails 相同结构
            return hosts.map(host => {
                const hostItems = hostItemsMap[host.hostid] || [];
                const cpuItem = hostItems.find(item => item.name && item.name.includes('CPU utilization'));
                const memoryUtilItem = hostItems.find(item => item.name && item.name.includes('Memory utilization')) || hostItems.find(item => item.key_ === 'vm.memory.utilization') || hostItems.find(item => item.key_ === 'vm.memory.util');
                const cpuCoresItem = hostItems.find(item => item.name && item.name.includes('Number of CPUs')) || hostItems.find(item => item.key_ === 'system.cpu.num') || (hostItems.find(item => item.key_ && item.key_.includes('NumberOfLogicalProcessors')));
                const hostnameItem = hostItems.find(item => item.name && item.name.includes('System name')) || hostItems.find(item => item.key_ === 'system.hostname' || item.key_ === 'system.name');
                const osItem = hostItems.find(item => item.name && item.name.includes('System description')) || hostItems.find(item => item.key_ === 'system.uname') || hostItems.find(item => item.key_ === 'system.sw.os');
                const memoryTotalItem = hostItems.find(item => item.name && item.name.includes('Total memory')) || hostItems.find(item => item.key_ === 'vm.memory.size[total]');

                const interfaces = host.interfaces || [];
                const mainInterface = interfaces.find(iface => iface.main === '1') || interfaces[0];
                const interfaceTypes = this.getInterfaceTypes(interfaces);

                const arch = this.parseArchitecture(osItem?.lastvalue || '');

                return {
                    hostid: host.hostid,
                    name: host.name || host.host,
                    hostname: hostnameItem?.lastvalue || host.host || '-',
                    ip: mainInterface?.ip || '-',
                    os: osItem?.lastvalue || '-',
                    arch: arch,
                    cpuCores: cpuCoresItem?.lastvalue ? parseInt(cpuCoresItem.lastvalue) : 0,
                    cpuCoresDisplay: cpuCoresItem?.lastvalue ? `${cpuCoresItem.lastvalue} cores` : '-',
                    memoryTotal: memoryTotalItem?.lastvalue ? parseInt(memoryTotalItem.lastvalue) : 0,
                    memoryTotalDisplay: memoryTotalItem ? this.formatMemorySize(memoryTotalItem.lastvalue) : '-',
                    cpu: cpuItem?.lastvalue ? parseFloat(cpuItem.lastvalue) : 0,
                    cpuDisplay: cpuItem?.lastvalue ? parseFloat(cpuItem.lastvalue).toFixed(2) + '%' : '-',
                    memory: memoryUtilItem?.lastvalue ? parseFloat(memoryUtilItem.lastvalue) : 0,
                    memoryDisplay: memoryUtilItem?.lastvalue ? parseFloat(memoryUtilItem.lastvalue).toFixed(2) + '%' : '-',
                    groups: host.groups || [],
                    interfaces: interfaces,
                    interfaceTypes: interfaceTypes,
                    agentVersion: (hostItems.find(item => item.key_ && item.key_.includes('agent.version')) || {}).lastvalue || '-',
                    status: host.status === '0' ? 'enabled' : 'disabled',
                    available: mainInterface?.available === '1'
                };
            });
        } catch (error) {
            console.error('fetchFilteredHosts error:', error);
            throw error;
        }
    }

    sortHosts(column) {
        // 更新排序状态
        if (this.currentSort.column === column) {
            this.currentSort.direction = this.currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            this.currentSort.column = column;
            this.currentSort.direction = 'asc';
        }

        // 更新排序图标
        document.querySelectorAll('.cmdb-table th.sortable').forEach(th => {
            th.classList.remove('sorted');
            const icon = th.querySelector('.sort-icon');
            icon.className = 'fas fa-sort sort-icon';
        });

        const currentTh = document.querySelector(`th[data-sort="${column}"]`);
        currentTh.classList.add('sorted');
        const icon = currentTh.querySelector('.sort-icon');
        icon.className = `fas fa-sort-${this.currentSort.direction === 'asc' ? 'up' : 'down'} sort-icon`;

        // 排序数据
        this.filteredHosts.sort((a, b) => {
            let valueA = a[column];
            let valueB = b[column];

            // 处理数字类型
            if (typeof valueA === 'number' && typeof valueB === 'number') {
                return this.currentSort.direction === 'asc' ? valueA - valueB : valueB - valueA;
            }

            // 处理字符串类型
            valueA = String(valueA || '');
            valueB = String(valueB || '');
            
            if (this.currentSort.direction === 'asc') {
                return valueA.localeCompare(valueB);
            } else {
                return valueB.localeCompare(valueA);
            }
        });

        this.renderTable();
    }

    renderTable() {
        const tbody = document.getElementById('hostsList');
        
        if (this.filteredHosts.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="12">
                        <div class="empty-state">
                            <i class="fas fa-server"></i>
                            <p>${safeTranslate('cmdb.noHostsFound', '未找到主机', 'No hosts found')}</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.filteredHosts.map(host => `
            <tr>
                <td title="${this.escapeHtml(host.name)}">
                    <span class="availability-indicator">
                        <span class="availability-dot ${host.available ? 'available' : 'unavailable'}"></span>
                        <span class="host-name-link" data-hostid="${host.hostid}">${this.escapeHtml(host.name)}</span>
                    </span>
                </td>
                <td title="${this.escapeHtml(host.hostname)}">${this.escapeHtml(host.hostname)}</td>
                <td title="${this.escapeHtml(host.ip)}">${this.escapeHtml(host.ip)}</td>
                <td title="${this.escapeHtml(host.arch)}"><span class="arch-tag">${this.escapeHtml(host.arch)}</span></td>
                <td title="${this.escapeHtml((host.interfaceTypes || []).map(t => safeTranslate(`cmdbInterfaceNames.${t}`, t.toUpperCase(), t.toUpperCase())).join(', ') || '-')}">${this.renderInterfaceTags(host.interfaceTypes)}</td>
                <td title="${this.escapeHtml(host.agentVersion)}">${this.escapeHtml(host.agentVersion)}</td>
                <td title="${this.escapeHtml(host.cpuCoresDisplay)}">${this.escapeHtml(host.cpuCoresDisplay)}</td>
                <td title="${this.escapeHtml(host.cpuDisplay)}">${this.renderUsageBar(host.cpu, host.cpuDisplay)}</td>
                <td title="${this.escapeHtml(host.memoryTotalDisplay)}">${this.escapeHtml(host.memoryTotalDisplay)}</td>
                <td title="${this.escapeHtml(host.memoryDisplay)}">${this.renderUsageBar(host.memory, host.memoryDisplay)}</td>
                <td title="${this.escapeHtml(host.os)}">${this.truncateText(host.os, 30)}</td>
                <td title="${this.escapeHtml((host.groups || []).map(g => g.name).join(', ') || '-')}">${this.renderGroupTags(host.groups)}</td>
            </tr>
        `).join('');
    }

    renderInterfaceTags(types) {
        if (!types || types.length === 0) return '-';
        
        return types.map(type => {
            const label = safeTranslate(`cmdbInterfaceNames.${type}`, type.toUpperCase(), type.toUpperCase());
            return `<span class="interface-tag ${type}">${label}</span>`;
        }).join('');
    }

    renderGroupTags(groups) {
        if (!groups || groups.length === 0) return '-';
        
        // 只显示前2个分组，其余用 +N 表示
        const displayGroups = groups.slice(0, 2);
        const remaining = groups.length - 2;
        
        let html = displayGroups.map(group => 
            `<span class="group-tag">${this.escapeHtml(group.name)}</span>`
        ).join('');
        
        if (remaining > 0) {
            html += `<span class="group-tag">+${remaining}</span>`;
        }
        
        return html;
    }

    renderUsageBar(value, displayValue) {
        if (!value || displayValue === '-') {
            return '-';
        }

        let colorClass = 'low';
        if (value >= 80) {
            colorClass = 'high';
        } else if (value >= 60) {
            colorClass = 'medium';
        }

        return `
            <div class="usage-bar-container">
                <div class="usage-bar">
                    <div class="usage-bar-fill ${colorClass}" style="width: ${Math.min(value, 100)}%"></div>
                </div>
                <span class="usage-value">${displayValue}</span>
            </div>
        `;
    }

    truncateText(text, maxLength) {
        if (!text || text === '-') return '-';
        if (text.length <= maxLength) return this.escapeHtml(text);
        return this.escapeHtml(text.substring(0, maxLength)) + '...';
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showError() {
        const tbody = document.getElementById('hostsList');
        tbody.innerHTML = `
            <tr>
                <td colspan="12">
                    <div class="empty-state">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>${safeTranslate('cmdb.loadError', '加载数据失败，请检查设置', 'Failed to load data, please check settings')}</p>
                    </div>
                </td>
            </tr>
        `;
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    new CMDBPage();
});
