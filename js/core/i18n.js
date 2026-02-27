const translations = {
    zh: {
        // 标题和按钮
        'pageTitle': {
            'settings': '设置',
            'dashboard': '仪表盘',
            'cmdb': 'CMDB',
            'screen1': '告警监控大屏',
            'screen2': '资源监控大屏',
            'screen3': '综合监控大屏',
            'screen4': '服务可用性大屏'
        },
        'hostCount': '主机数量',
        'alertCount': '当前告警',
        'alertTrend': '告警趋势',
        'alertDistribution': '当前告警分布',
        'alertHistory': '一周内告警历史',
        'settings': '设置',
        'testConnection': '测试连接',
        'saveSettings': '保存设置',
        'close': '关闭',

        // 导航菜单
        'nav': {
            'dashboard': '仪表盘',
            'cmdb': 'CMDB',
            'bigScreen': '大屏展示',
            'screen1': '告警监控大屏',
            'screen2': '资源监控大屏',
            'screen3': '综合监控大屏',
            'screen4': '服务可用性大屏'
        },
        // CMDB 页面
        'cmdb': {
            'searchByHostOrIP': '按主机名或IP搜索',
            'searchPlaceholder': '搜索主机...',
            'selectHostGroup': '选择主机分组',
            'allGroups': '所有分组',
            'interfaceType': '接口方式',
            'allInterfaces': '所有接口',
            'totalCPU': 'CPU总量',
            'totalMemory': '内存总量',
            'totalHosts': '主机总数',
            'totalGroups': '主机分组',
            'enabledHosts': '启用主机',
            'hostName': '主机名',
            'systemName': '系统名称',
            'ipAddress': 'IP地址',
            'architecture': '架构',
            'cpuCores': 'CPU总量',
            'cpuUsage': 'CPU使用率',
            'memoryTotal': '内存总量',
            'memoryUsage': '内存使用率',
            'operatingSystem': '操作系统',
            'hostGroups': '主机分组',
            'agentVersion': 'Agent 版本',
            'noHostsFound': '未找到主机',
            'loadError': '加载数据失败，请检查设置',
            'loading': '正在加载...',
            'perPage': '每页',
            'records': '条',
            'totalRecords': '共 {count} 条',
            'showingRange': '显示 {from}-{to} 条，共 {total} 条',
        },
        // 接口名称与可用性标签
        'cmdbInterfaceNames': {
            'agent': 'Agent',
            'snmp': 'SNMP',
            'ipmi': 'IPMI',
            'jmx': 'JMX'
        },
        'cmdbStatus': {
            'available': '可用',
            'unavailable': '不可用',
            'enabled': '已启用',
            'disabled': '已禁用'
        },

        // 时间范围按钮
        '1h': '1小时',
        '24h': '24小时',
        '7d': '7天',
        '15d': '15天',
        '30d': '30天',

        // 主机详情
        'hostDetails': '主机详情',
        'basicInfo': '基本信息',
        'hardwareInfo': '硬件信息',
        'performanceMonitor': '性能监控',
        'hostName': '名称',
        'ipAddress': 'IP地址',
        'systemType': '系统类型',
        'uptime': '运行时间',
        'cpuCores': 'CPU',
        'memoryTotal': '内存',
        'cpuUsage': 'CPU使用率',
        'memoryUsage': '内存使用率',

        // 告警相关
        'severity': {
            'notClassified': '未分类',
            'information': '信息',
            'warning': '警告',
            'average': '一般严重',
            'high': '严重',
            'disaster': '灾难'
        },
        'status': {
            'resolved': '已恢复',
            'problem': '告警中'
        },
        'statusTag': {
            'resolved': '已恢复',
            'problem': '告警中'
        },

        // 导航和标题
        /* 'hostList' removed */
        'alertHistory': '告警趋势',
        'hostDetails': '主机详情',

        // 主机详情页面
        'basicInfo': '基本信息',
        'hostName': '名称',
        'ipAddress': 'IP地址',
        'systemType': '系统类型',
        'runningTime': '运行时间',
        'hardwareInfo': '硬件信息',
        'cpuCores': 'CPU核心数',
        'memorySize': '内存总量',
        'performanceMonitor': '性能监控',
        'cpuUsage24h': 'CPU使用率 (24小时)',
        'memoryUsage24h': '内存使用率 (24小时)',

        // 告警相关
        'currentAlertDistribution': '当前告警分布',
        'weeklyAlertHistory': '一周内告警历史',
        'host': '主机',
        'alertContent': '告警内容',
        'level': '等级',
        'status': '状态',
        'duration': '持续时间',
        'startTime': '开始时间',
        'endTime': '结束时间',
        'currentAlerts': '当前告警',

        // 主机列表表头
        'hostName': '名称',
        'hostname': '主机名称',
        'ipAddress': 'IP地址',
        'operatingSystem': '操作系统',
        'cpuCores': 'CPU',
        'memoryTotal': '内存',
        'cpuUsage': 'CPU使用率',
        'memoryUsage': '内存使用率',
        'alerts': '当前告警',

        // 设置相关
        'settings': {
            'title': '设置',
            'apiUrl': 'ZABBIX API URL:',
            'apiToken': 'ZABBIX API TOKEN:',
            'refreshInterval': '刷新间隔',
            'buttons': {
                'test': '测试连接',
                'save': '保存设置'
            },
            'messages': {
                'lastRefresh': '最后刷新时间: {time}',
                'connectionSuccess': '连接测试成功',
                'connectionFailed': '连接测试失败: {error}',
                'settingsSaved': '设置已保存',
                'savingSettings': '正在保存设置...'
            }
        },

        // 时间相关
        'time': {
            'days': '天',
            'hours': '小时',
            'minutes': '分钟',
            'seconds': '秒',
            'lessThanOneMinute': '刚刚',
            'runningTime': '运行时间'
        },

        // 图表标题
        'chartTitle': {
            'cpu': 'CPU使用率',
            'memory': '内存使用率'
        },
        'timeRange': {
            '1h': '(1小时)',
            '24h': '(24小时)',
            '7d': '(7天)',
            '15d': '(15天)',
            '30d': '(30天)'
        },

        // 图表相关
        'chart': {
            'usage': '使用率',
            'tooltip': {
                'usage': '使用率: {value}%',
                'time': '时间'
            }
        },

        // 时间范围按钮
        'timeButtons': {
            '1h': '1小时',
            '24h': '24小时',
            '7d': '7天',
            '15d': '15天',
            '30d': '30天'
        },

        // 设置对话框
        'settings': {
            'title': '设置',
            'apiUrl': 'ZABBIX API URL:',
            'apiToken': 'ZABBIX API TOKEN:',
            'refreshInterval': '刷新间隔:',
            'intervals': {
                '5s': '5秒',
                '30s': '30秒',
                '1m': '1分钟',
                '5m': '5分钟',
                '10m': '10分钟',
                '30m': '30分钟'
            },
            'buttons': {
                'test': '测试连接',
                'save': '保存设置'
            },
            'messages': {
                'testing': '正在测试连接...',
                'connectionSuccess': '连接成功',
                'connectionFailed': '连接失败',
                'apiUrlAutoComplete': '已自动补充 api_jsonrpc.php 路径',
                'savingSettings': '正在保存设置...',
                'lastRefresh': '最后刷新时间: {time}',
                'settingsSaved': '设置已保存',
                'settingsSaveFailed': '保存设置失败',
                'loadFailed': '加载设置对话框失败'
            }
        },

        'nav': {
            'dashboard': '仪表盘',
            'cmdb': 'CMDB',
            'bigScreen': '大屏展示',
            'screen1': '告警监控大屏',
            'screen2': '资源监控大屏',
            'screen3': '综合监控大屏',
            'screen4': '服务可用性大屏'
        },

        'performanceMonitor': '性能监控',
        'units': {
            'percentage': '%'
        },
        
        // Dashboard2资源监控专用
        'dashboard2': {
            'title': '资源利用率监控大屏',
            'hostOverview': '主机总览',
            'loadingHostData': '正在加载主机数据...',
            'cpuTrend': 'CPU使用率趋势',
            'memoryDistribution': '内存使用率分布',
            'cpuDistribution': 'CPU使用率分布',
            'loadingCpuData': '正在加载CPU分布数据...',
            'alertTrend7Days': '过去7天告警趋势对比',
            'loadingAlertData': '正在加载告警趋势数据...',
            'memoryTrend': '内存使用率趋势',
            'loadingMemoryData': '正在加载内存趋势数据...',
            'lastRefresh': '最后刷新时间:',
            'hostStats': {
                'healthy': '健康主机',
                'warning': '警告主机',
                'critical': '严重主机',
                'unknown': '未知状态'
            },
            'resourceUsage': '平均资源使用率',
            'hostOverload': '主机数量较多({count}台)，显示关键信息。点击查看完整列表',
            'viewAll': '查看全部',
            'memory': '内存',
            'cpuUsage': 'CPU使用率',
            'memoryUsage': '内存使用率',
            'cpuUsagePercent': 'CPU使用率(%)',
            'memoryUsagePercent': '内存使用率(%)',
            'hostCount': '主机数量',
            'hostCountLabel': '主机数量',
            'percentage': '占比',
            'memoryDistributionChart': '内存使用率分布',
            'cpuDistributionChart': 'CPU使用率分布',
            'sortAsc': '升序排列',
            'sortDesc': '降序排列',
            'severity': {
                'normal': '正常',
                'warning': '警告',
                'critical': '严重'
            },
            'sortBy': {
                'name': '主机名',
                'ip': 'IP地址', 
                'cpu': 'CPU使用率',
                'memory': '内存使用率',
                'status': '状态'
            },
            'chartTitles': {
                'avgCpu': '平均CPU ({count}台主机)',
                'maxCpu': '最高CPU',
                'minCpu': '最低CPU',
                'avgMemory': '平均内存 ({count}台主机)',
                'maxMemory': '最高内存',
                'minMemory': '最低内存',
                'alertCount': '告警数量'
            },
            'tooltipFormats': {
                'hostCountWithPercentage': '{b}: {c}台 ({d}%)',
                'hostCountOnly': '{b}\n{c}台',
                'alertDetails': '{alertCount}: {value}个'
            },
            'hostCount': '主机数量',
            'percentage': '占比',
            'units': {
                'hosts': '台',
                'count': '个'
            },
            'dateFormat': {
                'monthDay': '{month}月{day}日'
            },
            'messages': {
                'noHostData': '未找到主机数据',
                'refreshIntervalUpdated': '刷新间隔已更新为 {seconds} 秒',
                'apiReinitialized': 'API设置已更新',
                'reinitializeApiFailed': '重新初始化API失败: {error}',
                'lastRefreshTime': '最后刷新时间: {time}',
                'alertTrendChartNotInit': '告警趋势图表未初始化',
                'cannotLoadAlertTrend': '无法加载告警趋势数据',
                'cannotLoadCpuData': '无法加载CPU数据',
                'cannotLoadMemoryData': '无法加载内存数据',
                'cannotLoadCpuDistribution': '无法加载CPU分布数据',
                'cannotLoadMemoryTrend': '无法加载内存趋势数据',
                'cpuStats': 'CPU统计 - 平均: {avg}%, 最高: {max}%, 最低: {min}%',
                'memoryStats': '内存统计 - 平均: {avg}%, 最高: {max}%, 最低: {min}%'
            }
        },
        
        // Dashboard3综合监控专用
        'dashboard3': {
            'title': '综合监控大屏',
            'totalHosts': '主机总数',
            'activeAlerts': '活动告警',
            'hostGroups': '主机组',
            'avgCpu': '平均CPU',
            'avgMemory': '平均内存',
            'hostGroupHealth': '主机组健康度',
            'severityDistribution': '告警严重性分布',
            'hostStatusGauge': '主机健康率',
            'topCpuHosts': 'TOP10 CPU使用率',
            'topMemoryHosts': 'TOP10 内存使用率',
            'recentAlerts': '最近告警',
            'healthyHosts': '健康主机',
            'problemHosts': '告警主机',
            'healthRate': '健康率',
            'healthy': '健康',
            'problem': '告警',
            'memory': '内存',
            'noAlerts': '暂无告警',
            'lastRefresh': '最后刷新:',
            'lastRefreshTime': '最后刷新: {time}'
        },

        'dashboard1': {
            'title': '告警监控大屏',
            'hostCount': '主机数量',
            'alertingHosts': '告警主机',
            'hostGroups': '主机组数量',
            'processedAlerts': '已处理告警数',
            'severityChart': '告警严重性分类',
            'alertTrend7Days': '过去7天告警趋势对比',
            'monitoringOverview': '监控状态概览',
            'pendingAlerts': '待处理告警',
            'hostAlertDistribution': '主机告警分布',
            'chartSeries': {
                'totalAlerts': '总告警',
                'activeAlerts': '活动告警',
                'resolvedAlerts': '已恢复告警'
            },
            'tableHeaders': {
                'hostname': '主机名',
                'alert': '告警',
                'severity': '严重性',
                'duration': '持续时间'
            },
            'monitorStatus': {
                'normal': '正常',
                'problem': '告警',
                'disabled': '已禁用'
            },
            'severity': {
                'disaster': '灾难',
                'high': '严重',
                'average': '一般',
                'warning': '警告',
                'information': '信息',
                'unknown': '未知'
            },
            'timeFormat': {
                'minutesAgo': '{minutes}分钟前',
                'hoursAgo': '{hours}小时前',
                'daysAgo': '{days}天前'
            },
            'noData': {
                'noAlertingHosts': '暂无告警主机',
                'noPendingAlerts': '暂无待处理告警'
            },
            'unknownData': {
                'unknownHost': '未知主机',
                'unknownProblem': '未知问题'
            },
            'lastRefresh': '最后刷新: {time}',
            'units': {
                'hosts': '台主机'
            },
            'tooltip': {
                'hostCount': '{name}: {value}台主机 ({percent}%)'
            }
        },        
        // 错误和状态消息
        'errors': {
            'loadFailed': '加载失败',
            'connectionFailed': '无法连接到Zabbix API，请检查设置',
            'incompleteApiConfig': 'API配置不完整，请检查设置',
            'noData': '无数据',
            'chartError': '图表加载错误'
        },

        // Dashboard4 服务可用性专用
        'dashboard4': {
            'title': '服务可用性大屏',
            'monitoredHosts': '监控主机',
            'availabilityRate': '可用率',
            'activeProblems': '活动问题',
            'resolvedToday': '今日已恢复',
            'hostGroups': '主机组',
            'alertHeatmap': '7天告警时段热力图',
            'severityRadar': '告警级别雷达',
            'groupProblems': '主机组问题分布',
            'availabilityTrend': '24小时可用率趋势',
            'topProblemHosts': '问题主机 TOP',
            'recentEvents': '实时事件流',
            'noEvents': '暂无事件',
            'alertCount': '告警',
            'resolved': '已恢复',
            'lastRefresh': '最后刷新:',
            'lastRefreshTime': '最后刷新: {time}'
        },

        // 通用字段
        'time': '时间',
        'ipAddress': 'IP地址'
    },
    en: {
        // Titles and buttons
        'pageTitle': {
            'settings': 'Settings',
            'dashboard': 'Dashboard',
            'cmdb': 'CMDB',
            'screen1': 'Alert Monitoring Screen',
            'screen2': 'Resource Monitoring Screen',
            'screen3': 'Comprehensive Monitoring Screen',
            'screen4': 'Service Availability Screen'
        },
        'hostCount': 'Host Count',
        'alertCount': 'Alerting',
        'alertTrend': 'Alert Trend',
        'alertDistribution': 'Alert Distribution',
        'alertHistory': 'Alert History (7 Days)',
        'settings': 'Settings',
        'testConnection': 'Test Connection',
        'saveSettings': 'Save Settings',
        'close': 'Close',

        // Navigation menu
        'nav': {
            'dashboard': 'Dashboard',
            'cmdb': 'CMDB',
            'bigScreen': 'Big Screen',
            'screen1': 'Alert Monitoring Screen',
            'screen2': 'Resource Monitoring Screen',
            'screen3': 'Comprehensive Monitoring Screen',
            'screen4': 'Service Availability Screen'
        },

        // CMDB Page
        'cmdb': {
            'searchByHostOrIP': 'Search by host name or IP',
            'searchPlaceholder': 'Search hosts...',
            'selectHostGroup': 'Select Host Group',
            'allGroups': 'All Groups',
            'interfaceType': 'Interface Type',
            'allInterfaces': 'All Interfaces',
            'totalCPU': 'Total CPU',
            'totalMemory': 'Total Memory',
            'totalHosts': 'Total Hosts',
            'totalGroups': 'Host Groups',
            'enabledHosts': 'Enabled Hosts',
            'hostName': 'Host Name',
            'systemName': 'System Name',
            'ipAddress': 'IP Address',
            'architecture': 'Architecture',
            'cpuCores': 'CPU Cores',
            'cpuUsage': 'CPU Usage',
            'memoryTotal': 'Memory Total',
            'memoryUsage': 'Memory Usage',
            'operatingSystem': 'Operating System',
            'hostGroups': 'Host Groups',
            'agentVersion': 'Agent Version',
            'noHostsFound': 'No hosts found',
            'loadError': 'Failed to load data, please check settings',
            'loading': 'Loading...',
            'perPage': 'Per page',
            'records': 'records',
            'totalRecords': 'Total {count} records',
            'showingRange': 'Showing {from}-{to} of {total}',
        },
        // Interface names and availability labels
        'cmdbInterfaceNames': {
            'agent': 'Agent',
            'snmp': 'SNMP',
            'ipmi': 'IPMI',
            'jmx': 'JMX'
        },
        'cmdbStatus': {
            'available': 'Available',
            'unavailable': 'Unavailable',
            'enabled': 'Enabled',
            'disabled': 'Disabled'
        },

        // Time range buttons
        '1h': '1 Hour',
        '24h': '24 Hours',
        '7d': '7 Days',
        '15d': '15 Days',
        '30d': '30 Days',

        // Host details
        'hostDetails': 'Host Details',
        'basicInfo': 'Basic Information',
        'hardwareInfo': 'Hardware Information',
        'performanceMonitor': 'Performance Monitor',
        'hostName': 'Host Name',
        'ipAddress': 'IP Address',
        'systemType': 'System Type',
        'uptime': 'Uptime',
        'cpuCores': 'CPU Cores',
        'memoryTotal': 'Memory',
        'cpuUsage': 'CPU Usage',
        'memoryUsage': 'Memory Usage',

        // Alert related
        'severity': {
            'notClassified': 'Not classified',
            'information': 'Information',
            'warning': 'Warning',
            'average': 'Average',
            'high': 'High',
            'disaster': 'Disaster'
        },
        'status': {
            'resolved': 'Resolved',
            'problem': 'Problem'
        },
        'statusTag': {
            'resolved': 'Resolved',
            'problem': 'Problem'
        },

        // Navigation and titles (hostList removed)
        'alertHistory': 'Alert History',
        'hostDetails': 'Host Details',

        // Host detail page
        'basicInfo': 'Basic Information',
        'hostName': 'Host Name',
        'ipAddress': 'IP Address',
        'systemType': 'System Type',
        'runningTime': 'Running Time',
        'hardwareInfo': 'Hardware Information',
        'cpuCores': 'CPU Cores',
        'memorySize': 'Total Memory',
        'performanceMonitor': 'Performance Monitor',
        'cpuUsage24h': 'CPU Usage (24 Hours)',
        'memoryUsage24h': 'Memory Usage (24 Hours)',

        // Alert related
        'currentAlertDistribution': 'Alerting Distribution',
        'weeklyAlertHistory': 'Weekly Alert History',
        'host': 'Host',
        'alertContent': 'Alert Content',
        'level': 'Level',
        'status': 'Status',
        'duration': 'Duration',
        'startTime': 'Start Time',
        'endTime': 'End Time',
        'currentAlerts': 'Alerting',

        // Host list headers
        'hostName': 'Host Name',
        'hostname': 'Host Name',
        'ipAddress': 'IP Address',
        'operatingSystem': 'Operating System',
        'cpuCores': 'CPU Cores',
        'memoryTotal': 'Memory',
        'cpuUsage': 'CPU Usage',
        'memoryUsage': 'Memory Usage',
        'alerts': 'Alerting',

        // Settings related
        'settings': {
            'title': 'Settings',
            'apiUrl': 'ZABBIX API URL:',
            'apiToken': 'ZABBIX API TOKEN:',
            'refreshInterval': 'Refresh Interval',
            'buttons': {
                'test': 'Test Connection',
                'save': 'Save Settings'
            },
            'messages': {
                'lastRefresh': 'Last Refresh: {time}',
                'connectionSuccess': 'Connection test successful',
                'connectionFailed': 'Connection test failed: {error}',
                'settingsSaved': 'Settings saved',
                'savingSettings': 'Saving settings...'
            }
        },

        // Time related
        'time': {
            'days': ' days',
            'hours': ' hrs',
            'minutes': ' mins',
            'seconds': ' secs',
            'lessThanOneMinute': 'Just now',
            'runningTime': 'Running Time'
        },

        // Chart titles
        'chartTitle': {
            'cpu': 'CPU Usage',
            'memory': 'Memory Usage'
        },
        'timeRange': {
            '1h': '(1 Hour)',
            '24h': '(24 Hours)',
            '7d': '(7 Days)',
            '15d': '(15 Days)',
            '30d': '(30 Days)'
        },

        // Chart related
        'chart': {
            'usage': 'Usage',
            'tooltip': {
                'usage': 'Usage: {value}%',
                'time': 'Time'
            }
        },

        // Time range buttons
        'timeButtons': {
            '1h': '1 Hour',
            '24h': '24 Hours',
            '7d': '7 Days',
            '15d': '15 Days',
            '30d': '30 Days'
        },

        // Settings dialog
        'settings': {
            'title': 'Settings',
            'apiUrl': 'ZABBIX API URL:',
            'apiToken': 'ZABBIX API TOKEN:',
            'refreshInterval': 'Refresh Interval:',
            'intervals': {
                '5s': '5 seconds',
                '30s': '30 seconds',
                '1m': '1 minute',
                '5m': '5 minutes',
                '10m': '10 minutes',
                '30m': '30 minutes'
            },
            'buttons': {
                'test': 'Test Connection',
                'save': 'Save Settings'
            },
            'messages': {
                'testing': 'Testing connection...',
                'connectionSuccess': 'Connection successful',
                'connectionFailed': 'Connection failed',
                'apiUrlAutoComplete': 'Automatically added api_jsonrpc.php path',
                'savingSettings': 'Saving settings...',
                'lastRefresh': 'Last Refresh: {time}',
                'settingsSaved': 'Settings saved',
                'settingsSaveFailed': 'Failed to save settings',
                'loadFailed': 'Failed to load settings dialog'
            }
        },

        'nav': {
            'dashboard': 'Dashboard',
            'cmdb': 'CMDB',
            'bigScreen': 'Big Screen',
            'screen1': 'Alert Monitoring Screen',
            'screen2': 'Resource Monitoring Screen',
            'screen3': 'Comprehensive Monitoring Screen',
            'screen4': 'Service Availability Screen'
        },

        'performanceMonitor': 'Performance Monitor',
        'units': {
            'percentage': '%'
        },
        
        // Dashboard2 Resource Monitoring
        'dashboard2': {
            'title': 'Zabbix Resource Utilization Monitoring Dashboard',
            'hostOverview': 'Host Overview',
            'loadingHostData': 'Loading host data...',
            'cpuTrend': 'CPU Usage Trend',
            'memoryDistribution': 'Memory Usage Distribution',
            'cpuDistribution': 'CPU Usage Distribution',
            'loadingCpuData': 'Loading CPU distribution data...',
            'alertTrend7Days': '7-Day Alert Trend Comparison',
            'loadingAlertData': 'Loading alert trend data...',
            'memoryTrend': 'Memory Usage Trend',
            'loadingMemoryData': 'Loading memory trend data...',
            'lastRefresh': 'Last Refresh:',
            'hostStats': {
                'healthy': 'Healthy Hosts',
                'warning': 'Warning Hosts',
                'critical': 'Critical Hosts',
                'unknown': 'Unknown Status'
            },
            'resourceUsage': 'Average Resource Usage',
            'hostOverload': 'Large number of hosts ({count}), showing key information. Click to view full list',
            'viewAll': 'View All',
            'memory': 'Memory',
            'cpuUsage': 'CPU Usage',
            'memoryUsage': 'Memory Usage',
            'cpuUsagePercent': 'CPU Usage (%)',
            'memoryUsagePercent': 'Memory Usage (%)',
            'hostCount': 'Host Count',
            'hostCountLabel': 'Host Count',
            'percentage': 'Percentage',
            'memoryDistributionChart': 'Memory Usage Distribution',
            'cpuDistributionChart': 'CPU Usage Distribution',
            'sortAsc': 'Sort Ascending',
            'sortDesc': 'Sort Descending',
            'severity': {
                'normal': 'Normal',
                'warning': 'Warning',
                'critical': 'Critical'
            },
            'sortBy': {
                'name': 'Host Name',
                'ip': 'IP Address',
                'cpu': 'CPU Usage',
                'memory': 'Memory Usage',
                'status': 'Status'
            },
            'chartTitles': {
                'avgCpu': 'Average CPU ({count} hosts)',
                'maxCpu': 'Max CPU',
                'minCpu': 'Min CPU',
                'avgMemory': 'Average Memory ({count} hosts)',
                'maxMemory': 'Max Memory',
                'minMemory': 'Min Memory',
                'alertCount': 'Alert Count'
            },
            'tooltipFormats': {
                'hostCountWithPercentage': '{b}: {c} hosts ({d}%)',
                'hostCountOnly': '{b}\n{c} hosts',
                'alertDetails': '{value} alerts'
            },
            'units': {
                'hosts': ' hosts',
                'count': ' items'
            },
            'dateFormat': {
                'monthDay': '{month}/{day}'
            },
            'messages': {
                'noHostData': 'No host data found',
                'refreshIntervalUpdated': 'Refresh interval updated to {seconds} seconds',
                'apiReinitialized': 'API settings updated',
                'reinitializeApiFailed': 'Failed to reinitialize API: {error}',
                'lastRefreshTime': 'Last Refresh: {time}',
                'alertTrendChartNotInit': 'Alert trend chart not initialized',
                'cannotLoadAlertTrend': 'Cannot load alert trend data',
                'cannotLoadCpuData': 'Cannot load CPU data',
                'cannotLoadMemoryData': 'Cannot load memory data',
                'cannotLoadCpuDistribution': 'Cannot load CPU distribution data',
                'cannotLoadMemoryTrend': 'Cannot load memory trend data',
                'cpuStats': 'CPU Stats - Avg: {avg}%, Max: {max}%, Min: {min}%',
                'memoryStats': 'Memory Stats - Avg: {avg}%, Max: {max}%, Min: {min}%'
            }
        },
        
        // Dashboard3 Comprehensive Monitoring
        'dashboard3': {
            'title': 'Zabbix Comprehensive Monitoring Dashboard',
            'totalHosts': 'Total Hosts',
            'activeAlerts': 'Active Alerts',
            'hostGroups': 'Host Groups',
            'avgCpu': 'Avg CPU',
            'avgMemory': 'Avg Memory',
            'hostGroupHealth': 'Host Group Health',
            'severityDistribution': 'Severity Distribution',
            'hostStatusGauge': 'Host Health Rate',
            'topCpuHosts': 'TOP10 CPU Usage',
            'topMemoryHosts': 'TOP10 Memory Usage',
            'recentAlerts': 'Recent Alerts',
            'healthyHosts': 'Healthy Hosts',
            'problemHosts': 'Problem Hosts',
            'healthRate': 'Health Rate',
            'healthy': 'Healthy',
            'problem': 'Problem',
            'memory': 'Memory',
            'noAlerts': 'No Alerts',
            'lastRefresh': 'Last Refresh:',
            'lastRefreshTime': 'Last Refresh: {time}'
        },

        // Dashboard1 Alert Monitoring
        'dashboard1': {
            'title': 'Zabbix Alert Monitoring Dashboard',
            'hostCount': 'Host Count',
            'alertingHosts': 'Alerting Hosts',
            'hostGroups': 'Host Groups',
            'processedAlerts': 'Processed Alerts',
            'severityChart': 'Alert Severity Classification',
            'alertTrend7Days': '7-Day Alert Trend Comparison',
            'monitoringOverview': 'Monitoring Overview',
            'pendingAlerts': 'Pending Alerts',
            'hostAlertDistribution': 'Host Alert Distribution',
            'chartSeries': {
                'totalAlerts': 'Total Alerts',
                'activeAlerts': 'Active Alerts',
                'resolvedAlerts': 'Resolved Alerts'
            },
            'tableHeaders': {
                'hostname': 'Host Name',
                'alert': 'Alert',
                'severity': 'Severity',
                'duration': 'Duration'
            },
            'monitorStatus': {
                'normal': 'Normal',
                'problem': 'Problem',
                'disabled': 'Disabled'
            },
            'severity': {
                'disaster': 'Disaster',
                'high': 'High',
                'average': 'Average',
                'warning': 'Warning',
                'information': 'Information',
                'unknown': 'Unknown'
            },
            'timeFormat': {
                'minutesAgo': '{minutes} minutes ago',
                'hoursAgo': '{hours} hours ago',
                'daysAgo': '{days} days ago'
            },
            'noData': {
                'noAlertingHosts': 'No alerting hosts',
                'noPendingAlerts': 'No pending alerts'
            },
            'unknownData': {
                'unknownHost': 'Unknown Host',
                'unknownProblem': 'Unknown Problem'
            },
            'lastRefresh': 'Last Refresh: {time}',
            'units': {
                'hosts': ' hosts'
            },
            'tooltip': {
                'hostCount': '{name}: {value} hosts ({percent}%)'
            }
        },        
        // Dashboard4 Service Availability
        'dashboard4': {
            'title': 'Service Availability Dashboard',
            'monitoredHosts': 'Monitored Hosts',
            'availabilityRate': 'Availability',
            'activeProblems': 'Active Problems',
            'resolvedToday': 'Resolved Today',
            'hostGroups': 'Host Groups',
            'alertHeatmap': '7-Day Alert Heatmap',
            'severityRadar': 'Severity Radar',
            'groupProblems': 'Group Problems',
            'availabilityTrend': '24h Availability Trend',
            'topProblemHosts': 'Top Problem Hosts',
            'recentEvents': 'Event Feed',
            'noEvents': 'No Events',
            'alertCount': 'Alerts',
            'resolved': 'Resolved',
            'lastRefresh': 'Last Refresh:',
            'lastRefreshTime': 'Last Refresh: {time}'
        },

        // Error and Status Messages
        'errors': {
            'loadFailed': 'Load Failed',
            'connectionFailed': 'Connection Failed',
            'noData': 'No Data',
            'chartError': 'Chart Load Error'
        },

        // Common Fields
        'time': 'Time',
        'ipAddress': 'IP Address'
    }
};

class I18n {
    constructor() {
        this.currentLang = this.getBrowserLanguage();
    }

    getBrowserLanguage() {
        const lang = navigator.language || navigator.userLanguage;
        return lang.startsWith('zh') ? 'zh' : 'en';
    }

    t(key) {
        const keys = key.split('.');
        let value = translations[this.currentLang];
        
        for (const k of keys) {
            value = value[k];
            if (!value) break;
        }
        
        return value || key;
    }
}

const i18n = new I18n(); 