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
    // 初始化设置按钮
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
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
        return;
    }

    // 创建模态框HTML
    const modalHTML = `
    <div id="settingsModal" class="settings-modal" style="display: flex;">
        <div class="settings-modal-overlay"></div>
        <div class="settings-modal-content">
            <div class="settings-modal-header">
                <h2 data-i18n="settings.title">设置</h2>
                <button id="closeSettingsModal" class="settings-close-btn">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="settings-modal-body">
                <div class="settings-form-group">
                    <label for="apiUrl" data-i18n="settings.apiUrl">ZABBIX API URL:</label>
                    <input type="text" id="apiUrl" class="settings-form-control" placeholder="http://your-zabbix-server/api_jsonrpc.php">
                </div>
                <div class="settings-form-group">
                    <label for="apiToken" data-i18n="settings.apiToken">ZABBIX API TOKEN:</label>
                    <input type="password" id="apiToken" class="settings-form-control">
                </div>
                <div class="settings-form-group">
                    <label data-i18n="settings.refreshInterval">刷新间隔</label>
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
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(5px);
    }

    .settings-modal-content {
        position: relative;
        background: white;
        border-radius: 12px;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
        width: 90%;
        max-width: 560px;
        padding: 0;
        animation: modalSlideIn 0.3s ease-out;
        max-height: 90vh;
        overflow-y: auto;
    }

    @keyframes modalSlideIn {
        from {
            opacity: 0;
            transform: translateY(-20px) scale(0.95);
        }
        to {
            opacity: 1;
            transform: translateY(0) scale(1);
        }
    }

    .settings-modal-header {
        padding: 24px 24px 0 24px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #e5e7eb;
        margin-bottom: 24px;
    }

    .settings-modal-header h2 {
        font-size: 1.5rem;
        font-weight: 600;
        color: #111827;
        margin: 0;
    }

    .settings-close-btn {
        background: none;
        border: none;
        font-size: 1.2rem;
        color: #6b7280;
        cursor: pointer;
        padding: 8px;
        border-radius: 6px;
        transition: all 0.2s;
    }

    .settings-close-btn:hover {
        color: #374151;
        background: #f3f4f6;
    }

    .settings-modal-body {
        padding: 0 24px;
    }

    .settings-form-group {
        margin-bottom: 20px;
    }

    .settings-form-group label {
        display: block;
        margin-bottom: 8px;
        font-weight: 500;
        color: #374151;
        font-size: 0.875rem;
    }

    .settings-form-control {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        font-size: 0.875rem;
        transition: border-color 0.2s, box-shadow 0.2s;
        box-sizing: border-box;
    }

    .settings-form-control:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .settings-form-select {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        font-size: 0.875rem;
        background: white;
        transition: border-color 0.2s, box-shadow 0.2s;
        box-sizing: border-box;
    }

    .settings-form-select:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .settings-modal-footer {
        padding: 24px;
        border-top: 1px solid #e5e7eb;
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        margin-top: 24px;
    }

    .settings-btn {
        padding: 10px 16px;
        border: none;
        border-radius: 6px;
        font-weight: 500;
        font-size: 0.875rem;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        transition: all 0.2s;
    }

    .settings-btn-secondary {
        background: #f3f4f6;
        color: #374151;
    }

    .settings-btn-secondary:hover {
        background: #e5e7eb;
    }

    .settings-btn-primary {
        background: #3b82f6;
        color: white;
    }

    .settings-btn-primary:hover {
        background: #2563eb;
    }

    .settings-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    /* 深色主题适配 */
    @media (prefers-color-scheme: dark) {
        .settings-modal-content {
            background: #1f2937;
            color: #f9fafb;
        }

        .settings-modal-header {
            border-bottom-color: #374151;
        }

        .settings-modal-header h2 {
            color: #f9fafb;
        }

        .settings-form-group label {
            color: #d1d5db;
        }

        .settings-form-control,
        .settings-form-select {
            background: #374151;
            border-color: #4b5563;
            color: #f9fafb;
        }

        .settings-form-control:focus,
        .settings-form-select:focus {
            border-color: #60a5fa;
        }

        .settings-modal-footer {
            border-top-color: #374151;
        }

        .settings-btn-secondary {
            background: #374151;
            color: #d1d5db;
        }

        .settings-btn-secondary:hover {
            background: #4b5563;
        }
    }
    </style>
    `;

    document.head.insertAdjacentHTML('beforeend', styles);
}

// 页面加载完成后自动加载导航栏
document.addEventListener('DOMContentLoaded', loadHeader);