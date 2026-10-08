<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { createVoyage, updateVoyage } from '@/api/voyage'
import { searchPorts } from '@/api/port'
import { useRemoteSelect } from '@/composables/useRemoteSelect'

/**
 * 航次的新增 / 编辑弹窗。
 *
 * 📌 四个字段**全是可选的** —— 后端没有必填项,所以这里也不做必填校验。
 *
 * ⚠️ **"船舶"那一栏是个半成品** —— 见 api/voyage.js 的说明:
 *    船舶模块还没做,后端不校验 `vslId`、也拿不到船名,所以只能填一个数字 id。
 *    等船舶模块做完再换成下拉。
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
  rememberLoadingPort(form.loadingPortId, r?.loadingPortName)
  rememberDischargePort(form.dischargePortId, r?.dischargePortName)

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
        <!-- ⚠️ 半成品字段:船舶模块还没做,没有下拉可选、后端也不校验,只能填 id -->
        <el-input-number
          v-model="form.vslId"
          :min="1"
          :precision="0"
          :controls="false"
          placeholder="船舶模块未完成,暂时只能填 id"
          style="width: 100%"
        />
        <div class="field-hint">
          船舶模块还没做,这一栏暂时只能填 id;后端也不校验,填错不会报错。
        </div>
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

.field-hint {
  margin-top: 4px;
  color: #909399;
  font-size: 12px;
  line-height: 1.5;
}
</style>
