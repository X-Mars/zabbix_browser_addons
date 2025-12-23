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

            // 保存当前过滤条件
            const currentSearchTerm = document.getElementById('searchInput')?.value || '';
            const currentGroupId = document.getElementById('groupFilter')?.value || '';
            const currentInterfaceType = document.getElementById('interfaceFilter')?.value || '';

            const api = new ZabbixAPI(settings.apiUrl, atob(settings.apiToken));

            // 并行加载主机和主机组数据
            const [hosts, hostGroups] = await Promise.all([
                this.loadHostsWithDetails(api),
                api.getHostGroups()
            ]);

            this.hosts = hosts;
            this.hostGroups = hostGroups;

            // 更新主机分组下拉框（保留之前选中的值）
            this.updateGroupFilter(currentGroupId);

            // 恢复搜索框的值（以防被清空）
            const searchInput = document.getElementById('searchInput');
            if (searchInput && currentSearchTerm) {
                searchInput.value = currentSearchTerm;
            }

            // 恢复接口类型下拉框的值
            const interfaceFilter = document.getElementById('interfaceFilter');
            if (interfaceFilter && currentInterfaceType) {
                interfaceFilter.value = currentInterfaceType;
            }

            // 如果有任何过滤条件，应用过滤；否则显示所有主机
            if (currentSearchTerm || currentGroupId || currentInterfaceType) {
                // 应用过滤条件（不触发新的 API 请求，使用本地过滤）
                this.applyLocalFilter(currentSearchTerm, currentGroupId, currentInterfaceType);
            } else {
                this.filteredHosts = [...this.hosts];
                // 更新统计卡片
                this.updateStats();
                // 渲染表格
                this.renderTable();
            }
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

    async loadHostsWithDetails(api, options = {}) {
        try {
            // 接口类型映射：agent=1, snmp=2, ipmi=3, jmx=4
            const interfaceTypeMap = {
                'agent': '1',
                'snmp': '2',
                'ipmi': '3',
                'jmx': '4'
            };

            // 构建 host.get 请求参数
            const hostParams = {
                output: ['hostid', 'host', 'name', 'status'],
                selectInterfaces: ['interfaceid', 'ip', 'dns', 'port', 'type', 'main', 'available'],
                selectHostGroups: ['groupid', 'name'],
                selectInventory: ['os', 'os_full', 'hardware', 'software', 'type'],
            };

            // 如果提供了 hostids，添加到请求参数
            if (options.hostids && options.hostids.length > 0) {
                hostParams.hostids = options.hostids;
            }

            // 如果提供了 groupids，添加到请求参数
            if (options.groupids && options.groupids.length > 0) {
                hostParams.groupids = options.groupids;
            }

            // 如果提供了 interfaceids，添加到请求参数
            if (options.interfaceids && options.interfaceids.length > 0) {
                hostParams.interfaceids = options.interfaceids;
            }

            // 如果提供了接口类型，使用 filter 参数按接口 type 属性过滤
            // 根据 Zabbix API 文档，filter 支持主机-接口-object属性
            if (options.interfaceType && interfaceTypeMap[options.interfaceType]) {
                hostParams.filter = hostParams.filter || {};
                hostParams.filter.type = interfaceTypeMap[options.interfaceType];
            }

            // 如果提供了搜索词，同时搜索 host、name 和 ip 字段
            if (options.search) {
                // 判断搜索词是否像 IP 地址
                const isIPLike = /^[\d.]+$/.test(options.search);
                hostParams.search = {
                    host: options.search,
                    name: options.search
                };
                // 如果搜索词像 IP，添加 ip 搜索
                if (isIPLike) {
                    hostParams.search.ip = options.search;
                }
                hostParams.searchByAny = true;  // 任意字段匹配即可
            }

            // 获取主机详细信息，包括接口、分组、监控项等
            const hosts = await api.request('host.get', hostParams);

            // 兼容不同 Zabbix 返回结构：有的版本/参数会返回 `hostgroups` 字段而不是 `groups`
            // 统一填充 `groups` 字段，便于后续代码使用
            if (Array.isArray(hosts)) {
                hosts.forEach(h => {
                    if (!h.groups && h.hostgroups) {
                        h.groups = h.hostgroups;
                    }
                });
            }

            // 获取监控项数据
            const items = await api.request('item.get', {
                output: ['itemid', 'hostid', 'name', 'key_', 'lastvalue'],
                search: {
                    name: [
                        'CPU utilization',
                        'Memory utilization',
                        'User memory utilization',
                        'Virtual memory',
                        'Memory utilization, in %',
                        'Number of CPUs',
                        'System name',
                        'Version of Zabbix agent running',
                        'System description',
                        'Total memory'
                    ],
                    key_: [
                        'vm.memory.utilization',
                        'vm.memory.util',
                        'vm.memory.pused',
                        'dev.mem.usage',
                        'vm.memory.total',
                        'vm.memory.walk.data.total',
                        'system.cpu.util',
                        'sfSysCpuCostRate',
                        'dev.cpu.usage',
                        'system.cpu.num',
                        'cpu.core.num',
                        'vmware.hv.hw.cpu.num',
                        'system.cpu.walk',
                        'vmware.vm.cpu.num',
                        "wmi.get[root/cimv2,'Select NumberOfLogicalProcessors from Win32_ComputerSystem']",
                        'system.name',
                        'sysName',
                        'sysDescr',
                        'system.hostname',
                        'system.uname',
                        'system.sw.os',
                        'docker.operating_system',
                        'dell.server.sw.os',
                        'sd_wan.device.os',
                        'juniper.mx.system.sw.os',
                        'agent.version',
                        'vm.memory.size[total]',
                        'dell.server.memory.size.total',
                        'nomad.client.memory.total',
                        'docker.mem.total',
                        'vm.memory.total'
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
                const cpuItem = hostItems.find(item => (
                    (item.name && item.name.includes('CPU utilization')) ||
                    (item.key_ && item.key_.includes('system.cpu.util')) ||
                    (item.key_ && item.key_.includes('sfSysCpuCostRate')) ||
                    (item.key_ && item.key_.includes('dev.cpu.usage'))
                ));
                const memoryUtilItem = hostItems.find(item => (item.name && (
                    item.name.includes('Memory utilization') ||
                    item.name.includes('User memory utilization') ||
                    item.name.includes('Virtual memory') ||
                    item.name.includes('Memory utilization, in %')
                )))
                    || hostItems.find(item => item.key_ && item.key_.includes('vm.memory.utilization'))
                    || hostItems.find(item => item.key_ && item.key_.includes('vm.memory.util'))
                    || hostItems.find(item => item.key_ && item.key_.includes('vm.memory.pused'))
                    || hostItems.find(item => item.key_ && item.key_.includes('dev.mem.usage'));
                const cpuCoresItem = hostItems.find(item => (
                    (item.name && item.name.includes('Number of CPUs')) ||
                    (item.key_ && item.key_.includes('system.cpu.num')) ||
                    (item.key_ && item.key_.includes('NumberOfLogicalProcessors')) ||
                    (item.key_ && item.key_.includes('cpu.core.num')) ||
                    (item.key_ && item.key_.includes('vmware.hv.hw.cpu.num')) ||
                    (item.key_ && item.key_.includes('system.cpu.walk')) ||
                    (item.key_ && item.key_.includes('vmware.vm.cpu.num'))
                ));
                const hostnameItem = hostItems.find(item => 
                    (item.name && item.name.includes('System name')) ||
                    (item.key_ && item.key_.includes('system.hostname')) ||
                    (item.key_ && item.key_.includes('system.name')) ||
                    (item.key_ && item.key_.includes('sysName'))
                );
                const osItem = hostItems.find(item => 
                    (item.name && item.name.includes('System description')) ||
                    (item.key_ && item.key_.includes('system.uname')) ||
                    (item.key_ && item.key_.includes('system.sw.os')) ||
                    (item.key_ && item.key_.includes('sysDescr')) ||
                    (item.key_ && item.key_.includes('docker.operating_system')) ||
                    (item.key_ && item.key_.includes('dell.server.sw.os')) ||
                    (item.key_ && item.key_.includes('sd_wan.device.os')) ||
                    (item.key_ && item.key_.includes('juniper.mx.system.sw.os'))
                );
                const memoryTotalItem = hostItems.find(item => (item.name && item.name.includes('Total memory')))
                    || hostItems.find(item => item.key_ && item.key_.includes('vm.memory.size[total]'))
                    || hostItems.find(item => item.key_ && item.key_.includes('dell.server.memory.size.total'))
                    || hostItems.find(item => item.key_ && item.key_.includes('nomad.client.memory.total'))
                    || hostItems.find(item => item.key_ && item.key_.includes('docker.mem.total'))
                    || hostItems.find(item => item.key_ && item.key_.includes('vm.memory.total'))
                    || hostItems.find(item => item.key_ && item.key_.includes('vm.memory.walk.data.total'));
               
                   const agentVersionItem = hostItems.find(item => 
                       (item.name && item.name.includes('Version of Zabbix agent running')) ||
                       (item.key_ && item.key_.includes('agent.version'))
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

    updateGroupFilter(selectedGroupId = '') {
        const select = document.getElementById('groupFilter');
        // 保留第一个"所有分组"选项
        select.innerHTML = `<option value="" data-i18n="cmdb.allGroups">${safeTranslate('cmdb.allGroups', '所有分组', 'All Groups')}</option>`;
        
        this.hostGroups.forEach(group => {
            const option = document.createElement('option');
            option.value = group.groupid;
            option.textContent = group.name;
            select.appendChild(option);
        });

        // 恢复之前选中的值
        if (selectedGroupId) {
            select.value = selectedGroupId;
        }
    }

    // 本地过滤方法，用于刷新后重新应用过滤条件（避免重复调用 API）
    applyLocalFilter(searchTerm = '', groupId = '', interfaceType = '') {
        let filtered = [...this.hosts];

        // 按搜索词过滤（主机名或 IP）
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(host => 
                (host.name && host.name.toLowerCase().includes(term)) ||
                (host.hostname && host.hostname.toLowerCase().includes(term)) ||
                (host.ip && host.ip.toLowerCase().includes(term))
            );
        }

        // 按主机组过滤
        if (groupId) {
            filtered = filtered.filter(host => 
                host.groups && host.groups.some(g => g.groupid === groupId)
            );
        }

        // 按接口类型过滤
        if (interfaceType) {
            filtered = filtered.filter(host => 
                (host.interfaceTypes || []).includes(interfaceType)
            );
        }

        this.filteredHosts = filtered;
        this.updateStats();
        this.renderTable();
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

        // 主机分组数 — 对 host.groups 做防护处理，兼容缺失或不同结构的数据
        const uniqueGroups = new Set();
        hosts.forEach(host => {
            const groups = host.groups || [];
            if (Array.isArray(groups) && groups.length > 0) {
                groups.forEach(group => {
                    // 兼容 group 可能是对象或直接的 id 字符串/数字
                    const gid = group && (group.groupid || group.groupId || group.id) ?
                        String(group.groupid || group.groupId || group.id) :
                        String(group);
                    if (gid) uniqueGroups.add(gid);
                });
            }
        });

        // 如果通过 hosts 计算不到分组（例如 hosts 中 groups 为空），回退到已加载的 hostGroups（仅统计包含主机的组）
        let totalGroupsCount = uniqueGroups.size;
        if (totalGroupsCount === 0 && Array.isArray(this.hostGroups) && this.hostGroups.length > 0) {
            try {
                totalGroupsCount = this.hostGroups.filter(g => {
                    // Zabbix 使用 with_hosts 时，group 里会包含 hosts 数组
                    if (g && Array.isArray(g.hosts)) return g.hosts.length > 0;
                    // 兼容 selectHosts 返回的结构：可能无 hosts 字段
                    return false;
                }).length;
            } catch (e) {
                totalGroupsCount = 0;
            }
        }

        document.getElementById('totalGroups').textContent = totalGroupsCount;

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
        // 使用后台 API 进行过滤：
        // - search: 按主机名、名称、IP 搜索
        // - groupids: 按主机分组过滤
        // - filter.type: 按接口类型过滤（通过 filter 参数支持主机接口属性）
        const searchTerm = document.getElementById('searchInput').value.trim();
        const groupId = document.getElementById('groupFilter').value;
        const interfaceType = document.getElementById('interfaceFilter').value;

        // 显示表格加载状态
        this.showTableLoading();

        // 异步调用后端获取过滤后的主机列表
        this.fetchFilteredHosts(searchTerm, groupId, interfaceType)
            .then(hosts => {
                // 接口类型过滤已在服务端通过 filter.type 完成
                // 但为确保准确性，仍在客户端进行二次验证
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

            // 接口类型映射：agent=1, snmp=2, ipmi=3, jmx=4
            const interfaceTypeMap = {
                'agent': '1',
                'snmp': '2',
                'ipmi': '3',
                'jmx': '4'
            };

            const api = new ZabbixAPI(settings.apiUrl, atob(settings.apiToken));

            // 构建 host.get 的查询参数
            const hostParams = {
                output: ['hostid', 'host', 'name', 'status'],
                selectInterfaces: ['interfaceid', 'ip', 'dns', 'port', 'type', 'main', 'available'],
                selectHostGroups: ['groupid', 'name'],
                selectInventory: ['os', 'os_full', 'hardware', 'software', 'type'],
            };

            // 按主机分组过滤 (groupids)
            if (groupId) {
                hostParams.groupids = [groupId];
            }

            // 按接口类型过滤，使用 filter 参数按接口 type 属性过滤
            // 根据 Zabbix API 文档，filter 支持主机-接口-object属性
            if (interfaceType && interfaceTypeMap[interfaceType]) {
                hostParams.filter = hostParams.filter || {};
                hostParams.filter.type = interfaceTypeMap[interfaceType];
            }

            // 按搜索词过滤 (search)
            // Zabbix API 的 search 支持搜索 host、name 字段以及主机接口属性（如 ip）
            if (searchTerm) {
                // 判断搜索词是否像 IP 地址（包含数字和点号）
                const isIPLike = /^[\d.]+$/.test(searchTerm);
                
                hostParams.search = {
                    host: searchTerm,
                    name: searchTerm
                };
                // 如果搜索词像 IP，添加 ip 搜索
                if (isIPLike) {
                    hostParams.search.ip = searchTerm;
                }
                hostParams.searchByAny = true;  // 任意字段匹配即可
            }

            // 获取主机基本信息（带接口和分组）
            let hosts = await api.request('host.get', hostParams);

            // 标准化返回字段：有时 API 返回 `hostgroups`，确保统一使用 `groups`
            if (Array.isArray(hosts)) {
                hosts.forEach(h => {
                    if (!h.groups && h.hostgroups) h.groups = h.hostgroups;
                });
            }

            // 如果搜索词像 IP 地址，在客户端进行二次过滤以确保准确性
            // 因为 API 的 search 是模糊匹配，可能返回不精确的结果
            if (searchTerm && hosts && hosts.length > 0) {
                const term = searchTerm.toLowerCase();
                hosts = hosts.filter(host => {
                    // 匹配主机名或名称
                    if ((host.host && host.host.toLowerCase().includes(term)) ||
                        (host.name && host.name.toLowerCase().includes(term))) {
                        return true;
                    }
                    // 匹配任意接口的 IP 或 DNS
                    if (host.interfaces && host.interfaces.length > 0) {
                        return host.interfaces.some(iface => 
                            (iface.ip && iface.ip.toLowerCase().includes(term)) ||
                            (iface.dns && iface.dns.toLowerCase().includes(term))
                        );
                    }
                    return false;
                });
            }

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
                        'User memory utilization',
                        'Virtual memory',
                        'Memory utilization, in %',
                        'Number of CPUs',
                        'System name',
                        'Version of Zabbix agent running',
                        'System description',
                        'Total memory'
                    ],
                    key_: [
                        'vm.memory.utilization',
                        'vm.memory.util',
                        'vm.memory.pused',
                        'dev.mem.usage',
                        'vm.memory.total',
                        'vm.memory.walk.data.total',
                        'system.cpu.util',
                        'sfSysCpuCostRate',
                        'dev.cpu.usage',
                        'system.cpu.num',
                        'cpu.core.num',
                        'vmware.hv.hw.cpu.num',
                        'system.cpu.walk',
                        'vmware.vm.cpu.num',
                        'system.name',
                        'sysName',
                        'sysDescr',
                        'system.hostname',
                        'system.uname',
                        'system.sw.os',
                        'docker.operating_system',
                        'dell.server.sw.os',
                        'sd_wan.device.os',
                        'juniper.mx.system.sw.os',
                        'agent.version',
                        'vm.memory.size[total]',
                        'dell.server.memory.size.total',
                        'nomad.client.memory.total',
                        'docker.mem.total',
                        'vm.memory.total'
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
                const cpuItem = hostItems.find(item => (
                    (item.name && item.name.includes('CPU utilization')) ||
                    (item.key_ && item.key_.includes('system.cpu.util')) ||
                    (item.key_ && item.key_.includes('sfSysCpuCostRate')) ||
                    (item.key_ && item.key_.includes('dev.cpu.usage'))
                ));
                const memoryUtilItem = hostItems.find(item => (item.name && (
                    item.name.includes('Memory utilization') ||
                    item.name.includes('User memory utilization') ||
                    item.name.includes('Virtual memory') ||
                    item.name.includes('Memory utilization, in %')
                )))
                    || hostItems.find(item => item.key_ && item.key_.includes('vm.memory.utilization'))
                    || hostItems.find(item => item.key_ && item.key_.includes('vm.memory.util'))
                    || hostItems.find(item => item.key_ && item.key_.includes('vm.memory.pused'))
                    || hostItems.find(item => item.key_ && item.key_.includes('dev.mem.usage'));
                const cpuCoresItem = hostItems.find(item => (item.name && item.name.includes('Number of CPUs')))
                    || hostItems.find(item => item.key_ && item.key_.includes('system.cpu.num'))
                    || hostItems.find(item => item.key_ && item.key_.includes('NumberOfLogicalProcessors'))
                    || hostItems.find(item => item.key_ && item.key_.includes('cpu.core.num'))
                    || hostItems.find(item => item.key_ && item.key_.includes('vmware.hv.hw.cpu.num'))
                    || hostItems.find(item => item.key_ && item.key_.includes('system.cpu.walk'))
                    || hostItems.find(item => item.key_ && item.key_.includes('vmware.vm.cpu.num'));
                const hostnameItem = hostItems.find(item => (item.name && item.name.includes('System name')))
                    || hostItems.find(item => item.key_ && item.key_.includes('system.hostname'))
                    || hostItems.find(item => item.key_ && item.key_.includes('system.name'))
                    || hostItems.find(item => item.key_ && item.key_.includes('sysName'));
                const osItem = hostItems.find(item => (item.name && item.name.includes('System description')))
                    || hostItems.find(item => item.key_ && item.key_.includes('system.uname'))
                    || hostItems.find(item => item.key_ && item.key_.includes('system.sw.os'))
                    || hostItems.find(item => item.key_ && item.key_.includes('sysDescr'))
                    || hostItems.find(item => item.key_ && item.key_.includes('docker.operating_system'))
                    || hostItems.find(item => item.key_ && item.key_.includes('dell.server.sw.os'))
                    || hostItems.find(item => item.key_ && item.key_.includes('sd_wan.device.os'))
                    || hostItems.find(item => item.key_ && item.key_.includes('juniper.mx.system.sw.os'));
                const memoryTotalItem = hostItems.find(item => (item.name && item.name.includes('Total memory')))
                    || hostItems.find(item => item.key_ && item.key_.includes('vm.memory.size[total]'))
                    || hostItems.find(item => item.key_ && item.key_.includes('dell.server.memory.size.total'))
                    || hostItems.find(item => item.key_ && item.key_.includes('nomad.client.memory.total'))
                    || hostItems.find(item => item.key_ && item.key_.includes('docker.mem.total'))
                    || hostItems.find(item => item.key_ && item.key_.includes('vm.memory.total'))
                    || hostItems.find(item => item.key_ && item.key_.includes('vm.memory.walk.data.total'))
                    || hostItems.find(item => item.key_ && item.key_.includes('vm.memory.pused'))
                    || hostItems.find(item => item.key_ && item.key_.includes('dev.mem.usage'));
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
