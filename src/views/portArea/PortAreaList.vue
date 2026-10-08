<script setup>
import DictManager from '@/components/DictManager.vue'
import { PORT_AREA } from '@/constants/dict'
import { usePortAreaDict } from '@/stores/dict'
import { areaApi } from '@/api/portDict'

// 页面全部行为都在 DictManager 里,这里只接线。
// 25 节的五个小字典接口形状完全一样,所以 api 直接传工厂产物。
const config = {
  ...PORT_AREA,
  api: areaApi,
  useDict: usePortAreaDict,
}
</script>

<template>
  <DictManager :config="config" />
</template>
