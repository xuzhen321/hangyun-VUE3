<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { createVoyage, updateVoyage } from '@/api/voyage'
import { searchPorts } from '@/api/port'
import { fetchVesselOptions } from '@/api/vessel'
import { useRemoteSelect } from '@/composables/useRemoteSelect'

/**
 * 航次的新增 / 编辑弹窗。
 *
 * 📌 四个字段**全是可选的** —— 后端没有必填项,所以这里也不做必填校验。
 *
 * ⚠️ **航次号的唯一性规则:"船 + 航次号"这一对唯一,不是航次号自己唯一。**
 *    航次号是船公司自编的,不同公司大量重号(001E 这种每年复用),所以全库唯一是错的;
 *    但同一条船 + 同一个航次号必须是同一个航次,否则两条一模一样的航次在列表和下拉框里
 *    完全分不出来,登记物流事件时选错了**不报任何错**,轨迹会静默挂到错的航次上。
 *    撞了返回 409「该船舶下已存在航次号: 2026E001」。
 *
 *    📌 **船或航次号任一为空就不查重** —— 所以两个都空也能建多条,这是预期的。
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
  no: '',
  vslId: null,
  loadingPortId: null,
  dischargePortId: null,
})

const rules = {
  no: [{ max: 20, message: '航次号最长 20 个字符', trigger: 'blur' }],
}

// 船舶下拉:23.5 的 /vessels/options
const {
  options: vesselOptions,
  loading: vesselLoading,
  search: searchVessel,
  load: loadVesselList,
  remember: rememberVessel,
} = useRemoteSelect(kw => fetchVesselOptions(kw), {
  toOption: v => ({
    value: v.id,
    // 船名可能相近,带上 MMSI 消歧
    label: v.shipname,
    sub: v.mmsi || '',
  }),
  selected: () => [form.vslId],
})

// 两个港口下拉共用 8.1 的港口搜索接口,但各自独立(搜起始港不该把目的港的选项冲掉)
const {
  options: loadingPortOptions,
  loading: loadingPortLoading,
  search: searchLoadingPort,
  load: loadLoadingPortList,
  remember: rememberLoadingPort,
} = useRemoteSelect(kw => searchPorts(kw), {
  toOption: p => ({ value: p.id, label: p.cnname, sub: p.unlocode || '' }),
  selected: () => [form.loadingPortId],
})

const {
  options: dischargePortOptions,
  loading: dischargePortLoading,
  search: searchDischargePort,
  load: loadDischargePortList,
  remember: rememberDischargePort,
} = useRemoteSelect(kw => searchPorts(kw), {
  toOption: p => ({ value: p.id, label: p.cnname, sub: p.unlocode || '' }),
  selected: () => [form.dischargePortId],
})

watch(visible, open => {
  if (!open) return
  formRef.value?.clearValidate()

  const r = props.row
  Object.assign(form, {
    no: r?.no ?? '',
    vslId: r?.vslId ?? null,
    loadingPortId: r?.loadingPortId ?? null,
    dischargePortId: r?.dischargePortId ?? null,
  })

  // 回填的显示文本要先 remember,后面的 load 才会把选中项补进选项列表
  rememberVessel(form.vslId, r?.vslName)
  rememberLoadingPort(form.loadingPortId, r?.loadingPortName)
  rememberDischargePort(form.dischargePortId, r?.dischargePortName)

  loadVesselList('')
  loadLoadingPortList('')
  loadDischargePortList('')
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
      no: form.no.trim() || null,
      vslId: form.vslId,
      loadingPortId: form.loadingPortId,
      dischargePortId: form.dischargePortId,
    }

    if (isEdit.value) await updateVoyage(props.row.id, body)
    else await createVoyage(body)

    ElMessage.success('保存成功')
    visible.value = false
    // 增删改不返回数据 —— 只能让父组件重新拉列表
    emit('success')
  } catch {
    // 400(港口不存在)·404 由拦截器弹出
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="isEdit ? '编辑航次' : '新增航次'"
    width="560px"
    :close-on-click-modal="false"
    destroy-on-close
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
      <el-form-item label="航次号" prop="no">
        <el-input v-model="form.no" maxlength="20" placeholder="如 2026E001" />
      </el-form-item>

      <el-form-item label="起始港口" prop="loadingPortId">
        <el-select
          v-model="form.loadingPortId"
          filterable
          remote
          clearable
          :remote-method="searchLoadingPort"
          :loading="loadingPortLoading"
          placeholder="输入港口中文名 / 英文名 / 五字码"
          style="width: 100%"
        >
          <el-option
            v-for="o in loadingPortOptions"
            :key="o.value"
            :value="o.value"
            :label="o.label"
          >
            <span>{{ o.label }}</span>
            <span class="option-sub">{{ o.sub }}</span>
          </el-option>
        </el-select>
      </el-form-item>

      <el-form-item label="目的港口" prop="dischargePortId">
        <el-select
          v-model="form.dischargePortId"
          filterable
          remote
          clearable
          :remote-method="searchDischargePort"
          :loading="dischargePortLoading"
          placeholder="输入港口中文名 / 英文名 / 五字码"
          style="width: 100%"
        >
          <el-option
            v-for="o in dischargePortOptions"
            :key="o.value"
            :value="o.value"
            :label="o.label"
          >
            <span>{{ o.label }}</span>
            <span class="option-sub">{{ o.sub }}</span>
          </el-option>
        </el-select>
      </el-form-item>

      <el-form-item label="船舶" prop="vslId">
        <!-- 选项要同时显示「船名 + MMSI」:船名可能相近,MMSI 是全球唯一识别码 -->
        <el-select
          v-model="form.vslId"
          filterable
          remote
          clearable
          :remote-method="searchVessel"
          :loading="vesselLoading"
          placeholder="输入船名或 MMSI 搜索"
          style="width: 100%"
        >
          <el-option
            v-for="o in vesselOptions"
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
.option-sub {
  float: right;
  margin-left: 16px;
  color: #909399;
  font-size: 12px;
}
</style>
