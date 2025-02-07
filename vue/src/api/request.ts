import axios from 'axios'
import type { ZabbixResponse } from './types'
import { useSettingsStore } from '@/stores/settings'

const request = axios.create({
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

request.interceptors.request.use(
  (config) => {
    const settingsStore = useSettingsStore()
    const data = config.data || {}
    
    // 使用设置中的 API URL
    config.url = settingsStore.apiUrl
    
    // 设置 Zabbix API 请求体格式
    config.data = {
      jsonrpc: '2.0',
      id: 1,
      method: data.method,
      params: data.params || {}
    }

    // 只有非 apiinfo.version 的请求才需要 auth token
    if (data.method !== 'apiinfo.version') {
      config.data.auth = settingsStore.apiToken
    }
    
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

request.interceptors.response.use(
  (response) => {
    const res = response.data as ZabbixResponse
    if (res.error) {
      return Promise.reject(new Error(res.error.message || 'API Error'))
    }
    return res.result
  },
  (error) => {
    if (error.response) {
      return Promise.reject(new Error(`HTTP Error: ${error.response.status} ${error.response.statusText}`))
    } else if (error.request) {
      return Promise.reject(new Error('Network Error: No response received'))
    } else {
      return Promise.reject(new Error(`Request Error: ${error.message}`))
    }
  }
)

export default request 