import axios from 'axios'
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { ElMessage } from 'element-plus'

class Request {
  private instance: AxiosInstance

  constructor(config: AxiosRequestConfig) {
    this.instance = axios.create(config)
    
    this.instance.interceptors.request.use(
      (config) => {
        // 添加token等
        return config
      },
      (error) => {
        return Promise.reject(error)
      }
    )

    this.instance.interceptors.response.use(
      (response: AxiosResponse) => {
        const { data } = response
        if (data.error) {
          ElMessage.error(data.error.data || data.error.message || '请求失败')
          return Promise.reject(data.error)
        }
        return data.result
      },
      (error) => {
        ElMessage.error(error.message || '网络错误')
        return Promise.reject(error)
      }
    )
  }

  request<T = any>(config: AxiosRequestConfig): Promise<T> {
    return this.instance.request(config)
  }
}

export default new Request({
  baseURL: '/api',
  timeout: 10000
}) 