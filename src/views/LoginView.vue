<script setup>
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const formRef = ref(null)
const loading = ref(false)

const form = reactive({ username: '', password: '' })

const rules = {
  username: [
    { required: true, whitespace: true, message: '请输入登录名', trigger: 'blur' },
    { max: 50, message: '登录名最长 50 个字符', trigger: 'blur' },
  ],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

async function onSubmit() {
  try {
    await formRef.value.validate()
  } catch {
    return // 校验不通过,表单上已有红字提示
  }

  loading.value = true
  try {
    await userStore.login({ ...form })

    // 登录成功。跳到"从哪被踢出来的"那个页面,没有就回首页。
    // ⚠️ redirect 只取路径部分,直接 push 用户传的字符串会有开放重定向的隐患
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : ''
    router.replace(redirect.startsWith('/') ? redirect : '/')
  } catch {
    // 401(用户名或密码错误)/ 403(账号被冻结)的文案由拦截器统一弹出,
    // 这里只需要把按钮的 loading 收掉
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login">
    <div class="login__card">
      <h1 class="login__title">集装箱物流信息管理系统</h1>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        size="large"
        @submit.prevent="onSubmit"
      >
        <el-form-item label="登录名" prop="username">
          <el-input
            v-model="form.username"
            placeholder="请输入登录名"
            clearable
            autocomplete="username"
          />
        </el-form-item>

        <el-form-item label="密码" prop="password">
          <!-- show-password:给个眼睛图标能看明文,输错了不用重打 -->
          <el-input
            v-model="form.password"
            type="password"
            placeholder="请输入密码"
            show-password
            autocomplete="current-password"
            @keyup.enter="onSubmit"
          />
        </el-form-item>

        <el-button
          type="primary"
          size="large"
          class="login__submit"
          :loading="loading"
          @click="onSubmit"
        >
          登 录
        </el-button>
      </el-form>
    </div>
  </div>
</template>

<style scoped>
.login {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  /* 和顶栏同一套配色,画面能接上 */
  background: linear-gradient(135deg, #1f6fd0 0%, #17a2c9 55%, #7ddc3f 100%);
}

.login__card {
  width: 420px;
  padding: 36px 36px 32px;
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
}

.login__title {
  margin: 0 0 28px;
  font-size: 22px;
  font-weight: 700;
  text-align: center;
  color: #1f6fd0;
  letter-spacing: 1px;
}

.login__submit {
  width: 100%;
  margin-top: 4px;
}
</style>
