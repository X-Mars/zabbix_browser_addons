class Settings {
    constructor() {
        // 构造函数不用初始化 DOM，按需调用 showDialog
    }

    async showDialog() {
        try {
            const response = await fetch('settings.html');
            const html = await response.text();
            const temp = document.createElement('div');
            temp.innerHTML = html;
            const modalContent = temp.querySelector('.modal-content');

            const modal = document.createElement('div');
            modal.className = 'modal active';
            modal.innerHTML = `<div class="modal-overlay"></div>`;
            modal.appendChild(modalContent);

            const container = document.getElementById('settingsContainer');
            if (!container) {
                console.error('Settings container not found');
                return;
            }

            container.innerHTML = '';
            container.appendChild(modal);

            this.container = modal;
            this.initI18n();
            document.title = i18n.t('pageTitle.settings');

            const closeBtn = modal.querySelector('#closeModal');
            const overlay = modal.querySelector('.modal-overlay');
            const closeModal = () => { container.innerHTML = ''; };
            closeBtn?.addEventListener('click', closeModal);
            overlay?.addEventListener('click', closeModal);

            this.initFormEvents(modal);
            await this.loadSettings(modal);
        } catch (error) {
            console.error('Failed to load settings dialog:', error);
            this.showTip(i18n.t('settings.messages.loadFailed'), 'error');
        }
    }

    async loadSettings(modal) {
        try {
            const result = await new Promise((resolve) => {
                chrome.storage.sync.get(['apiUrl', 'apiToken', 'refreshInterval'], resolve);
            });

            const apiUrl = modal.querySelector('#apiUrl');
            const apiToken = modal.querySelector('#apiToken');
            const refreshInterval = modal.querySelector('#refreshInterval');

            if (apiUrl && result.apiUrl) apiUrl.value = result.apiUrl;
            if (apiToken && result.apiToken) apiToken.value = atob(result.apiToken);
            if (refreshInterval && result.refreshInterval) {
                refreshInterval.value = result.refreshInterval;
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
                    if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
                    else resolve();
                });
            });

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
            const result = await api.testConnection();

            // 保存检测到的 Zabbix 版本到 storage，供后续 API 调用使用
            if (result && result.version) {
                try {
                    await new Promise((resolve, reject) => {
                        chrome.storage.sync.set({ zabbixVersion: result.version }, () => {
                            if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
                            else resolve();
                        });
                    });
                    console.log('Saved Zabbix version to storage:', result.version);
                } catch (e) {
                    console.warn('Failed to save Zabbix version:', e);
                }
            }

            testBtn.style.backgroundColor = '#67C23A';
            testBtn.style.color = 'white';
            // 显示版本号
            const versionText = result && result.version ? ` (v${result.version})` : '';
            testBtn.innerHTML = `<i class="fas fa-check"></i> ${i18n.t('settings.messages.connectionSuccess')}${versionText}`;

            setTimeout(() => {
                testBtn.style.backgroundColor = '#f0f0f0';
                testBtn.style.color = '#333';
                testBtn.innerHTML = originalText;
            }, 3000);
        } catch (error) {
            testBtn.style.backgroundColor = '#F56C6C';
            testBtn.style.color = 'white';
            testBtn.innerHTML = `<i class="fas fa-times"></i> ${i18n.t('settings.messages.connectionFailed')}`;

            setTimeout(() => {
                testBtn.style.backgroundColor = '#f0f0f0';
                testBtn.style.color = '#333';
                testBtn.innerHTML = originalText;
            }, 3000);

            console.error('Connection test failed:', error);
            try {
                this.showErrorDialog(error);
            } catch (e) {
                console.error('Failed to show error dialog:', e);
            }
        } finally {
            testBtn.disabled = false;
        }
    }

    initI18n() {
        if (this.container) {
            this.container.querySelectorAll('[data-i18n]').forEach(element => {
                const key = element.getAttribute('data-i18n');
                element.textContent = i18n.t(key);
            });

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

        apiUrl?.addEventListener('blur', () => {
            let url = apiUrl.value.trim();
            if (url && !url.endsWith('api_jsonrpc.php')) {
                url = url.replace(/\/+$/, '');
                url = `${url}/api_jsonrpc.php`;
                apiUrl.value = url;
                this.showTip(i18n.t('settings.messages.apiUrlAutoComplete'), 'success');
            }
        });

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
                try {
                    this.showErrorDialog(error);
                } catch (e) {
                    console.error('Failed to show error dialog:', e);
                }
            }
        });

        saveBtn?.addEventListener('click', async () => {
            try {
                const settings = {
                    apiUrl: apiUrl.value.trim(),
                    apiToken: btoa(apiToken.value.trim()),
                    refreshInterval: refreshInterval.value
                };

                await new Promise((resolve, reject) => {
                    chrome.storage.sync.set(settings, () => {
                        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
                        else resolve();
                    });
                });

                this.showTip(i18n.t('settings.messages.settingsSaved'), 'success');
                const container = document.getElementById('settingsContainer');
                if (container) container.innerHTML = '';
                setTimeout(() => window.location.reload(), 1000);
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
        tip.style.cssText = `position: fixed;top: 20px;right: 20px;padding: 10px 20px;border-radius: 4px;color: white;font-size: 14px;z-index: 10000;transition: all 0.3s ease;`;

        if (type === 'success') tip.style.backgroundColor = '#67C23A';
        else if (type === 'error') tip.style.backgroundColor = '#F56C6C';
        else tip.style.backgroundColor = '#909399';

        document.body.appendChild(tip);
        setTimeout(() => {
            tip.style.opacity = '0';
            setTimeout(() => document.body.removeChild(tip), 300);
        }, 2000);
    }

    showErrorDialog(error) {
        const title = (typeof i18n !== 'undefined' && i18n.t) ? (i18n.t('settings.messages.errorTitle') || '连接测试失败') : '连接测试失败';
        const msg = (error && error.message) ? error.message : String(error);
        const suggestions = [
            '请检查 Zabbix API URL 是否正确（确保含有 api_jsonrpc.php）',
            '确认 API Token/用户名密码正确且没有过期',
            '检查浏览器网络或代理设置，确保可访问 Zabbix 服务器',
            '如启用了防火墙或 CORS，请查看服务端日志并允许请求'
        ];

        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;left:0;top:0;right:0;bottom:0;background:rgba(0,0,0,0.45);z-index:10002;display:flex;align-items:center;justify-content:center;padding:20px;';

        const box = document.createElement('div');
        box.style.cssText = 'background:#fff;padding:20px;border-radius:8px;max-width:720px;width:100%;color:#222;box-shadow:0 8px 30px rgba(0,0,0,0.2);';

        const h = document.createElement('h3');
        h.textContent = title;
        h.style.margin = '0 0 12px 0';

        const p = document.createElement('div');
        p.style.marginBottom = '12px';
        p.textContent = msg;

        const sugTitle = document.createElement('div');
        sugTitle.textContent = '可能的原因与解决建议：';
        sugTitle.style.fontWeight = '600';
        sugTitle.style.margin = '8px 0';

        const ul = document.createElement('ul');
        suggestions.forEach(s => {
            const li = document.createElement('li');
            li.textContent = s;
            li.style.margin = '6px 0';
            ul.appendChild(li);
        });

        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;margin-top:16px;';

        const copyBtn = document.createElement('button');
        copyBtn.textContent = '复制错误详情';
        copyBtn.className = 'btn btn-secondary';
        copyBtn.style.padding = '8px 12px';
        copyBtn.addEventListener('click', () => {
            const text = `Error: ${msg}\n\nStack:\n${error && error.stack ? error.stack : ''}`;
            try {
                navigator.clipboard.writeText(text);
                copyBtn.textContent = '已复制';
                setTimeout(() => copyBtn.textContent = '复制错误详情', 2000);
            } catch (e) {
                console.error('Copy failed', e);
            }
        });

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '关闭';
        closeBtn.className = 'btn btn-primary';
        closeBtn.style.padding = '8px 12px';
        closeBtn.addEventListener('click', () => document.body.removeChild(overlay));

        btnRow.appendChild(copyBtn);
        btnRow.appendChild(closeBtn);

        box.appendChild(h);
        box.appendChild(p);
        box.appendChild(sugTitle);
        box.appendChild(ul);
        box.appendChild(btnRow);

        overlay.appendChild(box);
        document.body.appendChild(overlay);
    }
}

function handleApiUrlInput(input) {
    let url = input.value.trim();
    if (url && !url.endsWith('api_jsonrpc.php')) {
        url = url.replace(/\/+$/, '');
        url = `${url}/api_jsonrpc.php`;
        input.value = url;
        showApiUrlTip(i18n.t('settings.messages.apiUrlAutoComplete'));
    }
}

function showApiUrlTip(message) {
    const tipDiv = document.createElement('div');
    tipDiv.className = 'api-url-tip';
    tipDiv.textContent = message;
    tipDiv.style.color = '#67C23A';
    tipDiv.style.fontSize = '12px';
    tipDiv.style.marginTop = '5px';

    const inputParent = document.querySelector('#apiUrl').parentElement;
    const existingTip = inputParent.querySelector('.api-url-tip');
    if (existingTip) existingTip.remove();
    inputParent.appendChild(tipDiv);

    setTimeout(() => { tipDiv.remove(); }, 3000);
}

window.settingsManager = new Settings();

window.initializeSettingsForm = async function() {
    const modal = document.getElementById('settingsModal');
    if (!modal) return;

    try {
        const result = await new Promise((resolve) => {
            chrome.storage.sync.get(['apiUrl', 'apiToken', 'refreshInterval'], resolve);
        });

        const apiUrl = modal.querySelector('#apiUrl');
        const apiToken = modal.querySelector('#apiToken');
        const refreshInterval = modal.querySelector('#refreshInterval');

        if (apiUrl && result.apiUrl) apiUrl.value = result.apiUrl;
        if (apiToken && result.apiToken) apiToken.value = atob(result.apiToken);
        if (refreshInterval && result.refreshInterval) refreshInterval.value = result.refreshInterval;
    } catch (error) {
        console.error('Failed to load settings:', error);
    }

    const testBtn = modal.querySelector('#testConnection');
    const saveBtn = modal.querySelector('#saveSettings');
    const apiUrl = modal.querySelector('#apiUrl');
    const apiToken = modal.querySelector('#apiToken');
    const refreshInterval = modal.querySelector('#refreshInterval');

    if (apiUrl) {
        apiUrl.removeEventListener('blur', handleApiUrlBlur);
        apiUrl.addEventListener('blur', handleApiUrlBlur);
    }
    if (testBtn) {
        testBtn.removeEventListener('click', handleTestConnection);
        testBtn.addEventListener('click', handleTestConnection);
    }
    if (saveBtn) {
        saveBtn.removeEventListener('click', handleSaveSettings);
        saveBtn.addEventListener('click', handleSaveSettings);
    }

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
            try {
                if (window.settingsManager && typeof window.settingsManager.showErrorDialog === 'function') {
                    window.settingsManager.showErrorDialog(error);
                }
            } catch (e) {
                console.error('Failed to show error dialog:', e);
            }
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
                    if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
                    else resolve();
                });
            });

            showSettingsTip('设置已保存', 'success');
            setTimeout(() => { closeSettingsModal(); }, 1000);
        } catch (error) {
            console.error('Failed to save settings:', error);
            showSettingsTip('保存失败: ' + error.message, 'error');
        }
    }

    function showSettingsTip(message, type = 'info') {
        const existingTip = modal.querySelector('.settings-tip');
        if (existingTip) existingTip.remove();

        const tip = document.createElement('div');
        tip.className = `settings-tip settings-tip-${type}`;
        tip.textContent = message;
        tip.style.cssText = `position: fixed;top: 20px;right: 20px;padding: 12px 16px;border-radius: 6px;font-size: 14px;font-weight: 500;z-index: 10001;animation: settingsTipSlideIn 0.3s ease-out;box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);`;

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

        if (!document.getElementById('settingsTipStyles')) {
            const tipStyles = document.createElement('style');
            tipStyles.id = 'settingsTipStyles';
            tipStyles.textContent = `@keyframes settingsTipSlideIn { from { opacity: 0; transform: translateX(100%); } to { opacity: 1; transform: translateX(0); } }`;
            document.head.appendChild(tipStyles);
        }

        document.body.appendChild(tip);
        setTimeout(() => { tip.remove(); }, 3000);
    }
};
