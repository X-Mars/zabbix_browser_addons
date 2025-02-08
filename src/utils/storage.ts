interface StorageData {
  [key: string]: any
}

const isExtensionMode = () => {
  return typeof chrome !== 'undefined' && chrome.runtime?.id
}

class Storage {
  async get(keys: string[]): Promise<StorageData> {
    if (isExtensionMode()) {
      return new Promise((resolve) => {
        chrome.storage.local.get(keys, (result) => {
          resolve(result)
        })
      })
    } else {
      const result: StorageData = {}
      for (const key of keys) {
        const value = localStorage.getItem(key)
        if (value) {
          try {
            result[key] = JSON.parse(value)
          } catch {
            result[key] = value
          }
        }
      }
      return result
    }
  }

  async set(data: StorageData): Promise<void> {
    if (isExtensionMode()) {
      return new Promise((resolve) => {
        chrome.storage.local.set(data, () => {
          resolve()
        })
      })
    } else {
      for (const [key, value] of Object.entries(data)) {
        localStorage.setItem(key, JSON.stringify(value))
      }
    }
  }

  async remove(keys: string[]): Promise<void> {
    if (isExtensionMode()) {
      return new Promise((resolve) => {
        chrome.storage.local.remove(keys, () => {
          resolve()
        })
      })
    } else {
      for (const key of keys) {
        localStorage.removeItem(key)
      }
    }
  }

  async clear(): Promise<void> {
    if (isExtensionMode()) {
      return new Promise((resolve) => {
        chrome.storage.local.clear(() => {
          resolve()
        })
      })
    } else {
      localStorage.clear()
    }
  }
}

const storage = {
  local: new Storage()
}

export default storage 