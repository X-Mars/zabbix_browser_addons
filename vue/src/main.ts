import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import { createI18n } from 'vue-i18n'
import router from './router'
import App from './App.vue'
import locales from './locales'

import 'element-plus/dist/index.css'
import './styles/index.scss'

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  messages: locales
})

const app = createApp(App)

// 注册所有图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(createPinia())
   .use(router)
   .use(i18n)
   .use(ElementPlus)
   .mount('#app')