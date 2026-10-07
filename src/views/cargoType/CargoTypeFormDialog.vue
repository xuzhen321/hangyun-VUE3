<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { createCargoType, fetchCargoType, updateCargoType } from '@/api/cargoType'
import { toPayload } from '@/utils/payload'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  /** null = 新增;数字 = 编辑该 id */
  id: { type: Number, default: null },
})
const emit = defineEmits(['update:modelValue', 'success'])

const formRef = ref(null)
const loading = ref(false)
const submitting = ref(false)

const visible = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v),
})

const isEdit = computed(() => props.id !== null && props.id !== undefined)

function emptyForm() {
  return {
    name: '',
    description: '',
    weightKg: null,
    volumeM3: null,
  }
}

const form = reactive(emptyForm())

const rules = {
  name: [
    // whitespace: true 让"全是空格"也判为不通过
    { required: true, whitespace: true, message: '请输入货物名称', trigger: 'blur' },
    { max: 100, message: '货物名称最长 100 个字符', trigger: 'blur' },
  ],
  description: [{ max: 255, message: '货物描述最长 255 个字符', trigger: 'blur' }],
  // weightKg / volumeM3 的约束(非负、最多 8 位整数 + 2 位小数)由下方
  // el-input-number 的 min / max / precision 直接兜住,不需要再写规则
}

watch(visible, async open => {
  if (!open) return
  formRef.value?.clearValidate()

  if (isEdit.value) {
    // PUT 是整体覆盖 —— 必须先把完整字段取回来,
    // 否则用户没动的那些字段会在提交时被后端置为 null
    loading.value = true
    try {
      const c = await fetchCargoType(props.id)
      Object.assign(form, {
        name: c.name ?? '',
        description: c.description ?? '',
        weightKg: c.weightKg ?? null,
        volumeM3: c.volumeM3 ?? null,
      })
    } catch {
      visible.value = false // 404 等,拦截器已提示
    } finally {
      loading.value = false
    }
  } else {
    Object.assign(form, emptyForm())
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
    const body = toPayload(form)
    if (isEdit.value) await updateCargoType(props.id, body)
    else await createCargoType(body)

    ElMessage.success('保存成功')
    visible.value = false
    // 增删改不返回数据、也不返回新 id —— 只能让父组件重新拉列表
    emit('success')
  } catch {
    // 400(名称/位数超限)的 msg 已由拦截器弹出
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="isEdit ? '编辑货物种类' : '新增货物种类'"
    width="520px"
    :close-on-click-modal="false"
    destroy-on-close
  >
    <el-form
      ref="formRef"
      v-loading="loading"
      :model="form"
      :rules="rules"
      label-width="100px"
    >
      <el-form-item label="货物名称" prop="name">
        <el-input v-model="form.name" maxlength="100" placeholder="请输入货物名称" />
      </el-form-item>

      <el-form-item label="货物描述" prop="description">
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="2"
          maxlength="255"
          placeholder="请输入货物描述"
        />
      </el-form-item>

      <el-form-item label="单件重量" prop="weightKg">
        <!-- 可空:留空表示"未填",不会被当成 0 -->
        <el-input-number
          v-model="form.weightKg"
          :min="0"
          :max="99999999.99"
          :precision="2"
          :controls="false"
          placeholder="kg,最多 2 位小数"
          style="width: 100%"
        />
      </el-form-item>

      <el-form-item label="单件体积" prop="volumeM3">
        <el-input-number
          v-model="form.volumeM3"
          :min="0"
          :max="99999999.99"
          :precision="2"
          :controls="false"
          placeholder="m³,最多 2 位小数"
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
