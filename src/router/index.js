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
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/home' },
]

export default createRouter({
  history: createWebHistory(),
  routes,
})
