<template>
  <div class="hosts">
    <el-card>
      <template #header>
        <div class="card-header">
          <div class="title">{{ t('hosts.title') }}</div>
          <el-button type="primary" @click="handleRefresh">
            <el-icon><Refresh /></el-icon>
            {{ t('common.refresh') }}
          </el-button>
        </div>
      </template>

      <el-table :data="hosts" v-loading="loading">
        <el-table-column :label="t('hosts.name')" prop="name" />
        <el-table-column :label="t('hosts.ip')" width="160">
          <template #default="{ row }">
            {{ row.interfaces[0]?.ip }}
          </template>
        </el-table-column>
        <el-table-column :label="t('hosts.status')" width="120">
          <template #default="{ row }">
            <el-tag :type="row.status === '0' ? 'success' : 'danger'">
              {{ row.status === '0' ? t('hosts.enabled') : t('hosts.disabled') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('common.actions')" width="200" fixed="right">
          <template #default="{ row }">
            <el-button-group>
              <el-button type="primary" link @click="handleDetail(row)">
                {{ t('hosts.detail') }}
              </el-button>
              <el-button type="primary" link @click="handlePerformance(row)">
                {{ t('hosts.performance') }}
              </el-button>
            </el-button-group>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import type { Host } from '@/api/types'
import ZabbixAPI from '@/api/zabbix'

const { t } = useI18n()
const router = useRouter()
const api = new ZabbixAPI()

const hosts = ref<Host[]>([])
const loading = ref(false)

const fetchHosts = async () => {
  loading.value = true
  try {
    hosts.value = await api.getHosts()
  } catch (error) {
    console.error('Failed to fetch hosts:', error)
  } finally {
    loading.value = false
  }
}

const handleRefresh = () => {
  fetchHosts()
}

const handleDetail = (host: Host) => {
  router.push(`/hosts/${host.hostid}`)
}

const handlePerformance = (host: Host) => {
  router.push(`/hosts/${host.hostid}/performance`)
}

onMounted(() => {
  fetchHosts()
})
</script>

<style scoped lang="scss">
.hosts {
  height: 100%;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;

  .title {
    font-size: 16px;
    font-weight: bold;
  }
}
</style> 