import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ZabbixAPI } from '@/api/zabbix'
import type { Host, Alert, ChartData } from '@/types'

export const useZabbixStore = defineStore('zabbix', () => {
  // 状态
  const api = ref<ZabbixAPI | null>(null)
  const hostCount = ref(0)
  const alertCount = ref(0)
  const alerts = ref<Alert[]>([])
  const alertTrendData = ref<ChartData[]>([])
  const severityData = ref<ChartData[]>([])
  const lastRefreshTime = ref('')
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // 计算属性
  const hasApi = computed(() => api.value !== null)
  const activeAlerts = computed(() => alerts.value.filter(alert => alert.r_status === '1'))
  const resolvedAlerts = computed(() => alerts.value.filter(alert => alert.r_status === '0'))

  // 方法
  const initApi = (url: string, token: string) => {
    api.value = new ZabbixAPI(url, token)
  }

  const refreshData = async () => {
    if (!api.value) {
      throw new Error('API not initialized')
    }

    isLoading.value = true
    error.value = null

    try {
      // 获取主机数量
      const hosts = await api.value.getHosts()
      hostCount.value = hosts.length

      // 获取告警数据
      const problems = await api.value.getProblems()
      
      // 更新告警数量（只统计未恢复的告警）
      alertCount.value = problems.filter(problem => problem.r_status === '1').length
      alerts.value = problems

      // 更新告警趋势数据
      const trendData = problems.reduce((acc: ChartData[], problem: any) => {
        const time = parseInt(problem.clock) * 1000
        const existing = acc.find(item => (item.value as [number, number])[0] === time)
        if (existing) {
          (existing.value as [number, number])[1]++
        } else {
          acc.push({
            name: new Date(time).toLocaleString(),
            value: [time, 1]
          })
        }
        return acc
      }, []).sort((a, b) => (a.value as [number, number])[0] - (b.value as [number, number])[0])

      alertTrendData.value = trendData

      // 更新告警级别分布
      const severityCount = problems.reduce((acc: Record<string, number>, problem: any) => {
        acc[problem.severity] = (acc[problem.severity] || 0) + 1
        return acc
      }, {})
      
      severityData.value = Object.entries(severityCount).map(([severity, count]) => ({
        name: getSeverityLabel(severity),
        value: count
      }))

      // 更新刷新时间
      lastRefreshTime.value = new Date().toLocaleString()
    } catch (err: any) {
      console.error('Failed to refresh data:', err)
      error.value = err.message || '刷新数据失败'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const getSeverityLabel = (severity: string) => {
    const labels: Record<string, string> = {
      '0': '未分类',
      '1': '信息',
      '2': '警告',
      '3': '一般严重',
      '4': '严重',
      '5': '灾难'
    }
    return labels[severity] || '未知'
  }

  const clearStore = () => {
    api.value = null
    hostCount.value = 0
    alertCount.value = 0
    alerts.value = []
    alertTrendData.value = []
    severityData.value = []
    lastRefreshTime.value = ''
    isLoading.value = false
    error.value = null
  }

  return {
    // 状态
    api,
    hostCount,
    alertCount,
    alerts,
    alertTrendData,
    severityData,
    lastRefreshTime,
    isLoading,
    error,

    // 计算属性
    hasApi,
    activeAlerts,
    resolvedAlerts,

    // 方法
    initApi,
    refreshData,
    clearStore
  }
}) 