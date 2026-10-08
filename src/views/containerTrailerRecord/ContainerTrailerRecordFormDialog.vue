<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  createContainerTrailerRecord,
  updateContainerTrailerRecord,
} from '@/api/containerTrailerRecord'
import { fetchContainerOptions } from '@/api/container'
import { fetchTrailerOptions } from '@/api/trailer'
import { debounce } from '@/utils/debounce'

/**
 * 提空箱登记的新增 / 编辑弹窗。
 *
 * ⚠️ **箱号和拖车号都是实体引用,必须从下拉里选,不能自由输入:**
 *   - `containerNo` 必须是已存在的集装箱(12.7 的 /containers/options)
 *   - `trackNo`     必须是已存在的拖车(16 节的 /trailers/options)
 *   手敲一个库里没有的值会 400(集装箱不存在 / 拖车不存在)。
 */
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  /** 编辑时传整行;新增时传 null */
  row: { type: Object, default: null },
})
const emit = defineEmits(['update:modelValue', 'success'])

const formRef = ref(null)
const submitting = ref(false)

const visible = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v),
})

const isEdit = computed(() => props.row !== null && props.row !== undefined)

const form = reactive({
  containerNo: '',
  trackNo: '',
  dcInDate: '',
  dcOutDate: '',
  useNote: '',
})

// ---- 箱号下拉 ----
const containerOptions = ref([])
const containerLoading = ref(false)
const containerLabels = ref({}) // 箱号 -> 状态描述(12.7 会带出来)

// ---- 拖车下拉 ----
const trailerOptions = ref([])
const trailerLoading = ref(false)
const trailerLabels = ref({}) // 拖车号 -> 司机姓名

const rules = {
  containerNo: [{ required: true, message: '请选择集装箱', trigger: 'change' }],
  trackNo: [{ required: true, message: '请选择拖车', trigger: 'change' }],
  useNote: [{ max: 255, message: '箱使用备注最长 255 个字符', trigger: 'blur' }],
}

/**
 * 把"当前选中的值"补回选项列表 ——
 * el-select 在 options 里找不到当前值时会退化成显示空,而远程搜索每次都整个替换数组。
 */
function withSelected(list, selected) {
  const out = [...list]
  const have = new Set(out.map(o => o.value))
  for (const item of selected) {
    if (item.value && !have.has(item.value)) {
      out.push(item)
      have.add(item.value)
    }
  }
  return out
}

let containerSeq = 0
let trailerSeq = 0

async function loadContainers(keyword) {
  containerLoading.value = true
  const seq = ++containerSeq
  try {
    const list = await fetchContainerOptions(keyword)
    if (seq !== containerSeq) return
    const found = (list || []).map(c => {
      containerLabels.value[c.no] = c.statusDescription || ''
      return {
        value: c.no,
        label: c.no,
        // 显示当前状态,让用户知道这箱子现在能不能用
        sub: c.statusDescription || '',
      }
    })
    containerOptions.value = withSelected(found, [
      { value: form.containerNo, label: form.containerNo, sub: containerLabels.value[form.containerNo] ?? '' },
    ])
  } catch {
    // 拦截器已提示
  } finally {
    if (seq === containerSeq) containerLoading.value = false
  }
}

async function loadTrailers(keyword) {
  trailerLoading.value = true
  const seq = ++trailerSeq
  try {
    const list = await fetchTrailerOptions(keyword)
    if (seq !== trailerSeq) return
    const found = (list || []).map(t => {
      trailerLabels.value[t.no] = t.name || ''
      return {
        value: t.no,
        label: t.no,
        // 同一车队车多,光看车牌不一定记得是谁在开 —— 带上司机姓名
        sub: t.name || '',
      }
    })
    trailerOptions.value = withSelected(found, [
      { value: form.trackNo, label: form.trackNo, sub: trailerLabels.value[form.trackNo] ?? '' },
    ])
  } catch {
    // 拦截器已提示
  } finally {
    if (seq === trailerSeq) trailerLoading.value = false
  }
}

const searchContainer = debounce(loadContainers, 300)
const searchTrailer = debounce(loadTrailers, 300)

watch(visible, open => {
  if (!open) return
  formRef.value?.clearValidate()
  containerLabels.value = {}
  trailerLabels.value = {}
  containerOptions.value = []
  trailerOptions.value = []

  Object.assign(form, {
    containerNo: props.row?.containerNo ?? '',
    trackNo: props.row?.trackNo ?? '',
    dcInDate: props.row?.dcInDate ?? '',
    dcOutDate: props.row?.dcOutDate ?? '',
    useNote: props.row?.useNote ?? '',
  })

  // 各先加载一批(不传 keyword 返回前 20 条)。
  // 回填的值会在 withSelected 里被补进列表,所以下拉显示的是箱号 / 拖车号本身,不是空白
  loadContainers('')
  loadTrailers('')
})

async function onSubmit() {
  try {
    await formRef.value.validate()
  } catch {
    return // 校验不通过,表单上已有红字提示
  }

  submitting.value = true
  try {
    const body = {
      containerNo: form.containerNo,
      trackNo: form.trackNo,
      // 时间是 "YYYY-MM-DD HH:mm:ss" 字符串(date-picker 的 value-format 保证),空的话传 null
      dcInDate: form.dcInDate || null,
      dcOutDate: form.dcOutDate || null,
      useNote: form.useNote.trim() || null,
    }

    if (isEdit.value) await updateContainerTrailerRecord(props.row.id, body)
    else await createContainerTrailerRecord(body)

    ElMessage.success('保存成功')
    visible.value = false
    // 增删改不返回数据 —— 只能让父组件重新拉列表
    emit('success')
  } catch {
    // 400(箱号已删除 / 拖车不存在)·404 由拦截器弹出
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="isEdit ? '编辑提空箱登记' : '新增提空箱登记'"
    width="560px"
    :close-on-click-modal="false"
    destroy-on-close
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
      <el-form-item label="箱号" prop="containerNo">
        <el-select
          v-model="form.containerNo"
          filterable
          remote
          clearable
          :remote-method="searchContainer"
          :loading="containerLoading"
          placeholder="输入箱号开头几个字符"
          style="width: 100%"
        >
          <el-option
            v-for="o in containerOptions"
            :key="o.value"
            :value="o.value"
            :label="o.label"
          >
            <span>{{ o.label }}</span>
            <span class="option-sub">{{ o.sub }}</span>
          </el-option>
        </el-select>
      </el-form-item>

      <el-form-item label="拖车号" prop="trackNo">
        <el-select
          v-model="form.trackNo"
          filterable
          remote
          clearable
          :remote-method="searchTrailer"
          :loading="trailerLoading"
          placeholder="输入拖车号或司机姓名"
          style="width: 100%"
        >
          <!-- 选项要同时显示拖车号 + 司机姓名 -->
          <el-option
            v-for="o in trailerOptions"
            :key="o.value"
            :value="o.value"
            :label="o.label"
          >
            <span>{{ o.label }}</span>
            <span class="option-sub">{{ o.sub }}</span>
          </el-option>
        </el-select>
      </el-form-item>

      <el-form-item label="进场时间" prop="dcInDate">
        <!-- value-format 不能省:不加的话 v-model 拿到 Date 对象,提交时后端会 400 -->
        <el-date-picker
          v-model="form.dcInDate"
          type="datetime"
          value-format="YYYY-MM-DD HH:mm:ss"
          format="YYYY-MM-DD HH:mm:ss"
          placeholder="请选择进场时间"
          style="width: 100%"
        />
      </el-form-item>

      <el-form-item label="出场时间" prop="dcOutDate">
        <el-date-picker
          v-model="form.dcOutDate"
          type="datetime"
          value-format="YYYY-MM-DD HH:mm:ss"
          format="YYYY-MM-DD HH:mm:ss"
          placeholder="请选择出场时间"
          style="width: 100%"
        />
      </el-form-item>

      <el-form-item label="箱使用备注" prop="useNote">
        <el-input
          v-model="form.useNote"
          type="textarea"
          :rows="2"
          maxlength="255"
          placeholder="如 空箱提取"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="onSubmit">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
/* 选项右侧的附加信息(箱子当前状态 / 司机姓名) */
.option-sub {
  float: right;
  margin-left: 16px;
  color: #909399;
  font-size: 12px;
}
</style>
