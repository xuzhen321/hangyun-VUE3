import request from './request'

/** 下拉框专用:一次拿全,按 id 升序。id 1/2/3 是系统内置状态(正常/异常/注销) */
export const fetchAllStatuses = () => request.get('/customer-statuses/all')

/** 分页。只接受 page/size,没有关键字搜索 */
export const fetchStatusPage = ({ page = 1, size = 20 } = {}) =>
  request.get('/customer-statuses', { params: { page, size } })

export const fetchStatus = id => request.get(`/customer-statuses/${id}`)

/** 新增。description 必填、不能全空格、最长 50;重名返回 409 */
export const createStatus = body => request.post('/customer-statuses', body)

/**
 * 修改,整体覆盖语义。description 必传。
 *
 * 注意:内置状态(id 1/2/3)**不允许改名** ——
 * 文档 4.5 写的"允许改名"是过期信息,后端实际会拒绝。
 * 前端已把这三行的输入框置灰,这里只是兜底。
 */
export const updateStatus = (id, body) => request.put(`/customer-statuses/${id}`, body)

/**
 * 删除。两种 409 的 msg 都要原样展示给用户,它们说明了"为什么删不掉":
 *   - 内置状态:        系统内置状态(正常/异常/注销)不允许删除
 *   - 还有客户在用:    该状态下存在 3 个客户, 无法删除
 */
export const deleteStatus = id => request.delete(`/customer-statuses/${id}`)
