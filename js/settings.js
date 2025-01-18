class Settings {
    constructor() {
        this.modal = document.getElementById('settingsModal');
        this.settingsBtn = document.getElementById('settingsBtn');
        this.closeBtn = document.getElementById('closeModal');
        this.saveBtn = document.getElementById('saveSettings');
        this.testBtn = document.getElementById('testConnection');
        this.apiUrl = document.getElementById('apiUrl');
        this.apiToken = document.getElementById('apiToken');
        this.refreshInterval = document.getElementById('refreshInterval');
        
        this.initEventListeners();
        this.loadSettings();
    }

    initEventListeners() {
        this.settingsBtn.addEventListener('click', () => this.openModal());
        this.closeBtn.addEventListener('click', () => this.closeModal());
        this.saveBtn.addEventListener('click', () => this.saveSettings());
        this.testBtn.addEventListener('click', () => this.testConnection());

        // 点击遮罩层关闭
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.closeModal();
            }
        });
    }

    async loadSettings() {
        const settings = await new Promise((resolve) => {
            chrome.storage.local.get([
                'apiUrl', 
                'apiToken', 
                'refreshInterval'
            ], (result) => {
                resolve(result);
            });
        });

        if (settings.apiUrl) {
            this.apiUrl.value = settings.apiUrl;
        }
        if (settings.apiToken) {
            this.apiToken.value = atob(settings.apiToken);
        }
        if (settings.refreshInterval) {
            this.refreshInterval.value = settings.refreshInterval;
        }
    }

    async saveSettings() {
        const settings = {
            apiUrl: this.apiUrl.value.trim(),
            apiToken: btoa(this.apiToken.value.trim()),
            refreshInterval: this.refreshInterval.value
        };

        await new Promise((resolve) => {
            chrome.storage.local.set(settings, resolve);
        });

        this.closeModal();
        // 移除 window.close()，改为刷新页面以应用新设置
        location.reload();
    }

    async testConnection() {
        this.testBtn.disabled = true;
        this.testBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 测试中...';

        try {
            // 在测试连接前先处理 URL
            handleApiUrlInput(this.apiUrl);
            
            const api = new ZabbixAPI(
                this.apiUrl.value.trim(),
                this.apiToken.value.trim()
            );
            await api.testConnection();
            alert('连接成功！');
        } catch (error) {
            alert(error.message);
        } finally {
            this.testBtn.disabled = false;
            this.testBtn.innerHTML = '<i class="fas fa-plug"></i> 测试连接';
        }
    }

    openModal() {
        this.modal.classList.add('active');
    }

    closeModal() {
        this.modal.classList.remove('active');
    }
}

function handleApiUrlInput(input) {
    let url = input.value.trim();
    if (url && !url.endsWith('api_jsonrpc.php')) {
        // 移除末尾的斜杠
        url = url.replace(/\/+$/, '');
        // 添加 api_jsonrpc.php
        url = `${url}/api_jsonrpc.php`;
        input.value = url;
        
        // 显示提示信息
        showApiUrlTip('已自动补充 api_jsonrpc.php 路径');
    }
}

function showApiUrlTip(message) {
    const tipDiv = document.createElement('div');
    tipDiv.className = 'api-url-tip';
    tipDiv.textContent = message;
    tipDiv.style.color = '#67C23A';  // 使用绿色表示成功
    tipDiv.style.fontSize = '12px';
    tipDiv.style.marginTop = '5px';

    // 获取输入框的父元素
    const inputParent = document.querySelector('#apiUrl').parentElement;
    // 移除已存在的提示（如果有）
    const existingTip = inputParent.querySelector('.api-url-tip');
    if (existingTip) {
        existingTip.remove();
    }
    // 添加新提示
    inputParent.appendChild(tipDiv);

    // 3秒后自动隐藏提示
    setTimeout(() => {
        tipDiv.remove();
    }, 3000);
}

// 添加输入事件监听
document.addEventListener('DOMContentLoaded', function() {
    const apiUrlInput = document.querySelector('#apiUrl');
    if (apiUrlInput) {
        apiUrlInput.addEventListener('blur', function() {
            handleApiUrlInput(this);
        });
    }
});

// 初始化设置
new Settings(); 