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
            chrome.storage.local.get(['apiUrl', 'apiToken', 'refreshInterval'], (result) => {
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
        location.reload();  // 重新加载页面以应用新设置
    }

    async testConnection() {
        this.testBtn.disabled = true;
        this.testBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 测试中...';

        try {
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

// 初始化设置
new Settings(); 