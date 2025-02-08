<template>
  <div class="host-list">
    <el-card class="host-card">
      <template #header>
        <div class="card-header">
          <div class="header-title">
            <el-icon><Monitor /></el-icon>
            主机列表
          </div>
          <el-button type="primary" size="small" @click="refreshHosts">
            <el-icon><Refresh /></el-icon>
            刷新
          </el-button>
        </div>
      </template>
      <el-table :data="hosts" style="width: 100%" v-loading="loading">
        <el-table-column prop="name" label="主机名称" min-width="200">
          <template #default="{ row }">
            <div class="host-cell">
              <el-icon><Monitor /></el-icon>
              {{ row.name }}
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="host" label="主机标识" min-width="180" />
        <el-table-column prop="interfaces[0].ip" label="IP地址" min-width="140" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === '0' ? 'success' : 'danger'">
              {{ row.status === '0' ? '已启用' : '已禁用' }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Monitor, Refresh } from '@element-plus/icons-vue'
import { useZabbixStore } from '@/stores/zabbix'
import type { Host } from '@/types'

const store = useZabbixStore()
const hosts = ref<Host[]>([])
const loading = ref(false)

const refreshHosts = async () => {
  try {
    loading.value = true
    const result = await store.api?.getHosts()
    hosts.value = result || []
  } catch (error) {
    console.error('Failed to fetch hosts:', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  refreshHosts()
})
</script>

<style scoped>
.host-list {
  height: 100%;
}

.host-card {
  height: calc(100vh - 84px);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 500;
}

.host-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

:deep(.el-table) {
  height: calc(100% - 60px);
}
</style> 