import request from './request'

/**
 * 事件状态字典(文档 18 节)。给物流事件的"事件状态"那一栏用。
 *
 * ⚠️ 和**集装箱状态是同一条规则,别套用客户/订单状态那边**:
 *    |            | 客户状态 / 订单状态      | **事件状态**              |
 *    |------------|------------------------|-------------------------|
 *    | 描述列      | 只有一列                | **中英两列,两列都唯一**     |
 *    | 内置状态    | 有(1-3 / 1-4,整段)     | **只有 id=6「已删除」**    |
 *
 * 内置 6 条:1 预安排 / 2 装船中 / 3 航行中 / 4 卸货中 / 5 已完成 / **6 已删除**
 * —— 物流事件的逻辑删除(19.4)就是改到 6,所以它不可改不可删;1-5 只能被引用时删不掉。
 */

/** 分页。只接受 page/size —— 字典表数据量小,没有关键字搜索 */
export const fetchEventStatusPage = ({ page = 1, size = 20 } = {}) =>
  request.get('/event-statuses', { params: { page, size } })

/** 下拉框专用:一次性返回全部,不分页、不截断 */
export const fetchAllEventStatuses = () => request.get('/event-statuses/options')

export const fetchEventStatus = id => request.get(`/event-statuses/${id}`)

/**
 * 新增。
 *   descriptionCn  中文描述,**必填**、最长 50
 *   descriptionEn  英文描述,可空、最长 50
 *
 * 409:中文或英文描述重复(**两列在库里都有唯一约束**)。
 */
export const createEventStatus = body => request.post('/event-statuses', body)

export const updateEventStatus = (id, body) =>
  request.put(`/event-statuses/${id}`, body)

/**
 * 删除。**没有批量删除**。
 *
 * 409:还有物流事件在用这个状态,msg 形如 `该状态下存在 3 条物流事件, 无法删除`。
 */
export const deleteEventStatus = id => request.delete(`/event-statuses/${id}`)
