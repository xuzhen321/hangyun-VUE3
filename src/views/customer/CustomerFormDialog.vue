<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { createCustomer, fetchCustomer, updateCustomer } from '@/api/customer'
import { useStatusDictStore } from '@/stores/statusDict'
import { toPayload } from '@/utils/payload'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  /** null = 新增;数字 = 编辑该 id */
  id: { type: Number, default: null },
})
const emit = defineEmits(['update:modelValue', 'success'])

const dict = useStatusDictStore()
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
    phone: '',
    email: '',
    address: '',
    qualification: '',
    qualificationValidTo: '',
    statusId: 1, // 新增默认「正常」
  }
}

const form = reactive(emptyForm())

const rules = {
  name: [
    // whitespace: true 让"全是空格"也判为不通过
    { required: true, whitespace: true, message: '请输入客户姓名', trigger: 'blur' },
    { max: 50, message: '客户姓名最长 50 个字符', trigger: 'blur' },
  ],
  phone: [{ max: 30, message: '联系方式最长 30 个字符', trigger: 'blur' }],
  email: [
    // 值为空时这条规则会自动跳过,正好满足"可不填,填了就要合法"
    { type: 'email', message: '邮箱格式不正确', trigger: ['blur', 'change'] },
    { max: 50, message: '电子邮箱最长 50 个字符', trigger: 'blur' },
  ],
  address: [{ max: 255, message: '详细地址最长 255 个字符', trigger: 'blur' }],
  qualification: [{ max: 100, message: '资质信息最长 100 个字符', trigger: 'blur' }],
  // qualificationValidTo:格式由 date-picker 的 value-format 保证,不需要额外规则
}

watch(visible, async open => {
  if (!open) return
  dict.load()
  formRef.value?.clearValidate()

  if (isEdit.value) {
    // PUT 是整体覆盖 —— 必须先把完整字段取回来,
    // 否则用户没动的那些字段会在提交时被后端置为 null
    loading.value = true
    try {
      const c = await fetchCustomer(props.id)
      Object.assign(form, {
        name: c.name ?? '',
        phone: c.phone ?? '',
        email: c.email ?? '',
        address: c.address ?? '',
        qualification: c.qualification ?? '',
        qualificationValidTo: c.qualificationValidTo ?? '',
        // 返回体里状态字段叫 status,提交体里叫 statusId
        statusId: c.status ?? null,
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
    if (isEdit.value) await updateCustomer(props.id, body)
    else await createCustomer(body)

    ElMessage.success('保存成功')
    visible.value = false
    // 增删改不返回 data、也不返回新 id —— 只能让父组件重新拉列表
    emit('success')
  } catch {
    // 400(字段校验)/ 409 的 msg 已由拦截器弹出
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="isEdit ? '编辑客户' : '新增客户'"
    width="560px"
    :close-on-click-modal="false"
    destroy-on-close
  >
    <el-form
      ref="formRef"
      v-loading="loading"
      :model="form"
      :rules="rules"
      label-width="110px"
    >
      <el-form-item label="客户姓名" prop="name">
        <el-input v-model="form.name" maxlength="50" placeholder="请输入客户姓名" />
      </el-form-item>
      <el-form-item label="联系方式" prop="phone">
        <el-input v-model="form.phone" maxlength="30" placeholder="请输入联系方式" />
      </el-form-item>
      <el-form-item label="电子邮箱" prop="email">
        <el-input v-model="form.email" maxlength="50" placeholder="请输入电子邮箱" />
      </el-form-item>
      <el-form-item label="详细地址" prop="address">
        <el-input
          v-model="form.address"
          type="textarea"
          :rows="2"
          maxlength="255"
          placeholder="请输入详细地址"
        />
      </el-form-item>
      <el-form-item label="资质信息" prop="qualification">
        <el-input
          v-model="form.qualification"
          maxlength="100"
          placeholder="请输入资质信息"
        />
      </el-form-item>
      <el-form-item label="资质有效期至" prop="qualificationValidTo">
        <!-- value-format 是关键:拿到手直接就是字符串,
             不会出现 JSON.stringify(Date) 那种带 Z 和毫秒的格式 -->
        <el-date-picker
          v-model="form.qualificationValidTo"
          type="datetime"
          value-format="YYYY-MM-DD HH:mm:ss"
          format="YYYY-MM-DD HH:mm:ss"
          placeholder="请选择资质有效期"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item label="客户状态" prop="statusId">
        <el-select v-model="form.statusId" placeholder="请选择客户状态" style="width: 100%">
          <el-option
            v-for="o in dict.options"
            :key="o.value"
            :label="o.label"
            :value="o.value"
          />
        </el-select>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="onSubmit">保存</el-button>
    </template>
  </el-dialog>
</template>
