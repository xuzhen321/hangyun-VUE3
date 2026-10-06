<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { createStatus } from '@/api/customerStatus'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'success'])

const formRef = ref(null)
const submitting = ref(false)
const form = reactive({ description: '' })

const visible = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v),
})

const rules = {
  description: [
    { required: true, whitespace: true, message: '请输入状态描述', trigger: 'blur' },
    { max: 50, message: '状态描述最长 50 个字符', trigger: 'blur' },
  ],
}

watch(visible, open => {
  if (!open) return
  form.description = ''
  formRef.value?.clearValidate()
})

async function onSubmit() {
  try {
    await formRef.value.validate()
  } catch {
    return
  }

  submitting.value = true
  try {
    // 前后端都会去掉首尾空格再比较重复,所以"正常"和"正常 "视为同一个
    await createStatus({ description: form.description.trim() })
    ElMessage.success('新增成功')
    visible.value = false
    emit('success')
  } catch {
    // 409 重名(msg: 状态描述已存在: xxx)由拦截器弹出,
    // 前端不做本地查重 —— 字典数据可能不全,本地判重容易误报
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <el-dialog
    v-model="visible"
    title="新增客户状态"
    width="420px"
    :close-on-click-modal="false"
    destroy-on-close
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
      <el-form-item label="状态描述" prop="description">
        <el-input
          v-model="form.description"
          maxlength="50"
          placeholder="请输入状态描述"
          @keyup.enter="onSubmit"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="onSubmit">保存</el-button>
    </template>
  </el-dialog>
</template>
