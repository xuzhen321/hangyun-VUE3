<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { createCargo, updateCargo } from '@/api/cargo'
import { fetchCargoTypeOptions } from '@/api/cargoType'

/**
 * 货物明细的新增 / 编辑弹窗。
 *
 * 新增和编辑共用一个组件,但**提交体不一样**:
 *   新增 → POST /cargos      { orderId, cargoTypeId, quantity }  三个全必填
 *   编辑 → PUT  /cargos/{id} { cargoTypeId, quantity }           **不带 orderId**
 *
 * ⚠️ 没有 `GET /cargos/{id}` 接口,所以编辑时不能像客户 / 订单那样"先查详情再回填",
 *    只能由父组件把整行数据传进来。
 */
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  /** 编辑时传整行;新增时传 null */
  row: { type: Object, default: null },
  /** 新增时的所属订单号(由订单列表那一行带过来) */
  orderId: { type: String, default: null },
})
const emit = defineEmits(['update:modelValue', 'success'])

const formRef = ref(null)
const submitting = ref(false)
const typeLoading = ref(false)
const typeOptions = ref([])

const visible = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v),
})

const isEdit = computed(() => props.row !== null && props.row !== undefined)

/** 所属订单号:编辑时取行上的,新增时用父组件传的。两种情况都只读 */
const theOrderId = computed(() => props.row?.orderId ?? props.orderId ?? '')

const form = reactive({ cargoTypeId: null, quantity: null })

const rules = {
  cargoTypeId: [{ required: true, message: '请选择货物种类', trigger: 'change' }],
  // 非负和整数由 el-input-number 的 min / precision 兜住
  quantity: [{ required: true, message: '请输入数量', trigger: 'blur' }],
}

watch(visible, async open => {
  if (!open) return
  formRef.value?.clearValidate()

  if (isEdit.value) {
    Object.assign(form, {
      cargoTypeId: props.row.cargoTypeId ?? null,
      quantity: props.row.quantity ?? null,
    })
  } else {
    Object.assign(form, { cargoTypeId: null, quantity: null })
  }

  // 9.7 一次性返回全部种类(不截断),拉一次本地过滤就够了
  typeLoading.value = true
  try {
    typeOptions.value = (await fetchCargoTypeOptions()) || []
  } catch {
    // 拦截器已提示
  } finally {
    typeLoading.value = false
  }
})

async function onSubmit() {
  try {
    await formRef.value.validate()
  } catch {
    return // 校验不通过,表单上已有红字提示
  }

  submitting.value = true
  try {
    if (isEdit.value) {
      // 刻意只传这两个字段:orderId 后端不收,多传也没用;字段名写死,别用通用归一化
      await updateCargo(props.row.id, {
        cargoTypeId: form.cargoTypeId,
        quantity: form.quantity,
      })
    } else {
      await createCargo({
        orderId: theOrderId.value, // 19 位字符串,原样传,不做任何转换
        cargoTypeId: form.cargoTypeId,
        quantity: form.quantity,
      })
    }

    ElMessage.success('保存成功')
    visible.value = false
    // 增删改不返回数据 —— 只能让父组件重新拉列表
    emit('success')
  } catch {
    // 400(订单/种类不存在)·404 由拦截器弹出
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="isEdit ? '编辑货物' : '新增货物'"
    width="480px"
    :close-on-click-modal="false"
    destroy-on-close
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
      <el-form-item label="所属订单号">
        <!--
          只读:后端 UPDATE 语句里根本没有 order_id 那一列,改不了。
          要换订单只能把这条删掉、到目标订单下重新加一条。
        -->
        <el-input :model-value="theOrderId" disabled />
      </el-form-item>

      <el-form-item label="货物种类" prop="cargoTypeId">
        <el-select
          v-model="form.cargoTypeId"
          filterable
          :loading="typeLoading"
          placeholder="请选择货物种类"
          style="width: 100%"
        >
          <el-option
            v-for="t in typeOptions"
            :key="t.id"
            :label="t.name"
            :value="t.id"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="数量" prop="quantity">
        <el-input-number
          v-model="form.quantity"
          :min="0"
          :max="2147483647"
          :precision="0"
          :controls="false"
          placeholder="请输入数量"
          style="width: 100%"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="onSubmit">保存</el-button>
    </template>
  </el-dialog>
</template>
