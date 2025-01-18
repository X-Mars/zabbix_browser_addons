// 处理插件图标点击
chrome.action.onClicked.addListener((tab) => {
    chrome.tabs.create({
        url: chrome.runtime.getURL('index.html')
    });
});

// 首次安装或更新时自动打开插件
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        chrome.tabs.create({
            url: chrome.runtime.getURL('index.html')
        });
    }
});

// 监听存储变更，处理 API 地址
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.zabbixServer) {
        let url = changes.zabbixServer.newValue;
        if (url && !url.endsWith('api_jsonrpc.php')) {
            url = url.replace(/\/+$/, '');
            url = `${url}/api_jsonrpc.php`;
            chrome.storage.local.set({ zabbixServer: url });
        }
    }
}); 