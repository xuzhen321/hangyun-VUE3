<script setup>
import DictManager from '@/components/DictManager.vue'
import { CONTAINER_STATUS } from '@/constants/dict'
import { useContainerStatusDict } from '@/stores/dict'
import {
  fetchContainerStatusPage as fetchPage,
  createContainerStatus as create,
  updateContainerStatus as update,
  deleteContainerStatus as remove,
} from '@/api/containerStatus'

// 和箱型、客户状态、订单状态页都是同一个组件,只是换了配置
const config = {
  ...CONTAINER_STATUS,
  api: { fetchPage, create, update, remove },
  useDict: useContainerStatusDict,
}
</script>

<template>
  <DictManager :config="config" />
</template>
