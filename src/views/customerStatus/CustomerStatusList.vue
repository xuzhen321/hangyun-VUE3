<script setup>
import StatusDictManager from '@/components/StatusDictManager.vue'
import { CUSTOMER_STATUS } from '@/constants/status'
import { useCustomerStatusDict } from '@/stores/statusDict'
import {
  fetchCustomerStatusPage as fetchPage,
  createCustomerStatus as create,
  updateCustomerStatus as update,
  deleteCustomerStatus as remove,
} from '@/api/customerStatus'

// 页面全部行为都在 StatusDictManager 里,这里只接线
const config = {
  ...CUSTOMER_STATUS,
  api: { fetchPage, create, update, remove },
  useDict: useCustomerStatusDict,
}
</script>

<template>
  <StatusDictManager :config="config" />
</template>
