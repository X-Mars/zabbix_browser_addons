export interface Host {
  hostid: string
  host: string
  name: string
  status: string
  interfaces: Array<{
    ip: string
  }>
}

export interface Alert {
  eventid: string
  clock: string
  name: string
  severity: string
  r_status: string
  hosts: Array<{
    name: string
  }>
  hostname?: string
}

export interface ChartData {
  name: string
  value: number | [number, number]
}