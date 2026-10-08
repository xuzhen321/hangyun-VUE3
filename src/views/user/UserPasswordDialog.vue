<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { resetUserPassword } from '@/api/user'

/**
 * 重置密码。
 *
 * 📌 这是**管理员给用户重置**,接口**不要求输入旧密码** —— 所以这个弹窗里没有"原密码"。
 *
 * 📌 加了一个"确认新密码"是**纯前端**的:接口只要一个 `newPassword`。
 *    但密码设完就看不见了,输错了只能再重置一次,所以值得再输一遍确认。
 */
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  /** 要重置的用户行 */
  user: { type: Object, default: null },
})
const emit = defineEmits(['update:modelValue', 'success'])

const formRef = ref(null)
const submitting = ref(false)

const visible = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v),
})

const form = reactive({ newPassword: '', confirmPassword: '' })

/** 两次输入一致 —— 这条只能在前端做,后端只有一个字段 */
function validateConfirm(rule, value, callback) {
  if (!value) return callback(new Error('请再输入一次新密码'))
  if (value !== form.newPassword) return callback(new Error('两次输入的密码不一致'))
  callback()
}

const rules = {
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, max: 64, message: '密码长度 6~64 位', trigger: 'blur' },
  ],
  confirmPassword: [{ validator: validateConfirm, trigger: 'blur' }],
}

watch(visible, open => {
  if (!open) return
  form.newPassword = ''
  form.confirmPassword = ''
  formRef.value?.clearValidate()
})

async function onSubmit() {
  try {
    await formRef.value.validate()
  } catch {
    return // 校验不通过,表单上已有红字提示
  }

  submitting.value = true
  try {
    await resetUserPassword(props.user.id, form.newPassword)
    ElMessage.success('密码已重置')
    visible.value = false
    emit('success')
  } catch {
    // 404 由拦截器弹出
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <el-dialog
    v-model="visible"
    title="重置密码"
    width="460px"
    :close-on-click-modal="false"
    destroy-on-close
  >
    <p class="tip">
      正在重置用户
      <strong>{{ user?.username }}</strong>
      的密码。重置后请把新密码告知本人 —— 旧密码立即失效。
    </p>

    <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
      <el-form-item label="新密码" prop="newPassword">
        <el-input
          v-model="form.newPassword"
          type="password"
          show-password
          maxlength="64"
          placeholder="6~64 位"
        />
      </el-form-item>
      <el-form-item label="确认新密码" prop="confirmPassword">
        <el-input
          v-model="form.confirmPassword"
          type="password"
          show-password
          maxlength="64"
          placeholder="再输入一次"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="onSubmit">确定重置</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.tip {
  margin: 0 0 18px;
  color: #606266;
  line-height: 1.6;
}
</style>
