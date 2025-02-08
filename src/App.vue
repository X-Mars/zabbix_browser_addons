<template>
  <el-container class="layout-container">
    <el-header class="app-header">
      <div class="header-content">
        <div class="logo-title">
          <img src="@/assets/zabbix.png" class="logo" alt="logo">
          <h1 class="app-title">Zabbix Dashboard</h1>
        </div>
        <div class="header-actions">
          <span class="last-refresh">
            <el-icon><Timer /></el-icon>
            {{ store.lastRefreshTime }}
          </span>
          <el-button type="primary" @click="refreshData">
            <el-icon><Refresh /></el-icon>
          </el-button>
          <el-button type="info" plain @click="showSettings">
            <el-icon><Setting /></el-icon>
          </el-button>
        </div>
      </div>
    </el-header>

    <el-main>
      <el-row :gutter="24">
        <el-col :span="12">
          <statistic-card title="主机数量" :value="store.hostCount" icon="Monitor" />
        </el-col>
        <el-col :span="12">
          <statistic-card title="当前告警" :value="store.alertCount" icon="Warning" />
        </el-col>
      </el-row>

      <el-row :gutter="24" class="mt-4">
        <el-col :span="12">
          <alert-trend :data="store.alertTrendData" />
        </el-col>
        <el-col :span="12">
          <severity-chart :data="store.severityData" />
        </el-col>
      </el-row>

      <alert-history class="mt-4" :alerts="store.alerts" />
    </el-main>
    <settings-dialog 
      ref="settingsDialogRef" 
      @refresh-interval-changed="handleRefreshIntervalChange" 
    />
  </el-container>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useZabbixStore } from '@/stores/zabbix'
import storage from '@/utils/storage'
import StatisticCard from '@/components/StatisticCard.vue'
import AlertTrend from '@/components/AlertTrend.vue'
import SeverityChart from '@/components/SeverityChart.vue'
import AlertHistory from '@/components/AlertHistory.vue'
import SettingsDialog from '@/components/SettingsDialog.vue'

const store = useZabbixStore()
const settingsDialogRef = ref<InstanceType<typeof SettingsDialog>>()
const refreshTimer = ref<number | undefined>(undefined)

// 检查是否为浏览器插件模式
const isExtensionMode = () => {
  return typeof chrome !== 'undefined' && chrome.runtime?.id
}

const refreshData = async () => {
  try {
    await store.refreshData()
  } catch (error) {
    console.error('Failed to refresh data:', error)
    ElMessage.error('刷新数据失败')
  }
}

const startRefreshTimer = (interval: number) => {
  // 清除现有定时器
  if (refreshTimer.value) {
    clearInterval(refreshTimer.value)
    refreshTimer.value = undefined
  }
  // 设置新的定时器
  if (isExtensionMode()) {
    // 在插件模式下使用 chrome.alarms API
    chrome.alarms.create('refreshData', { periodInMinutes: interval / 60000 })
  } else {
    // 在浏览器模式下使用 setInterval
    refreshTimer.value = window.setInterval(refreshData, interval)
  }
}

const showSettings = () => {
  settingsDialogRef.value?.show()
}

const handleRefreshIntervalChange = (interval: number) => {
  startRefreshTimer(interval)
}

onMounted(async () => {
  try {
    // 从存储加载设置
    const settings = await storage.local.get(['apiUrl', 'apiToken', 'refreshInterval'])
    
    // 检查是否有API配置
    const hasApiConfig = settings.apiUrl && settings.apiToken
    
    if (hasApiConfig) {
      store.initApi(settings.apiUrl, settings.apiToken)
      await refreshData()
      
      // 设置定时刷新
      const interval = settings.refreshInterval || 60000
      startRefreshTimer(interval)

      // 在插件模式下设置 alarm 监听器
      if (isExtensionMode()) {
        chrome.alarms.onAlarm.addListener((alarm) => {
          if (alarm.name === 'refreshData') {
            refreshData()
          }
        })
      }
    } else if (isExtensionMode()) {
      // 只在插件模式下自动显示设置对话框
      showSettings()
    }
  } catch (error) {
    console.error('Failed to load settings:', error)
    ElMessage.error('加载设置失败')
  }
})

onUnmounted(() => {
  if (refreshTimer.value) {
    clearInterval(refreshTimer.value)
    refreshTimer.value = undefined
  }
  if (isExtensionMode()) {
    chrome.alarms.clear('refreshData')
  }
})
</script>

<style scoped>
.layout-container {
  min-height: 100vh;
  width: 100vw;
  height: 100vh;
  background-color: var(--el-bg-color-page);
}

.app-header {
  background: linear-gradient(135deg, var(--el-color-primary), var(--el-color-primary-light-3));
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 100%;
  padding: 0 20px;
}

.app-title {
  color: white;
  font-size: 1.5rem;
  font-weight: 500;
  margin: 0;
}

.el-main {
  padding: 24px;
  height: calc(100vh - 60px);
  overflow-y: auto;
}

.el-row {
  margin-bottom: 5px;
}

.el-col {
  margin-bottom: 5px;
}

.logo-title {
  display: flex;
  align-items: center;
  gap: 16px;
}

.logo {
  width: 32px;
  height: 32px;
  filter: brightness(0) invert(1);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.last-refresh {
  color: white;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  opacity: 0.9;
}

.el-button {
  border-radius: 8px;
}

.el-button--primary {
  background: rgba(255, 255, 255, 0.2);
  border: none;
}

.el-button--info.is-plain {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: white;
}

.mt-4 {
  margin-top: 5px;
}

:deep(.el-card) {
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
}

:deep(.el-card:hover) {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
}
</style> 