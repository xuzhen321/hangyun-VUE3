<script setup>
import DictManager from '@/components/DictManager.vue'
import { EVENT_STATUS } from '@/constants/dict'
import { useEventStatusDict } from '@/stores/dict'
import {
  fetchEventStatusPage as fetchPage,
  createEventStatus as create,
  updateEventStatus as update,
  deleteEventStatus as remove,
} from '@/api/eventStatus'

// 和集装箱状态页是同一个组件,只是换了配置(内置 id 变成 6,文案不同)
const config = {
  ...EVENT_STATUS,
  api: { fetchPage, create, update, remove },
  useDict: useEventStatusDict,
}
</script>

<template>
  <DictManager :config="config" />
</template>
