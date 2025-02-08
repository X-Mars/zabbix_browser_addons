<template>
  <el-config-provider :locale="locale">
    <div class="app-container">
      <div class="top-bar">
        <div class="nav-container">
          <div class="logo">Zabbix Dashboard</div>
          <el-menu mode="horizontal" :default-active="route.path" router>
            <el-menu-item index="/dashboard">{{ t('dashboard.title') }}</el-menu-item>
            <el-menu-item index="/hosts">{{ t('hosts.title') }}</el-menu-item>
          </el-menu>
          <div class="actions">
            <span class="refresh-info">
              {{ t('common.lastRefresh') }}: {{ formatDateTime(lastRefreshTime) }}
            </span>
            <el-button
              type="primary"
              link
              @click="showSettings = true"
            >
              <el-icon><Setting /></el-icon>
            </el-button>
          </div>
        </div>
      </div>
      
      <div class="main-content">
        <router-view v-if="settingsStore.initialized" />
      </div>
      
      <settings-dialog
        v-model="showSettings"
        :initial-setup="!settingsStore.initialized"
      />
    </div>
  </el-config-provider>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Setting } from '@element-plus/icons-vue'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import en from 'element-plus/dist/locale/en.mjs'
import SettingsDialog from '@/components/SettingsDialog.vue'
import { useSettingsStore } from '@/stores/settings'
import { formatDateTime } from '@/utils/time'

const route = useRoute()
const { t, locale: currentLocale } = useI18n()
const settingsStore = useSettingsStore()
const locale = ref(currentLocale.value.startsWith('zh') ? zhCn : en)
const showSettings = ref(false)
const lastRefreshTime = ref(new Date())

watch(currentLocale, (val) => {
  locale.value = val.startsWith('zh') ? zhCn : en
})

onMounted(() => {
  settingsStore.loadSettings()
  if (!settingsStore.initialized) {
    showSettings.value = true
  }
})
</script>

<style scoped lang="scss">
.app-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.top-bar {
  border-bottom: 1px solid var(--el-border-color-light);
  background-color: var(--el-bg-color);
}

.nav-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  height: 50px;
}

.logo {
  font-size: 18px;
  font-weight: bold;
  margin-right: 40px;
  white-space: nowrap;
}

.actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.refresh-info {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

:deep(.el-menu) {
  flex: 1;
  display: flex;
  justify-content: center;
  border-bottom: none;
}

:deep(.el-menu-item) {
  font-size: 14px;
  height: 50px;
  line-height: 50px;
}

.main-content {
  flex: 1;
  min-height: 0;
  padding: 20px;
  background-color: var(--el-bg-color-page);
}
</style> 