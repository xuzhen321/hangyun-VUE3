import { createRouter, createWebHistory } from 'vue-router'
import MainLayout from '@/layouts/MainLayout.vue'
import { getToken } from '@/utils/token'

const routes = [
  {
    // 登录页**不套 MainLayout** —— 没登录的人不该看到侧边菜单
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { title: '登录', public: true },
  },
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
      {
        path: 'cargo-types',
        name: 'cargoTypes',
        component: () => import('@/views/cargoType/CargoTypeList.vue'),
        meta: { title: '货物种类管理' },
      },
      {
        // 订单列表的「货物查询」会带着 ?orderId= 跳到这里
        path: 'cargos',
        name: 'cargos',
        component: () => import('@/views/cargo/CargoList.vue'),
        meta: { title: '订单货物管理' },
      },
      {
        // 路径和接口 /cargo-container-results 保持一致,便于对照文档
        path: 'cargo-container-results',
        name: 'packingRecords',
        component: () => import('@/views/packing/PackingList.vue'),
        meta: { title: '装箱情况登记管理' },
      },
      {
        path: 'containers',
        name: 'containers',
        component: () => import('@/views/container/ContainerList.vue'),
        meta: { title: '集装箱信息管理' },
      },
      {
        path: 'container-types',
        name: 'containerTypes',
        component: () => import('@/views/containerType/ContainerTypeList.vue'),
        meta: { title: '箱型管理' },
      },
      {
        path: 'container-statuses',
        name: 'containerStatuses',
        component: () => import('@/views/containerStatus/ContainerStatusList.vue'),
        meta: { title: '集装箱状态管理' },
      },
      {
        path: 'trailers',
        name: 'trailers',
        component: () => import('@/views/trailer/TrailerList.vue'),
        meta: { title: '拖车管理' },
      },
      {
        path: 'container-trailer-records',
        name: 'containerTrailerRecords',
        component: () =>
          import('@/views/containerTrailerRecord/ContainerTrailerRecordList.vue'),
        meta: { title: '提空箱登记' },
      },
      {
        path: 'container-events',
        name: 'containerEvents',
        component: () => import('@/views/containerEvent/ContainerEventList.vue'),
        meta: { title: '物流事件管理' },
      },
      {
        path: 'event-statuses',
        name: 'eventStatuses',
        component: () => import('@/views/eventStatus/EventStatusList.vue'),
        meta: { title: '事件状态管理' },
      },
      {
        path: 'voyages',
        name: 'voyages',
        component: () => import('@/views/voyage/VoyageList.vue'),
        meta: { title: '航次管理' },
      },
      // ---- 港口(文档 24 / 25 节)----
      {
        path: 'ports',
        name: 'ports',
        component: () => import('@/views/port/PortList.vue'),
        meta: { title: '港口信息管理' },
      },
      {
        path: 'areas',
        name: 'areas',
        component: () => import('@/views/portArea/PortAreaList.vue'),
        meta: { title: '港口区域' },
      },
      {
        path: 'timezones',
        name: 'timezones',
        component: () => import('@/views/portTimezone/PortTimezoneList.vue'),
        meta: { title: '港口时区' },
      },
      {
        path: 'harbor-sizes',
        name: 'harborSizes',
        component: () => import('@/views/harborSize/HarborSizeList.vue'),
        meta: { title: '港口尺寸' },
      },
      {
        path: 'port-levels',
        name: 'portLevels',
        component: () => import('@/views/portLevel/PortLevelList.vue'),
        meta: { title: '港口级别' },
      },
      {
        path: 'port-types',
        name: 'portTypes',
        component: () => import('@/views/portType/PortTypeList.vue'),
        meta: { title: '港口类型' },
      },
      // ---- 船舶(文档 21 / 22 / 23 节)----
      {
        path: 'vessels',
        name: 'vessels',
        component: () => import('@/views/vessel/VesselList.vue'),
        meta: { title: '船舶信息管理' },
      },
      {
        path: 'countries',
        name: 'countries',
        component: () => import('@/views/country/CountryList.vue'),
        meta: { title: '国家字典' },
      },
      {
        path: 'ship-types',
        name: 'shipTypes',
        component: () => import('@/views/shipType/ShipTypeList.vue'),
        meta: { title: '船舶类型' },
      },
      {
        // 通用字典表:箱主 / 操作方 / 船东 / 管理公司都指向它,目前只有集装箱在用
        path: 'companies',
        name: 'companies',
        component: () => import('@/views/company/CompanyList.vue'),
        meta: { title: '公司信息管理' },
      },
      // ---- 认证与日志(文档 26~29 节)----
      {
        path: 'users',
        name: 'users',
        component: () => import('@/views/user/UserList.vue'),
        meta: { title: '系统用户' },
      },
      {
        path: 'operation-types',
        name: 'operationTypes',
        component: () => import('@/views/operationType/OperationTypeList.vue'),
        meta: { title: '操作类型' },
      },
      {
        path: 'logs',
        name: 'logs',
        component: () => import('@/views/log/LogList.vue'),
        meta: { title: '操作日志' },
      },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/home' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

/**
 * 路由守卫:没登录就踢到登录页。
 *
 * ⚠️ 这里**只检查"有没有令牌",不校验令牌有效性** —— 有效性由服务端说了算,
 *    过期/伪造的令牌会在第一个接口请求时收到 401,由 request.js 的拦截器统一处理
 *    (清令牌 + 跳登录页)。前端自己解析 JWT 算过期时间是重复劳动且容易出错。
 *
 * 📌 守卫里直接读 `getToken()` 而不是用 Pinia store ——
 *    守卫 import store 会绕出 store → api → request → router 的环。
 */
router.beforeEach(to => {
  const hasToken = !!getToken()
  // 已登录还去登录页 → 直接送回首页
  if (to.name === 'login' && hasToken) return { path: '/' }
  // 未登录访问受保护页面 → 去登录页,并记住原来想去哪
  if (!to.meta.public && !hasToken) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  return true
})

export default router
