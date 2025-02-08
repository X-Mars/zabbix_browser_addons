// Zabbix API 响应类型
export interface ZabbixResponse {
  jsonrpc: string
  result: any
  error?: {
    code: number
    message: string
    data: string
  }
  id: number
}

// 主机类型
export interface Host {
  hostid: string
  host: string
  name: string
  status: string
  interfaces: Array<{
    ip: string
  }>
}

// 告警类型
export interface Alert {
  eventid: string
  objectid: string
  name: string
  severity: string
  clock: string
  hosts: Array<{
    hostid: string
    name: string
  }>
}

// 监控项类型
export interface Item {
  itemid: string
  name: string
  key_: string
  lastvalue: string
  lastclock: string
  units: string
}

// 历史数据类型
export interface HistoryData {
  itemid: string
  clock: string
  value: string
  ns: number
} 