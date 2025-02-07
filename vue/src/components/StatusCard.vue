<template>
  <el-card class="status-card" :class="type">
    <div class="card-content">
      <el-icon class="icon" :size="24">
        <component :is="icon" />
      </el-icon>
      <div class="info">
        <div class="label">{{ label }}</div>
        <div class="value">{{ value }}</div>
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
defineProps<{
  type: 'primary' | 'success' | 'warning' | 'danger'
  icon: string
  label: string
  value: string | number
}>()
</script>

<style scoped lang="scss">
.status-card {
  .card-content {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .icon {
    padding: 12px;
    border-radius: 8px;
  }

  .info {
    flex: 1;

    .label {
      font-size: 14px;
      color: var(--el-text-color-secondary);
      margin-bottom: 4px;
    }

    .value {
      font-size: 24px;
      font-weight: bold;
    }
  }

  &.primary {
    .icon {
      background-color: var(--el-color-primary-light-9);
      color: var(--el-color-primary);
    }
    .value {
      color: var(--el-color-primary);
    }
  }

  &.success {
    .icon {
      background-color: var(--el-color-success-light-9);
      color: var(--el-color-success);
    }
    .value {
      color: var(--el-color-success);
    }
  }

  &.warning {
    .icon {
      background-color: var(--el-color-warning-light-9);
      color: var(--el-color-warning);
    }
    .value {
      color: var(--el-color-warning);
    }
  }

  &.danger {
    .icon {
      background-color: var(--el-color-danger-light-9);
      color: var(--el-color-danger);
    }
    .value {
      color: var(--el-color-danger);
    }
  }
}
</style>