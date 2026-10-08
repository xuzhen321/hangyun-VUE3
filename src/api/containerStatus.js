import request from './request'

/**
 * 集装箱状态字典(文档 14 节)。给新增集装箱时"当前状态"那一栏用的字典。
 *
 * ⚠️ **和客户状态 / 订单状态有两处不一样,别套用那边的东西:**
 *
 *   |            | 客户状态 / 订单状态            | **集装箱状态**                    |
 *   |------------|------------------------------|----------------------------------|
 *   | 描述列      | 只有一列 `description`         | **中英两列,两列都唯一**             |
 *   | 内置状态    | 有(1-3 / 1-4,**整段**不可改不可删) | **只有 id=7「已删除」一个是内置的**  |
 *
 * 也就是说:**除了 id=7,其余几条(1-6)只要没被集装箱引用,都能改、都能删**。
 * 只有「已删除」被代码写死依赖(集装箱的逻辑删除就是改到它),所以它不可改不可删。
 */

/** 分页。只接受 page/size —— 字典表数据量小,没有关键字搜索 */
export const fetchContainerStatusPage = ({ page = 1, size = 20 } = {}) =>
  request.get('/container-statuses', { params: { page, size } })

/** 下拉框专用:一次性返回全部,不分页、不截断(给集装箱表单的"当前状态"用) */
export const fetchAllContainerStatuses = () =>
  request.get('/container-statuses/options')

export const fetchContainerStatus = id => request.get(`/container-statuses/${id}`)

/**
 * 新增。
 *   descriptionCn  状态中文描述,**必填**、不能为空、最长 50
 *   descriptionEn  状态英文描述,可空、最长 50
 *
 * 409:中文描述重复,或英文描述重复(两列各自唯一)。
 */
export const createContainerStatus = body =>
  request.post('/container-statuses', body)

/** 修改。整体覆盖语义,字段同新增 */
export const updateContainerStatus = (id, body) =>
  request.put(`/container-statuses/${id}`, body)

/**
 * 删除。**没有批量删除**(14 节只有单条 DELETE)。
 *
 * 409:还有集装箱在用这个状态,`msg` 形如 `该状态下存在 2 个集装箱, 无法删除`。
 */
export const deleteContainerStatus = id =>
  request.delete(`/container-statuses/${id}`)
