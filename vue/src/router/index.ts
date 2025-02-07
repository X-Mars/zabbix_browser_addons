import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/dashboard'
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('@/views/dashboard/index.vue')
  },
  {
    path: '/hosts',
    name: 'Hosts',
    component: () => import('@/views/hosts/index.vue')
  },
  {
    path: '/hosts/:id',
    name: 'HostDetail',
    component: () => import('@/views/hosts/detail.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router