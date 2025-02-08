<template>
  <el-card class="alert-card">
    <template #header>
      <div class="card-header">
        <div class="header-title">
          <el-icon><Warning /></el-icon>
          一周内告警历史
        </div>
        <el-tag type="info" size="small">
          共 {{ alerts.length }} 条
        </el-tag>
      </div>
    </template>
    <el-table 
      :data="alerts" 
      style="width: 100%" 
      height="300"
      :row-class-name="getRowClassName"
    >
      <el-table-column prop="hostname" label="主机" width="180">
        <template #default="{ row }">
          <div class="host-cell">
            <el-icon><Monitor /></el-icon>
            {{ row.hostname || '未知主机' }}
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="name" label="告警内容" />
      <el-table-column prop="r_status" label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="getStatusType(row.r_status)" size="small">
            <el-icon><component :is="getStatusIcon(row.r_status)" /></el-icon>
            {{ getStatusLabel(row.r_status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="severity" label="级别" width="100">
        <template #default="{ row }">
          <el-tag :type="getSeverityType(row.severity)">
            <el-icon><Warning /></el-icon>
            {{ getSeverityLabel(row.severity) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="clock" label="时间" width="180">
        <template #default="{ row }">
          <div class="time-cell">
            <el-icon><Timer /></el-icon>
            {{ formatTime(row.clock) }}
          </div>
        </template>
      </el-table-column>
    </el-table>
  </el-card>
</template>

<script setup lang="ts">
import { Warning, Monitor, Timer, CircleCheck, CircleClose } from '@element-plus/icons-vue'
import type { Alert } from '@/types'

defineProps<{
  alerts: Alert[]
}>()

const getSeverityType = (severity: string) => {
  const types: Record<string, string> = {
    '0': 'info',
    '1': 'info',
    '2': 'warning',
    '3': 'warning',
    '4': 'danger',
    '5': 'danger'
  }
  return types[severity] || 'info'
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

const getStatusType = (status: string) => {
  const types: Record<string, string> = {
    '0': 'success',  // 已恢复
    '1': 'danger'    // 未恢复
  }
  return types[status] || 'info'
}

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    '0': '已恢复',
    '1': '告警中'
  }
  return labels[status] || '未知'
}

const getStatusIcon = (status: string) => {
  return status === '0' ? CircleCheck : CircleClose
}

const formatTime = (timestamp: string) => {
  return new Date(parseInt(timestamp) * 1000).toLocaleString()
}

const getRowClassName = ({ row }: { row: any }) => {
  return `severity-${row.severity}`
}
</script>

<style scoped>
.alert-card {
  height: calc(100vh - 200px);  /* 适应屏幕高度 */
}

.el-table {
  height: calc(100% - 60px);  /* 减去卡片header高度 */
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

.host-cell,
.time-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

:deep(.el-tag) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

:deep(.severity-4),
:deep(.severity-5) {
  background-color: var(--el-color-danger-light-9);
}

:deep(.severity-2),
:deep(.severity-3) {
  background-color: var(--el-color-warning-light-9);
}

:deep(.el-table__row) {
  transition: all 0.3s ease;
}

:deep(.el-table__row:hover) {
  transform: translateX(4px);
}
</style> 