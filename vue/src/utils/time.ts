import dayjs from 'dayjs'

export function formatDateTime(date: Date | string | number): string {
  return dayjs(date).format('YYYY/MM/DD HH:mm:ss')
}

export function formatDate(date: Date | string | number): string {
  return dayjs(date).format('YYYY/MM/DD')
}

export function formatTime(date: Date | string | number): string {
  return dayjs(date).format('HH:mm:ss')
}

export function getTimeAgo(timestamp: number): string {
  const now = dayjs()
  const target = dayjs(timestamp * 1000)
  const diff = now.diff(target, 'second')

  if (diff < 60) {
    return `${diff}秒前`
  } else if (diff < 3600) {
    return `${Math.floor(diff / 60)}分钟前`
  } else if (diff < 86400) {
    return `${Math.floor(diff / 3600)}小时前`
  } else {
    return `${Math.floor(diff / 86400)}天前`
  }
} 