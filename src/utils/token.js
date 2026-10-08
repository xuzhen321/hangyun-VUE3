/**
 * 令牌的本地存取。
 *
 * 📌 单独抽一个文件,而不是放在 Pinia store 里,有两个原因:
 *   1. **路由守卫要用它**。守卫里如果 import 了 store,store 又会 import api,
 *      api 又 import request,request 又 import router —— 绕成一个环。
 *      这里不依赖任何东西,谁都能安全地引。
 *   2. **响应拦截器收到 401 时要清它**。拦截器也应该只依赖最底层的东西。
 *
 * 📌 用 localStorage 而不是 sessionStorage:关掉标签页再打开不用重新登录。
 */
const TOKEN_KEY = 'hangyun_token'

export const getToken = () => localStorage.getItem(TOKEN_KEY) || ''

export const setToken = token => localStorage.setItem(TOKEN_KEY, token)

/**
 * 清掉令牌。
 *
 * ⚠️ 登出时**务必调它** —— 令牌是无状态的(JWT),服务端不存会话,
 * "登出"的实质就是前端把本地令牌删干净。`POST /auth/logout` 那个接口本身什么都不做。
 */
export const clearToken = () => localStorage.removeItem(TOKEN_KEY)
