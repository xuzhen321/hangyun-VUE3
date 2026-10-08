<script setup>
import DictManager from '@/components/DictManager.vue'
import { PORT_TIMEZONE } from '@/constants/dict'
import { usePortTimezoneDict } from '@/stores/dict'
import { timezoneApi } from '@/api/portDict'

// 页面全部行为都在 DictManager 里,这里只接线。
// 25 节的五个小字典接口形状完全一样,所以 api 直接传工厂产物。
const config = {
  ...PORT_TIMEZONE,
  api: timezoneApi,
  useDict: usePortTimezoneDict,
}
</script>

<template>
  <DictManager :config="config" />
</template>
