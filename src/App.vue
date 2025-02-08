<template>
  <el-container class="layout-container">
    <el-header class="app-header">
      <div class="header-content">
        <div class="logo-title">
          <img src="@/assets/zabbix.png" class="logo" alt="logo">
          <h1 class="app-title">Zabbix Dashboard</h1>
        </div>
        <div class="nav-menu">
          <el-menu
            mode="horizontal"
            :ellipsis="false"
            class="header-menu"
            :default-active="activeMenu"
            @select="handleSelect"
          >
            <el-menu-item index="dashboard">
              <el-icon><DataBoard /></el-icon>
              仪表盘
            </el-menu-item>
            <el-menu-item index="hosts">
              <el-icon><Monitor /></el-icon>
              主机列表
            </el-menu-item>
          </el-menu>
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
      <router-view />
    </el-main>
    <settings-dialog 
      ref="settingsDialogRef" 
      @refresh-interval-changed="handleRefreshIntervalChange" 
    />
  </el-container>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { DataBoard, Monitor, Timer, Refresh, Setting } from '@element-plus/icons-vue'
import { useZabbixStore } from '@/stores/zabbix'
import storage from '@/utils/storage'
import SettingsDialog from '@/components/SettingsDialog.vue'

const store = useZabbixStore()
const router = useRouter()
const settingsDialogRef = ref<InstanceType<typeof SettingsDialog>>()
const refreshTimer = ref<number | undefined>(undefined)
const activeMenu = ref('dashboard')

const handleSelect = (key: string) => {
  router.push({ name: key })
}

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
  if (refreshTimer.value) {
    clearInterval(refreshTimer.value)
    refreshTimer.value = undefined
  }
  if (isExtensionMode()) {
    chrome.alarms.create('refreshData', { periodInMinutes: interval / 60000 })
  } else {
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
    const settings = await storage.local.get(['apiUrl', 'apiToken', 'refreshInterval'])
    const hasApiConfig = settings.apiUrl && settings.apiToken
    
    if (hasApiConfig) {
      store.initApi(settings.apiUrl, settings.apiToken)
      await refreshData()
      
      const interval = settings.refreshInterval || 60000
      startRefreshTimer(interval)

      if (isExtensionMode()) {
        chrome.alarms.onAlarm.addListener((alarm) => {
          if (alarm.name === 'refreshData') {
            refreshData()
          }
        })
      }
    } else if (isExtensionMode()) {
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
  gap: 24px;
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

.app-title {
  color: white;
  font-size: 1.5rem;
  font-weight: 500;
  margin: 0;
}

.nav-menu {
  flex: 1;
  display: flex;
  justify-content: center;
}

.header-menu {
  background: transparent;
  border-bottom: none;
}

:deep(.header-menu .el-menu-item) {
  color: rgba(255, 255, 255, 0.8);
  font-size: 16px;
  height: 60px;
  border-bottom: 2px solid transparent;
}

:deep(.header-menu .el-menu-item.is-active) {
  color: white;
  background: rgba(255, 255, 255, 0.1);
  border-bottom: 2px solid white;
}

:deep(.header-menu .el-menu-item:hover) {
  color: white;
  background: rgba(255, 255, 255, 0.1);
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

.el-main {
  padding: 24px;
  height: calc(100vh - 60px);
  overflow-y: auto;
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
</style> 