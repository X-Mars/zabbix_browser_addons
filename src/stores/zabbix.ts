import { defineStore } from 'pinia'
import { ref } from 'vue'
import { ZabbixAPI } from '@/api/zabbix'
import type { Alert } from '@/types'

export const useZabbixStore = defineStore('zabbix', () => {
  const api = ref<ZabbixAPI | null>(null)
  const hostCount = ref(0)
  const alertCount = ref(0)
  const alerts = ref<Alert[]>([])
  const alertTrendData = ref<any[]>([])
  const severityData = ref<any[]>([])
  const lastRefreshTime = ref('')

  const initApi = (url: string, token: string) => {
    api.value = new ZabbixAPI(url, token)
  }

  const refreshData = async () => {
    if (!api.value) {
      throw new Error('API not initialized')
    }

    try {
      // 获取主机数量
      const hosts = await api.value.getHosts()
      hostCount.value = hosts.length

      // 获取告警数据（现在已经包含主机名）
      const problems = await api.value.getProblems()
      
      // 只统计未恢复的告警数量
      alertCount.value = problems.filter(problem => problem.r_status === '1').length
      alerts.value = problems

      // 更新告警趋势数据
      const trendData = problems.reduce((acc: any[], problem: any) => {
        const time = parseInt(problem.clock) * 1000
        const existing = acc.find(item => item.value[0] === time)
        if (existing) {
          existing.value[1]++
        } else {
          acc.push({
            name: new Date(time).toLocaleString(),
            value: [time, 1]
          })
        }
        return acc
      }, []).sort((a: any, b: any) => a.value[0] - b.value[0])
      alertTrendData.value = trendData

      // 更新告警级别分布
      const severityCount = problems.reduce((acc: any, problem: any) => {
        acc[problem.severity] = (acc[problem.severity] || 0) + 1
        return acc
      }, {})
      
      severityData.value = Object.entries(severityCount).map(([severity, count]) => ({
        name: getSeverityLabel(severity),
        value: count
      }))

      // 更新刷新时间
      lastRefreshTime.value = new Date().toLocaleString()
    } catch (error) {
      console.error('Failed to refresh data:', error)
      throw error
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

  return {
    hostCount,
    alertCount,
    alerts,
    alertTrendData,
    severityData,
    lastRefreshTime,
    initApi,
    refreshData
  }
}) 