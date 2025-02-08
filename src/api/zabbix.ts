import request from '@/utils/request'
import type { Host, Alert } from '@/types'

export class ZabbixAPI {
  private url: string
  private token: string
  private requestId: number

  constructor(url: string, token: string) {
    this.url = url
    this.token = token
    this.requestId = 1
  }

  private async request(method: string, params = {}) {
    const body = {
      jsonrpc: '2.0',
      method,
      params,
      id: this.requestId++,
      auth: this.token
    }

    try {
      const result = await request.request({
        url: this.url,
        method: 'POST',
        data: body
      })
      return result
    } catch (error) {
      console.error('API Error:', error)
      throw error
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await request.request({
        url: this.url,
        method: 'POST',
        data: {
          jsonrpc: '2.0',
          method: 'apiinfo.version',
          params: {},
          id: 1
        }
      })
      
      if (response) {
        await request.request({
          url: this.url,
          method: 'POST',
          data: {
            jsonrpc: '2.0',
            method: 'host.get',
            params: {
              countOutput: true
            },
            auth: this.token,
            id: 2
          }
        })
        return true
      }
      return false
    } catch (error) {
      console.error('Connection test failed:', error)
      throw new Error('API连接或认证失败')
    }
  }

  async getHosts(): Promise<Host[]> {
    const hosts = await this.request('host.get', {
      output: ['hostid', 'host', 'name', 'status'],
      selectInterfaces: ['ip'],
      filter: { status: 0 }
    })
    return hosts
  }

  async getProblems() {
    const problems = await this.request('problem.get', {
      output: 'extend',
      selectAcknowledges: 'extend',
      selectTags: 'extend',
      selectSuppressionData: 'extend',
      recent: true,
      object: 0,
      acknowledged: null,
      suppressed: false,
      sortfield: ['eventid'],
      sortorder: 'DESC',
      limit: 100
    })

    if (problems.length > 0) {
      const triggerIds = problems.map((p: any) => p.objectid)
      const triggers = await this.request('trigger.get', {
        output: ['triggerid', 'description', 'hostname'],
        triggerids: triggerIds,
        selectHosts: ['hostid', 'host', 'name'],
        expandDescription: true
      })
      
      return problems.map((problem: any) => {
        const trigger = triggers.find((t: any) => t.triggerid === problem.objectid)
        return {
          ...problem,
          hostname: trigger?.hosts?.[0]?.name || '未知主机',
          r_status: problem.r_eventid === '0' ? '1' : '0'
        }
      })
    }
    
    return problems
  }
} 