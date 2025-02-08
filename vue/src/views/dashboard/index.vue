<template>
  <div class="dashboard">
    <!-- 状态卡片 -->
    <div class="status-cards">
      <status-card
        type="primary"
        icon="Monitor"
        :label="t('dashboard.hostCount')"
        :value="dashboardStore.hosts.length"
      />
      <status-card
        type="warning"
        icon="Warning"
        :label="t('dashboard.alertCount')"
        :value="dashboardStore.alerts.length"
      />
    </div>

    <!-- 图表区域 -->
    <div class="charts">
      <el-card class="chart-card">
        <template #header>
          <div class="card-header">
            <span>{{ t('dashboard.alertTrend') }}</span>
          </div>
        </template>
        <div class="chart-container">
          <trend-chart ref="trendChartRef" />
        </div>
      </el-card>

      <el-card class="chart-card">
        <template #header>
          <div class="card-header">
            <span>{{ t('dashboard.alertDistribution') }}</span>
          </div>
        </template>
        <div class="chart-container">
          <severity-chart ref="severityChartRef" />
        </div>
      </el-card>
    </div>

    <!-- 告警列表 -->
    <el-card class="alert-list">
      <template #header>
        <div class="card-header">
          <span>{{ t('dashboard.recentAlerts') }}</span>
        </div>
      </template>
      <el-table :data="dashboardStore.alerts" height="100%">
        <el-table-column :label="t('hosts.name')" prop="hosts[0].name" />
        <el-table-column :label="t('alerts.content')" prop="name" />
        <el-table-column :label="t('alerts.severity')" width="120">
          <template #default="{ row }">
            <el-tag :type="getSeverityType(row.severity)">
              {{ t(`alerts.severity.${row.severity}`) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('common.time')" width="180">
          <template #default="{ row }">
            {{ getTimeAgo(Number(row.clock)) }}
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import StatusCard from '@/components/StatusCard.vue'
import TrendChart from './components/TrendChart.vue'
import SeverityChart from './components/SeverityChart.vue'
import { useDashboardStore } from '@/stores/dashboard'
import { getTimeAgo } from '@/utils/time'

const { t } = useI18n()
const dashboardStore = useDashboardStore()
const trendChartRef = ref()
const severityChartRef = ref()
let refreshTimer: number | null = null

// 获取告警等级对应的类型
const getSeverityType = (severity: string) => {
  const types = {
    '0': 'info',
    '1': 'info',
    '2': 'warning',
    '3': 'warning',
    '4': 'danger',
    '5': 'danger'
  }
  return types[severity] || 'info'
}

// 启动定时刷新
const startAutoRefresh = () => {
  stopAutoRefresh() // 先清除可能存在的定时器
  refreshTimer = window.setInterval(() => {
    dashboardStore.fetchDashboardData()
  }, dashboardStore.refreshInterval)
}

// 停止定时刷新
const stopAutoRefresh = () => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}

onMounted(async () => {
  await dashboardStore.fetchDashboardData()
  startAutoRefresh()
})

onUnmounted(() => {
  stopAutoRefresh()
})
</script>

<style scoped lang="scss">
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 20px;
  height: 100%;
}

.status-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

.charts {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
  height: 400px;
}

.chart-card {
  height: 100%;
  display: flex;
  flex-direction: column;

  .chart-container {
    flex: 1;
    min-height: 0;
  }
}

.alert-list {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;

  :deep(.el-card__body) {
    flex: 1;
    min-height: 0;
    padding: 0;
  }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style> 