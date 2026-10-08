import request from '@/api/request'

/**
 * Excel 导出(文档 29.4 节)—— **所有导出接口共用这一套约定**。
 *
 * | | 说明 |
 * |---|---|
 * | 筛选条件 | 与对应的**列表接口完全一致**,只是不分页 |
 * | 方法 | `GET`,参数放 query string,和列表一样 |
 * | 响应 | ⚠️ **不是 JSON,是文件流** |
 * | 文件名 | 在 `Content-Disposition` 头里,形如 `logs_20261008.xlsx`(英文名 + 日期) |
 * | 行数上限 | **50000 行**,超了返回 400 |
 *
 * ⚠️ **必须按 blob 接收**(`responseType: 'blob'`),否则拿到的是乱码。
 *    这件事在 `downloadExcel` 里做了,调用方不用管。
 *
 * ⚠️ **失败时后端返回的是正常的 JSON 错误**,但因为在 blob 模式下它也被当成 Blob 收下来,
 *    所以"读出 msg"这件事在 `request.js` 的响应拦截器里统一处理了 ——
 *    调用方拿到 reject 时,错误提示**已经弹过了**,不用再弹一次。
 */

/** 从 `Content-Disposition` 里抠文件名 */
function parseFilename(disposition) {
  if (!disposition) return ''
  // 优先 RFC 5987 的 filename*=UTF-8''xxx(能带非 ASCII)
  const star = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(disposition)
  if (star) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^"|"$/g, ''))
    } catch {
      // 解码失败就走下面那条
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(disposition)
  return plain ? plain[1].trim() : ''
}

/** 今天的 YYYYMMDD,用来拼文件名,避免多次导出互相覆盖 */
function today() {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
}

/** 触发浏览器下载一个 Blob */
function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  // 下载是异步的,立刻 revoke 有些浏览器会中断;给一点时间
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * 下载一个导出接口。
 *
 * @param {string} url           导出接口路径,如 `/customers/export`
 * @param {object} [params]      查询条件,**和列表接口的完全一样**
 * @param {string} [baseName]    文件名主体(中文),会拼成 `客户_20261008.xlsx`。
 *                               不传就用后端 `Content-Disposition` 里的英文名。
 */
export async function downloadExcel(url, params = {}, baseName = '') {
  // ⚠️ responseType 少了这行,下载下来的文件打不开(拿到的是乱码文本)
  const res = await request.get(url, { params, responseType: 'blob' })

  const serverName = parseFilename(res.headers?.['content-disposition'])
  // 📌 后端给的是英文名 + 日期(如 logs_20261008.xlsx),用户看着不直观,
  //    所以传了 baseName 就自己拼一个中文的;没传才退回服务端的名字。
  const filename = baseName ? `${baseName}_${today()}.xlsx` : serverName || 'export.xlsx'

  saveBlob(res.data, filename)
}

/**
 * 剔掉筛选条件里"空"的那些项。
 *
 * ⚠️ 不剔的话,像 `{ name: '' }` 这种会被 axios 原样拼进 query string
 * (`/customers/export?name=`),后端可能把它当成"按空值筛",结果导出一片空白。
 * 列表接口那边是靠 `|| undefined` 一个个挡的,导出这里统一挡一次。
 */
export function cleanQuery(query) {
  const out = {}
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== '' && value !== null && value !== undefined) out[key] = value
  }
  return out
}
