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
            document.getElementById('nav-dashboard').classList.add('active');
            break;
        case 'hosts.html':
            document.getElementById('nav-hosts').classList.add('active');
            break;
        case 'dashboard1.html':
            document.getElementById('nav-screens').classList.add('active');
            document.getElementById('nav-screen1').classList.add('active');
            break;
        case 'dashboard2.html':
            document.getElementById('nav-screens').classList.add('active');
            document.getElementById('nav-screen2').classList.add('active');
            break;
    }
} 