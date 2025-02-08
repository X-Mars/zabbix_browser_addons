<template>
  <div class="host-detail">
    <el-card>
      <template #header>
        <div class="card-header">
          <div class="title">
            <el-button link @click="router.back()">
              <el-icon><ArrowLeft /></el-icon>
            </el-button>
            {{ host?.name }}
          </div>
          <el-button-group>
            <el-button type="primary" @click="handleRefresh">
              <el-icon><Refresh /></el-icon>
              {{ t('common.refresh') }}
            </el-button>
            <el-button type="primary" @click="handlePerformance">
              {{ t('hosts.performance') }}
            </el-button>
          </el-button-group>
        </div>
      </template>

      <el-descriptions :column="2" border>
        <el-descriptions-item :label="t('hosts.name')">
          {{ host?.name }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('hosts.ip')">
          {{ host?.interfaces[0]?.ip }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('hosts.status')">
          <el-tag :type="host?.status === '0' ? 'success' : 'danger'">
            {{ host?.status === '0' ? t('hosts.enabled') : t('hosts.disabled') }}
          </el-tag>
        </el-descriptions-item>
      </el-descriptions>

      <!-- 监控项列表 -->
      <div class="items-list">
        <div class="section-title">{{ t('hosts.items') }}</div>
        <el-table :data="items" v-loading="loading">
          <el-table-column :label="t('hosts.itemName')" prop="name" />
          <el-table-column :label="t('hosts.lastValue')" width="200" prop="lastvalue" />
          <el-table-column :label="t('hosts.lastCheck')" width="180">
            <template #default="{ row }">
              {{ formatDateTime(Number(row.lastclock)) }}
            </template>
          </el-table-column>
          <el-table-column :label="t('common.actions')" width="100" fixed="right">
            <template #default="{ row }">
              <el-button type="primary" link @click="handleItemHistory(row)">
                {{ t('hosts.history') }}
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 告警列表 -->
      <div class="problems-list">
        <div class="section-title">{{ t('hosts.problems') }}</div>
        <el-table :data="problems" v-loading="loading">
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
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import type { Host } from '@/api/types'
import ZabbixAPI from '@/api/zabbix'
import { formatDateTime, getTimeAgo } from '@/utils/time'

const router = useRouter()
const route = useRoute()
const { t } = useI18n()
const api = new ZabbixAPI()

const host = ref<Host>()
const items = ref([])
const problems = ref([])
const loading = ref(false)

const hostId = route.params.id as string

const fetchData = async () => {
  loading.value = true
  try {
    const [hostData, itemsData, problemsData] = await Promise.all([
      api.getHostById(hostId),
      api.getHostItems(hostId),
      api.getHostProblems(hostId)
    ])
    host.value = hostData[0]
    items.value = itemsData
    problems.value = problemsData
  } catch (error) {
    console.error('Failed to fetch host data:', error)
  } finally {
    loading.value = false
  }
}

const handleRefresh = () => {
  fetchData()
}

const handlePerformance = () => {
  router.push(`/hosts/${hostId}/performance`)
}

const handleItemHistory = (item: any) => {
  router.push(`/hosts/${hostId}/items/${item.itemid}/history`)
}

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

onMounted(() => {
  fetchData()
})
</script>

<style scoped lang="scss">
.host-detail {
  height: 100%;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;

  .title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    font-weight: bold;
  }
}

.section-title {
  font-size: 14px;
  font-weight: bold;
  margin: 24px 0 16px;
  padding-left: 8px;
  border-left: 4px solid var(--el-color-primary);
}

.items-list,
.problems-list {
  margin-top: 20px;
}
</style> 