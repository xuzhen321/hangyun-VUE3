<script setup>
import DictManager from '@/components/DictManager.vue'
import { TRAILER } from '@/constants/dict'
import {
  fetchTrailers as fetchPage,
  createTrailer as create,
  updateTrailer as update,
  deleteTrailer as remove,
} from '@/api/trailer'

// 页面全部行为都在 DictManager 里,这里只接线。
// ⚠️ 刻意**不传 useDict** —— 拖车的下拉接口只返回前 20 条,不是全量,缓存没意义。
//    另外配置里带了 keyField: 'no'(主键是拖车号)和 no 列的 immutable(建了不能改)。
const config = {
  ...TRAILER,
  api: { fetchPage, create, update, remove },
}
</script>

<template>
  <DictManager :config="config" />
</template>
