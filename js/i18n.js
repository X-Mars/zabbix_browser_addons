const translations = {
    zh: {
        // 标题和按钮
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
        'hostName': '主机名称',
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
        'hostName': '主机名称',
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
        'hostName': '主机名称',
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
            'lessThanOneMinute': '小于1分钟',
            'runningTime': '运行时间'
        },

        // 图表标题
        'chartTitle': {
            'cpu': 'CPU使用率',
            'memory': '内存使用率',
            'usage': '使用率'
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
            'apiUrl': 'API URL:',
            'apiToken': 'API Token:',
            'refreshInterval': '刷新间隔:',
            'intervals': {
                '5s': '5秒',
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
                'settingsSaved': '设置已保存',
                'settingsSaveFailed': '保存设置失败'
            }
        }
    },
    en: {
        // Titles and buttons
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
        'ipAddress': 'IP Address',
        'operatingSystem': 'Operating System',
        'cpuCores': 'CPU Cores',
        'memoryTotal': 'Memory',
        'cpuUsage': 'CPU Usage',
        'memoryUsage': 'Memory Usage',
        'alerts': 'Alerting',

        // Time related
        'time': {
            'days': 'days',
            'hours': 'hours',
            'minutes': 'minutes',
            'seconds': 'seconds',
            'lessThanOneMinute': 'less than 1 minute',
            'runningTime': 'Running Time'
        },

        // Chart titles
        'chartTitle': {
            'cpu': 'CPU Usage',
            'memory': 'Memory Usage',
            'usage': 'Usage'
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
            'apiUrl': 'API URL:',
            'apiToken': 'API Token:',
            'refreshInterval': 'Refresh Interval:',
            'intervals': {
                '5s': '5 seconds',
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
                'settingsSaved': 'Settings saved',
                'settingsSaveFailed': 'Failed to save settings'
            }
        }
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