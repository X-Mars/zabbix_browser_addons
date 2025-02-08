<template>
  <el-dialog
    v-model="visible"
    title="设置"
    width="500px"
    :close-on-click-modal="false"
    @closed="handleClosed"
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="100px"
      class="settings-form"
    >
      <el-form-item label="API地址" prop="apiUrl">
        <el-input 
          v-model="form.apiUrl" 
          placeholder="请输入Zabbix API地址"
          clearable
        />
      </el-form-item>
      <el-form-item label="API Token" prop="apiToken">
        <el-input
          v-model="form.apiToken"
          type="password"
          placeholder="请输入API Token"
          clearable
          show-password
        />
      </el-form-item>
      <el-form-item label="刷新间隔" prop="refreshInterval">
        <el-select v-model="form.refreshInterval" class="w-full">
          <el-option label="30秒" :value="30000" />
          <el-option label="1分钟" :value="60000" />
          <el-option label="5分钟" :value="300000" />
          <el-option label="10分钟" :value="600000" />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="loading">
          确定
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { useZabbixStore } from '@/stores/zabbix'
import storage from '@/utils/storage'

const emit = defineEmits<{
  (e: 'refresh-interval-changed', interval: number): void
}>()

const visible = ref(false)
const loading = ref(false)
const formRef = ref<FormInstance>()

const form = ref({
  apiUrl: '',
  apiToken: '',
  refreshInterval: 60000
})

const rules: FormRules = {
  apiUrl: [
    { required: true, message: '请输入API地址', trigger: 'blur' },
    { type: 'url', message: '请输入有效的URL', trigger: 'blur' }
  ],
  apiToken: [
    { required: true, message: '请输入API Token', trigger: 'blur' },
    { min: 32, message: '请输入有效的Token', trigger: 'blur' }
  ],
  refreshInterval: [
    { required: true, message: '请选择刷新间隔', trigger: 'change' }
  ]
}

const store = useZabbixStore()

const show = async () => {
  visible.value = true
  const settings = await storage.local.get(['apiUrl', 'apiToken', 'refreshInterval'])
  form.value = {
    apiUrl: settings.apiUrl || '',
    apiToken: settings.apiToken || '',
    refreshInterval: settings.refreshInterval || 60000
  }
}

const handleSubmit = async () => {
  if (!formRef.value) return
  
  try {
    await formRef.value.validate()
    loading.value = true
    
    // 初始化API并测试连接
    store.initApi(form.value.apiUrl, form.value.apiToken)
    const connected = await store.api?.testConnection()
    
    if (connected) {
      // 保存设置
      await storage.local.set({
        apiUrl: form.value.apiUrl,
        apiToken: form.value.apiToken,
        refreshInterval: form.value.refreshInterval
      })
      
      // 触发刷新间隔变更事件
      emit('refresh-interval-changed', form.value.refreshInterval)
      
      ElMessage.success('设置保存成功')
      visible.value = false
    }
  } catch (error: any) {
    ElMessage.error(error.message || '设置保存失败')
  } finally {
    loading.value = false
  }
}

const handleClosed = () => {
  formRef.value?.resetFields()
}

defineExpose({
  show
})
</script>

<style scoped>
.settings-form {
  padding: 20px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

:deep(.el-select) {
  width: 100%;
}
</style> 