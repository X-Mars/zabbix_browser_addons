<template>
  <el-dialog
    :title="initialSetup ? t('settings.initialSetup') : t('settings.title')"
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    :close-on-click-modal="!initialSetup"
    :close-on-press-escape="!initialSetup"
    :show-close="!initialSetup"
    width="500px"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="120px">
      <el-form-item :label="t('settings.apiUrl')" prop="apiUrl">
        <el-input v-model="form.apiUrl" placeholder="http://your-zabbix-server/api_jsonrpc.php" />
      </el-form-item>
      <el-form-item :label="t('settings.apiToken')" prop="apiToken">
        <el-input v-model="form.apiToken" type="password" show-password />
      </el-form-item>
      <el-form-item :label="t('settings.refreshInterval')" prop="refreshInterval">
        <el-select v-model="form.refreshInterval">
          <el-option :value="10000" :label="'10s'" />
          <el-option :value="30000" :label="'30s'" />
          <el-option :value="60000" :label="'1m'" />
          <el-option :value="300000" :label="'5m'" />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button :loading="testing" @click="handleTest">
        <el-icon><Connection /></el-icon>
        {{ t('settings.test') }}
      </el-button>
      <el-button type="primary" :loading="saving" @click="handleSave">
        <el-icon><Check /></el-icon>
        {{ t('settings.save') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FormInstance } from 'element-plus'
import { ElMessage } from 'element-plus'
import { Connection, Check } from '@element-plus/icons-vue'
import axios from 'axios'
import { useSettingsStore } from '@/stores/settings'

const props = defineProps<{
  modelValue: boolean
  initialSetup?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const { t } = useI18n()
const settingsStore = useSettingsStore()
const formRef = ref<FormInstance>()
const testing = ref(false)
const saving = ref(false)

const form = reactive({
  apiUrl: settingsStore.apiUrl,
  apiToken: settingsStore.apiToken,
  refreshInterval: settingsStore.refreshInterval
})

const rules = {
  apiUrl: [{ required: true, message: 'API URL is required' }],
  apiToken: [{ required: true, message: 'API Token is required' }]
}

const handleTest = async () => {
  if (!form.apiUrl) {
    ElMessage.error('Please enter API URL')
    return
  }

  testing.value = true
  try {
    // 测试 API 版本
    const versionResponse = await axios.post(form.apiUrl, {
      jsonrpc: '2.0',
      method: 'apiinfo.version',
      params: {},
      id: 1
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (versionResponse.data?.result) {
      // 如果版本检查成功，测试认证
      const authResponse = await axios.post(form.apiUrl, {
        jsonrpc: '2.0',
        method: 'host.get',
        params: {
          output: ['hostid'],
          limit: 1
        },
        auth: form.apiToken,
        id: 1
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (Array.isArray(authResponse.data?.result)) {
        ElMessage.success(t('settings.testSuccess'))
      } else {
        throw new Error('Authentication failed')
      }
    } else {
      throw new Error('Invalid API response')
    }
  } catch (error: any) {
    console.error('Connection test failed:', error)
    if (error.response) {
      ElMessage.error(`${t('settings.testError')}: ${error.response.status} ${error.response.statusText}`)
    } else if (error.request) {
      ElMessage.error(`${t('settings.testError')}: Network Error`)
    } else {
      ElMessage.error(`${t('settings.testError')}: ${error.message}`)
    }
  } finally {
    testing.value = false
  }
}

const handleSave = async () => {
  if (!formRef.value) return
  
  await formRef.value.validate(async (valid) => {
    if (valid) {
      saving.value = true
      try {
        settingsStore.setSettings(form)
        ElMessage.success(t('settings.saveSuccess'))
        emit('update:modelValue', false)
      } catch (error) {
        ElMessage.error(t('settings.saveError'))
      } finally {
        saving.value = false
      }
    }
  })
}
</script> 