if (process.env.NODE_ENV === 'development' && !chrome?.storage?.local) {
  const storage: Record<string, any> = {}
  
  // @ts-ignore
  window.chrome = {
    storage: {
      local: {
        get: async (keys: string[] | null) => {
          if (!keys) return storage
          const result: Record<string, any> = {}
          keys.forEach(key => {
            result[key] = storage[key]
          })
          return result
        },
        set: async (items: Record<string, any>) => {
          Object.assign(storage, items)
        }
      }
    }
  }
} 