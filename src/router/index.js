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
        // 客户列表操作列「订单查询」跳这里。用 5.8 的 /customers/{id}/orders,
        // 按 id 精确查,不存在同名客户混淆的问题
        path: 'customers/:id/orders',
        name: 'customerOrders',
        component: () => import('@/views/customer/CustomerOrders.vue'),
        meta: { title: '客户订单查询' },
      },
      {
        path: 'customer-statuses',
        name: 'customerStatuses',
        component: () => import('@/views/customerStatus/CustomerStatusList.vue'),
        meta: { title: '客户状态管理' },
      },
      {
        path: 'orders',
        name: 'orders',
        component: () => import('@/views/order/OrderList.vue'),
        meta: { title: '订单信息管理' },
      },
      {
        path: 'order-statuses',
        name: 'orderStatuses',
        component: () => import('@/views/orderStatus/OrderStatusList.vue'),
        meta: { title: '订单状态管理' },
      },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/home' },
]

export default createRouter({
  history: createWebHistory(),
  routes,
})
