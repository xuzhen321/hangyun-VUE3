<script setup>
import { computed, ref, watch } from 'vue'
import { fetchContainerTrack } from '@/api/containerEvent'

/**
 * 集装箱轨迹(12.8)—— 把某个箱的全部物流事件按时间轴画出来。
 *
 * 📌 接口返回的**已经是数组、已经按发生时间升序排好**(= 时间轴顺序),前端不用再排、不用分页。
 * 📌 已删除的事件不会出现;但**已删除的集装箱仍然能查轨迹** —— 箱子退役了,历史链路还留着。
 */
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  /** 要查的箱号 */
  no: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])

const visible = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v),
})

const loading = ref(false)
const events = ref([])
/** 404 = 箱号不存在(和"这个箱子没有事件"是两回事,分开显示) */
const notFound = ref(false)

watch(visible, async open => {
  if (!open) return
  loading.value = true
  notFound.value = false
  events.value = []
  try {
    events.value = (await fetchContainerTrack(props.no)) || []
  } catch (err) {
    if (err?.response?.status === 404) notFound.value = true
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="`集装箱轨迹 · ${no}`"
    width="640px"
    align-center
  >
    <div v-loading="loading" class="track-body">
      <el-empty v-if="notFound" description="该集装箱不存在" />
      <el-empty
        v-else-if="!events.length && !loading"
        description="这个箱子还没有任何物流事件"
      />

      <el-timeline v-else>
        <el-timeline-item
          v-for="(e, i) in events"
          :key="i"
          :timestamp="e.eventTime"
          placement="top"
          :type="e.isEsti === '预计' ? 'warning' : 'success'"
        >
          <div class="track-head">
            <span class="track-head__status">{{ e.descriptionCn || '—' }}</span>
            <!-- isEsti 返回的就是中文文字,直接用 -->
            <el-tag v-if="e.isEsti === '预计'" size="small" type="warning" effect="light">
              预计
            </el-tag>
            <el-tag v-else-if="e.isEsti === '实际'" size="small" type="success" effect="light">
              实际
            </el-tag>
          </div>
          <div class="track-meta">
            <span v-if="e.eventPlace">发生地:{{ e.eventPlace }}</span>
            <span v-if="e.voy">航次:{{ e.voy }}</span>
            <span v-if="e.vslName">船名:{{ e.vslName }}</span>
            <span v-if="e.source">来源:{{ e.source }}</span>
          </div>
        </el-timeline-item>
      </el-timeline>
    </div>

    <template #footer>
      <el-button @click="visible = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
/* 给 loading 留出高度,避免加载时框子高度跳一下 */
.track-body {
  min-height: 160px;
  max-height: 60vh;
  overflow: auto;
}

.track-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
}

.track-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 6px;
  color: #909399;
  font-size: 13px;
}
</style>
