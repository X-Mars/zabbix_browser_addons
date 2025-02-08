import request from '@/utils/request'
import type { Host, Alert, ChartData } from '@/types'

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

  // 测试连接
  async testConnection(): Promise<boolean> {
    try {
      // 使用 apiinfo.version 方法测试连接，这个方法不需要认证
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
      
      // 如果能获取到版本号，再测试认证
      if (response) {
        // 使用 token 直接调用一个需要认证的 API
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

  // 获取主机列表
  async getHosts(): Promise<Host[]> {
    const hosts = await this.request('host.get', {
      output: ['hostid', 'host', 'name', 'status'],
      selectInterfaces: ['ip'],
      filter: { status: 0 }
    })
    return hosts
  }

  // 获取当前告警数量
  async getProblems() {
    const problems = await this.request('problem.get', {
      output: 'extend',
      selectAcknowledges: 'extend',
      selectTags: 'extend',
      selectSuppressionData: 'extend',
      recent: true,
      object: 0,  // 触发器的问题
      acknowledged: null,  // 获取所有状态的告警
      suppressed: false,
      sortfield: ['eventid'],
      sortorder: 'DESC',
      limit: 100
    })

    // 获取这些问题对应的触发器信息
    if (problems.length > 0) {
      const triggerIds = problems.map((p: any) => p.objectid)
      const triggers = await this.request('trigger.get', {
        output: ['triggerid', 'description', 'hostname'],
        triggerids: triggerIds,
        selectHosts: ['hostid', 'host', 'name'],
        expandDescription: true
      })
      
      // 将触发器信息（包含主机信息）添加到问题数据中
      return problems.map((problem: any) => {
        const trigger = triggers.find((t: any) => t.triggerid === problem.objectid)
        return {
          ...problem,
          hostname: trigger?.hosts?.[0]?.name || '未知主机',
          r_status: problem.r_eventid === '0' ? '1' : '0'  // 如果 r_eventid 为 0，表示告警中；否则表示已恢复
        }
      })
    }
    
    return problems
  }

  // 获取主机组
  async getHostGroups() {
    const response = await this.request('hostgroup.get', {
      output: ['groupid', 'name'],
    })
    return response
  }

  // 获取监控项
  async getItems(hostids: string[]) {
    const response = await this.request('item.get', {
      output: ['itemid', 'name', 'key_', 'lastvalue', 'units'],
      hostids,
      sortfield: 'name',
    })
    return response
  }

  // 获取图形
  async getGraphs(hostids: string[]) {
    const response = await this.request('graph.get', {
      output: ['graphid', 'name'],
      hostids,
      sortfield: 'name',
    })
    return response
  }
} 