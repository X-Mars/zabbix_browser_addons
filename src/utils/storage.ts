interface StorageData {
  [key: string]: any
}

class LocalStorage {
  private storage: StorageData = {}

  async get(keys: string | string[] | object | null): Promise<StorageData> {
    if (!keys) return this.storage

    const result: StorageData = {}
    if (typeof keys === 'string') {
      result[keys] = this.storage[keys]
    } else if (Array.isArray(keys)) {
      keys.forEach(key => {
        result[key] = this.storage[key]
      })
    } else {
      Object.keys(keys as object).forEach(key => {
        result[key] = this.storage[key] || (keys as StorageData)[key]
      })
    }
    return result
  }

  async set(items: StorageData): Promise<void> {
    Object.assign(this.storage, items)
  }

  async remove(keys: string | string[]): Promise<void> {
    const keysToRemove = Array.isArray(keys) ? keys : [keys]
    keysToRemove.forEach(key => {
      delete this.storage[key]
    })
  }

  async clear(): Promise<void> {
    this.storage = {}
  }
}

// 创建模拟的 Chrome API
const mockChromeAPI = {
  storage: {
    local: new LocalStorage(),
    sync: new LocalStorage()
  },
  runtime: {
    sendMessage: () => {},
    onMessage: {
      addListener: () => {}
    },
    onInstalled: {
      addListener: () => {}
    }
  }
}

// 浏览器模式下的存储实现
const browserStorage = {
  local: {
    get: async (keys: string | string[] | object | null) => {
      const data: { [key: string]: any } = {}
      const keyList = typeof keys === 'string' ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys || {})
      
      for (const key of keyList) {
        const value = localStorage.getItem(key)
        if (value) {
          try {
            data[key] = JSON.parse(value)
          } catch {
            data[key] = value
          }
        }
      }
      return data
    },
    set: async (items: { [key: string]: any }) => {
      Object.entries(items).forEach(([key, value]) => {
        localStorage.setItem(key, JSON.stringify(value))
      })
    },
    remove: async (keys: string | string[]) => {
      const keyList = Array.isArray(keys) ? keys : [keys]
      keyList.forEach(key => localStorage.removeItem(key))
    },
    clear: async () => {
      localStorage.clear()
    }
  }
}

// 导出统一的存储接口
export default typeof chrome !== 'undefined' && chrome.storage 
  ? chrome.storage 
  : browserStorage 