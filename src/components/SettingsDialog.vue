<template>
  <el-dialog
    v-model="visible"
    title="设置"
    :width="dialogWidth"
    :close-on-click-modal="false"
    class="settings-dialog"
    align-center
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="120px" class="settings-form">
      <el-form-item label="API地址" prop="apiUrl">
        <div class="form-item-content">
          <el-icon class="form-item-icon"><Link /></el-icon>
          <el-input 
            v-model="form.apiUrl" 
            placeholder="http://your-zabbix-server/api_jsonrpc.php" 
            :prefix-icon="Link"
          />
        </div>
      </el-form-item>
      <el-form-item label="API Token" prop="apiToken">
        <div class="form-item-content">
          <el-icon class="form-item-icon"><Key /></el-icon>
          <el-input 
            v-model="form.apiToken" 
            type="password" 
            show-password 
            :prefix-icon="Key"
          />
        </div>
      </el-form-item>
      <el-form-item label="刷新间隔" prop="refreshInterval">
        <div class="form-item-content">
          <el-icon class="form-item-icon"><Timer /></el-icon>
          <el-select v-model="form.refreshInterval">
            <el-option label="5秒" :value="5000" />
            <el-option label="30秒" :value="30000" />
            <el-option label="1分钟" :value="60000" />
            <el-option label="3分钟" :value="180000" />
            <el-option label="5分钟" :value="300000" />
          </el-select>
        </div>
      </el-form-item>
    </el-form>
    <template #footer>
      <span class="dialog-footer">
        <el-button plain @click="visible = false">
          <el-icon><Close /></el-icon>
          取消
        </el-button>
        <el-button type="warning" plain @click="testConnection" :loading="testing">
          <el-icon><Connection /></el-icon>
          测试连接
        </el-button>
        <el-button type="primary" @click="save" :loading="saving">
          <el-icon><Check /></el-icon>
          保存
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormInstance } from 'element-plus'
import { ZabbixAPI } from '@/api/zabbix'
import { useZabbixStore } from '@/stores/zabbix'
import storage from '@/utils/storage'
import { Link, Key, Timer, Close, Connection, Check } from '@element-plus/icons-vue'

const emit = defineEmits(['refresh-interval-changed'])

const visible = ref(false)
const testing = ref(false)
const saving = ref(false)
const formRef = ref<FormInstance>()
const store = useZabbixStore()
const screenSize = ref({
  width: window.screen.width,
  height: window.screen.height
})

// 计算对话框尺寸（显示器尺寸的30%）
const dialogWidth = computed(() => `${screenSize.value.width * 0.3}px`)

// 监听窗口大小变化
const handleResize = () => {
  screenSize.value = {
    width: window.screen.width,
    height: window.screen.height
  }
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})

const form = reactive({
  apiUrl: '',
  apiToken: '',
  refreshInterval: 60000
})

const rules = {
  apiUrl: [{ required: true, message: '请输入API地址', trigger: 'blur' }],
  apiToken: [{ required: true, message: '请输入API Token', trigger: 'blur' }]
}

const show = async () => {
  try {
    visible.value = true
    // 从存储加载设置
    const settings = await storage.local.get(['apiUrl', 'apiToken', 'refreshInterval'])
    form.apiUrl = settings.apiUrl || ''
    form.apiToken = settings.apiToken || ''
    form.refreshInterval = settings.refreshInterval || 60000
  } catch (error) {
    console.error('Failed to load settings:', error)
    ElMessage.error('加载设置失败')
  }
}

const testConnection = async () => {
  if (!form.apiUrl || !form.apiToken) {
    ElMessage.warning('请填写API地址和Token')
    return
  }

  testing.value = true
  try {
    const api = new ZabbixAPI(form.apiUrl, form.apiToken)
    await api.testConnection()
    ElMessage.success('连接成功')
  } catch (error) {
    ElMessage.error('连接失败: ' + (error as Error).message)
  } finally {
    testing.value = false
  }
}

const save = async () => {
  if (!formRef.value) return
  
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    
    saving.value = true
    try {
      // 保存到存储
      await storage.local.set({
        apiUrl: form.apiUrl,
        apiToken: form.apiToken,
        refreshInterval: form.refreshInterval
      })
      
      // 初始化 API 并刷新数据
      store.initApi(form.apiUrl, form.apiToken)
      await store.refreshData()
      
      // 通知父组件刷新间隔已更改
      emit('refresh-interval-changed', form.refreshInterval)
      
      ElMessage.success('保存成功')
      visible.value = false
    } catch (error) {
      console.error('Failed to save settings:', error)
      ElMessage.error('保存失败')
    } finally {
      saving.value = false
    }
  })
}

// 确保 show 方法可以被父组件访问
defineExpose({
  show
})
</script>

<style scoped>
.settings-dialog {
  :deep(.el-dialog__header) {
    margin: 0;
    padding: 20px 24px;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  :deep(.el-dialog__title) {
    font-size: 18px;
    font-weight: 600;
  }

  :deep(.el-dialog__body) {
    padding: 24px;
    height: calc(30% - 140px);  /* 减去header和footer的高度 */
    overflow-y: auto;
  }

  :deep(.el-dialog__footer) {
    padding: 16px 24px;
    border-top: 1px solid var(--el-border-color-lighter);
  }

  :deep(.el-dialog) {
    height: calc(30% * var(--el-dialog-scale, 1));
    margin: 0 !important;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    --el-dialog-scale: calc(var(--screen-height) / 100);
  }
}

.settings-form {
  :deep(.el-form-item__label) {
    font-weight: 500;
  }

  :deep(.el-form-item) {
    margin-bottom: 16px;
  }
}

.form-item-content {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.form-item-icon {
  font-size: 20px;
  color: var(--el-text-color-secondary);
}

:deep(.el-input__wrapper),
:deep(.el-select) {
  flex: 1;
}

:deep(.el-input__wrapper) {
  box-shadow: 0 0 0 1px var(--el-border-color) inset;
  transition: all 0.3s ease;

  &:hover {
    box-shadow: 0 0 0 1px var(--el-color-primary) inset;
  }

  &.is-focus {
    box-shadow: 0 0 0 1px var(--el-color-primary) inset !important;
  }
}

:deep(.el-select .el-input__wrapper) {
  box-shadow: 0 0 0 1px var(--el-border-color) inset !important;

  &:hover {
    box-shadow: 0 0 0 1px var(--el-color-primary) inset !important;
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;

  .el-button {
    min-width: 100px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
  }
}

:deep(.el-button) {
  border-radius: 8px;
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-1px);
  }
}

@media (max-height: 600px) {
  .settings-dialog {
    :deep(.el-dialog) {
      height: calc(50% * var(--el-dialog-scale, 1));  /* 在小屏幕上增加高度 */
    }

    :deep(.el-dialog__body) {
      height: calc(50% - 140px);
    }
  }
}
</style> 