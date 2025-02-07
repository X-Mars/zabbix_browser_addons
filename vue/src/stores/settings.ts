import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useSettingsStore = defineStore('settings', () => {
  const apiUrl = ref('')
  const apiToken = ref('')
  const refreshInterval = ref(30000) // 默认30秒
  const initialized = ref(false)

  function setSettings(settings: {
    apiUrl: string
    apiToken: string
    refreshInterval?: number
  }) {
    apiUrl.value = settings.apiUrl
    apiToken.value = settings.apiToken
    if (settings.refreshInterval) {
      refreshInterval.value = settings.refreshInterval
    }
    initialized.value = true
    saveSettings()
  }

  function loadSettings() {
    const settings = localStorage.getItem('settings')
    if (settings) {
      const parsed = JSON.parse(settings)
      apiUrl.value = parsed.apiUrl
      apiToken.value = parsed.apiToken
      refreshInterval.value = parsed.refreshInterval
      initialized.value = true
    }
  }

  function saveSettings() {
    localStorage.setItem('settings', JSON.stringify({
      apiUrl: apiUrl.value,
      apiToken: apiToken.value,
      refreshInterval: refreshInterval.value
    }))
  }

  return {
    apiUrl,
    apiToken,
    refreshInterval,
    initialized,
    setSettings,
    loadSettings,
    saveSettings
  }
})