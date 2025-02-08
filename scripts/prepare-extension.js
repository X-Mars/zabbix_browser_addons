import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 确保 dist 目录存在
const distDir = path.resolve(__dirname, '../dist')
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir)
}

// 复制 manifest.json 到 dist 目录
fs.copyFileSync(
  path.resolve(__dirname, '../manifest.json'),
  path.resolve(distDir, 'manifest.json')
)

// 确保 dist/assets 目录存在
const distAssetsDir = path.resolve(distDir, 'assets')
if (!fs.existsSync(distAssetsDir)) {
  fs.mkdirSync(distAssetsDir)
}

// 复制图标资源（如果存在）
const assetsDir = path.resolve(__dirname, '../src/assets')
if (fs.existsSync(assetsDir)) {
  fs.readdirSync(assetsDir).forEach(file => {
    fs.copyFileSync(
      path.resolve(assetsDir, file),
      path.resolve(distAssetsDir, file)
    )
  })
} 