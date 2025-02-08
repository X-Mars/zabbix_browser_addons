import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import Dashboard from '@/views/Dashboard.vue'
import HostList from '@/views/HostList.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/dashboard'
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: Dashboard
  },
  {
    path: '/hosts',
    name: 'hosts',
    component: HostList
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router 