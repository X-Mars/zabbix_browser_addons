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
        const testBtn = document.getElementById('testConnection');
        const originalText = testBtn.innerHTML;
        const originalClass = testBtn.className;
        testBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${i18n.t('settings.messages.testing')}`;
        testBtn.disabled = true;

        try {
            const settings = {
                apiUrl: this.apiUrl.value.trim(),
                apiToken: btoa(this.apiToken.value.trim())
            };
            const api = new ZabbixAPI(settings.apiUrl, atob(settings.apiToken));
            await api.testConnection();
            
            // 测试成功
            testBtn.className = 'btn btn-success';
            testBtn.innerHTML = `<i class="fas fa-check"></i> ${i18n.t('settings.messages.connectionSuccess')}`;
            
            // 3秒后恢复原状
            setTimeout(() => {
                testBtn.className = originalClass;
                testBtn.innerHTML = originalText;
            }, 5000);
        } catch (error) {
            // 测试失败
            testBtn.className = 'btn btn-danger';
            testBtn.innerHTML = `<i class="fas fa-times"></i> ${i18n.t('settings.messages.connectionFailed')}`;
            
            // 5秒后恢复原状
            setTimeout(() => {
                testBtn.className = originalClass;
                testBtn.innerHTML = originalText;
            }, 5000);
        } finally {
            testBtn.disabled = false;
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