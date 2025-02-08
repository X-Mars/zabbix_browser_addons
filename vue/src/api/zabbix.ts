import request from './request'
import type { Host, Alert, Item, HistoryData } from './types'

export default class ZabbixAPI {
  async getHosts() {
    return request.post<Host[]>('', {
      method: 'host.get',
      params: {
        output: ['hostid', 'host', 'name', 'status'],
        selectInterfaces: ['ip'],
        filter: { status: 0 }
      }
    })
  }

  async getHostById(hostId: string) {
    return request.post<Host[]>('', {
      method: 'host.get',
      params: {
        output: ['hostid', 'host', 'name', 'status'],
        selectInterfaces: ['ip'],
        hostids: hostId
      }
    })
  }

  async getHostItems(hostId: string) {
    return request.post<Item[]>('', {
      method: 'item.get',
      params: {
        output: ['itemid', 'name', 'key_', 'lastvalue', 'lastclock', 'units'],
        hostids: hostId,
        sortfield: 'name',
        filter: { status: 0 }
      }
    })
  }

  async getHostProblems(hostId: string) {
    return request.post<Alert[]>('', {
      method: 'problem.get',
      params: {
        output: ['eventid', 'name', 'severity', 'clock'],
        hostids: hostId,
        sortfield: 'eventid',
        sortorder: 'DESC',
        recent: true
      }
    })
  }

  async getAlerts() {
    return request.post<Alert[]>('', {
      method: 'problem.get',
      params: {
        output: ['eventid', 'objectid', 'name', 'severity', 'clock'],
        recent: true,
        sortfield: 'eventid',
        sortorder: 'DESC',
        limit: 100
      }
    })
  }

  async getItemHistory(itemId: string, timeFrom: number) {
    return request.post<HistoryData[]>('', {
      method: 'history.get',
      params: {
        output: 'extend',
        itemids: itemId,
        time_from: timeFrom,
        sortfield: 'clock',
        sortorder: 'ASC'
      }
    })
  }

  async testConnection() {
    try {
      const version = await request.post('', {
        method: 'apiinfo.version',
        params: {}
      })
      
      if (!version) {
        throw new Error('Invalid API response')
      }
      
      const authTest = await request.post('', {
        method: 'host.get',
        params: {
          output: ['hostid'],
          limit: 1
        }
      })
      
      return Array.isArray(authTest)
    } catch (error) {
      console.error('Connection test failed:', error)
      return false
    }
  }
} 