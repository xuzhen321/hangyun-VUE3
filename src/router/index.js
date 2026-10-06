import { createRouter, createWebHistory } from 'vue-router'
import MainLayout from '@/layouts/MainLayout.vue'

const routes = [
  {
    path: '/',
    component: MainLayout,
    children: [
      { path: '', redirect: '/home' },
      {
        path: 'home',
        name: 'home',
        component: () => import('@/views/HomeView.vue'),
        meta: { title: '首页' },
      },
      {
        path: 'customers',
        name: 'customers',
        component: () => import('@/views/customer/CustomerList.vue'),
        meta: { title: '客户信息管理' },
      },
      {
        path: 'customer-statuses',
        name: 'customerStatuses',
        component: () => import('@/views/customerStatus/CustomerStatusList.vue'),
        meta: { title: '客户状态管理' },
      },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/home' },
]

export default createRouter({
  history: createWebHistory(),
  routes,
})
