const messages = {
  dashboard: {
    title: '仪表盘',
    hostCount: '主机数量',
    alertCount: '告警数量',
    alertTrend: '告警趋势',
    alertDistribution: '告警分布',
    recentAlerts: '最近告警'
  },
  hosts: {
    title: '主机列表',
    name: '主机名称',
    ip: 'IP地址',
    status: '状态',
    detail: '详情',
    performance: '性能监控',
    enabled: '启用',
    disabled: '禁用',
    items: '监控项',
    itemName: '监控项名称',
    lastValue: '最新值',
    lastCheck: '最后检查',
    history: '历史数据',
    problems: '问题'
  },
  alerts: {
    content: '告警内容',
    severity: {
      0: '未分类',
      1: '信息',
      2: '警告',
      3: '一般',
      4: '严重',
      5: '灾难'
    }
  },
  settings: {
    title: '设置',
    initialSetup: '初始设置',
    apiUrl: 'API地址',
    apiToken: 'API令牌',
    refreshInterval: '刷新间隔',
    test: '测试连接',
    save: '保存',
    cancel: '取消',
    testSuccess: '连接成功',
    testError: '连接失败',
    saveSuccess: '保存成功',
    saveError: '保存失败'
  },
  common: {
    lastRefresh: '最后刷新',
    loading: '加载中',
    error: '错误',
    retry: '重试',
    confirm: '确认',
    cancel: '取消',
    refresh: '刷新',
    time: '时间',
    actions: '操作'
  }
}

export default messages 