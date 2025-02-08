<template>
  <el-card class="statistic-card" :class="{ warning: title === '当前告警' && value > 0 }">
    <div class="card-content">
      <el-icon :size="40" class="card-icon">
        <component :is="icon" />
      </el-icon>
      <div class="card-info">
        <div class="card-title">
          {{ title }}
        </div>
        <div class="card-value" :class="{ 'has-alerts': title === '当前告警' && value > 0 }">
          {{ value }}
        </div>
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  value: number
  icon: string
}>()
</script>

<style scoped>
.statistic-card {
  height: 120px;
  background: linear-gradient(135deg, var(--el-bg-color), var(--el-bg-color-page));
  transition: all 0.3s ease;
}

.warning {
  background: linear-gradient(135deg, var(--el-color-danger-light-5), var(--el-color-danger-light-9));
}

.card-content {
  display: flex;
  align-items: center;
  gap: 20px;
  height: 100%;
  justify-content: space-between;
}

.card-icon {
  color: var(--el-color-primary-dark-2);
  opacity: 0.8;
  margin-left: 12px;
}

.warning .card-icon {
  color: var(--el-color-danger);
}

.card-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-right: 12px;
  align-items: flex-end;
}

.card-title {
  font-size: 16px;
  color: var(--el-text-color-secondary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.card-value {
  font-size: 28px;
  font-weight: bold;
  color: var(--el-text-color-primary);
  text-align: right;
}

.has-alerts {
  color: var(--el-color-danger);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.7; }
  100% { opacity: 1; }
}
</style> 