<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  EVENT_IS_ESTI_OPTIONS,
  EVENT_SOURCE_OPTIONS,
  createContainerEvent,
  updateContainerEvent,
} from '@/api/containerEvent'
import { fetchContainerOptions } from '@/api/container'
import { fetchVoyages } from '@/api/voyage'
import { searchPorts } from '@/api/port'
import { EVENT_STATUS_DELETED_ID } from '@/constants/dict'
import { useEventStatusDict } from '@/stores/dict'
import { useRemoteSelect } from '@/composables/useRemoteSelect'

/**
 * 物流事件的新增 / 编辑弹窗。
 *
 * ⚠️ 两处和别的表单不一样:
 *
 * 1. **`source` / `isEsti` 传中文文字**,不是编码 —— 见 api/containerEvent.js
 * 2. **`isEsti` 的方向容易搞反**:`is_esti` 是 is estimated,
 *    所以 **Y = 预计、N = 实际**。界面上直接显示"实际 / 预计",不碰编码
 *
 * 📌 另外编辑时有个接口缺口:列表/详情返回里有 `voy`(航次号)但**没有 `voyageId`**,
 *    而提交要的是 `voyageId`。所以这里用**航次号反查**一次补上(见 onOpen 里的注释)。
 */
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  /** 编辑时传整行;新增时传 null */
  row: { type: Object, default: null },
})
const emit = defineEmits(['update:modelValue', 'success'])

const statusDict = useEventStatusDict()

const formRef = ref(null)
const submitting = ref(false)
/** 编辑时反查航次 id 的过程(可能失败,失败就留空) */
const voyageResolving = ref(false)

const visible = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v),
})

const isEdit = computed(() => props.row !== null && props.row !== undefined)

const form = reactive({
  containerNo: '',
  eventStatusId: null,
  source: '',
  voyageId: null,
  eventPlaceId: null,
  isEsti: '',
  eventTime: '',
})

// ---- 三个远程搜索下拉,统一走 useRemoteSelect ----
// 解构出来,模板里就能直接写 containerOptions / containerLoading / searchContainer,
// 不用写成 containerOptions(那样能用但不合本项目模板的习惯)
const {
  options: containerOptions,
  loading: containerLoading,
  search: searchContainer,
  load: loadContainers,
  remember: rememberContainer,
} = useRemoteSelect(kw => fetchContainerOptions(kw), {
  toOption: c => ({ value: c.no, label: c.no, sub: c.statusDescription || '' }),
  selected: () => [form.containerNo],
})

const {
  options: voyageOptions,
  loading: voyageLoading,
  search: searchVoyage,
  load: loadVoyageList,
  remember: rememberVoyage,
} = useRemoteSelect(kw => fetchVoyages({ no: kw }).then(r => r.list), {
  toOption: v => ({
    value: v.id,
    label: v.no || `#${v.id}`,
    sub: v.loadingPortName || '',
  }),
  selected: () => [form.voyageId],
})

const {
  options: portOptions,
  loading: portLoading,
  search: searchPort,
  load: loadPortList,
  remember: rememberPort,
} = useRemoteSelect(kw => searchPorts(kw), {
  toOption: p => ({ value: p.id, label: p.cnname, sub: p.unlocode || '' }),
  selected: () => [form.eventPlaceId],
})

const rules = {
  containerNo: [{ required: true, message: '请选择集装箱', trigger: 'change' }],
}

/**
 * 事件状态下拉 —— **把「已删除」滤掉**。
 * 它是逻辑删除的结果,不是让用户挑的状态;留着的话用户一不小心就把事件标成已删除了。
 * 但编辑一条**已经删掉**的事件时,当前值就是它 —— 那种情况补回列表,否则显示空白。
 */
const statusOptions = computed(() => {
  const all = statusDict.options
  const base = all.filter(o => o.value !== EVENT_STATUS_DELETED_ID)
  if (form.eventStatusId && !base.some(o => o.value === form.eventStatusId)) {
    const current = all.find(o => o.value === form.eventStatusId)
    if (current) return [...base, current]
  }
  return base
})

async function onOpen() {
  formRef.value?.clearValidate()

  const r = props.row
  Object.assign(form, {
    containerNo: r?.containerNo ?? '',
    eventStatusId: r?.eventStatusId ?? null,
    // 返回的是中文文字,直接用
    source: r?.source ?? '',
    voyageId: null, // 行里没有,下面反查
    eventPlaceId: r?.eventPlaceId ?? null,
    isEsti: r?.isEsti ?? '',
    eventTime: r?.eventTime ?? '',
  })

  // 回填的显示文本要先记下来,后面的 load('') 才会把选中项补进选项列表
  rememberContainer(form.containerNo, form.containerNo)
  rememberPort(form.eventPlaceId, r?.eventPlace)

  statusDict.load()

  // ⚠️ 航次:列表行里只有航次号 `voy`,没有 `voyageId`,而提交要的是 id。
  //    所以拿航次号去 /voyages 做一次**精确匹配**把它换成 id。
  //    匹配不到(比如航次被删了)就留空 —— 提交时该字段会是 null。
  if (r?.voy) {
    voyageResolving.value = true
    try {
      const res = await fetchVoyages({ no: r.voy, size: 100 })
      const exact = (res.list || []).find(v => v.no === r.voy)
      if (exact) {
        form.voyageId = exact.id
        rememberVoyage(exact.id, exact.no)
      } else {
        // 反查不到,至少让用户看到原始航次号,别显示成空白
        ElMessage.warning(`航次「${r.voy}」已查不到,保存后这一栏会被清空`)
      }
    } catch {
      // 拦截器已提示
    } finally {
      voyageResolving.value = false
    }
  }

  loadContainers('')
  loadVoyageList('')
  loadPortList('')
}

watch(visible, open => {
  if (open) onOpen()
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
      eventStatusId: form.eventStatusId,
      // ⚠️ 两个文字枚举原样传中文,不要转成 '1'/'0' 或 'Y'/'N'
      source: form.source || null,
      isEsti: form.isEsti || null,
      voyageId: form.voyageId,
      eventPlaceId: form.eventPlaceId,
      eventTime: form.eventTime || null,
    }

    if (isEdit.value) await updateContainerEvent(props.row.id, body)
    else await createContainerEvent(body)

    ElMessage.success('保存成功')
    visible.value = false
    // 增删改不返回数据 —— 只能让父组件重新拉列表
    emit('success')
  } catch {
    // 400(集装箱已删除 / 各种不存在 / 枚举类型不对)·404 由拦截器弹出
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="isEdit ? '编辑物流事件' : '新增物流事件'"
    width="720px"
    :close-on-click-modal="false"
    destroy-on-close
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="集装箱" prop="containerNo">
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
        </el-col>
        <el-col :span="12">
          <el-form-item label="事件状态" prop="eventStatusId">
            <!-- statusOptions 已经把「已删除」滤掉了 -->
            <el-select v-model="form.eventStatusId" clearable placeholder="请选择状态" style="width: 100%">
              <el-option
                v-for="o in statusOptions"
                :key="o.value"
                :label="o.label"
                :value="o.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="发生时间" prop="eventTime">
            <!-- value-format 不能省,否则 v-model 拿到 Date 对象,提交时后端会 400 -->
            <el-date-picker
              v-model="form.eventTime"
              type="datetime"
              value-format="YYYY-MM-DD HH:mm:ss"
              format="YYYY-MM-DD HH:mm:ss"
              placeholder="请选择发生时间"
              style="width: 100%"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="实际/预计" prop="isEsti">
            <!-- ⚠️ 传的是中文文字,不是 'Y'/'N' -->
            <el-select v-model="form.isEsti" clearable placeholder="请选择" style="width: 100%">
              <el-option v-for="v in EVENT_IS_ESTI_OPTIONS" :key="v" :label="v" :value="v" />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="发生地" prop="eventPlaceId">
            <el-select
              v-model="form.eventPlaceId"
              filterable
              remote
              clearable
              :remote-method="searchPort"
              :loading="portLoading"
              placeholder="输入港口中文名 / 英文名 / 五字码"
              style="width: 100%"
            >
              <el-option
                v-for="o in portOptions"
                :key="o.value"
                :value="o.value"
                :label="o.label"
              >
                <span>{{ o.label }}</span>
                <span class="option-sub">{{ o.sub }}</span>
              </el-option>
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="数据来源" prop="source">
            <!-- ⚠️ 传的是中文文字,不是 '1'/'0' -->
            <el-select v-model="form.source" clearable placeholder="请选择" style="width: 100%">
              <el-option v-for="v in EVENT_SOURCE_OPTIONS" :key="v" :label="v" :value="v" />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item label="航次" prop="voyageId">
        <el-select
          v-model="form.voyageId"
          filterable
          remote
          clearable
          :remote-method="searchVoyage"
          :loading="voyageLoading || voyageResolving"
          placeholder="输入航次号开头几个字符(如 2026E)"
          style="width: 100%"
        >
          <el-option
            v-for="o in voyageOptions"
            :key="o.value"
            :value="o.value"
            :label="o.label"
          >
            <span>{{ o.label }}</span>
            <span class="option-sub">{{ o.sub }}</span>
          </el-option>
        </el-select>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="onSubmit">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
/* 选项右侧的附加信息(箱子状态 / 起运港 / 港口五字码) */
.option-sub {
  float: right;
  margin-left: 16px;
  color: #909399;
  font-size: 12px;
}
</style>
