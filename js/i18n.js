const translations = {
    zh: {
        // 标题和按钮
        'pageTitle': {
            'settings': '设置',
            'dashboard': '仪表盘',
            'hostList': '主机列表',
            'screen1': '告警监控大屏',
            'screen2': '资源监控大屏'
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
        'hostList': '主机列表',
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
            'hostList': '主机列表',
            'bigScreen': '大屏展示',
            'screen1': '告警监控大屏',
            'screen2': '资源监控大屏'
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
        
        // Dashboard1告警监控专用
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

        // 通用字段
        'time': '时间',
        'ipAddress': 'IP地址'
    },
    en: {
        // Titles and buttons
        'pageTitle': {
            'settings': 'Settings',
            'dashboard': 'Dashboard',
            'hostList': 'Host List',
            'screen1': 'Alert Monitoring Screen',
            'screen2': 'Resource Monitoring Screen'
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

        // Navigation and titles
        'hostList': 'Host List',
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
            'hostList': 'Host List',
            'bigScreen': 'Big Screen',
            'screen1': 'Alert Monitoring Screen',
            'screen2': 'Resource Monitoring Screen'
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
                'hostCountOnly': '{b}\n{c} hosts'
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