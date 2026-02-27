// 安全翻译工具函数
function safeTranslate(key, zhFallback = '', enFallback = '') {
    try {
        if (typeof i18n !== 'undefined' && i18n.t) {
            const translation = i18n.t(key);
            if (translation && translation !== key) {
                return translation;
            }
        }
        
        // 如果翻译失败，根据当前语言返回合适的fallback
        const currentLang = (typeof i18n !== 'undefined' && i18n.currentLang) ? i18n.currentLang : 'zh';
        return currentLang === 'en' ? (enFallback || zhFallback) : zhFallback;
    } catch (e) {
        console.warn(`Translation failed for key: ${key}`, e);
        const currentLang = (typeof i18n !== 'undefined' && i18n.currentLang) ? i18n.currentLang : 'zh';
        return currentLang === 'en' ? (enFallback || zhFallback) : zhFallback;
    }
}

/**
 * Zabbix API客户端类
 * 兼容 Zabbix 6.0、7.0 和 7.4+
 * - Zabbix 6.x: 使用请求体中的 auth 字段传递 API Token
 * - Zabbix 7.0+: 使用 HTTP Header Authorization: Bearer <token>
 * @see https://www.zabbix.com/documentation/6.0/zh/manual/api
 * @see https://www.zabbix.com/documentation/7.0/en/manual/api
 */
class ZabbixAPI {
    constructor(url, token, zabbixVersion = null) {
        this.url = url;
        this.token = token;
        this.requestId = 1;
        // 存储 Zabbix 版本，用于决定认证方式
        // null 表示未知，需要在首次请求时检测
        this.zabbixVersion = zabbixVersion;
    }

    /**
     * 获取主版本号（如 6、7）
     * @returns {number|null}
     */
    getMajorVersion() {
        if (!this.zabbixVersion) return null;
        const match = this.zabbixVersion.match(/^(\d+)/);
        return match ? parseInt(match[1], 10) : null;
    }

    /**
     * 判断是否需要使用旧版认证方式（auth 在请求体中）
     * Zabbix 6.x 使用请求体 auth 字段
     * Zabbix 7.0+ 使用 Authorization header
     * @returns {boolean}
     */
    useLegacyAuth() {
        const major = this.getMajorVersion();
        // 如果版本未知，先尝试新版认证方式（7.0+）
        if (major === null) return false;
        return major < 7;
    }

    /**
     * 检测并获取 Zabbix 版本
     * @returns {Promise<string>} 版本号字符串
     */
    async detectVersion() {
        if (this.zabbixVersion) return this.zabbixVersion;
        
        // apiinfo.version 不需要认证
        const body = {
            jsonrpc: '2.0',
            method: 'apiinfo.version',
            params: {},
            id: this.requestId++
        };

        const response = await fetch(this.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (data.error) {
            throw new Error(data.error.data || data.error.message || 'API error');
        }

        this.zabbixVersion = data.result;
        return this.zabbixVersion;
    }

    async request(method, params = {}) {
        // 如果版本未知且不是获取版本的请求，先检测版本
        if (!this.zabbixVersion && method !== 'apiinfo.version') {
            try {
                await this.detectVersion();
            } catch (e) {
                console.warn('Failed to detect Zabbix version, using default auth method:', e);
            }
        }

        // 构建请求体
        const body = {
            jsonrpc: '2.0',
            method: method,
            params: params,
            id: this.requestId++
        };

        // 构建请求头
        const headers = {
            'Content-Type': 'application/json',
        };

        // 根据版本选择认证方式
        if (method !== 'apiinfo.version' && this.token) {
            if (this.useLegacyAuth()) {
                // Zabbix 6.x: 使用请求体中的 auth 字段
                body.auth = this.token;
            } else {
                // Zabbix 7.0+: 使用 Authorization header
                headers['Authorization'] = `Bearer ${this.token}`;
            }
        }

        try {
            // console.log(`Sending request to ${method}:`, body);  // 添加日志
            const response = await fetch(this.url, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            // console.log(`Response from ${method}:`, data);  // 添加日志
            
            if (data.error) {
                console.error('API Error:', JSON.stringify(data.error, null, 2));  // 格式化错误输出
                throw new Error(data.error.data || data.error.message || 'API error');
            }

            return data.result;
        } catch (error) {
            console.error('Request Error:', error);
            throw error;
        }
    }

    /**
     * 测试连接并返回版本信息
     * @returns {Promise<{success: boolean, version: string}>}
     */
    async testConnection() {
        try {
            // 先检测 API 版本（不需要认证）
            const version = await this.detectVersion();
            console.log('Zabbix API version:', version, '| Major:', this.getMajorVersion(), '| Legacy auth:', this.useLegacyAuth());

            // 再测试认证
            const hosts = await this.request('host.get', {
                countOutput: true,
                limit: 1
            });
            // console.log('Connection test successful');
            return { success: true, version: version };
        } catch (error) {
            console.error('Connection test failed:', error);
            throw new Error('连接失败：' + error.message);
        }
    }

    /**
     * 静态工厂方法：从 chrome.storage 加载设置并创建 ZabbixAPI 实例
     * 会自动加载已存储的 Zabbix 版本以选择正确的认证方式
     * @returns {Promise<ZabbixAPI>}
     */
    static async createFromStorage() {
        return new Promise((resolve, reject) => {
            chrome.storage.sync.get(['apiUrl', 'apiToken', 'zabbixVersion'], (result) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                    return;
                }
                if (!result.apiUrl || !result.apiToken) {
                    reject(new Error('API URL or Token not configured'));
                    return;
                }
                const api = new ZabbixAPI(
                    result.apiUrl,
                    atob(result.apiToken),
                    result.zabbixVersion || null
                );
                resolve(api);
            });
        });
    }

    async getHosts() {
        try {
            // 先获取所需的监控项
            const items = await this.request('item.get', {
                output: ['itemid', 'hostid', 'name', 'key_', 'lastvalue'],
                search: {
                    name: [
                        'CPU utilization',            // CPU使用率
                        'Memory utilization',         // 内存使用率
                        'Number of CPUs',             // CPU核心数
                        'System name',                // 主机名称
                        'System description',         // 系统详情
                        'System uptime',              // 运行时间
                        'Total memory',               // 内存总量
                        'Free disk space',            // 磁盘空间
                        'Used disk space',            // 已用磁盘空间
                        'Disk space utilization'     // 磁盘使用率
                    ],
                    key_: [
                        'vm.memory.utilization',      // 内存使用率
                        'vm.memory.util',             // 内存使用率
                        'system.cpu.num',             // CPU核心数
                        "wmi.get[root/cimv2,'Select NumberOfLogicalProcessors from Win32_ComputerSystem']",  // Windows CPU 核心数
                        'system.name',                // 主机名称
                        'system.hostname',            // 主机名称
                        'system.uname',               // 系统详情
                        'system.sw.os',               // 系统详情
                        'system.uptime',              // 运行时间
                        'system.net.uptime',          // 运行时间
                        'system.descr[sysDescr.0]',    // 系统详情
                        'vm.memory.size[total]',      // 内存总量
                        'vfs.fs.size[/,pused]',       // Linux磁盘使用率
                        'vfs.fs.size[C:,pused]',      // Windows磁盘使用率
                        'vfs.fs.size[/,used]',        // Linux已用磁盘
                        'vfs.fs.size[C:,used]',       // Windows已用磁盘
                        'vfs.fs.size[/,free]',        // Linux可用磁盘
                        'vfs.fs.size[C:,free]',       // Windows可用磁盘
                        'system.disk.utilization'     // 系统磁盘使用率
                    ]
                },
                searchByAny: true,                    // 匹配任意关键字
                monitored: true,                      // 只获取已监控的项目
                webitems: false,                      // 排除 web 监控项
                filter_flags: {
                    not_supported: false              // 排除不支持的项目
                }
            });

            // 创建主机ID到监控项的映射
            const hostItemsMap = items.reduce((map, item) => {
                if (!map[item.hostid]) {
                    map[item.hostid] = [];
                }
                map[item.hostid].push(item);
                return map;
            }, {});

            // 获取主机基本信息
            const hostsResponse = await this.request('host.get', {
                output: ['hostid', 'host', 'name', 'status'],
                selectInterfaces: ['ip'],
                selectInventory: ['os'],
                selectTriggers: ['triggerid', 'description', 'priority', 'value'],
                filter: {
                    status: 0  // 只获取启用的主机
                }
            });

            return await Promise.all(hostsResponse.map(async host => {
                const items = hostItemsMap[host.hostid] || [];
                
                // 通过名称获取CPU监控项
                const cpuItem = items.find(item => item.name.includes('CPU utilization'));
                const memoryUtilItem = items.find(item => item.name.includes('Memory utilization')) ||
                                     items.find(item => item.key_ === 'vm.memory.utilization') ||
                                     items.find(item => item.key_.startsWith('vm.memory.util[')) ||
                                     items.find(item => item.key_ === 'vm.memory.util');

                const hostnameItem = items.find(item => item.name.includes('System name')) ||
                                   items.find(item => item.key_ === 'system.hostname') ||
                                   items.find(item => item.key_ === 'system.name');

                const osItem = items.find(item => item.name.includes('System description')) ||
                             items.find(item => item.key_ === 'system.uname') ||
                             items.find(item => item.key_ === 'system.sw.os') ||
                             items.find(item => item.key_ === 'system.descr[sysDescr.0]');

                const cpuCoresItem = items.find(item => item.name.includes('Number of CPUs')) ||
                                   items.find(item => item.key_ === 'system.cpu.num') ||
                                   items.find(item => item.key_ === "wmi.get[root/cimv2,'Select NumberOfLogicalProcessors from Win32_ComputerSystem']");

                const memoryTotalItem = items.find(item => item.name.includes('Total memory')) ||
                                      items.find(item => item.key_ === 'vm.memory.size[total]');
                
                // 计算内存使用率，优先使用直接的使用率值
                let memoryUsage = '-';
                if (memoryUtilItem?.lastvalue) {
                    memoryUsage = parseFloat(memoryUtilItem.lastvalue).toFixed(2);
                }
                
                const cpuCores = cpuCoresItem?.lastvalue || '-';
                const hostname = hostnameItem?.lastvalue || '-';

                // 获取活动的告警数量
                const activeProblems = (host.triggers || []).filter(trigger => 
                    trigger.value === '1'  // 1 表示问题状态
                ).length;

                // 添加运行时间监控项获取
                const uptimeItem = items.find(item => item.name.includes('System uptime')) ||
                                 items.find(item => item.key_ === 'system.uptime') ||
                                 items.find(item => item.key_.startsWith('system.net.uptime'));

                return {
                    hostid: host.hostid,
                    name: host.name || host.host,
                    hostname: hostname,
                    ip: host.interfaces?.[0]?.ip || '-',
                    os: osItem?.lastvalue || '-',  // 直接使用 System description 的值
                    cpuCores: cpuCores !== '-' ? `${cpuCores}` : '-',
                    memoryTotal: memoryTotalItem ? this.formatMemorySize(memoryTotalItem.lastvalue) : '-',
                    cpu: cpuItem?.lastvalue ? parseFloat(cpuItem.lastvalue).toFixed(2) : '-',
                    memory: memoryUsage,
                    alerts: activeProblems || 0,
                    uptime: uptimeItem ? this.calculateDuration(Math.floor(Date.now() / 1000) - parseInt(uptimeItem.lastvalue)) : '-'
                };
            }));
        } catch (error) {
            console.error('Failed to get hosts:', error);
            throw error;
        }
    }

    async getAlerts() {
        const params = {
            output: ['eventid', 'clock', 'name', 'severity'],
            recent: true,
            sortfield: 'eventid',
            sortorder: 'DESC',
            suppressed: false,
            severities: [1, 2, 3, 4, 5]
        };
        return await this.request('problem.get', params);
    }

    async getAlertTrend() {
        const now = Math.floor(Date.now() / 1000);
        const weekAgo = now - 7 * 24 * 60 * 60;

        const events = await this.request('event.get', {
            output: ['clock', 'severity', 'name'],
            time_from: weekAgo,
            source: 0,        // 触发器事件
            object: 0,        // 触发器对象
            value: 1,         // PROBLEM状态
            sortfield: 'clock',
            sortorder: 'ASC'
            // 移除 recent 和 acknowledged 参数，这样可以获取所有告警
        });

        // 按天分组
        const dailyProblems = events.reduce((acc, event) => {
            const date = new Date(event.clock * 1000).toISOString().split('T')[0];
            if (!acc[date]) {
                acc[date] = 0;
            }
            acc[date]++;
            return acc;
        }, {});

        // 确保有过去7天的数据
        const dates = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            dates.push(date);
            if (!dailyProblems[date]) {
                dailyProblems[date] = 0;
            }
        }

        // 转换为图表数据格式
        return dates.map(date => ({
            name: date,
            value: [date, dailyProblems[date]]
        }));
    }

    async getAlertSeverity() {
        const problems = await this.getAlerts();
        
        // 获取当前语言
        const currentLang = (typeof i18n !== 'undefined' && i18n.currentLang) ? i18n.currentLang : 'zh';
        
        // 多语言严重性名称映射
        const severityNames = {
            zh: {
                '0': '未分类',
                '1': '信息',
                '2': '警告',
                '3': '一般严重',
                '4': '严重',
                '5': '灾难'
            },
            en: {
                '0': 'Not classified',
                '1': 'Information',
                '2': 'Warning',
                '3': 'Average',
                '4': 'High',
                '5': 'Disaster'
            }
        };

        // 初始化所有严重级别的计数为0
        const severityCounts = Object.keys(severityNames[currentLang]).reduce((acc, severity) => {
            acc[severity] = 0;
            return acc;
        }, {});

        // 统计各严重级别的数量
        problems.forEach(problem => {
            severityCounts[problem.severity]++;
        });

        // 转换为图表数据格式
        return Object.entries(severityCounts)
            .map(([severity, count]) => ({
                name: severityNames[currentLang][severity],
                value: count
            }))
            .filter(item => item.value > 0);
    }

    async getAlertHistory() {
        const now = Math.floor(Date.now() / 1000);
        const weekAgo = now - 7 * 24 * 60 * 60;

        // 获取问题事件
        const eventParams = {
            output: ['eventid', 'clock', 'name', 'severity', 'value', 'r_eventid'],
            selectHosts: ['hostid', 'host', 'name'],
            source: 0,
            object: 0,
            time_from: weekAgo,
            sortfield: ['clock', 'eventid'],
            sortorder: 'DESC',
            value: 1,
            suppressed: false,
            severities: [1, 2, 3, 4, 5]
        };
        const problems = await this.request('event.get', eventParams);

        // 获取恢复事件（仅当有恢复事件ID时才请求）
        const recoveryIds = problems.map(p => p.r_eventid).filter(id => id !== '0');
        let recoveryMap = new Map();
        if (recoveryIds.length > 0) {
            const recoveryEvents = await this.request('event.get', {
                output: ['eventid', 'clock'],
                eventids: recoveryIds
            });
            recoveryMap = new Map(recoveryEvents.map(e => [e.eventid, e]));
        }

        // 为每个问题添加恢复状态和持续时间
        return problems.map(problem => {
            const recoveryEvent = recoveryMap.get(problem.r_eventid);
            const endTime = recoveryEvent ? parseInt(recoveryEvent.clock) : now;
            const duration = endTime - parseInt(problem.clock);

            return {
                ...problem,
                status: recoveryEvent ? '0' : '1',  // 0 表示已恢复，1 表示告警中
                duration: duration  // 持续时间（秒）
            };
        });
    }

    async getHostsDetails() {
        // 获取所有主机基本信息
        const hosts = await this.request('host.get', {
            output: ['hostid', 'host', 'name'],
            selectInterfaces: ['ip'],
            filter: { status: 0 }
        });

        // 获取所有主机的最新数据
        const items = await this.request('item.get', {
            output: ['hostid', 'name', 'lastvalue', 'key_'],
            hostids: hosts.map(host => host.hostid),
            search: {
                name: ['CPU utilization', 'Memory utilization']
            },
            filter: {
                key_: [
                    'vm.memory.utilization',  // Linux 内存使用率
                    'vm.memory.util',         // Windows 内存使用率
                    'system.cpu.num',         // Linux CPU 核心数
                    "wmi.get[root/cimv2,'Select NumberOfLogicalProcessors from Win32_ComputerSystem']",  // Windows CPU 核心数
                    'vm.memory.size[total]',
                    'system.sw.os'
                ]
            }
        });

        // 获取当前告警数量（仅严重级别>=警告）
        const triggerParams = {
            output: ['triggerid'],
            selectHosts: ['hostid'],
            filter: {
                value: 1,
                status: 0,
                priority: [2, 3, 4, 5]
            },
            monitored: true,
            skipDependent: true,
            only_true: true
        };
        const triggers = await this.request('trigger.get', triggerParams);

        // 统计每个主机的告警数量
        const alertCounts = {};
        triggers.forEach(trigger => {
            if (trigger.hosts && trigger.hosts.length > 0) {
                const hostId = trigger.hosts[0].hostid;
                alertCounts[hostId] = (alertCounts[hostId] || 0) + 1;
            }
        });

        // 整合数据
        return hosts.map(host => {
            const cpuItem = items.find(item => 
                item.hostid === host.hostid && 
                item.name.includes('CPU utilization')
            );

            const osItem = items.find(item =>
                item.hostid === host.hostid &&
                item.key_ === 'system.sw.os'
            );

            // 根据操作系统类型选择合适的内存使用率监控项
            const memoryItem = items.find(item => {
                if (!item || item.hostid !== host.hostid) return false;
                const isWindows = osItem?.lastvalue?.toLowerCase().includes('windows');
                return isWindows ? 
                    item.key_ === 'vm.memory.util' :      // Windows
                    item.key_ === 'vm.memory.utilization' // Linux
            });

            // 根据操作系统类型选择合适的 CPU 核心数监控项
            const cpuNumItem = items.find(item => {
                if (!item || item.hostid !== host.hostid) return false;
                const isWindows = osItem?.lastvalue?.toLowerCase().includes('windows');
                return isWindows ? 
                    item.key_ === "wmi.get[root/cimv2,'Select NumberOfLogicalProcessors from Win32_ComputerSystem']" :  // Windows
                    item.key_ === 'system.cpu.num'  // Linux
            });

            const memTotalItem = items.find(item =>
                item.hostid === host.hostid &&
                item.key_ === 'vm.memory.size[total]'
            );

            const formatMemorySize = (bytes) => {
                if (!bytes) return '-';
                const gb = Math.round(parseFloat(bytes) / (1024 * 1024 * 1024));
                return `${gb} GB`;
            };

            const formatPercentage = (value) => {
                if (!value) return '-';
                return parseFloat(value).toFixed(2) + '%';
            };

            const getOsType = (osInfo) => {
                if (!osInfo) return '-';
                if (osInfo.toLowerCase().includes('windows')) return 'Windows';
                if (osInfo.toLowerCase().includes('linux')) return 'Linux';
                return 'Other';
            };

            return {
                hostid: parseInt(host.hostid),
                name: host.name,
                ip: host.interfaces?.[0]?.ip || '-',
                os: getOsType(osItem?.lastvalue),
                cpuCores: cpuNumItem ? cpuNumItem.lastvalue : '-',
                memoryTotal: memTotalItem ? formatMemorySize(memTotalItem.lastvalue) : '-',
                cpu: cpuItem?.lastvalue ? parseFloat(cpuItem.lastvalue).toFixed(2) : '-',
                memory: formatPercentage(memoryItem?.lastvalue),
                alerts: alertCounts[host.hostid] || 0
            };
        });
    }

    async getHostDetail(hostId) {
        try {
            const [hostResponse, itemsResponse] = await Promise.all([
                this.request('host.get', {
                    output: ['hostid', 'host', 'name', 'status'],
                    selectInterfaces: ['ip'],
                    hostids: [hostId]
                }),
                this.request('item.get', {
                    output: ['itemid', 'name', 'key_', 'lastvalue', 'units'],
                    hostids: [hostId],
                    search: {
                        name: [
                            'CPU utilization',            // CPU使用率
                            'Memory utilization',         // 内存使用率
                            'Number of CPUs',             // CPU核心数
                            'System name',                // 主机名称
                            'System description',         // 系统详情
                            'System uptime',              // 运行时间
                            'Total memory'                // 内存总量
                        ],
                        key_: [
                            'vm.memory.utilization',      // 内存使用率
                            'vm.memory.util',             // 内存使用率
                            'system.cpu.num',             // CPU核心数
                            "wmi.get[root/cimv2,'Select NumberOfLogicalProcessors from Win32_ComputerSystem']",  // Windows CPU 核心数
                            'system.name',                // 主机名称
                            'system.hostname',            // 主机名称
                            'system.uname',               // 系统详情
                            'system.sw.os',               // 系统详情
                            'system.uptime',              // 运行时间
                            'system.net.uptime',          // 运行时间
                            'system.descr[sysDescr.0]',    // 系统详情
                            'vm.memory.size[total]'       // 内存总量
                        ]
                    },
                    searchByAny: true
                })
            ]);

            if (!hostResponse || !hostResponse.length) {
                throw new Error('Host not found');
            }

            const host = hostResponse[0];
            // 通过名称获取CPU监控项
            const cpuItem = itemsResponse.find(item => item.name.includes('CPU utilization'));

            const memoryItem = itemsResponse.find(item => item.name.includes('Memory utilization')) ||
                            itemsResponse.find(item => item.key_ === 'vm.memory.utilization') ||
                            itemsResponse.find(item => item.key_.startsWith('vm.memory.util[')) ||
                            itemsResponse.find(item => item.key_ === 'vm.memory.util');

            const cpuCoresItem = itemsResponse.find(item => item.name.includes('Number of CPUs')) ||
                                itemsResponse.find(item => item.key_ === 'system.cpu.num') ||
                                itemsResponse.find(item => item.key_ === "wmi.get[root/cimv2,'Select NumberOfLogicalProcessors from Win32_ComputerSystem']");

            const hostnameItem = itemsResponse.find(item => item.name.includes('System name')) ||
                                itemsResponse.find(item => item.key_ === 'system.hostname') ||
                                itemsResponse.find(item => item.key_ === 'system.name');

            const osItem = itemsResponse.find(item => item.name.includes('System description')) ||
                          itemsResponse.find(item => item.key_ === 'system.uname') ||
                          itemsResponse.find(item => item.key_ === 'system.sw.os') ||
                          itemsResponse.find(item => item.key_ === 'system.descr[sysDescr.0]');

            const uptimeItem = itemsResponse.find(item => item.name.includes('System uptime')) ||
                              itemsResponse.find(item => item.key_ === 'system.uptime') ||
                              itemsResponse.find(item => item.key_.startsWith('system.net.uptime'));

            const memoryTotalItem = itemsResponse.find(item => item.name.includes('Total memory')) ||
                                   itemsResponse.find(item => item.key_ === 'vm.memory.size[total]');

            // 初始化历史数据结构
            const history = { time: [], cpu: [], memory: [] };
            
            // 只有当监控项存在时才获取历史数据
            if (cpuItem || memoryItem) {
                // 获取历史数据（最近24小时）
                const timeFrom = Math.floor(Date.now() / 1000) - 24 * 3600;
                const historyRequests = [];
                
                if (cpuItem) {
                    historyRequests.push(
                        this.request('history.get', {
                            itemids: [parseInt(cpuItem.itemid)],
                            time_from: timeFrom,
                            output: 'extend',
                            history: 0,
                            sortfield: 'clock',
                            sortorder: 'ASC'
                        })
                    );
                }
                
                if (memoryItem) {
                    historyRequests.push(
                        this.request('history.get', {
                            itemids: [parseInt(memoryItem.itemid)],
                            time_from: timeFrom,
                            output: 'extend',
                            history: 0,
                            sortfield: 'clock',
                            sortorder: 'ASC'
                        })
                    );
                }
                
                const responses = await Promise.all(historyRequests);
                const cpuHistoryResponse = cpuItem ? responses[0] : [];
                const memoryHistoryResponse = memoryItem ? responses[cpuItem ? 1 : 0] : [];

                // 处理 CPU 历史数据
                if (cpuItem) {
                    cpuHistoryResponse.forEach(record => {
                        const value = parseFloat(record.value);
                        history.time.push(this.formatHistoryTime(record.clock));
                        history.cpu.push(value.toFixed(2));
                    });
                }

                // 处理内存历史数据
                if (memoryItem) {
                    memoryHistoryResponse.forEach((record, index) => {
                        if (!history.time[index]) {
                            history.time.push(this.formatHistoryTime(record.clock));
                        }
                        history.memory.push(parseFloat(record.value).toFixed(2));
                    });
                }
            }

            const result = {
                name: host.name,
                ip: host.interfaces[0]?.ip || '-',
                os: osItem?.lastvalue || '-',
                uptime: uptimeItem?.lastvalue || 0,
                cpuCores: cpuCoresItem?.lastvalue || '-',
                memoryTotal: this.formatMemorySize(memoryTotalItem?.lastvalue) || '-',
                history: history,
                cpuItemId: cpuItem?.itemid,
                memoryItemId: memoryItem?.itemid,
            };

            return result;
        } catch (error) {
            console.error('Failed to get host details:', error);
            throw error;
        }
    }

    // 修改 processItems 方法
    processItems(items, isWindows) {
        const result = {};
        items.forEach(item => {
            // 直接通过名称匹配CPU utilization
            if (item.name && item.name.includes('CPU utilization')) {
                result.cpuUsage = parseFloat(item.lastvalue).toFixed(2);
                return;
            }
            
            // 处理其他监控项
            switch (item.key_) {
                case 'vm.memory.util':
                    result.memoryUsage = parseFloat(item.lastvalue).toFixed(2);
                    break;
                case 'system.cpu.num':
                    if (!isWindows) {
                        result.cpuCores = item.lastvalue;
                    }
                    break;
                case "wmi.get[root/cimv2,'Select NumberOfLogicalProcessors from Win32_ComputerSystem']":
                    if (isWindows) {
                        result.cpuCores = item.lastvalue;
                    }
                    break;
                case 'vm.memory.size[total]':
                    result.memoryTotal = this.formatBytes(item.lastvalue);
                    break;
                case 'system.uptime':
                    result.uptime = parseInt(item.lastvalue);
                    break;
                case 'system.sw.os':
                    result.os = item.lastvalue;
                    break;
            }
        });

        return result;
    }

    // 格式化时间
    formatHistoryTime(timestamp) {
        return new Date(timestamp * 1000).toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // 格式化字节大小
    formatBytes(bytes) {
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        if (bytes === 0) return '0 B';
        const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
        return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
    }

    // 添加内存大小格式化方法
    formatMemorySize(bytes) {
        if (!bytes) return '-';
        
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
    }

    async getHostAlerts(hostId) {
        try {
            const problems = await this.request('problem.get', {
                output: ['eventid', 'name', 'clock', 'severity', 'r_clock', 'objectid'],
                hostids: [hostId],
                recent: true,
                sortfield: ['eventid'],
                sortorder: 'DESC'
            });

            // 获取所有触发器的最新数据
            const triggerIds = problems.map(p => p.objectid);
            const triggers = await this.request('trigger.get', {
                output: ['triggerid', 'lastvalue', 'units'],
                triggerids: triggerIds,
                selectItems: ['itemid', 'name', 'lastvalue', 'units']
            });

            // 创建触发器查找映射
            const triggerMap = triggers.reduce((map, t) => {
                map[t.triggerid] = t;
                return map;
            }, {});

            return problems.map(problem => {
                const trigger = triggerMap[problem.objectid];
                const item = trigger?.items?.[0];
                const value = item ? `${item.lastvalue}${item.units || ''}` : '-';

                return {
                    name: problem.name,
                    severity: this.getSeverityName(problem.severity),
                    value: value,
                    startTime: this.formatDateTime(problem.clock),
                    duration: this.calculateDuration(problem.clock)
                };
            });
        } catch (error) {
            console.error('Failed to get host alerts:', error);
            throw error;
        }
    }

    getSeverityName(severity) {
        const severities = {
            '0': { name: '未分类', class: 'severity-not-classified' },
            '1': { name: '信息', class: 'severity-information' },
            '2': { name: '警告', class: 'severity-warning' },
            '3': { name: '一般', class: 'severity-average' },
            '4': { name: '严重', class: 'severity-high' },
            '5': { name: '灾难', class: 'severity-disaster' }
        };
        return severities[severity] || severities['0'];
    }

    formatDateTime(timestamp) {
        return new Date(timestamp * 1000).toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    calculateDuration(startTime) {
        const duration = Math.floor(Date.now() / 1000) - startTime;
        const days = Math.floor(duration / 86400);
        const hours = Math.floor((duration % 86400) / 3600);
        const minutes = Math.floor((duration % 3600) / 60);
        
        let result = '';
        if (days > 0) result += `${days}${safeTranslate('time.days', '天', ' days')} `;
        if (hours > 0) result += `${hours}${safeTranslate('time.hours', '小时', ' hrs')} `;
        if (minutes > 0) result += `${minutes}${safeTranslate('time.minutes', '分钟', ' mins')}`;
        return result.trim() || safeTranslate('time.lessThanOneMinute', '刚刚', 'Just now');
    }

    getAvailabilityText(available) {
        switch (available) {
            case '0': return '未知';
            case '1': return '可用';
            case '2': return '不可用';
            default: return '未知';
        }
    }

    async getHostGroups() {
        try {
            const hostGroups = await this.request('hostgroup.get', {
                output: ['groupid', 'name'],
                with_hosts: true,  // 使用 with_hosts 仅返回包含主机的组（替代已弃用的 real_hosts）
                selectHosts: ['hostid', 'name', 'status'],  // 选择主机信息
            });
            return hostGroups;
        } catch (error) {
            console.error('Failed to get host groups:', error);
            throw error;
        }
    }

    async getHostsWithStatus() {
        try {
            // 确保已知 Zabbix 版本，若未知则尝试检测（以便在 6.x 使用 selectGroups）
            if (!this.zabbixVersion && this.detectVersion) {
                try {
                    await this.detectVersion();
                } catch (e) {
                    console.warn('Failed to detect Zabbix version in getHostsWithStatus:', e);
                }
            }
            const major = this.getMajorVersion ? this.getMajorVersion() : null;
            const groupKey = (major && major >= 7) ? 'selectHostGroups' : 'selectGroups';
            const hostParams = {
                output: ['hostid', 'host', 'name', 'status'],
                selectInterfaces: ['ip', 'type', 'main', 'available'],
                selectTriggers: ['triggerid', 'value'],
                monitored: true
            };
            hostParams[groupKey] = ['groupid', 'name'];

            const hosts = await this.request('host.get', hostParams);

            // 获取每个主机的活动问题（批量请求以减少 API 调用）
            const hostProblemsMap = {};
            // 初始化每个主机的计数为 0，并构建 triggerId -> hostId 映射（依赖于 selectTriggers）
            const triggerToHost = new Map();
            hosts.forEach(host => {
                hostProblemsMap[host.hostid] = 0;
                const triggers = host.triggers || [];
                triggers.forEach(t => {
                    if (t.triggerid) triggerToHost.set(t.triggerid, host.hostid);
                });
            });

            const triggerIds = Array.from(triggerToHost.keys());
            if (triggerIds.length > 0) {
                try {
                    // 一次性获取所有触发器对应的活动问题，避免逐主机请求
                    const allProblems = await this.request('problem.get', {
                        output: ['eventid', 'objectid', 'r_eventid'],
                        objectids: triggerIds,
                        recent: true,
                        suppressed: false
                    });
                    // 过滤掉已恢复的问题（r_eventid !== "0" 表示已有恢复事件）
                    const problems = allProblems.filter(p => p.r_eventid === "0");

                    problems.forEach(p => {
                        const hostId = triggerToHost.get(p.objectid);
                        if (hostId) {
                            hostProblemsMap[hostId] = (hostProblemsMap[hostId] || 0) + 1;
                        }
                    });
                } catch (error) {
                    console.warn('Failed to batch get problems for triggers:', error);
                    // 若批量请求失败，保留各主机计数为 0（避免抛出并中断主流程）
                }
            }

            return hosts.map(host => {
                // 分析接口可用性
                const interfaces = host.interfaces || [];
                const agentInterface = interfaces.find(iface => iface.type === '1'); // Zabbix agent
                const snmpInterface = interfaces.find(iface => iface.type === '2');  // SNMP
                const ipmiInterface = interfaces.find(iface => iface.type === '3');  // IPMI
                const jmxInterface = interfaces.find(iface => iface.type === '4');   // JMX
                
                // 判断主要接口的可用性
                // available: 0=未知, 1=可用, 2=不可用
                let isAvailable = true;
                let unavailableInterfaces = [];
                let unknownInterfaces = [];
                
                if (agentInterface) {
                    if (agentInterface.available === '2') {
                        isAvailable = false;
                        unavailableInterfaces.push('Zabbix agent');
                    } else if (agentInterface.available === '0') {
                        unknownInterfaces.push('Zabbix agent');
                    }
                }
                
                if (snmpInterface) {
                    if (snmpInterface.available === '2') {
                        isAvailable = false;
                        unavailableInterfaces.push('SNMP');
                    } else if (snmpInterface.available === '0') {
                        unknownInterfaces.push('SNMP');
                    }
                }
                
                if (ipmiInterface) {
                    if (ipmiInterface.available === '2') {
                        isAvailable = false;
                        unavailableInterfaces.push('IPMI');
                    } else if (ipmiInterface.available === '0') {
                        unknownInterfaces.push('IPMI');
                    }
                }
                
                if (jmxInterface) {
                    if (jmxInterface.available === '2') {
                        isAvailable = false;
                        unavailableInterfaces.push('JMX');
                    } else if (jmxInterface.available === '0') {
                        unknownInterfaces.push('JMX');
                    }
                }
                
                // 如果没有主要接口，但主机是启用状态，也认为有问题
                if (interfaces.length === 0 && host.status === '0') {
                    isAvailable = false;
                    unavailableInterfaces.push('无接口');
                }

                // 只有当接口状态为"不可用"(2)时才认为是监控失效
                // "未知"(0)状态不算作监控失效

                return {
                    ...host,
                    problemCount: hostProblemsMap[host.hostid] || 0,
                    isEnabled: host.status === '0',  // 0=启用, 1=禁用
                    isAvailable: isAvailable,        // 只有当接口状态为不可用(2)时才为false
                    unavailableInterfaces: unavailableInterfaces,
                    unknownInterfaces: unknownInterfaces,
                    interfaces: interfaces,
                    groups: host.groups || host.hostgroups || [],
                    // 详细的接口状态
                    interfaceStatus: {
                        agent: agentInterface ? {
                            available: agentInterface.available,
                            availableText: this.getAvailabilityText(agentInterface.available),
                            ip: agentInterface.ip,
                            port: agentInterface.port
                        } : null,
                        snmp: snmpInterface ? {
                            available: snmpInterface.available,
                            availableText: this.getAvailabilityText(snmpInterface.available),
                            ip: snmpInterface.ip,
                            port: snmpInterface.port
                        } : null,
                        ipmi: ipmiInterface ? {
                            available: ipmiInterface.available,
                            availableText: this.getAvailabilityText(ipmiInterface.available),
                            ip: ipmiInterface.ip,
                            port: ipmiInterface.port
                        } : null,
                        jmx: jmxInterface ? {
                            available: jmxInterface.available,
                            availableText: this.getAvailabilityText(jmxInterface.available),
                            ip: jmxInterface.ip,
                            port: jmxInterface.port
                        } : null
                    }
                };
            });
        } catch (error) {
            console.error('Failed to get hosts with status:', error);
            throw error;
        }
    }

    async getProblemsStatistics() {
        try {
            // 第一步：获取活动问题的基础信息（过滤掉未分类和信息级别）
            const problemParams = {
                output: ['eventid', 'objectid', 'clock', 'r_eventid', 'severity', 'name'],
                recent: true,
                suppressed: false,
                severities: [1, 2, 3, 4, 5]
            };
            const allProblems = await this.request('problem.get', problemParams);
            // 过滤掉已恢复的问题（r_eventid !== "0" 表示已有恢复事件，即问题已解决）
            const activeProblems = allProblems.filter(p => p.r_eventid === "0");
            const recentlyResolvedProblems = allProblems.filter(p => p.r_eventid !== "0");

            // 第二步：批量获取触发器信息（为所有问题，包括已恢复的）
            const allTriggerIds = [...new Set(allProblems.map(p => p.objectid))];
            let triggerMap = new Map();
            let interfaceMap = new Map();

            if (allTriggerIds.length > 0) {
                const triggers = await this.request('trigger.get', {
                    output: ['triggerid', 'description'],
                    triggerids: allTriggerIds,
                    selectHosts: ['hostid', 'name', 'host']
                });

                // 第三步：获取所有相关主机的接口信息
                const hostIds = [...new Set(triggers.flatMap(trigger => 
                    trigger.hosts ? trigger.hosts.map(host => host.hostid) : []
                ))];

                if (hostIds.length > 0) {
                    const hostInterfaces = await this.request('hostinterface.get', {
                        output: ['hostid', 'ip', 'dns', 'main'],
                        hostids: hostIds,
                        filter: { main: 1 }
                    });
                    interfaceMap = new Map(hostInterfaces.map(iface => [String(iface.hostid), iface]));
                }

                triggerMap = new Map(triggers.map(trigger => [String(trigger.triggerid), trigger]));
            }

            // 第四步：统一的数据丰富函数
            const enrichProblem = (problem) => {
                const trigger = triggerMap.get(String(problem.objectid));
                const host = trigger && trigger.hosts && trigger.hosts[0];
                const hostInterface = host ? interfaceMap.get(String(host.hostid)) : null;

                return {
                    ...problem,
                    hostId: host ? host.hostid : null,
                    hostName: host ? (host.name || host.host) : '未知主机',
                    hostIp: hostInterface ? (hostInterface.ip || hostInterface.dns) : '--',
                    name: problem.name || (trigger ? trigger.description : '未知问题')
                };
            };

            // 第五步：丰富活动问题和最近恢复的问题
            const enrichedActiveProblems = activeProblems.map(enrichProblem);
            const enrichedResolvedProblems = recentlyResolvedProblems.map(enrichProblem);

            // 第六步：获取最近24小时已解决的事件（用于统计计数）
            const resolvedEvents = await this.request('event.get', {
                output: ['eventid', 'clock', 'value'],
                source: 0,  // 触发器事件
                object: 0,  // 触发器对象
                value: 0,   // 恢复状态（0=OK, 1=PROBLEM）
                time_from: Math.floor(Date.now() / 1000) - 24 * 60 * 60, // 最近24小时
                sortfield: 'clock',
                sortorder: 'DESC'
            });

            const resolvedProblemsCount = resolvedEvents.length;

            console.log('Problems statistics debug:', {
                activeProblemsCount: enrichedActiveProblems.length,
                recentlyResolvedCount: enrichedResolvedProblems.length,
                resolvedEventsCount: resolvedEvents.length,
                sampleActiveProblems: enrichedActiveProblems.slice(0, 3),
                sampleResolvedProblems: enrichedResolvedProblems.slice(0, 3)
            });

            return {
                activeProblemsCount: enrichedActiveProblems.length,
                resolvedProblemsCount: resolvedProblemsCount,
                totalProblemsToday: enrichedActiveProblems.length + resolvedProblemsCount,
                activeProblems: enrichedActiveProblems,
                recentResolvedProblems: enrichedResolvedProblems,
                resolvedProblems: resolvedEvents
            };
        } catch (error) {
            console.error('Failed to get problems statistics:', error);
            throw error;
        }
    }

    // 获取主机的监控项
    async getItems(hostId, searchKey = '') {
        try {
            const params = {
                output: ['itemid', 'hostid', 'name', 'key_', 'lastvalue', 'units'],
                hostids: hostId,
                monitored: true,  // 只获取监控中的项目
                status: 0         // 只获取启用的项目
            };

            // 如果提供了搜索关键字，添加搜索条件
            if (searchKey) {
                // 如果搜索的是监控项名称（如"CPU utilization"），使用name搜索
                if (searchKey.includes(' ')) {
                    params.search = {
                        name: searchKey
                    };
                } else {
                    // 否则使用key搜索
                    params.search = {
                        key_: searchKey
                    };
                }
            }

            const items = await this.request('item.get', params);
            return items || [];
        } catch (error) {
            console.error(`Failed to get items for host ${hostId}:`, error);
            return [];
        }
    }

    // 批量获取多个主机的监控项，返回一个以 hostid 为键的映射
    async getItemsForHosts(hostIds, searchKey = '') {
        try {
            if (!Array.isArray(hostIds)) hostIds = [hostIds];
            if (hostIds.length === 0) return {};

            const params = {
                output: ['itemid', 'hostid', 'name', 'key_', 'lastvalue', 'units'],
                hostids: hostIds,
                monitored: true,
                status: 0
            };

            if (searchKey) {
                if (searchKey.includes(' ')) {
                    params.search = { name: searchKey };
                } else {
                    params.search = { key_: searchKey };
                }
            }

            const items = await this.request('item.get', params) || [];

            const map = {};
            // 初始化空数组，确保每个hostid都有返回值（至少为空数组）
            hostIds.forEach(h => { map[h] = []; });

            items.forEach(item => {
                const hid = item.hostid || item.host;
                if (!map[hid]) map[hid] = [];
                map[hid].push(item);
            });

            return map;
        } catch (error) {
            console.error('Failed to get items for hosts:', error);
            return {};
        }
    }

    // 获取监控项的历史数据
    async getHistory(itemId, valueType = 0, timeFrom = null, timeTill = null, limit = 100) {
        try {
            console.log(`API获取历史数据 - ItemID: ${itemId}, 类型: ${valueType}, 时间范围: ${timeFrom ? new Date(timeFrom * 1000).toLocaleString() : '不限'} - ${timeTill ? new Date(timeTill * 1000).toLocaleString() : '不限'}, 限制: ${limit}`);
            
            const params = {
                output: 'extend',
                itemids: itemId,
                history: valueType,  // 0=float, 1=character, 2=log, 3=numeric(unsigned), 4=text
                sortfield: 'clock',
                sortorder: 'ASC',  // 改为升序，确保获取时间范围内的所有数据
                limit: limit
            };

            // 添加时间范围
            if (timeFrom) {
                params.time_from = timeFrom;
            }
            if (timeTill) {
                params.time_till = timeTill;
            }

            console.log(`API请求参数:`, params);
            const history = await this.request('history.get', params);
            console.log(`API返回历史数据条数: ${history ? history.length : 0}`);
            
            if (history && history.length > 0) {
                console.log(`首条数据:`, {
                    clock: history[0].clock,
                    time: new Date(parseInt(history[0].clock) * 1000).toLocaleString(),
                    value: history[0].value
                });
                console.log(`末条数据:`, {
                    clock: history[history.length-1].clock,
                    time: new Date(parseInt(history[history.length-1].clock) * 1000).toLocaleString(),
                    value: history[history.length-1].value
                });
                
                // 检查数据分布 - 统计每小时的数据点数量
                const hourlyStats = {};
                history.forEach(item => {
                    const hour = new Date(parseInt(item.clock) * 1000).getHours();
                    hourlyStats[hour] = (hourlyStats[hour] || 0) + 1;
                });
                console.log(`每小时数据点分布:`, hourlyStats);
            }
            
            return history || [];
        } catch (error) {
            console.error(`Failed to get history for item ${itemId}:`, error);
            return [];
        }
    }

    // 获取主机的最新值
    async getLatestValues(hostId, itemKeys = []) {
        try {
            const params = {
                output: ['itemid', 'hostid', 'name', 'key_', 'lastvalue', 'units'],
                hostids: hostId,
                monitored: true,
                status: 0
            };

            // 如果指定了监控项key，添加过滤条件
            if (itemKeys.length > 0) {
                params.filter = {
                    key_: itemKeys
                };
            }

            const items = await this.request('item.get', params);
            
            // 转换为更易用的格式
            const values = {};
            items.forEach(item => {
                values[item.key_] = {
                    value: item.lastvalue,
                    units: item.units,
                    name: item.name,
                    itemid: item.itemid
                };
            });

            return values;
        } catch (error) {
            console.error(`Failed to get latest values for host ${hostId}:`, error);
            return {};
        }
    }
} 