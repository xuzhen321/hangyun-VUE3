import axios from 'axios'
import { ElMessage } from 'element-plus'

/**
 * 后端地址。
 *
 * 📌 **默认按"当前页面是从哪个主机打开的"来推**,而不是写死 `localhost`。
 *
 * 原因:如果写死 `localhost:8080`,那局域网里另一台设备(手机、同事的机器)打开页面后,
 * 浏览器会去请求**它自己的** localhost —— 那儿没有后端,于是**页面能打开、但数据全是空的**。
 * 这种"看起来正常其实全挂"的故障最难排查。
 *
 * 按主机名推之后,同一个 dev server 既能在 `localhost:5173` 用,
 * 也能被 `192.168.x.x:5173` 访问,两边都指向同一台后端,不用改配置。
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

request.interceptors.response.use(
  // 200:后端 code 恒为 1,直接吐 data。
  // 增删改的 data 是 null,调用方忽略即可 —— 所以成功分支根本不用判 code。
  res => res.data.data,

  err => {
    // ① 没有 response = 网络层错误(后端没起、超时、DNS)。联调时最常见,单独给文案。
    if (!err.response) {
      ElMessage.error(
        err.code === 'ECONNABORTED'
          ? '请求超时,请稍后重试'
          : '无法连接服务器,请确认后端已在 8080 端口启动'
      )
      return Promise.reject(err)
    }

    // ② 有 response:错误类别全看 HTTP 状态码。
    //    code 只有 0/1,分不出类别,所以不读它。
    const { status, data } = err.response
    const msg = data?.msg // 必须读 response.data.msg,不是 err.message

    switch (status) {
      case 400:
        ElMessage.error(msg || '参数校验失败')
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
