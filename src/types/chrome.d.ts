declare namespace chrome {
  export namespace storage {
    export interface StorageArea {
      get(keys: string | string[] | object | null): Promise<{ [key: string]: any }>
      set(items: object): Promise<void>
      remove(keys: string | string[]): Promise<void>
      clear(): Promise<void>
    }

    export const local: StorageArea
    export const sync: StorageArea
  }

  export namespace runtime {
    export interface MessageSender {
      tab?: chrome.tabs.Tab
      frameId?: number
      id?: string
      url?: string
      tlsChannelId?: string
    }

    export function sendMessage(
      message: any,
      responseCallback?: (response: any) => void
    ): void

    export const onMessage: {
      addListener(
        callback: (
          message: any,
          sender: MessageSender,
          sendResponse: (response?: any) => void
        ) => void
      ): void
    }

    export const onInstalled: {
      addListener(callback: () => void): void
    }
  }
} 