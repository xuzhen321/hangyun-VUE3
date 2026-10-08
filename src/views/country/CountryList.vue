<script setup>
import DictManager from '@/components/DictManager.vue'
import { COUNTRY } from '@/constants/dict'
import {
  fetchCountries as fetchPage,
  createCountry as create,
  updateCountry as update,
  deleteCountry as remove,
} from '@/api/country'

// 页面全部行为都在 DictManager 里,这里只接线。
// ⚠️ 刻意**不传 useDict** —— 国家的下拉接口只返回前 20 条,不是全量,缓存没意义;
//    船舶表单那边会做成远程搜索。
const config = {
  ...COUNTRY,
  api: { fetchPage, create, update, remove },
}
</script>

<template>
  <DictManager :config="config" />
</template>
