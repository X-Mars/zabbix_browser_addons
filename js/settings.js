class Settings {
    constructor() {
        this.initialized = false;
        this.initializeWhenReady();
    }

    async initializeWhenReady() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initialize());
        } else {
            this.initialize();
        }
    }

    async initialize() {
        if (this.initialized) return;
        
        // 创建设置对话框
        this.createSettingsDialog();
        
        // 加载设置
        await this.loadSettings();

        // 初始化国际化
        this.initI18n();
        
        this.initialized = true;
    }

    createSettingsDialog() {
        // 创建设置对话框的容器
        const container = document.createElement('div');
        container.id = 'settingsContainer';
        container.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
        `;

        // 设置对话框的 HTML 内容
        const refreshIntervalHtml = `
            <div class="form-group" style="margin-bottom: 16px;">
                <label for="refreshInterval" style="
                    display: block;
                    margin-bottom: 6px;
                    font-weight: 500;
                    color: #444;
                " data-i18n="settings.refreshInterval">刷新间隔:</label>
                <select id="refreshInterval" class="form-control" style="
                    width: 100%;
                    padding: 8px 12px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    font-size: 14px;
                    background-color: white;
                    cursor: pointer;
                ">
                    <option value="5000" data-i18n="settings.intervals.5s">5秒</option>
                    <option value="60000" data-i18n="settings.intervals.1m">1分钟</option>
                    <option value="300000" data-i18n="settings.intervals.5m">5分钟</option>
                    <option value="600000" data-i18n="settings.intervals.10m">10分钟</option>
                    <option value="1800000" data-i18n="settings.intervals.30m">30分钟</option>
                </select>
            </div>
        `;

        container.innerHTML = `
            <div class="modal-content" style="
                background: white;
                border-radius: 8px;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
                width: 100%;
                max-width: 800px;
                height: 600px;
                padding: 16px 24px;
                margin: 20px;
                display: flex;
                flex-direction: column;
            ">
                <div class="modal-header" style="
                    margin-bottom: 16px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex-shrink: 0;
                ">
                    <h2 style="
                        font-size: 1.5rem;
                        font-weight: 600;
                        color: #333;
                        margin: 0;
                    " data-i18n="settings.title">设置</h2>
                    <button id="closeModal" class="close-btn" style="
                        background: none;
                        border: none;
                        font-size: 1.2rem;
                        color: #666;
                        cursor: pointer;
                        padding: 4px;
                    ">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body" style="
                    flex-grow: 1;
                    overflow-y: auto;
                ">
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label for="apiUrl" style="
                            display: block;
                            margin-bottom: 6px;
                            font-weight: 500;
                            color: #444;
                        " data-i18n="settings.apiUrl">API URL:</label>
                        <input type="text" id="apiUrl" class="form-control" placeholder="http://your-zabbix-server/api_jsonrpc.php" style="
                            width: 100%;
                            padding: 8px 12px;
                            border: 1px solid #ddd;
                            border-radius: 4px;
                            font-size: 14px;
                        ">
                    </div>
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label for="apiToken" style="
                            display: block;
                            margin-bottom: 6px;
                            font-weight: 500;
                            color: #444;
                        " data-i18n="settings.apiToken">API Token:</label>
                        <input type="password" id="apiToken" class="form-control" style="
                            width: 100%;
                            padding: 8px 12px;
                            border: 1px solid #ddd;
                            border-radius: 4px;
                            font-size: 14px;
                        ">
                    </div>
                    ${refreshIntervalHtml}
                </div>
                <div class="modal-footer" style="
                    margin-top: 16px;
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                    flex-shrink: 0;
                ">
                    <button id="testConnection" class="btn btn-secondary" style="
                        padding: 8px 16px;
                        border-radius: 4px;
                        font-weight: 500;
                        cursor: pointer;
                        transition: all 0.2s;
                        background-color: #f0f0f0;
                        color: #333;
                    " data-i18n="settings.buttons.test">测试连接</button>
                    <button id="saveSettings" class="btn btn-primary" style="
                        padding: 8px 16px;
                        border-radius: 4px;
                        font-weight: 500;
                        cursor: pointer;
                        transition: all 0.2s;
                        background-color: #1a73e8;
                        color: white;
                    " data-i18n="settings.buttons.save">保存设置</button>
                </div>
            </div>
        `;

        // 将对话框添加到 body
        document.body.appendChild(container);

        // 默认隐藏对话框
        container.style.display = 'none';

        // 获取所有需要的元素
        this.container = container;
        this.closeBtn = container.querySelector('#closeModal');
        this.saveBtn = container.querySelector('#saveSettings');
        this.testBtn = container.querySelector('#testConnection');
        this.apiUrl = container.querySelector('#apiUrl');
        this.apiToken = container.querySelector('#apiToken');
        this.refreshInterval = container.querySelector('#refreshInterval');

        // 初始化事件监听器
        this.initEventListeners();
    }

    initEventListeners() {
        // 关闭按钮事件
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => {
                this.hideDialog();
            });
        }

        // 保存按钮事件
        if (this.saveBtn) {
            this.saveBtn.addEventListener('click', () => {
                this.saveSettings();
            });
        }

        // 测试按钮事件
        if (this.testBtn) {
            this.testBtn.addEventListener('click', () => {
                this.testConnection();
            });
        }

        // 点击遮罩层关闭
        if (this.container) {
            this.container.addEventListener('click', (e) => {
                if (e.target === this.container) {
                    this.hideDialog();
                }
            });
        }

        // API URL 输入框失焦事件
        if (this.apiUrl) {
            this.apiUrl.addEventListener('blur', () => {
                handleApiUrlInput(this.apiUrl);
            });
        }
    }

    showDialog() {
        if (this.container) {
            this.container.style.display = 'flex';
            // 重新加载设置和国际化
            this.loadSettings();
            this.initI18n();
        }
    }

    hideDialog() {
        if (this.container) {
            this.container.style.display = 'none';
        }
    }

    async loadSettings() {
        try {
            const result = await new Promise((resolve, reject) => {
                chrome.storage.sync.get(['apiUrl', 'apiToken', 'refreshInterval'], (result) => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve(result);
                    }
                });
            });

            // 设置值
            if (this.apiUrl && result.apiUrl) {
                this.apiUrl.value = result.apiUrl;
            }
            if (this.apiToken && result.apiToken) {
                this.apiToken.value = atob(result.apiToken);
            }
            if (this.refreshInterval && result.refreshInterval) {
                // 设置下拉框的选中值
                this.refreshInterval.value = result.refreshInterval;
                // 如果没有匹配的选项，默认选择 5 分钟
                if (!Array.from(this.refreshInterval.options).some(option => option.value === result.refreshInterval)) {
                    this.refreshInterval.value = '300000';
                }
            }

            return result;
        } catch (error) {
            console.error('Failed to load settings:', error);
            return {};
        }
    }

    async saveSettings() {
        const settings = {
            apiUrl: this.apiUrl.value.trim(),
            apiToken: btoa(this.apiToken.value.trim()),
            refreshInterval: this.refreshInterval.value
        };

        try {
            await new Promise((resolve, reject) => {
                chrome.storage.sync.set(settings, () => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve();
                    }
                });
            });

            // 刷新所有相关页面
            chrome.tabs.query({}, (tabs) => {
                tabs.forEach(tab => {
                    if (tab.url.includes('index.html') || tab.url.includes('hosts.html')) {
                        chrome.tabs.reload(tab.id);
                    }
                });
            });

            this.hideDialog();
        } catch (error) {
            console.error('Failed to save settings:', error);
        }
    }

    async testConnection() {
        const testBtn = this.testBtn;
        if (!testBtn) return;

        const originalText = i18n.t('settings.buttons.test'); // 使用国际化的原始文本
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
            testBtn.style.backgroundColor = '#67C23A';
            testBtn.style.color = 'white';
            testBtn.innerHTML = `<i class="fas fa-check"></i> ${i18n.t('settings.messages.connectionSuccess')}`;
            
            // 3秒后恢复原状
            setTimeout(() => {
                testBtn.style.backgroundColor = '#f0f0f0';
                testBtn.style.color = '#333';
                testBtn.innerHTML = originalText;
            }, 3000);
        } catch (error) {
            // 测试失败
            testBtn.style.backgroundColor = '#F56C6C';
            testBtn.style.color = 'white';
            testBtn.innerHTML = `<i class="fas fa-times"></i> ${i18n.t('settings.messages.connectionFailed')}`;
            
            // 3秒后恢复原状
            setTimeout(() => {
                testBtn.style.backgroundColor = '#f0f0f0';
                testBtn.style.color = '#333';
                testBtn.innerHTML = originalText;
            }, 3000);

            console.error('Connection test failed:', error);
        } finally {
            testBtn.disabled = false;
        }
    }

    // 添加国际化初始化方法
    initI18n() {
        // 初始化所有带有 data-i18n 属性的元素
        if (this.container) {
            this.container.querySelectorAll('[data-i18n]').forEach(element => {
                const key = element.getAttribute('data-i18n');
                element.textContent = i18n.t(key);
            });
        }
    }
}

function handleApiUrlInput(input) {
    let url = input.value.trim();
    if (url && !url.endsWith('api_jsonrpc.php')) {
        url = url.replace(/\/+$/, '');
        url = `${url}/api_jsonrpc.php`;
        input.value = url;
        
        // 使用国际化的提示信息
        showApiUrlTip(i18n.t('settings.messages.apiUrlAutoComplete'));
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

// 创建一个全局的 Settings 实例
window.settingsManager = new Settings();