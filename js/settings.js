class Settings {
    constructor() {
        // 移除构造函数中的初始化
    }

    async showDialog() {
        try {
            // 获取 settings.html 内容
            const response = await fetch('settings.html');
            const html = await response.text();
            
            // 创建临时容器来解析 HTML
            const temp = document.createElement('div');
            temp.innerHTML = html;
            
            // 提取 modal-content 的内容
            const modalContent = temp.querySelector('.modal-content');
            
            // 创建模态框容器
            const modal = document.createElement('div');
            modal.className = 'modal active';
            modal.innerHTML = `
                <div class="modal-overlay"></div>
            `;
            modal.appendChild(modalContent);
            
            // 获取容器并添加模态框
            const container = document.getElementById('settingsContainer');
            if (!container) {
                console.error('Settings container not found');
                return;
            }
            
            container.innerHTML = '';
            container.appendChild(modal);
            
            // 初始化 i18n
            this.container = modal;
            this.initI18n();
            document.title = i18n.t('pageTitle.settings');
            
            // 添加关闭事件
            const closeBtn = modal.querySelector('#closeModal');
            const overlay = modal.querySelector('.modal-overlay');
            
            const closeModal = () => {
                container.innerHTML = '';
            };
            
            closeBtn?.addEventListener('click', closeModal);
            overlay?.addEventListener('click', closeModal);
            
            // 初始化表单事件
            this.initFormEvents(modal);
            
            // 加载已保存的设置
            await this.loadSettings(modal);
            
        } catch (error) {
            console.error('Failed to load settings dialog:', error);
            // 显示错误提示
            this.showTip(i18n.t('settings.messages.loadFailed'), 'error');
        }
    }

    async loadSettings(modal) {
        try {
            // 从 storage 读取设置
            const result = await new Promise((resolve) => {
                chrome.storage.sync.get(['apiUrl', 'apiToken', 'refreshInterval'], resolve);
            });

            // 获取表单元素
            const apiUrl = modal.querySelector('#apiUrl');
            const apiToken = modal.querySelector('#apiToken');
            const refreshInterval = modal.querySelector('#refreshInterval');

            // 设置表单值
            if (apiUrl && result.apiUrl) {
                apiUrl.value = result.apiUrl;
            }
            if (apiToken && result.apiToken) {
                apiToken.value = atob(result.apiToken);
            }
            if (refreshInterval && result.refreshInterval) {
                refreshInterval.value = result.refreshInterval;
                // 如果没有匹配的选项，默认选择 5 分钟
                if (!Array.from(refreshInterval.options).some(option => option.value === result.refreshInterval)) {
                    refreshInterval.value = '300000';
                }
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
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
                        if (tab.url.includes('index.html') || tab.url.includes('cmdb.html')) {
                            chrome.tabs.reload(tab.id);
                        }
                    });
            });

            this.hideDialog();
            this.showTip(i18n.t('settings.messages.settingsSaved'), 'success');
        } catch (error) {
            console.error('Failed to save settings:', error);
            this.showTip(i18n.t('settings.messages.settingsSaveFailed'), 'error');
        }
    }

    async testConnection() {
        const testBtn = this.testBtn;
        if (!testBtn) return;

        const originalText = i18n.t('settings.buttons.test');
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
        if (this.container) {
            // 更新所有带有 data-i18n 属性的静态文本
            this.container.querySelectorAll('[data-i18n]').forEach(element => {
                const key = element.getAttribute('data-i18n');
                element.textContent = i18n.t(key);
            });

            // 更新刷新间隔选项
            const select = this.container.querySelector('#refreshInterval');
            if (select) {
                const intervals = {
                    '5000': i18n.t('settings.intervals.5s'),
                    '30000': i18n.t('settings.intervals.30s'),
                    '60000': i18n.t('settings.intervals.1m'),
                    '300000': i18n.t('settings.intervals.5m'),
                    '600000': i18n.t('settings.intervals.10m'),
                    '1800000': i18n.t('settings.intervals.30m')
                };
                Array.from(select.options).forEach(option => {
                    option.textContent = intervals[option.value] || option.textContent;
                });
            }
        }
    }

    async initFormEvents(modal) {
        const testBtn = modal.querySelector('#testConnection');
        const saveBtn = modal.querySelector('#saveSettings');
        const apiUrl = modal.querySelector('#apiUrl');
        const apiToken = modal.querySelector('#apiToken');
        const refreshInterval = modal.querySelector('#refreshInterval');

        // API URL 输入框失焦事件
        apiUrl?.addEventListener('blur', () => {
            let url = apiUrl.value.trim();
            if (url && !url.endsWith('api_jsonrpc.php')) {
                url = url.replace(/\/+$/, '');
                url = `${url}/api_jsonrpc.php`;
                apiUrl.value = url;
                this.showTip(i18n.t('settings.messages.apiUrlAutoComplete'), 'success');
            }
        });

        // 测试连接按钮点击事件
        testBtn?.addEventListener('click', async () => {
            const originalText = testBtn.textContent;
            testBtn.disabled = true;
            testBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${i18n.t('settings.messages.testing')}`;

            try {
                const api = new ZabbixAPI(apiUrl.value.trim(), apiToken.value.trim());
                await api.testConnection();
                
                testBtn.style.backgroundColor = '#67C23A';
                testBtn.style.color = 'white';
                testBtn.innerHTML = `<i class="fas fa-check"></i> ${i18n.t('settings.messages.connectionSuccess')}`;
                
                setTimeout(() => {
                    testBtn.style.backgroundColor = '';
                    testBtn.style.color = '';
                    testBtn.innerHTML = originalText;
                    testBtn.disabled = false;
                }, 2000);
            } catch (error) {
                testBtn.style.backgroundColor = '#F56C6C';
                testBtn.style.color = 'white';
                testBtn.innerHTML = `<i class="fas fa-times"></i> ${i18n.t('settings.messages.connectionFailed')}`;
                
                setTimeout(() => {
                    testBtn.style.backgroundColor = '';
                    testBtn.style.color = '';
                    testBtn.innerHTML = originalText;
                    testBtn.disabled = false;
                }, 2000);
                
                console.error('Connection test failed:', error);
            }
        });

        // 保存设置按钮点击事件
        saveBtn?.addEventListener('click', async () => {
            try {
                const settings = {
                    apiUrl: apiUrl.value.trim(),
                    apiToken: btoa(apiToken.value.trim()),
                    refreshInterval: refreshInterval.value
                };

                await new Promise((resolve, reject) => {
                    chrome.storage.sync.set(settings, () => {
                        if (chrome.runtime.lastError) {
                            reject(chrome.runtime.lastError);
                        } else {
                            resolve();
                        }
                    });
                });

                this.showTip(i18n.t('settings.messages.settingsSaved'), 'success');
                
                // 关闭设置对话框
                const container = document.getElementById('settingsContainer');
                if (container) {
                    container.innerHTML = '';
                }

                // 刷新页面以应用新设置
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            } catch (error) {
                console.error('Failed to save settings:', error);
                this.showTip(i18n.t('settings.messages.settingsSaveFailed'), 'error');
            }
        });
    }

    showTip(message, type = 'info') {
        const tip = document.createElement('div');
        tip.className = `settings-tip ${type}`;
        tip.textContent = message;
        tip.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 10px 20px;
            border-radius: 4px;
            color: white;
            font-size: 14px;
            z-index: 10000;
            transition: all 0.3s ease;
        `;

        if (type === 'success') {
            tip.style.backgroundColor = '#67C23A';
        } else if (type === 'error') {
            tip.style.backgroundColor = '#F56C6C';
        } else {
            tip.style.backgroundColor = '#909399';
        }

        document.body.appendChild(tip);

        setTimeout(() => {
            tip.style.opacity = '0';
            setTimeout(() => {
                document.body.removeChild(tip);
            }, 300);
        }, 2000);
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

// 全局函数：初始化设置表单（用于模态框）
window.initializeSettingsForm = async function() {
    const modal = document.getElementById('settingsModal');
    if (!modal) return;

    // 加载已保存的设置
    try {
        const result = await new Promise((resolve) => {
            chrome.storage.sync.get(['apiUrl', 'apiToken', 'refreshInterval'], resolve);
        });

        const apiUrl = modal.querySelector('#apiUrl');
        const apiToken = modal.querySelector('#apiToken');
        const refreshInterval = modal.querySelector('#refreshInterval');

        // 设置表单值
        if (apiUrl && result.apiUrl) {
            apiUrl.value = result.apiUrl;
        }
        if (apiToken && result.apiToken) {
            apiToken.value = atob(result.apiToken);
        }
        if (refreshInterval && result.refreshInterval) {
            refreshInterval.value = result.refreshInterval;
        }
    } catch (error) {
        console.error('Failed to load settings:', error);
    }

    // 初始化表单事件
    const testBtn = modal.querySelector('#testConnection');
    const saveBtn = modal.querySelector('#saveSettings');
    const apiUrl = modal.querySelector('#apiUrl');
    const apiToken = modal.querySelector('#apiToken');
    const refreshInterval = modal.querySelector('#refreshInterval');

    // API URL 输入框失焦事件
    if (apiUrl) {
        // 移除已有的事件监听器
        apiUrl.removeEventListener('blur', handleApiUrlBlur);
        apiUrl.addEventListener('blur', handleApiUrlBlur);
    }

    // 测试连接按钮点击事件
    if (testBtn) {
        testBtn.removeEventListener('click', handleTestConnection);
        testBtn.addEventListener('click', handleTestConnection);
    }

    // 保存设置按钮点击事件
    if (saveBtn) {
        saveBtn.removeEventListener('click', handleSaveSettings);
        saveBtn.addEventListener('click', handleSaveSettings);
    }

    // 事件处理函数
    function handleApiUrlBlur() {
        let url = apiUrl.value.trim();
        if (url && !url.endsWith('api_jsonrpc.php')) {
            url = url.replace(/\/+$/, '');
            url = `${url}/api_jsonrpc.php`;
            apiUrl.value = url;
            showSettingsTip('API URL 已自动补全', 'success');
        }
    }

    async function handleTestConnection() {
        const originalText = testBtn.textContent;
        testBtn.disabled = true;
        testBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> 测试中...`;

        try {
            const api = new ZabbixAPI(apiUrl.value.trim(), apiToken.value.trim());
            await api.testConnection();
            
            testBtn.style.backgroundColor = '#67C23A';
            testBtn.style.color = 'white';
            testBtn.innerHTML = `<i class="fas fa-check"></i> 连接成功`;
            
            setTimeout(() => {
                testBtn.style.backgroundColor = '';
                testBtn.style.color = '';
                testBtn.innerHTML = originalText;
                testBtn.disabled = false;
            }, 2000);
        } catch (error) {
            testBtn.style.backgroundColor = '#F56C6C';
            testBtn.style.color = 'white';
            testBtn.innerHTML = `<i class="fas fa-times"></i> 连接失败`;
            
            setTimeout(() => {
                testBtn.style.backgroundColor = '';
                testBtn.style.color = '';
                testBtn.innerHTML = originalText;
                testBtn.disabled = false;
            }, 2000);
            
            console.error('Connection test failed:', error);
        }
    }

    async function handleSaveSettings() {
        try {
            const settings = {
                apiUrl: apiUrl.value.trim(),
                apiToken: btoa(apiToken.value.trim()),
                refreshInterval: refreshInterval.value
            };

            await new Promise((resolve, reject) => {
                chrome.storage.sync.set(settings, () => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve();
                    }
                });
            });

            showSettingsTip('设置已保存', 'success');
            
            // 1秒后关闭模态框
            setTimeout(() => {
                closeSettingsModal();
            }, 1000);
            
        } catch (error) {
            console.error('Failed to save settings:', error);
            showSettingsTip('保存失败: ' + error.message, 'error');
        }
    }

    // 显示提示信息
    function showSettingsTip(message, type = 'info') {
        // 移除已存在的提示
        const existingTip = modal.querySelector('.settings-tip');
        if (existingTip) {
            existingTip.remove();
        }

        const tip = document.createElement('div');
        tip.className = `settings-tip settings-tip-${type}`;
        tip.textContent = message;
        tip.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 16px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            z-index: 10001;
            animation: settingsTipSlideIn 0.3s ease-out;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        `;

        // 根据类型设置样式
        if (type === 'success') {
            tip.style.background = '#67C23A';
            tip.style.color = 'white';
        } else if (type === 'error') {
            tip.style.background = '#F56C6C';
            tip.style.color = 'white';
        } else {
            tip.style.background = '#409EFF';
            tip.style.color = 'white';
        }

        // 添加动画样式
        if (!document.getElementById('settingsTipStyles')) {
            const tipStyles = document.createElement('style');
            tipStyles.id = 'settingsTipStyles';
            tipStyles.textContent = `
                @keyframes settingsTipSlideIn {
                    from {
                        opacity: 0;
                        transform: translateX(100%);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }
            `;
            document.head.appendChild(tipStyles);
        }

        document.body.appendChild(tip);

        // 3秒后自动移除
        setTimeout(() => {
            tip.remove();
        }, 3000);
    }
};