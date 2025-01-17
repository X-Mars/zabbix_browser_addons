const fs = require('fs');
const https = require('https');
const path = require('path');

const resources = {
    'lib/css/tailwind.min.css': 'https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css',
    'lib/js/echarts.min.js': 'https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js',
    'lib/js/echarts.min.js.map': 'https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js.map'
};

// 创建目录
['lib/css', 'lib/js'].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// 下载文件
Object.entries(resources).forEach(([filePath, url]) => {
    https.get(url, (response) => {
        const file = fs.createWriteStream(filePath);
        response.pipe(file);
        file.on('finish', () => {
            file.close();
            console.log(`Downloaded: ${filePath}`);
        });
    }).on('error', (err) => {
        console.error(`Error downloading ${filePath}:`, err);
    });
}); 