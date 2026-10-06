import request from './request'

/** 下拉框专用:一次拿全,按 id 升序。id 1-4 是系统内置状态 */
export const fetchAllOrderStatuses = () => request.get('/order-statuses/all')

/** 分页。只接受 page/size,没有关键字搜索 */
export const fetchOrderStatusPage = ({ page = 1, size = 20 } = {}) =>
  request.get('/order-statuses', { params: { page, size } })

export const fetchOrderStatus = id => request.get(`/order-statuses/${id}`)

/** 新增。description 必填、不能全空格、最长 50;重名返回 409 */
export const createOrderStatus = body => request.post('/order-statuses', body)

/**
 * 修改,整体覆盖语义。description 必传。
 *
 * ⚠️ 内置状态(id 1-4)**不允许改名**,后端返回 409;前端已把这几行置灰兜底。
 */
export const updateOrderStatus = (id, body) =>
  request.put(`/order-statuses/${id}`, body)

/**
 * 删除。两种 409 的 msg 都要原样展示给用户:
 *   - 内置状态:      系统内置状态(已确认/执行中/已完成/已取消)不允许删除
 *   - 还有订单在用:  该状态下存在 N 个订单, 无法删除
 */
export const deleteOrderStatus = id => request.delete(`/order-statuses/${id}`)
