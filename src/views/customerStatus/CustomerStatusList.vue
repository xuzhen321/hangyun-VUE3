<script setup>
import DictManager from '@/components/DictManager.vue'
import { CUSTOMER_STATUS } from '@/constants/dict'
import { useCustomerStatusDict } from '@/stores/dict'
import {
  fetchCustomerStatusPage as fetchPage,
  createCustomerStatus as create,
  updateCustomerStatus as update,
  deleteCustomerStatus as remove,
} from '@/api/customerStatus'

// 页面全部行为都在 DictManager 里,这里只接线
const config = {
  ...CUSTOMER_STATUS,
  api: { fetchPage, create, update, remove },
  useDict: useCustomerStatusDict,
}
</script>

<template>
  <DictManager :config="config" />
</template>
