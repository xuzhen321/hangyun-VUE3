<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { createUser, updateUser } from '@/api/user'

/**
 * 系统用户的新增 / 编辑弹窗。
 *
 * ⚠️ **两处和别的表单不一样:**
 *
 * 1. **编辑时没有密码字段** —— 改密码走单独的「重置密码」。因为"整体覆盖"碰上密码会歧义:
 *    编辑表单不填密码时,到底是"不改密码"还是"清空密码"?清空等于把账号锁死。
 *    所以后端干脆把密码从修改接口里摘出去了。
 * 2. **`status` 在修改接口里是唯一"不传就保持原状"的字段**(其余字段不传会被清空)。
 *    但**仍然要把它带上** —— 状态被写成 null 的账号既登不进去、也不出现在任何列表里,
 *    等于被静默停用。所以这里始终传。
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

/** 内置管理员:id = 1。它不允许被冻结、也不允许被删除 */
const BUILTIN_ADMIN_ID = '1'
const isBuiltinAdmin = computed(() => String(props.row?.id ?? '') === BUILTIN_ADMIN_ID)

const STATUS_OPTIONS = [
  { value: '0', label: '正常' },
  { value: '1', label: '冻结' },
  { value: '2', label: '已删除' },
]

function emptyForm() {
  return { username: '', password: '', realName: '', phone: '', status: '0' }
}

const form = reactive(emptyForm())

const rules = {
  username: [
    // whitespace: true 让"全是空格"也判为不通过
    { required: true, whitespace: true, message: '请输入登录名', trigger: 'blur' },
    { max: 50, message: '登录名最长 50 个字符', trigger: 'blur' },
  ],
  realName: [{ max: 100, message: '真实姓名最长 100 个字符', trigger: 'blur' }],
  phone: [{ max: 30, message: '电话最长 30 个字符', trigger: 'blur' }],
}

/** 密码只在新增时校验 */
const passwordRules = [
  { required: true, message: '请输入密码', trigger: 'blur' },
  { min: 6, max: 64, message: '密码长度 6~64 位', trigger: 'blur' },
]

watch(visible, open => {
  if (!open) return
  formRef.value?.clearValidate()

  const r = props.row
  Object.assign(form, {
    username: r?.username ?? '',
    password: '', // 编辑时不展示、也不提交
    realName: r?.realName ?? '',
    phone: r?.phone ?? '',
    // ⚠️ 兜底成 '0':状态为空会被后端当成非法值
    status: r?.status ?? '0',
  })
})

async function onSubmit() {
  try {
    await formRef.value.validate()
    if (!isEdit.value) {
      // 密码是动态字段,单独校验
      if (!form.password) throw new Error('password required')
      if (form.password.length < 6 || form.password.length > 64) {
        ElMessage.warning('密码长度 6~64 位')
        throw new Error('password length')
      }
    }
  } catch {
    return // 校验不通过,表单上已有红字提示
  }

  submitting.value = true
  try {
    if (isEdit.value) {
      // ⚠️ 编辑**不带 password**,但**一定要带 status**
      await updateUser(props.row.id, {
        username: form.username.trim(),
        realName: form.realName.trim() || null,
        phone: form.phone.trim() || null,
        status: form.status,
      })
    } else {
      await createUser({
        username: form.username.trim(),
        password: form.password,
        realName: form.realName.trim() || null,
        phone: form.phone.trim() || null,
        status: form.status,
      })
    }

    ElMessage.success('保存成功')
    visible.value = false
    // 增删改不返回数据 —— 只能让父组件重新拉列表
    emit('success')
  } catch {
    // 409(登录名重复 / 内置管理员不能被冻结)·400 由拦截器弹出
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="isEdit ? '编辑用户' : '新增用户'"
    width="520px"
    :close-on-click-modal="false"
    destroy-on-close
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
      <el-form-item label="登录名" prop="username">
        <el-input v-model="form.username" maxlength="50" placeholder="请输入登录名" />
      </el-form-item>

      <!-- ⚠️ 密码只在新增时出现 —— 改密码走列表里的「重置密码」 -->
      <el-form-item v-if="!isEdit" label="密码" prop="password" :rules="passwordRules">
        <el-input
          v-model="form.password"
          type="password"
          show-password
          maxlength="64"
          placeholder="6~64 位"
        />
      </el-form-item>

      <el-form-item label="真实姓名" prop="realName">
        <el-input v-model="form.realName" maxlength="100" placeholder="请输入真实姓名" />
      </el-form-item>

      <el-form-item label="电话" prop="phone">
        <el-input v-model="form.phone" maxlength="30" placeholder="请输入电话" />
      </el-form-item>

      <el-form-item label="账号状态" prop="status">
        <!-- 内置管理员不能被冻结/删除,那两个选项直接禁掉 -->
        <el-select v-model="form.status" style="width: 100%">
          <el-option
            v-for="o in STATUS_OPTIONS"
            :key="o.value"
            :label="o.label"
            :value="o.value"
            :disabled="isBuiltinAdmin && o.value !== '0'"
          />
        </el-select>
        <div v-if="isBuiltinAdmin" class="field-hint">
          这是<strong>内置管理员</strong>,不能被冻结或删除 ——
          否则把唯一的管理员锁死,就没人能登录进来改回去了。
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
.field-hint {
  margin-top: 4px;
  color: #909399;
  font-size: 12px;
  line-height: 1.5;
}
</style>
