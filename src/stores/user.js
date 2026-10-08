import { defineStore } from 'pinia'
import { fetchMe, login as loginApi, logout as logoutApi } from '@/api/auth'
import { clearToken, getToken, setToken } from '@/utils/token'

/**
 * 登录用户。
 *
 * ⚠️ **令牌本身不放在 state 里**,而是存在 localStorage(见 `utils/token.js`)。
 *    因为响应拦截器收到 401 时要在**任何地方**都能把它清掉,
 *    而拦截器不能 import store(会绕成环)。
 *
 * 这里的 `user` 只表示**当前登录用户的信息**,刷新页面后是 null,
 * 由布局组件调 `loadMe()` 补回来。
 */
export const useUserStore = defineStore('user', {
  state: () => ({
    /** 当前登录用户,未加载时为 null */
    user: null,
  }),

  getters: {
    isLoggedIn: () => !!getToken(),
    /** 界面上优先显示真实姓名,没填就退回登录名 */
    displayName: state => state.user?.realName || state.user?.username || '',
    userId: state => state.user?.id ?? null,
  },

  actions: {
    /**
     * 登录。成功后就地写入用户信息,不用再调 `/auth/me`。
     * @param {{username: string, password: string}} payload
     */
    async login(payload) {
      const data = await loginApi(payload)
      // ⚠️ 先存令牌再存用户 —— 万一后面那步出错,令牌还在,不会卡在"登录了但没令牌"
      setToken(data.token)
      this.user = data.user ?? null
      return data
    },

    /**
     * 拉当前登录用户。
     * 刷新页面后 state 是空的,用它补;401 由拦截器统一处理(清令牌 + 跳登录页)。
     */
    async loadMe() {
      this.user = await fetchMe()
      return this.user
    },

    /**
     * 登出。
     *
     * 📌 **不管接口成不成功,本地一定要清干净** ——
     *    令牌是无状态的,服务端那个接口本来就是空操作,
     *    如果因为它失败就不清本地,用户会卡在"点了登出但还是登录态"。
     */
    async logout() {
      try {
        await logoutApi()
      } catch {
        // 忽略:清本地才是登出的实质
      } finally {
        this.reset()
      }
    },

    /** 清掉本地登录态(令牌 + 用户信息) */
    reset() {
      clearToken()
      this.user = null
    },
  },
})
