// CMDB 页面脚本 - 分页版本，优化大规模主机场景性能
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
        // ── 分页状态 ──
        this.currentPage = 1;
        this.pageSize = 20;
        this.totalCount = 0;
        this.totalPages = 1;

        // ── 数据缓存 ──
        this.allHostIds = [];
        this.pageHosts = [];
        this.hostGroups = [];
        this.globalStats = { totalCPU: 0, totalMemory: 0, activeHosts: 0 };

        // ── 排序 / 定时器 ──
        this.currentSort = { column: null, direction: 'asc' };
        this.searchTimeout = null;
        this.refreshTimer = null;
        this.onStorageChangeHandler = this.onStorageChange.bind(this);

        // ── API 实例缓存 ──
        this._api = null;

        this.init();
    }

    // ══════════════════════════════════════
    //  初始化
    // ══════════════════════════════════════

    async init() {
        this.initI18n();
        this.bindEvents();
        await this.loadData();
        this.startAutoRefresh();

        if (chrome && chrome.storage && chrome.storage.onChanged) {
            chrome.storage.onChanged.addListener(this.onStorageChangeHandler);
        }
        window.addEventListener('beforeunload', () => this.stopAutoRefresh());
    }

    initI18n() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            el.textContent = i18n.t(key);
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            el.placeholder = i18n.t(key);
        });
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            const translated = i18n.t(key);
            if (translated && translated !== key) el.title = translated;
        });
    }

    bindEvents() {
        // 搜索框防抖
        document.getElementById('searchInput').addEventListener('input', () => {
            clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(() => {
                this.currentPage = 1;
                this.loadData();
            }, 300);
        });

        // 分组筛选
        document.getElementById('groupFilter').addEventListener('change', () => {
            this.currentPage = 1;
            this.loadData();
        });

        // 接口类型筛选
        document.getElementById('interfaceFilter').addEventListener('change', () => {
            this.currentPage = 1;
            this.loadData();
        });

        // 列排序
        document.querySelectorAll('.cmdb-table th.sortable').forEach(th => {
            th.addEventListener('click', () => {
                const column = th.dataset.sort;
                this.sortHosts(column);
            });
        });

        // 每页条数
        const pageSizeSelect = document.getElementById('pageSizeSelect');
        if (pageSizeSelect) {
            pageSizeSelect.addEventListener('change', (e) => {
                this.pageSize = parseInt(e.target.value, 10) || 20;
                this.currentPage = 1;
                this.onPageChange();
            });
        }
    }

    // ══════════════════════════════════════
    //  设置与 API
    // ══════════════════════════════════════

    async getSettings() {
        return new Promise((resolve, reject) => {
            chrome.storage.sync.get(['apiUrl', 'apiToken', 'refreshInterval', 'zabbixVersion'], (result) => {
                if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
                else resolve(result);
            });
        });
    }

    async getApi() {
        const settings = await this.getSettings();
        if (!settings.apiUrl || !settings.apiToken) {
            window.settingsManager?.showDialog();
            return null;
        }
        if (!this._api || this._api.url !== settings.apiUrl) {
            this._api = new ZabbixAPI(settings.apiUrl, atob(settings.apiToken), settings.zabbixVersion);
        }
        return this._api;
    }

    getGroupKey(api) {
        const major = api.getMajorVersion ? api.getMajorVersion() : null;
        return (major && major >= 7) ? 'selectHostGroups' : 'selectGroups';
    }

    // ══════════════════════════════════════
    //  主数据加载流程（分页架构）
    // ══════════════════════════════════════

    async loadData() {
        try {
            const api = await this.getApi();
            if (!api) return;

            // 确保版本检测完成
            if (!api.zabbixVersion && api.detectVersion) {
                try { await api.detectVersion(); } catch (e) {
                    console.warn('Failed to detect Zabbix version:', e);
                }
            }

            this.showTableLoading();

            const searchTerm = (document.getElementById('searchInput')?.value || '').trim();
            const groupId = document.getElementById('groupFilter')?.value || '';
            const interfaceType = document.getElementById('interfaceFilter')?.value || '';

            // 步骤1: 轻量查询获取所有匹配的 hostid（只返回 hostid，不查监控项）
            this.allHostIds = await this.getFilteredHostIds(api, searchTerm, groupId, interfaceType);
            this.totalCount = this.allHostIds.length;
            this.totalPages = Math.max(1, Math.ceil(this.totalCount / this.pageSize));
            if (this.currentPage > this.totalPages) this.currentPage = this.totalPages;

            // 步骤2: 并行加载 —— 主机分组 + 当前页完整数据 + 全局统计
            const offset = (this.currentPage - 1) * this.pageSize;
            const pageHostIds = this.allHostIds.slice(offset, offset + this.pageSize);

            const [hostGroups, pageHosts, globalStats] = await Promise.all([
                api.getHostGroups(),
                pageHostIds.length > 0 ? this.getPageHostsWithItems(api, pageHostIds) : [],
                this.computeGlobalStats(api, this.allHostIds)
            ]);

            this.hostGroups = hostGroups;
            this.pageHosts = pageHosts;
            this.globalStats = globalStats;

            // 更新下拉并保持选中
            this.updateGroupFilter(groupId);
            const groupFilterEl = document.getElementById('groupFilter');
            if (groupFilterEl && groupId) groupFilterEl.value = groupId;
            const interfaceFilterEl = document.getElementById('interfaceFilter');
            if (interfaceFilterEl && interfaceType) interfaceFilterEl.value = interfaceType;

            this.updateStats();
            this.renderTable();
            this.renderPagination();
            this.updateLastRefreshTime();

        } catch (error) {
            console.error('加载CMDB数据失败:', error);
            this.showError();
        }
    }

    // ══════════════════════════════════════
    //  步骤1: 轻量 hostid 查询
    //  只查 hostid，支持名称 + IP 搜索
    // ══════════════════════════════════════

    async getFilteredHostIds(api, search, groupId, interfaceType) {
        const interfaceTypeMap = { 'agent': '1', 'snmp': '2', 'ipmi': '3', 'jmx': '4' };

        const baseParams = {
            output: ['hostid'],
            sortfield: 'name',
            sortorder: 'ASC',
        };

        if (groupId) baseParams.groupids = [groupId];

        // 如果有接口类型筛选，需要获取接口信息用于客户端过滤
        if (interfaceType && interfaceTypeMap[interfaceType]) {
            baseParams.selectInterfaces = ['type'];
        }

        const allHostIds = new Map(); // hostid -> host object

        if (search) {
            // 并行: 名称搜索 + IP搜索
            try {
                const nameParams = Object.assign({}, baseParams, {
                    search: { host: search, name: search },
                    searchByAny: true,
                    searchWildcardsEnabled: true,
                });
                const nameHosts = await api.request('host.get', nameParams);
                nameHosts.forEach(h => allHostIds.set(h.hostid, h));
            } catch (e) {
                console.error('CMDB: Name search failed:', e);
            }

            try {
                const ipInterfaces = await api.request('hostinterface.get', {
                    output: ['hostid'],
                    search: { ip: search },
                    searchWildcardsEnabled: true,
                });
                const ipHostIdSet = new Set(ipInterfaces.map(i => i.hostid));
                const newIpHostIds = [...ipHostIdSet].filter(id => !allHostIds.has(id));
                if (newIpHostIds.length > 0) {
                    const ipParams = Object.assign({}, baseParams, { hostids: newIpHostIds });
                    const ipHosts = await api.request('host.get', ipParams);
                    ipHosts.forEach(h => allHostIds.set(h.hostid, h));
                }
            } catch (e) {
                console.error('CMDB: IP search failed:', e);
            }
        } else {
            // 无搜索词，获取所有主机
            try {
                const hosts = await api.request('host.get', baseParams);
                hosts.forEach(h => allHostIds.set(h.hostid, h));
            } catch (e) {
                console.error('CMDB: Host fetch failed:', e);
            }
        }

        // 接口类型过滤
        let result = [];
        if (interfaceType && interfaceTypeMap[interfaceType]) {
            const targetType = interfaceTypeMap[interfaceType];
            for (const [hostid, host] of allHostIds) {
                const interfaces = host.interfaces || [];
                if (interfaces.some(iface => iface.type === targetType)) {
                    result.push(hostid);
                }
            }
        } else {
            result = [...allHostIds.keys()];
        }

        return result;
    }

    // ══════════════════════════════════════
    //  步骤2: 当前页主机完整信息 + 监控项
    //  只为当前页的主机查询完整数据
    // ══════════════════════════════════════

    async getPageHostsWithItems(api, hostIds) {
        const groupKey = this.getGroupKey(api);

        // 获取主机详情
        const hostParams = {
            output: ['hostid', 'host', 'name', 'status'],
            selectInterfaces: ['interfaceid', 'ip', 'dns', 'port', 'type', 'main', 'available'],
            selectInventory: ['os', 'os_full', 'hardware', 'software', 'type'],
            hostids: hostIds,
            preservekeys: false,
        };
        hostParams[groupKey] = ['groupid', 'name'];
        let hosts = await api.request('host.get', hostParams);

        // 兼容 Zabbix 5.x / 7.x 的分组字段
        if (Array.isArray(hosts)) {
            hosts.forEach(h => { if (!h.groups && h.hostgroups) h.groups = h.hostgroups; });
        }

        // 批量获取监控项
        const itemsData = await this.batchGetHostItems(api, hostIds);

        // 组装数据
        return hosts.map(host => {
            const items = itemsData[host.hostid] || {};
            const interfaces = host.interfaces || [];
            const mainInterface = interfaces.find(iface => iface.main === '1') || interfaces[0];
            const interfaceTypes = this.getInterfaceTypes(interfaces);

            // 操作系统 + 架构
            const osValue = (items.operating_system && items.operating_system.value)
                || (items.kernel_version && items.kernel_version.value)
                || '';
            const arch = this.parseArchitecture(osValue);

            // CPU 使用率（注意 idle 反转）
            let cpuUsageVal = 0;
            let cpuUsageDisplay = '-';
            if (items.cpu_usage && items.cpu_usage.value) {
                cpuUsageVal = parseFloat(items.cpu_usage.value);
                if (items.cpu_usage.key === 'system.cpu.util[,idle]') {
                    cpuUsageVal = 100 - cpuUsageVal;
                }
                cpuUsageDisplay = cpuUsageVal.toFixed(2) + '%';
            }

            // 内存使用率（注意 pavailable 反转）
            let memUsageVal = 0;
            let memUsageDisplay = '-';
            if (items.memory_usage && items.memory_usage.value) {
                memUsageVal = parseFloat(items.memory_usage.value);
                if (items.memory_usage.key === 'vm.memory.size[pavailable]') {
                    memUsageVal = 100 - memUsageVal;
                }
                memUsageDisplay = memUsageVal.toFixed(2) + '%';
            }

            const cpuCoresRaw = items.cpu_count && items.cpu_count.value;
            const memTotalRaw = items.memory_total && items.memory_total.value;

            return {
                hostid: host.hostid,
                name: host.name || host.host,
                hostname: (items.system_name && items.system_name.value) || host.host || '-',
                ip: mainInterface ? (mainInterface.ip || '-') : '-',
                os: (items.operating_system && items.operating_system.value) || (items.kernel_version && items.kernel_version.value) || '-',
                arch: arch,
                cpuCores: cpuCoresRaw ? parseInt(cpuCoresRaw) : 0,
                cpuCoresDisplay: cpuCoresRaw ? (cpuCoresRaw + ' cores') : '-',
                memoryTotal: memTotalRaw ? parseInt(memTotalRaw) : 0,
                memoryTotalDisplay: memTotalRaw ? this.formatMemorySize(memTotalRaw) : '-',
                cpu: cpuUsageVal,
                cpuDisplay: cpuUsageDisplay,
                memory: memUsageVal,
                memoryDisplay: memUsageDisplay,
                groups: host.groups || [],
                interfaces: interfaces,
                interfaceTypes: interfaceTypes,
                agentVersion: (items.agent_version && items.agent_version.value) || '-',
                status: host.status === '0' ? 'enabled' : 'disabled',
                available: mainInterface ? (mainInterface.available === '1') : false,
            };
        });
    }

    // ══════════════════════════════════════
    //  三阶段批量监控项获取（参考 ItemFinder）
    //  Phase 1: filter.key_ 精确匹配（单次 API 调用，覆盖 ~90% 场景）
    //  Phase 2: search 模糊兜底（仅对缺失的 host/category 补查）
    // ══════════════════════════════════════

    async batchGetHostItems(api, hostIds) {
        if (!hostIds || hostIds.length === 0) return {};

        // 分类 key 列表（按优先级排序，越靠前越优先）
        const categoryKeys = {
            cpu_count: [
                'system.cpu.num',
                'system.hw.cpu.num',
                'cpu.core.num',
                'vmware.hv.hw.cpu.num',
                'vmware.vm.cpu.num',
            ],
            cpu_usage: [
                'system.cpu.util[,avg1]',
                'system.cpu.util[]',
                'system.cpu.util',
                'system.cpu.util[,idle]',
                'system.cpu.load[avg1]',
                'sfSysCpuCostRate',
                'dev.cpu.usage',
            ],
            memory_total: [
                'vm.memory.size[total]',
                'vm.memory.total',
                'dell.server.memory.size.total',
                'nomad.client.memory.total',
                'docker.mem.total',
                'vm.memory.walk.data.total',
            ],
            memory_usage: [
                'vm.memory.util[]',
                'vm.memory.util',
                'vm.memory.utilization',
                'vm.memory.pused',
                'vm.memory.size[pavailable]',
                'dev.mem.usage',
            ],
            kernel_version: [
                'system.uname',
                'system.sw.os[uname]',
            ],
            system_name: [
                'system.hostname',
                'system.name',
                'sysName',
                'system.sw.os[hostname]',
            ],
            operating_system: [
                'system.sw.os',
                'system.sw.os[name]',
                'docker.operating_system',
                'dell.server.sw.os',
                'sd_wan.device.os',
                'juniper.mx.system.sw.os',
                'sysDescr',
            ],
            os_architecture: [
                'system.sw.arch',
                'system.hw.arch',
            ],
            agent_version: [
                'agent.version',
            ],
        };

        // 初始化结果
        const result = {};
        hostIds.forEach(hid => {
            result[hid] = {};
            Object.keys(categoryKeys).forEach(cat => { result[hid][cat] = null; });
        });

        // 构建 key → category 映射（带优先级）
        const keyIndex = {};
        const allKeys = [];
        for (const [category, keys] of Object.entries(categoryKeys)) {
            keys.forEach((key, priority) => {
                if (!keyIndex[key]) {
                    keyIndex[key] = { category, priority };
                    allKeys.push(key);
                }
            });
        }

        // ── Phase 1: 精确匹配 ──
        const currentPriority = {}; // "hostid:category" → priority

        try {
            const items = await api.request('item.get', {
                output: ['itemid', 'hostid', 'key_', 'lastvalue', 'value_type'],
                hostids: hostIds,
                filter: {
                    key_: allKeys,
                    status: 0,
                },
                preservekeys: false,
            });

            for (const item of items) {
                const hostid = item.hostid;
                const key = item.key_;
                if (!result[hostid] || !keyIndex[key]) continue;

                const info = keyIndex[key];
                const category = info.category;
                const priority = info.priority;
                const prioKey = hostid + ':' + category;
                const hasValue = item.lastvalue != null && item.lastvalue !== '';

                if (hasValue) {
                    // 有值：按优先级替换
                    if (currentPriority[prioKey] === undefined || priority < currentPriority[prioKey]) {
                        result[hostid][category] = {
                            value: item.lastvalue,
                            key: key,
                            value_type: item.value_type,
                        };
                        currentPriority[prioKey] = priority;
                    }
                } else {
                    // 无值：仅当该 category 还没有值时记录（低优先级占位）
                    if (currentPriority[prioKey] === undefined) {
                        result[hostid][category] = {
                            value: '',
                            key: key,
                            value_type: item.value_type,
                        };
                        currentPriority[prioKey] = priority + 10000;
                    }
                }
            }
        } catch (e) {
            console.error('CMDB batchGetHostItems phase1 error:', e);
        }

        // ── Phase 2: 搜索模糊兜底 ──
        const searchPatterns = {
            cpu_count: [
                { search: { name: 'Number of CPUs' }, searchWildcardsEnabled: true },
                { search: { name: 'Number of cores' }, searchWildcardsEnabled: true },
                { search: { name: 'CPU cores' }, searchWildcardsEnabled: true },
            ],
            cpu_usage: [
                { search: { key_: 'cpu.util' }, searchWildcardsEnabled: true },
                { search: { key_: 'cpu.load' }, searchWildcardsEnabled: true },
                { search: { name: 'CPU utilization' }, searchWildcardsEnabled: true },
                { search: { name: 'CPU usage' }, searchWildcardsEnabled: true },
                { search: { name: 'Processor load' }, searchWildcardsEnabled: true },
            ],
            memory_total: [
                { search: { key_: 'vm.memory.size' }, searchWildcardsEnabled: true },
                { search: { name: 'Total memory' }, searchWildcardsEnabled: true },
                { search: { name: 'Memory total' }, searchWildcardsEnabled: true },
            ],
            memory_usage: [
                { search: { key_: 'memory.util' }, searchWildcardsEnabled: true },
                { search: { key_: 'memory.pused' }, searchWildcardsEnabled: true },
                { search: { name: 'Memory utilization' }, searchWildcardsEnabled: true },
                { search: { name: 'Memory usage' }, searchWildcardsEnabled: true },
            ],
            kernel_version: [
                { search: { key_: 'system.uname' }, searchWildcardsEnabled: true },
                { search: { name: 'Kernel version' }, searchWildcardsEnabled: true },
            ],
            system_name: [
                { search: { key_: 'hostname' }, searchWildcardsEnabled: true },
                { search: { name: 'System name' }, searchWildcardsEnabled: true },
                { search: { name: 'Hostname' }, searchWildcardsEnabled: true },
            ],
            operating_system: [
                { search: { key_: 'system.sw.os' }, searchWildcardsEnabled: true },
                { search: { name: 'Operating system' }, searchWildcardsEnabled: true },
                { search: { name: 'System description' }, searchWildcardsEnabled: true },
            ],
            os_architecture: [
                { search: { key_: '.arch' }, searchWildcardsEnabled: true },
                { search: { name: 'System architecture' }, searchWildcardsEnabled: true },
            ],
            agent_version: [
                { search: { name: 'Version of Zabbix agent' }, searchWildcardsEnabled: true },
            ],
        };

        // 对于 Phase 1 中未命中的 host+category，逐个 pattern 补查
        for (const [category, patterns] of Object.entries(searchPatterns)) {
            let missingHostIds = hostIds.filter(hid => result[hid][category] === null);
            if (missingHostIds.length === 0) continue;

            for (const pattern of patterns) {
                if (missingHostIds.length === 0) break;
                try {
                    const searchParams = Object.assign({
                        output: ['itemid', 'hostid', 'key_', 'lastvalue', 'value_type'],
                        hostids: missingHostIds,
                        filter: { status: 0 },
                    }, pattern);

                    const foundItems = await api.request('item.get', searchParams);

                    for (const item of foundItems) {
                        const hostid = item.hostid;
                        if (result[hostid] && result[hostid][category] === null) {
                            result[hostid][category] = {
                                value: item.lastvalue || '',
                                key: item.key_,
                                value_type: item.value_type,
                            };
                        }
                    }

                    missingHostIds = missingHostIds.filter(hid => result[hid][category] === null);
                } catch (e) {
                    console.error(`CMDB batchGetHostItems phase2 (${category}):`, e);
                }
            }
        }

        return result;
    }

    // ══════════════════════════════════════
    //  全局统计（独立计算，不需要当前页数据）
    // ══════════════════════════════════════

    async computeGlobalStats(api, allHostIds) {
        const stats = { totalCPU: 0, totalMemory: 0, activeHosts: 0 };
        if (!allHostIds || allHostIds.length === 0) return stats;

        try {
            const [itemsResult, hostsResult] = await Promise.all([
                // CPU 核数 + 内存总量
                api.request('item.get', {
                    output: ['hostid', 'key_', 'lastvalue'],
                    hostids: allHostIds,
                    filter: {
                        key_: ['system.cpu.num', 'vm.memory.size[total]'],
                        status: 0,
                    },
                }).catch(e => { console.error('CMDB: Global CPU/Memory stats failed:', e); return []; }),
                // 在线主机数
                api.request('host.get', {
                    output: ['hostid', 'status', 'maintenance_status'],
                    selectInterfaces: ['type', 'main', 'available'],
                    hostids: allHostIds,
                }).catch(e => { console.error('CMDB: Global active hosts failed:', e); return []; }),
            ]);

            // 汇总 CPU 和内存
            const cpuByHost = {};
            const memByHost = {};
            for (const item of itemsResult) {
                const hid = item.hostid;
                const val = item.lastvalue;
                if (!val || val === '') continue;
                if (item.key_ === 'system.cpu.num' && !cpuByHost[hid]) {
                    cpuByHost[hid] = parseInt(val) || 0;
                } else if (item.key_ === 'vm.memory.size[total]' && !memByHost[hid]) {
                    memByHost[hid] = parseInt(val) || 0;
                }
            }
            stats.totalCPU = Object.values(cpuByHost).reduce((s, v) => s + v, 0);
            stats.totalMemory = Object.values(memByHost).reduce((s, v) => s + v, 0);

            // 统计活跃主机
            for (const host of hostsResult) {
                if (host.status === '1') continue; // disabled
                if (host.maintenance_status === '1') continue;
                const interfaces = host.interfaces || [];
                const mainIface = interfaces.find(i => i.main === '1') || interfaces[0];
                if (mainIface && mainIface.available === '1') {
                    stats.activeHosts++;
                }
            }
        } catch (e) {
            console.error('CMDB: computeGlobalStats failed:', e);
        }

        return stats;
    }

    // ══════════════════════════════════════
    //  分页切换（只重新加载当前页数据）
    // ══════════════════════════════════════

    async onPageChange() {
        try {
            const api = await this.getApi();
            if (!api) return;

            this.totalPages = Math.max(1, Math.ceil(this.totalCount / this.pageSize));
            if (this.currentPage > this.totalPages) this.currentPage = this.totalPages;
            if (this.currentPage < 1) this.currentPage = 1;

            const offset = (this.currentPage - 1) * this.pageSize;
            const pageHostIds = this.allHostIds.slice(offset, offset + this.pageSize);

            this.showTableLoading();
            this.pageHosts = pageHostIds.length > 0 ? await this.getPageHostsWithItems(api, pageHostIds) : [];

            this.renderTable();
            this.renderPagination();
        } catch (e) {
            console.error('分页切换失败:', e);
            this.showError();
        }
    }

    goToPage(page) {
        if (page < 1 || page > this.totalPages || page === this.currentPage) return;
        this.currentPage = page;
        this.onPageChange();
    }

    // ══════════════════════════════════════
    //  排序（当前页内排序）
    // ══════════════════════════════════════

    sortHosts(column) {
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
            if (icon) icon.className = 'fas fa-sort sort-icon';
        });
        const currentTh = document.querySelector(`th[data-sort="${column}"]`);
        if (currentTh) {
            currentTh.classList.add('sorted');
            const icon = currentTh.querySelector('.sort-icon');
            if (icon) icon.className = `fas fa-sort-${this.currentSort.direction === 'asc' ? 'up' : 'down'} sort-icon`;
        }

        this.pageHosts.sort((a, b) => {
            let valA = a[column];
            let valB = b[column];
            if (typeof valA === 'number' && typeof valB === 'number') {
                return this.currentSort.direction === 'asc' ? valA - valB : valB - valA;
            }
            valA = String(valA || '');
            valB = String(valB || '');
            return this.currentSort.direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        });

        this.renderTable();
    }

    // ══════════════════════════════════════
    //  UI 渲染
    // ══════════════════════════════════════

    updateStats() {
        document.getElementById('totalCPU').textContent = this.globalStats.totalCPU || 0;
        document.getElementById('totalMemory').textContent = this.formatMemorySize(this.globalStats.totalMemory || 0);
        document.getElementById('totalHosts').textContent = this.totalCount;

        const uniqueGroups = new Set();
        if (Array.isArray(this.hostGroups)) {
            this.hostGroups.forEach(g => {
                if (g && g.groupid) uniqueGroups.add(g.groupid);
            });
        }
        document.getElementById('totalGroups').textContent = uniqueGroups.size;
        document.getElementById('enabledHosts').textContent = this.globalStats.activeHosts || 0;
    }

    updateGroupFilter(selectedGroupId) {
        selectedGroupId = selectedGroupId || '';
        const select = document.getElementById('groupFilter');
        const currentVal = selectedGroupId || select.value;
        select.innerHTML = '<option value="" data-i18n="cmdb.allGroups">' + safeTranslate('cmdb.allGroups', '所有分组', 'All Groups') + '</option>';
        this.hostGroups.forEach(group => {
            const option = document.createElement('option');
            option.value = group.groupid;
            option.textContent = group.name;
            select.appendChild(option);
        });
        if (currentVal) select.value = currentVal;
    }

    renderTable() {
        const tbody = document.getElementById('hostsList');

        if (this.pageHosts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="13"><div class="empty-state"><i class="fas fa-server"></i><p>' + safeTranslate('cmdb.noHostsFound', '未找到主机', 'No hosts found') + '</p></div></td></tr>';
            return;
        }

        const rows = [];
        const startIndex = (this.currentPage - 1) * this.pageSize;
        for (let idx = 0; idx < this.pageHosts.length; idx++) {
            const host = this.pageHosts[idx];
            const rowNum = startIndex + idx + 1;
            const ifaceTitle = (host.interfaceTypes || []).map(t =>
                safeTranslate('cmdbInterfaceNames.' + t, t.toUpperCase(), t.toUpperCase())
            ).join(', ') || '-';
            const groupTitle = (host.groups || []).map(g => g.name).join(', ') || '-';

            rows.push(
                '<tr>'
                + '<td style="text-align:center;color:var(--gray-500);">' + rowNum + '</td>'
                + '<td title="' + this.escapeHtml(host.name) + '">'
                +   '<span class="availability-indicator">'
                +     '<span class="availability-dot ' + (host.available ? 'available' : 'unavailable') + '"></span>'
                +     '<span class="host-name-link" data-hostid="' + host.hostid + '">' + this.escapeHtml(host.name) + '</span>'
                +   '</span>'
                + '</td>'
                + '<td title="' + this.escapeHtml(host.hostname) + '">' + this.escapeHtml(host.hostname) + '</td>'
                + '<td title="' + this.escapeHtml(host.ip) + '">' + this.escapeHtml(host.ip) + '</td>'
                + '<td title="' + this.escapeHtml(host.arch) + '"><span class="arch-tag">' + this.escapeHtml(host.arch) + '</span></td>'
                + '<td title="' + this.escapeHtml(ifaceTitle) + '">' + this.renderInterfaceTags(host.interfaceTypes) + '</td>'
                + '<td title="' + this.escapeHtml(host.agentVersion) + '">' + this.escapeHtml(host.agentVersion) + '</td>'
                + '<td title="' + this.escapeHtml(host.cpuCoresDisplay) + '">' + this.escapeHtml(host.cpuCoresDisplay) + '</td>'
                + '<td title="' + this.escapeHtml(host.cpuDisplay) + '">' + this.renderUsageBar(host.cpu, host.cpuDisplay) + '</td>'
                + '<td title="' + this.escapeHtml(host.memoryTotalDisplay) + '">' + this.escapeHtml(host.memoryTotalDisplay) + '</td>'
                + '<td title="' + this.escapeHtml(host.memoryDisplay) + '">' + this.renderUsageBar(host.memory, host.memoryDisplay) + '</td>'
                + '<td title="' + this.escapeHtml(host.os) + '">' + this.truncateText(host.os, 30) + '</td>'
                + '<td title="' + this.escapeHtml(groupTitle) + '">' + this.renderGroupTags(host.groups) + '</td>'
                + '</tr>'
            );
        }
        tbody.innerHTML = rows.join('');
    }

    renderPagination() {
        const containers = [
            document.getElementById('paginationTop'),
            document.getElementById('paginationBottom'),
        ].filter(Boolean);
        if (containers.length === 0) return;

        // 构建 HTML
        let html = '';

        // 页面大小下拉框 HTML
        const pageSizeOptions = [20, 50, 100, 200];
        const pageSizeHtml = '<div class="page-size-wrapper">'
            + '<span>' + safeTranslate('cmdb.perPage', '每页', 'Per page') + '</span>'
            + '<select class="page-size-select">'
            + pageSizeOptions.map(s => '<option value="' + s + '"' + (s === this.pageSize ? ' selected' : '') + '>' + s + '</option>').join('')
            + '</select>'
            + '<span>' + safeTranslate('cmdb.records', '条', 'records') + '</span>'
            + '</div>';

        if (this.totalPages <= 1 && this.totalCount <= this.pageSize) {
            html = '<div class="pagination-wrapper">'
                + '<div class="pagination-info">'
                + safeTranslate('cmdb.totalRecords', '共 {count} 条', 'Total {count} records').replace('{count}', this.totalCount)
                + '</div>'
                + pageSizeHtml
                + '</div>';
            containers.forEach(c => {
                c.innerHTML = html;
                this._bindPageSizeEvent(c);
            });
            return;
        }

        const prevDisabled = this.currentPage <= 1 ? ' disabled' : '';
        const nextDisabled = this.currentPage >= this.totalPages ? ' disabled' : '';

        // 页码按钮（智能省略号，使用 data-page 属性代替 inline onclick）
        let pageButtons = '';
        const maxVisible = 7;
        let startPage = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
        let endPage = Math.min(this.totalPages, startPage + maxVisible - 1);
        if (endPage - startPage < maxVisible - 1) {
            startPage = Math.max(1, endPage - maxVisible + 1);
        }

        if (startPage > 1) {
            pageButtons += '<button class="pagination-btn" data-page="1">1</button>';
            if (startPage > 2) pageButtons += '<span class="pagination-ellipsis">...</span>';
        }

        for (let i = startPage; i <= endPage; i++) {
            const active = i === this.currentPage ? ' active' : '';
            pageButtons += '<button class="pagination-btn' + active + '" data-page="' + i + '">' + i + '</button>';
        }

        if (endPage < this.totalPages) {
            if (endPage < this.totalPages - 1) pageButtons += '<span class="pagination-ellipsis">...</span>';
            pageButtons += '<button class="pagination-btn" data-page="' + this.totalPages + '">' + this.totalPages + '</button>';
        }

        const from = (this.currentPage - 1) * this.pageSize + 1;
        const to = Math.min(this.currentPage * this.pageSize, this.totalCount);

        html = '<div class="pagination-wrapper">'
            + '<div class="pagination-info">'
            + safeTranslate('cmdb.showingRange', '显示 {from}-{to} 条，共 {total} 条', 'Showing {from}-{to} of {total}').replace('{from}', from).replace('{to}', to).replace('{total}', this.totalCount)
            + '</div>'
            + '<div class="pagination-controls">'
            + '<button class="pagination-btn" data-page="prev"' + prevDisabled + '><i class="fas fa-chevron-left"></i></button>'
            + pageButtons
            + '<button class="pagination-btn" data-page="next"' + nextDisabled + '><i class="fas fa-chevron-right"></i></button>'
            + '</div>'
            + pageSizeHtml
            + '</div>';

        // 渲染到所有分页容器并绑定事件
        const self = this;
        containers.forEach(container => {
            container.innerHTML = html;
            container.querySelectorAll('.pagination-btn[data-page]').forEach(btn => {
                btn.addEventListener('click', function () {
                    if (this.disabled) return;
                    const pageAttr = this.getAttribute('data-page');
                    let page;
                    if (pageAttr === 'prev') {
                        page = self.currentPage - 1;
                    } else if (pageAttr === 'next') {
                        page = self.currentPage + 1;
                    } else {
                        page = parseInt(pageAttr, 10);
                    }
                    if (page) self.goToPage(page);
                });
            });
            self._bindPageSizeEvent(container);
        });
    }

    _bindPageSizeEvent(container) {
        const select = container.querySelector('.page-size-select');
        if (!select) return;
        select.addEventListener('change', (e) => {
            this.pageSize = parseInt(e.target.value, 10) || 50;
            this.currentPage = 1;
            this.onPageChange();
        });
    }

    showTableLoading() {
        const tbody = document.getElementById('hostsList');
        tbody.innerHTML = '<tr><td colspan="13"><div class="loading-overlay"><i class="fas fa-spinner"></i><span style="margin-left:8px;">'
            + safeTranslate('cmdb.loading', '正在加载...', 'Loading...')
            + '</span></div></td></tr>';
    }

    showError() {
        const tbody = document.getElementById('hostsList');
        tbody.innerHTML = '<tr><td colspan="13"><div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>'
            + safeTranslate('cmdb.loadError', '加载数据失败，请检查设置', 'Failed to load data, please check settings')
            + '</p></div></td></tr>';
    }

    // ══════════════════════════════════════
    //  工具方法
    // ══════════════════════════════════════

    getInterfaceTypes(interfaces) {
        const types = [];
        const typeMap = { '1': 'agent', '2': 'snmp', '3': 'ipmi', '4': 'jmx' };
        interfaces.forEach(iface => {
            const type = typeMap[iface.type];
            if (type && !types.includes(type)) types.push(type);
        });
        return types;
    }

    parseArchitecture(osInfo) {
        if (!osInfo || osInfo === '-') return '-';
        const lower = osInfo.toLowerCase();
        if (lower.includes('x86_64') || lower.includes('amd64') || lower.includes('x64')) return 'x86_64';
        if (lower.includes('x86') || lower.includes('i386') || lower.includes('i686')) return 'x86';
        if (lower.includes('arm64') || lower.includes('aarch64')) return 'ARM64';
        if (lower.includes('arm')) return 'ARM';
        return '-';
    }

    formatMemorySize(bytes) {
        if (bytes === 0 || bytes === '0') return '0';
        if (!bytes) return '-';
        const gb = parseFloat(bytes) / (1024 * 1024 * 1024);
        if (gb >= 1) return gb.toFixed(2) + ' GB';
        const mb = parseFloat(bytes) / (1024 * 1024);
        return mb.toFixed(2) + ' MB';
    }

    renderInterfaceTags(types) {
        if (!types || types.length === 0) return '-';
        return types.map(type => {
            const label = safeTranslate('cmdbInterfaceNames.' + type, type.toUpperCase(), type.toUpperCase());
            return '<span class="interface-tag ' + type + '">' + label + '</span>';
        }).join('');
    }

    renderGroupTags(groups) {
        if (!groups || groups.length === 0) return '-';
        const display = groups.slice(0, 2);
        const remaining = groups.length - 2;
        let html = display.map(g => '<span class="group-tag">' + this.escapeHtml(g.name) + '</span>').join('');
        if (remaining > 0) html += '<span class="group-tag">+' + remaining + '</span>';
        return html;
    }

    renderUsageBar(value, displayValue) {
        if (!value || displayValue === '-') return '-';
        let colorClass = 'low';
        if (value >= 80) colorClass = 'high';
        else if (value >= 60) colorClass = 'medium';
        return '<div class="usage-bar-container">'
            + '<div class="usage-bar"><div class="usage-bar-fill ' + colorClass + '" style="width: ' + Math.min(value, 100) + '%"></div></div>'
            + '<span class="usage-value">' + displayValue + '</span>'
            + '</div>';
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

    updateLastRefreshTime() {
        const el = document.getElementById('lastRefreshTime');
        if (!el) return;
        try {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
            let template = (typeof i18n !== 'undefined' && i18n.t) ? i18n.t('settings.messages.lastRefresh') : null;
            if (!template || template.indexOf('{time}') === -1) {
                template = (typeof i18n !== 'undefined' && i18n.t) ? i18n.t('messages.lastRefreshTime') : null;
            }
            if (!template || template.indexOf('{time}') === -1) template = '最后刷新时间: {time}';
            el.textContent = template.replace('{time}', timeStr);
        } catch (e) { console.warn('设置最后刷新时间失败', e); }
    }

    // ══════════════════════════════════════
    //  自动刷新
    // ══════════════════════════════════════

    async startAutoRefresh() {
        try {
            this.stopAutoRefresh();
            const settings = await this.getSettings();
            const interval = Math.max(1000, parseInt(settings.refreshInterval, 10) || 300000);
            this.refreshTimer = setInterval(async () => {
                try { await this.loadData(); } catch (e) { console.warn('自动刷新失败', e); }
            }, interval);
        } catch (e) { console.warn('启动自动刷新失败', e); }
    }

    stopAutoRefresh() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
    }

    onStorageChange(changes, area) {
        if (area !== 'sync') return;
        if (changes.refreshInterval) this.startAutoRefresh();
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    window._cmdbPage = new CMDBPage();
});
