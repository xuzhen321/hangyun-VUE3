<script setup>
import DictManager from '@/components/DictManager.vue'
import { HARBOR_SIZE } from '@/constants/dict'
import { useHarborSizeDict } from '@/stores/dict'
import { harborSizeApi } from '@/api/portDict'

// 页面全部行为都在 DictManager 里,这里只接线。
// 25 节的五个小字典接口形状完全一样,所以 api 直接传工厂产物。
const config = {
  ...HARBOR_SIZE,
  api: harborSizeApi,
  useDict: useHarborSizeDict,
}
</script>

<template>
  <DictManager :config="config" />
</template>
