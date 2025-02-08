// 监听安装事件
chrome.runtime.onInstalled.addListener(() => {
  // 初始化存储
  chrome.storage.local.set({
    refreshInterval: 60000, // 默认1分钟刷新一次
    theme: 'light'
  })
})

// 处理消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_SETTINGS') {
    chrome.storage.local.get(['apiUrl', 'apiToken', 'refreshInterval'], (result) => {
      sendResponse(result)
    })
    return true
  }
})

// 监听插件图标点击事件
chrome.action.onClicked.addListener(async () => {
  try {
    // 创建新标签页
    await chrome.tabs.create({
      url: chrome.runtime.getURL('index.html')
    })
  } catch (error) {
    console.error('Failed to open new tab:', error)
  }
}) 