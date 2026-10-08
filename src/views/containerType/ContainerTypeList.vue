<script setup>
import DictManager from '@/components/DictManager.vue'
import { CONTAINER_TYPE } from '@/constants/dict'
import { useContainerTypeDict } from '@/stores/dict'
import {
  fetchContainerTypePage as fetchPage,
  createContainerType as create,
  updateContainerType as update,
  deleteContainerType as remove,
} from '@/api/containerType'

// 页面全部行为都在 DictManager 里,这里只接线
const config = {
  ...CONTAINER_TYPE,
  api: { fetchPage, create, update, remove },
  useDict: useContainerTypeDict,
}
</script>

<template>
  <DictManager :config="config" />
</template>
