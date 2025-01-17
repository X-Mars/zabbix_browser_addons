const fs = require('fs');
const { createCanvas } = require('canvas');

// 创建不同尺寸的图标
const sizes = [16, 48, 128];

function generateIcon(size) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // 设置背景
    ctx.fillStyle = '#D40000';
    ctx.fillRect(0, 0, size, size);

    // 绘制字母'Z'
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${size * 0.7}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Z', size/2, size/2);

    // 保存为PNG
    const buffer = canvas.toBuffer('image/png');
    if (!fs.existsSync('assets')) {
        fs.mkdirSync('assets');
    }
    fs.writeFileSync(`assets/icon${size}.png`, buffer);
}

// 生成所有尺寸的图标
sizes.forEach(size => generateIcon(size)); 