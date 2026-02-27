// 动态加载导航栏
async function loadHeader() {
    try {
        const headerContainer = document.getElementById('header-container');
        if (!headerContainer) {
            console.warn('未找到header-container元素');
            return;
        }

        // 创建导航栏HTML
        const headerHTML = `
        <header class="header">
            <div class="header-content flex">
                <div class="flex items-center">
                    <img src="assets/zabbix.png" class="logo" alt="logo">
                    <h1>Zabbix Dashboard</h1>
                </div>
                <nav class="navbar">
                    <ul>
                        <li><a href="index.html" id="nav-dashboard"><i class="fas fa-tachometer-alt"></i> <span data-i18n="nav.dashboard">仪表盘</span></a></li>
                        <li><a href="cmdb.html" id="nav-cmdb"><i class="fas fa-server"></i> <span data-i18n="nav.cmdb">主机列表</span></a></li>
                        <li class="dropdown">
                            <a href="#" class="dropdown-toggle" id="nav-screens">
                                <i class="fas fa-desktop"></i>
                                <span data-i18n="nav.bigScreen">大屏展示</span>
                                <i class="fas fa-chevron-down"></i>
                            </a>
                            <ul class="dropdown-menu">
                                <li><a href="dashboard1.html" id="nav-screen1"><span data-i18n="nav.screen1">告警监控大屏</span></a></li>
                                <li><a href="dashboard2.html" id="nav-screen2"><span data-i18n="nav.screen2">资源监控大屏</span></a></li>
                                <li><a href="dashboard3.html" id="nav-screen3"><span data-i18n="nav.screen3">综合监控大屏</span></a></li>
                                <li><a href="dashboard4.html" id="nav-screen4"><span data-i18n="nav.screen4">服务可用性大屏</span></a></li>
                            </ul>
                        </li>
                    </ul>
                </nav>
                <div class="header-actions">
                    <div class="last-refresh">
                        <span id="lastRefreshTime" data-i18n="settings.messages.lastRefresh"></span>
                    </div>
                    <a href="https://qm.qq.com/cgi-bin/qm/qr?k=a_y5qjuIfBYZHkhGg4JTZqGjTk3KUI5T&jump_from=webapi&authKey=qJpb8UQWFJcxKBdT/zq9kGBqiMxOm9k3TkfYeAtaVtHAbKbIfxMiGBolmP+aWa5b" target="_blank" class="icon-btn">
                        <img width="32px" src="assets/qq.png" class="icon" />
                    </a>
                    <a href="https://github.com/X-Mars" target="_blank" class="icon-btn">
                        <svg viewBox="0 0 24 24" width="24" height="24" class="icon">
                            <path fill="currentColor" d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                        </svg>
                    </a>
                    <button id="settingsBtn" class="icon-btn">
                        <svg viewBox="0 0 24 24" width="24" height="24" class="icon">
                            <path fill="currentColor" d="M24 13.616v-3.232l-2.869-1.02c-.198-.687-.472-1.342-.811-1.955l1.308-2.751-2.285-2.285-2.751 1.307c-.613-.339-1.268-.613-1.955-.811l-1.02-2.869h-3.232l-1.021 2.869c-.687.198-1.342.472-1.955.811l-2.751-1.308-2.285 2.285 1.308 2.752c-.339.613-.614 1.268-.811 1.955l-2.869 1.02v3.232l2.869 1.02c.198.687.472 1.342.811 1.955l-1.308 2.751 2.285 2.286 2.751-1.308c.613.339 1.268.613 1.955.811l1.021 2.869h3.232l1.02-2.869c.687-.198 1.342-.472 1.955-.811l2.751 1.308 2.285-2.286-1.308-2.751c.339-.613.614-1.268.811-1.955l2.869-1.02zm-12 2.384c-2.209 0-4-1.791-4-4s1.791-4 4-4 4 1.791 4 4-1.791 4-4 4z"/>
                        </svg>
                    </button>
                </div>
            </div>
        </header>
        `;

        // 插入导航栏HTML
        headerContainer.innerHTML = headerHTML;

        // 初始化导航栏功能
        initializeNavigation();
        initializeDropdown();
        initializeSettings();
        
        // 初始化国际化
        initializeI18n();

    } catch (error) {
        console.error('加载导航栏失败:', error);
    }
}

function initializeNavigation() {
    // 获取当前页面的文件名
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    
    // 移除所有激活状态
    document.querySelectorAll('.navbar a').forEach(link => {
        link.classList.remove('active');
    });
    
    // 根据当前页面设置激活状态
        switch(currentPage) {
        case 'index.html':
            document.getElementById('nav-dashboard')?.classList.add('active');
            break;
        case 'cmdb.html':
            document.getElementById('nav-cmdb')?.classList.add('active');
            break;
        case 'dashboard1.html':
            document.getElementById('nav-screens')?.classList.add('active');
            document.getElementById('nav-screen1')?.classList.add('active');
            break;
        case 'dashboard2.html':
            document.getElementById('nav-screens')?.classList.add('active');
            document.getElementById('nav-screen2')?.classList.add('active');
            break;
        case 'dashboard3.html':
            document.getElementById('nav-screens')?.classList.add('active');
            document.getElementById('nav-screen3')?.classList.add('active');
            break;
        case 'dashboard4.html':
            document.getElementById('nav-screens')?.classList.add('active');
            document.getElementById('nav-screen4')?.classList.add('active');
            break;
    }
}

function initializeDropdown() {
    // 初始化下拉菜单
    const dropdownToggle = document.querySelector('.dropdown-toggle');
    const dropdown = document.querySelector('.dropdown');
    
    if (dropdownToggle && dropdown) {
        dropdownToggle.addEventListener('click', (e) => {
            e.preventDefault();
            dropdown.classList.toggle('open');
        });

        // 点击其他地方关闭下拉菜单
        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target)) {
                dropdown.classList.remove('open');
            }
        });
    }
}

// 初始化国际化
function initializeI18n() {
    // 应用所有 data-i18n 属性的翻译
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (typeof i18n !== 'undefined' && i18n.t) {
            element.textContent = i18n.t(key);
        }
    });
}

function initializeSettings() {
    // 初始化设置按钮（防止重复绑定）
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn && !settingsBtn.dataset.settingsBound) {
        settingsBtn.dataset.settingsBound = 'true';
        settingsBtn.addEventListener('click', () => {
            showSettingsModal();
        });
    }
}

// 显示设置模态框
function showSettingsModal() {
    // 检查是否已存在模态框
    let existingModal = document.getElementById('settingsModal');
    if (existingModal) {
        existingModal.style.display = 'flex';
        // 重新加载设置数据
        if (window.initializeSettingsForm) {
            window.initializeSettingsForm();
        }
        return;
    }

    // 创建模态框HTML
    const modalHTML = `
    <div id="settingsModal" class="settings-modal" style="display: flex;">
        <div class="settings-modal-overlay"></div>
        <div class="settings-modal-content">
            <div class="settings-modal-header">
                <div class="settings-header-title">
                    <div class="settings-header-icon">
                        <i class="fas fa-cog"></i>
                    </div>
                    <div>
                        <h2 data-i18n="settings.title">设置</h2>
                        <p class="settings-header-desc" data-i18n="settings.description">配置 Zabbix 连接参数</p>
                    </div>
                </div>
                <button id="closeSettingsModal" class="settings-close-btn">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="settings-modal-body">
                <div class="settings-form-group">
                    <label for="apiUrl">
                        <i class="fas fa-link settings-label-icon"></i>
                        <span data-i18n="settings.apiUrl">ZABBIX API URL</span>
                    </label>
                    <div class="settings-input-wrapper">
                        <input type="text" id="apiUrl" class="settings-form-control" placeholder="http://your-zabbix-server/api_jsonrpc.php">
                    </div>
                </div>
                <div class="settings-form-group">
                    <label for="apiToken">
                        <i class="fas fa-key settings-label-icon"></i>
                        <span data-i18n="settings.apiToken">ZABBIX API TOKEN</span>
                    </label>
                    <div class="settings-input-wrapper">
                        <input type="password" id="apiToken" class="settings-form-control">
                        <button type="button" class="settings-toggle-pwd" title="显示/隐藏">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                </div>
                <div class="settings-form-group">
                    <label for="refreshInterval">
                        <i class="fas fa-sync-alt settings-label-icon"></i>
                        <span data-i18n="settings.refreshInterval">刷新间隔</span>
                    </label>
                    <select id="refreshInterval" class="settings-form-select">
                        <option value="5000">5秒</option>
                        <option value="30000">30秒</option>
                        <option value="60000">1分钟</option>
                        <option value="300000" selected>5分钟</option>
                        <option value="600000">10分钟</option>
                        <option value="1800000">30分钟</option>
                    </select>
                </div>
            </div>
            <div class="settings-modal-footer">
                <button id="testConnection" class="settings-btn settings-btn-secondary">
                    <i class="fas fa-plug"></i>
                    <span data-i18n="settings.buttons.test">测试连接</span>
                </button>
                <button id="saveSettings" class="settings-btn settings-btn-primary">
                    <i class="fas fa-save"></i>
                    <span data-i18n="settings.buttons.save">保存设置</span>
                </button>
            </div>
        </div>
    </div>
    `;

    // 添加模态框到页面
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // 添加模态框样式
    addSettingsModalStyles();

    // 绑定关闭事件
    const modal = document.getElementById('settingsModal');
    const overlay = modal.querySelector('.settings-modal-overlay');
    const closeBtn = modal.querySelector('#closeSettingsModal');
    
    overlay.addEventListener('click', closeSettingsModal);
    closeBtn.addEventListener('click', closeSettingsModal);

    // ESC 键关闭
    document.addEventListener('keydown', function settingsEscHandler(e) {
        if (e.key === 'Escape') {
            closeSettingsModal();
        }
    });

    // 密码显示/隐藏切换
    const togglePwdBtn = modal.querySelector('.settings-toggle-pwd');
    if (togglePwdBtn) {
        togglePwdBtn.addEventListener('click', () => {
            const pwdInput = modal.querySelector('#apiToken');
            const icon = togglePwdBtn.querySelector('i');
            if (pwdInput.type === 'password') {
                pwdInput.type = 'text';
                icon.className = 'fas fa-eye-slash';
            } else {
                pwdInput.type = 'password';
                icon.className = 'fas fa-eye';
            }
        });
    }

    // 初始化设置功能
    if (window.initializeSettingsForm) {
        window.initializeSettingsForm();
    }

    // 应用国际化
    if (window.i18n) {
        window.i18n.apply();
    }
}

// 关闭设置模态框
function closeSettingsModal() {
    const modal = document.getElementById('settingsModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// 添加模态框样式
function addSettingsModalStyles() {
    // 检查是否已添加样式
    if (document.getElementById('settingsModalStyles')) {
        return;
    }

    const styles = `
    <style id="settingsModalStyles">
    .settings-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 10000;
        display: none;
        justify-content: center;
        align-items: center;
    }

    .settings-modal-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.45);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
    }

    .settings-modal-content {
        position: relative;
        background: #ffffff;
        border-radius: 16px;
        box-shadow: 0 25px 60px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(0, 0, 0, 0.05);
        width: 90%;
        max-width: 520px;
        padding: 0;
        animation: settingsModalSlideIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
        max-height: 90vh;
        overflow-y: auto;
    }

    @keyframes settingsModalSlideIn {
        from {
            opacity: 0;
            transform: translateY(-30px) scale(0.9);
        }
        to {
            opacity: 1;
            transform: translateY(0) scale(1);
        }
    }

    .settings-modal-header {
        padding: 28px 28px 20px 28px;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        border-bottom: 1px solid #f0f0f0;
    }

    .settings-header-title {
        display: flex;
        align-items: center;
        gap: 14px;
    }

    .settings-header-icon {
        width: 44px;
        height: 44px;
        border-radius: 12px;
        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 1.1rem;
        flex-shrink: 0;
        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
    }

    .settings-modal-header h2 {
        font-size: 1.25rem;
        font-weight: 700;
        color: #111827;
        margin: 0;
        letter-spacing: -0.01em;
    }

    .settings-header-desc {
        font-size: 0.8rem;
        color: #9ca3af;
        margin: 2px 0 0 0;
        font-weight: 400;
    }

    .settings-close-btn {
        background: none;
        border: none;
        font-size: 1.1rem;
        color: #9ca3af;
        cursor: pointer;
        padding: 8px;
        border-radius: 8px;
        transition: all 0.2s;
        margin-top: -2px;
    }

    .settings-close-btn:hover {
        color: #374151;
        background: #f3f4f6;
    }

    .settings-modal-body {
        padding: 24px 28px;
    }

    .settings-form-group {
        margin-bottom: 22px;
    }

    .settings-form-group:last-child {
        margin-bottom: 0;
    }

    .settings-form-group label {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 10px;
        font-weight: 600;
        color: #374151;
        font-size: 0.8125rem;
        text-transform: uppercase;
        letter-spacing: 0.03em;
    }

    .settings-label-icon {
        color: #6b7280;
        font-size: 0.8rem;
        width: 16px;
        text-align: center;
    }

    .settings-input-wrapper {
        position: relative;
    }

    .settings-form-control {
        width: 100%;
        padding: 11px 14px;
        border: 1.5px solid #e5e7eb;
        border-radius: 10px;
        font-size: 0.875rem;
        transition: border-color 0.2s, box-shadow 0.2s, background-color 0.2s;
        box-sizing: border-box;
        background: #f9fafb;
        color: #111827;
    }

    .settings-form-control::placeholder {
        color: #9ca3af;
    }

    .settings-form-control:hover {
        border-color: #d1d5db;
    }

    .settings-form-control:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
        background: #ffffff;
    }

    .settings-toggle-pwd {
        position: absolute;
        right: 10px;
        top: 50%;
        transform: translateY(-50%);
        background: none;
        border: none;
        color: #9ca3af;
        cursor: pointer;
        padding: 4px 6px;
        border-radius: 4px;
        font-size: 0.85rem;
        transition: color 0.2s;
    }

    .settings-toggle-pwd:hover {
        color: #6b7280;
    }

    .settings-form-select {
        width: 100%;
        padding: 11px 14px;
        border: 1.5px solid #e5e7eb;
        border-radius: 10px;
        font-size: 0.875rem;
        background: #f9fafb url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e") right 10px center/1.5em 1.5em no-repeat;
        transition: border-color 0.2s, box-shadow 0.2s, background-color 0.2s;
        box-sizing: border-box;
        color: #111827;
        -webkit-appearance: none;
        appearance: none;
        cursor: pointer;
    }

    .settings-form-select:hover {
        border-color: #d1d5db;
    }

    .settings-form-select:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
        background-color: #ffffff;
    }

    .settings-modal-footer {
        padding: 20px 28px 28px;
        border-top: 1px solid #f0f0f0;
        display: flex;
        justify-content: flex-end;
        gap: 10px;
    }

    .settings-btn {
        padding: 10px 20px;
        border: none;
        border-radius: 10px;
        font-weight: 600;
        font-size: 0.8125rem;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        transition: all 0.2s;
        letter-spacing: 0.01em;
    }

    .settings-btn-secondary {
        background: #f3f4f6;
        color: #4b5563;
        border: 1.5px solid #e5e7eb;
    }

    .settings-btn-secondary:hover {
        background: #e5e7eb;
        border-color: #d1d5db;
    }

    .settings-btn-primary {
        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
        color: white;
        box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
    }

    .settings-btn-primary:hover {
        background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
        transform: translateY(-1px);
    }

    .settings-btn:active {
        transform: translateY(0);
    }

    .settings-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
    }

    /* 深色主题适配 */
    @media (prefers-color-scheme: dark) {
        .settings-modal-content {
            background: #1f2937;
            color: #f9fafb;
            box-shadow: 0 25px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05);
        }

        .settings-modal-header {
            border-bottom-color: #374151;
        }

        .settings-header-desc {
            color: #6b7280;
        }

        .settings-modal-header h2 {
            color: #f9fafb;
        }

        .settings-close-btn:hover {
            color: #e5e7eb;
            background: #374151;
        }

        .settings-form-group label {
            color: #d1d5db;
        }

        .settings-label-icon {
            color: #9ca3af;
        }

        .settings-form-control,
        .settings-form-select {
            background: #374151;
            border-color: #4b5563;
            color: #f9fafb;
        }

        .settings-form-control::placeholder {
            color: #6b7280;
        }

        .settings-form-control:hover,
        .settings-form-select:hover {
            border-color: #6b7280;
        }

        .settings-form-control:focus,
        .settings-form-select:focus {
            border-color: #60a5fa;
            background: #1f2937;
        }

        .settings-toggle-pwd {
            color: #6b7280;
        }

        .settings-toggle-pwd:hover {
            color: #9ca3af;
        }

        .settings-modal-footer {
            border-top-color: #374151;
        }

        .settings-btn-secondary {
            background: #374151;
            color: #d1d5db;
            border-color: #4b5563;
        }

        .settings-btn-secondary:hover {
            background: #4b5563;
            border-color: #6b7280;
        }
    }
    </style>
    `;

    document.head.insertAdjacentHTML('beforeend', styles);
}

// 页面加载完成后自动加载导航栏
document.addEventListener('DOMContentLoaded', loadHeader);