<script setup>
import StatusDictManager from '@/components/StatusDictManager.vue'
import { ORDER_STATUS } from '@/constants/status'
import { useOrderStatusDict } from '@/stores/statusDict'
import {
  fetchOrderStatusPage as fetchPage,
  createOrderStatus as create,
  updateOrderStatus as update,
  deleteOrderStatus as remove,
} from '@/api/orderStatus'

// 和客户状态页是同一个组件,只是换了配置(内置 id 变成 1-4,文案不同)
const config = {
  ...ORDER_STATUS,
  api: { fetchPage, create, update, remove },
  useDict: useOrderStatusDict,
}
</script>

<template>
  <StatusDictManager :config="config" />
</template>
