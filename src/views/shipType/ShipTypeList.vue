<script setup>
import DictManager from '@/components/DictManager.vue'
import { SHIP_TYPE } from '@/constants/dict'
import {
  fetchShipTypes as fetchPage,
  createShipType as create,
  updateShipType as update,
  deleteShipType as remove,
} from '@/api/shipType'

// 页面全部行为都在 DictManager 里,这里只接线。
// ⚠️ 刻意**不传 useDict** —— 文档没说船型的 /options 会不会截断,按"可能截断"处理,
//    船舶表单那边做成远程搜索(远程搜索在两种情况下都能用,而缓存只在真全量时才对)。
const config = {
  ...SHIP_TYPE,
  api: { fetchPage, create, update, remove },
}
</script>

<template>
  <DictManager :config="config" />
</template>
