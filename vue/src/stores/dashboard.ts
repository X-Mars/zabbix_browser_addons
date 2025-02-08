import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Host, Alert } from '@/api/types'
import ZabbixAPI from '@/api/zabbix'
import { useSettingsStore } from './settings'

export const useDashboardStore = defineStore('dashboard', () => {
  const hosts = ref<Host[]>([])
  const alerts = ref<Alert[]>([])
  const loading = ref(false)

  const settingsStore = useSettingsStore()
  const api = new ZabbixAPI()

  const refreshInterval = computed(() => settingsStore.refreshInterval)

  async function fetchDashboardData() {
    if (!settingsStore.initialized || loading.value) {
      return
    }

    loading.value = true
    try {
      const [hostsData, alertsData] = await Promise.all([
        api.getHosts(),
        api.getAlerts()
      ])
      hosts.value = hostsData
      alerts.value = alertsData
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    } finally {
      loading.value = false
    }
  }

  return {
    hosts,
    alerts,
    loading,
    refreshInterval,
    fetchDashboardData
  }
}) 