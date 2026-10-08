<script setup>
import { computed } from 'vue'

/**
 * 操作日志详情。
 *
 * 📌 数据直接用**列表行里的那一条**,不再调 `/logs/{id}` ——
 *    列表返回的字段和详情是一样的,省一次请求。
 */
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  row: { type: Object, default: null },
})
const emit = defineEmits(['update:modelValue'])

const visible = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v),
})

/**
 * `beforeValue` / `afterValue` 是 JSON 字符串,格式化一下好读。
 * 解析失败(或本来就是普通文本)就原样显示,不要因为格式化把内容弄丢。
 */
function pretty(text) {
  if (!text) return ''
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return text
  }
}

const beforeText = computed(() => pretty(props.row?.beforeValue))
const afterText = computed(() => pretty(props.row?.afterValue))
</script>

<template>
  <el-dialog
    v-model="visible"
    title="操作日志详情"
    width="680px"
    align-center
  >
    <el-descriptions v-if="row" :column="2" border>
      <el-descriptions-item label="操作时间">
        {{ row.operationTime || '—' }}
      </el-descriptions-item>
      <el-descriptions-item label="操作人">
        {{ row.operatorName || '—' }}
      </el-descriptions-item>
      <el-descriptions-item label="操作类型">
        <!-- 后端存的是英文(INSERT / UPDATE / ...),原样显示,不做翻译 -->
        {{ row.operationType || '—' }}
      </el-descriptions-item>
      <el-descriptions-item label="执行结果">
        <el-tag v-if="row.resultStatus === '1'" type="success" effect="light">成功</el-tag>
        <el-tag v-else-if="row.resultStatus === '0'" type="danger" effect="light">失败</el-tag>
        <span v-else>—</span>
      </el-descriptions-item>
      <el-descriptions-item label="目标表">
        {{ row.targetTable || '—' }}
      </el-descriptions-item>
      <el-descriptions-item label="目标主键">
        {{ row.targetId || '—' }}
      </el-descriptions-item>
      <el-descriptions-item label="错误信息" :span="2">
        {{ row.errorMessage || '—' }}
      </el-descriptions-item>
    </el-descriptions>

    <div class="json-block">
      <div class="json-block__title">操作后数据</div>
      <pre v-if="afterText" class="json-block__body">{{ afterText }}</pre>
      <p v-else class="json-block__empty">—</p>
    </div>

    <div class="json-block">
      <div class="json-block__title">操作前数据</div>
      <pre v-if="beforeText" class="json-block__body">{{ beforeText }}</pre>
      <!--
        ⚠️ 这个一般是空的 —— 通用切面只知道方法签名和入参,拿不到"改之前那一行长什么样"。
            不是 bug,是设计如此。
      -->
      <p v-else class="json-block__empty">
        通常为空 —— 日志切面拿不到"改之前"的数据,这是已知情况,不是漏记。
      </p>
    </div>

    <template #footer>
      <el-button @click="visible = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.json-block {
  margin-top: 16px;
}

.json-block__title {
  margin-bottom: 6px;
  font-weight: 600;
  color: #303133;
}

.json-block__body {
  max-height: 220px;
  margin: 0;
  padding: 12px;
  overflow: auto;
  background: #f5f7fa;
  border-radius: 4px;
  font-family: Consolas, Monaco, 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.6;
  color: #303133;
  /* 长内容要折行,不然会横向撑出去 */
  white-space: pre-wrap;
  word-break: break-all;
}

.json-block__empty {
  margin: 0;
  color: #909399;
  font-size: 13px;
}
</style>
