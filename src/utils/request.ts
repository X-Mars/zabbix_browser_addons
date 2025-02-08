import axios from 'axios'
import type { AxiosInstance, AxiosRequestConfig } from 'axios'

const request: AxiosInstance = axios.create({
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

request.interceptors.response.use(
  response => response.data?.result,
  error => {
    console.error('Request failed:', error)
    return Promise.reject(error?.response?.data?.error || error)
  }
)

export default {
  request: (config: AxiosRequestConfig) => request(config)
} 