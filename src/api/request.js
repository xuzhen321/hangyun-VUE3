import axios from 'axios'
import { ElMessage } from 'element-plus'
import router from '@/router'
import { clearToken, getToken } from '@/utils/token'

/**
 * 后端地址。
 *
 * 📌 **默认按"当前页面是从哪个主机打开的"来推**,而不是写死 `localhost`。
 *
 * 原因:如果写死 `localhost:8080`,那局域网里另一台设备(手机、同事的机器)打开页面后,
 * 浏览器会去请求**它自己的** localhost —— 那儿没有后端,于是**页面能打开、但数据全是空的**。
 * 这种"看起来正常其实全挂"的故障最难排查。
 *
 * 想固定成别的地址(比如后端在另一台机器):在 `.env.development` 里设 `VITE_API_BASE_URL` 覆盖。
 */
const API_PORT = import.meta.env.VITE_API_PORT || '8080'
const baseURL =
  import.meta.env.VITE_API_BASE_URL ||
  `${window.location.protocol}//${window.location.hostname}:${API_PORT}`

const request = axios.create({
  // 文档第 1 节:无路径前缀,跨域已全放行,不需要代理、不需要带凭证/Cookie
  baseURL,
  timeout: 15000,
})

// ===========================================================================
// 请求拦截器:带上令牌
// ===========================================================================

/**
 * ⚠️ **除了 `POST /auth/login` 和 Swagger,所有接口都要带令牌**,否则一律 401。
 *    所以统一在这里加,别在业务代码里一个个加。
 *
 * 📌 走 `Authorization` 请求头而不是 Cookie —— 后端跨域放行的是
 *    `allowCredentials=false` 的请求,用 Cookie 传东西会被挡。
 */
request.interceptors.request.use(config => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ===========================================================================
// 响应拦截器
// ===========================================================================

/**
 * 把"其实是错误 JSON、但被当成 blob 收下来"的响应体读回文本、取出 msg。
 *
 * ⚠️ 导出接口用 `responseType: 'blob'`,而**失败时后端返回的是正常的 JSON 错误**
 *    (HTTP 400/500 + Result 结构)。因为 responseType 是 blob,那份 JSON 也被当成
 *    Blob 收下来了 —— 直接读 `.msg` 拿到的是 undefined。
 */
async function readBlobErrorMsg(blob) {
  try {
    return JSON.parse(await blob.text())?.msg || ''
  } catch {
    return ''
  }
}

request.interceptors.response.use(
  res => {
    // ⚠️ 导出接口返回的是**文件流**,原样把整个响应交给调用方。
    //    这里不能扒 `.data.data` —— blob 上没有 data 字段,扒完就成了 undefined。
    if (res.config.responseType === 'blob') return res
    // 200:后端 code 恒为 1,直接吐 data。
    // 增删改的 data 是 null,调用方忽略即可 —— 所以成功分支根本不用判 code。
    return res.data.data
  },

  async err => {
    // ① 没有 response = 网络层错误(后端没起、超时、DNS)。联调时最常见,单独给文案。
    if (!err.response) {
      ElMessage.error(
        err.code === 'ECONNABORTED'
          ? '请求超时,请稍后重试'
          : '无法连接服务器,请确认后端已启动'
      )
      return Promise.reject(err)
    }

    const { status, data, config } = err.response
    const url = config?.url || ''

    // 错误体可能是 Blob(导出接口),先兼容着取一次 msg
    let msg = data?.msg
    if (!msg && data instanceof Blob) msg = await readBlobErrorMsg(data)

    // ② 401:登录态没了
    if (status === 401) {
      if (url.includes('/auth/login')) {
        // ⚠️ **登录接口自己的 401 是"用户名或密码错误"**,不是"登录失效"。
        //    这种要照常把文案弹出来,但**不能清令牌、更不能跳转**(跳了就没法重试)
        ElMessage.error(msg || '用户名或密码错误')
      } else {
        // 令牌缺失 / 无效 / 过期 / 账号被冻结 —— 清掉本地令牌跳登录页
        clearToken()
        ElMessage.error(msg || '登录已失效,请重新登录')
        // 已经在登录页就不重复跳(多个请求同时 401 时会触发多次)
        if (router.currentRoute.value.name !== 'login') {
          router.push({
            name: 'login',
            // 带上当前地址,登录完能跳回去
            query: { redirect: router.currentRoute.value.fullPath },
          })
        }
      }
      return Promise.reject(err)
    }

    // ③ 其余错误类别全看 HTTP 状态码。code 只有 0/1,分不出类别,所以不读它。
    switch (status) {
      case 400:
        ElMessage.error(msg || '参数校验失败')
        break
      case 403:
        // 后端用它表示"账号被冻结/停用"
        ElMessage.error(msg || '没有权限执行该操作')
        break
      case 404:
        ElMessage.error(msg || '数据不存在')
        break
      case 409:
        // 原样展示:msg 里带具体原因,如"该状态下存在 3 个客户, 无法删除"
        ElMessage.error(msg || '数据冲突')
        break
      case 500:
        // 固定文案,不拿 msg 做判断
        ElMessage.error('系统繁忙,请稍后重试')
        break
      default:
        ElMessage.error(msg || `请求失败(${status})`)
    }

    // 提示统一在这里弹,页面 catch 里不要再弹一次(否则一次 409 弹两遍)
    return Promise.reject(err)
  }
)

export default request
