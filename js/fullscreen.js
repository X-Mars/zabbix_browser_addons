// 全屏功能管理器
class FullscreenManager {
    constructor() {
        this.isFullscreen = false;
        this.fullscreenBtn = null;
        this.dashboardScreen = null;
        this.currentDashboard = null;
    }

    init() {
        // 检测当前是哪个大屏页面
        this.detectCurrentDashboard();
        
        if (this.fullscreenBtn) {
            this.fullscreenBtn.addEventListener('click', () => {
                this.toggleFullscreen();
            });
        }

        // 监听全屏状态变化 - 各浏览器兼容
        const fullscreenEvents = [
            'fullscreenchange',
            'webkitfullscreenchange', 
            'mozfullscreenchange',
            'MSFullscreenChange'
        ];
        
        fullscreenEvents.forEach(event => {
            document.addEventListener(event, () => {
                this.handleFullscreenChange();
            });
        });

        // 监听ESC键退出全屏
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isFullscreen) {
                this.exitFullscreen();
            }
        });

        console.log('FullscreenManager initialized for', this.currentDashboard);
    }

    detectCurrentDashboard() {
        // 检测是大屏1还是大屏2
        const dashboard1Btn = document.getElementById('fullscreenBtn');
        const dashboard2Btn = document.getElementById('fullscreenBtn2');
        const dashboard1Screen = document.querySelector('.dashboard-screen');
        const dashboard2Screen = document.querySelector('.dashboard-screen-2');
        
        if (dashboard1Btn && dashboard1Screen) {
            this.fullscreenBtn = dashboard1Btn;
            this.dashboardScreen = dashboard1Screen;
            this.currentDashboard = 'dashboard1';
        } else if (dashboard2Btn && dashboard2Screen) {
            this.fullscreenBtn = dashboard2Btn;
            this.dashboardScreen = dashboard2Screen;
            this.currentDashboard = 'dashboard2';
        }
    }

    toggleFullscreen() {
        console.log('Toggle fullscreen, current state:', this.isFullscreen);
        if (this.isFullscreen) {
            this.exitFullscreen();
        } else {
            this.enterFullscreen();
        }
    }

    enterFullscreen() {
        console.log('Entering fullscreen mode');
        const element = this.dashboardScreen || document.documentElement;
        
        try {
            if (element.requestFullscreen) {
                element.requestFullscreen().catch(err => {
                    console.error('Failed to enter fullscreen:', err);
                });
            } else if (element.webkitRequestFullscreen) {
                element.webkitRequestFullscreen();
            } else if (element.mozRequestFullScreen) {
                element.mozRequestFullScreen();
            } else if (element.msRequestFullscreen) {
                element.msRequestFullscreen();
            } else {
                console.warn('Fullscreen API not supported');
                // 手动设置样式模拟全屏
                this.simulateFullscreen();
            }
        } catch (error) {
            console.error('Fullscreen request failed:', error);
        }
    }

    exitFullscreen() {
        console.log('Exiting fullscreen mode');
        try {
            if (document.exitFullscreen) {
                document.exitFullscreen().catch(err => {
                    console.error('Failed to exit fullscreen:', err);
                });
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            } else {
                // 退出模拟全屏
                this.exitSimulateFullscreen();
            }
        } catch (error) {
            console.error('Exit fullscreen failed:', error);
        }
    }

    simulateFullscreen() {
        // 如果原生全屏API不可用，使用CSS模拟全屏
        const element = this.dashboardScreen;
        if (element) {
            element.style.position = 'fixed';
            element.style.top = '0';
            element.style.left = '0';
            element.style.width = '100vw';
            element.style.height = '100vh';
            element.style.zIndex = '9999';
            
            // 根据不同大屏设置不同的背景色
            if (this.currentDashboard === 'dashboard2') {
                element.style.backgroundColor = '#0f0f23';
                element.classList.add('simulated-fullscreen-2');
            } else {
                element.style.backgroundColor = '#0c1218';
                element.classList.add('simulated-fullscreen');
            }
            
            // 隐藏页面其他元素
            document.body.style.overflow = 'hidden';
            
            this.isFullscreen = true;
            this.updateButtonIcon();
            
            // 进入模拟全屏时更新刷新时间显示
            const dashboardInstance = this.currentDashboard === 'dashboard2' ? 
                window.dashboard2Instance : window.dashboardInstance;
                
            if (dashboardInstance && typeof dashboardInstance.updateLastRefreshTime === 'function') {
                setTimeout(() => {
                    dashboardInstance.updateLastRefreshTime();
                }, 100);
            }
        }
    }

    exitSimulateFullscreen() {
        const element = this.dashboardScreen;
        if (element) {
            element.style.position = '';
            element.style.top = '';
            element.style.left = '';
            element.style.width = '';
            element.style.height = '';
            element.style.zIndex = '';
            element.style.backgroundColor = '';
            
            // 移除对应的CSS类
            if (this.currentDashboard === 'dashboard2') {
                element.classList.remove('simulated-fullscreen-2');
            } else {
                element.classList.remove('simulated-fullscreen');
            }
            
            document.body.style.overflow = '';
            
            this.isFullscreen = false;
            this.updateButtonIcon();
        }
    }

    handleFullscreenChange() {
        const isCurrentlyFullscreen = !!(
            document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.mozFullScreenElement ||
            document.msFullscreenElement
        );

        console.log('Fullscreen state changed:', isCurrentlyFullscreen);
        this.isFullscreen = isCurrentlyFullscreen;
        this.updateButtonIcon();
        
        // 全屏状态改变时重新调整图表大小
        const dashboardInstance = this.currentDashboard === 'dashboard2' ? 
            window.dashboard2Instance : window.dashboardInstance;
            
        if (dashboardInstance && dashboardInstance.charts) {
            setTimeout(() => {
                Object.values(dashboardInstance.charts).forEach(chart => {
                    if (chart && typeof chart.resize === 'function') {
                        chart.resize();
                    }
                });
            }, 300);
        }
        
        // 进入全屏时更新刷新时间显示
        if (this.isFullscreen && dashboardInstance && typeof dashboardInstance.updateLastRefreshTime === 'function') {
            setTimeout(() => {
                dashboardInstance.updateLastRefreshTime();
            }, 100);
        }
    }

    updateButtonIcon() {
        if (this.fullscreenBtn) {
            const icon = this.fullscreenBtn.querySelector('i');
            if (icon) {
                if (this.isFullscreen) {
                    icon.className = 'fas fa-compress';
                    this.fullscreenBtn.title = '退出全屏';
                } else {
                    icon.className = 'fas fa-expand';
                    this.fullscreenBtn.title = '全屏显示';
                }
            }
        }
    }
}

// 页面加载完成后初始化全屏管理器
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing FullscreenManager');
    const fullscreenManager = new FullscreenManager();
    fullscreenManager.init();
    
    // 将实例存储到全局，以便其他模块访问
    window.fullscreenManager = fullscreenManager;
});
