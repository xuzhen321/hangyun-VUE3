import request from './request'

/**
 * 物流事件(文档 19 节)。
 * "**某个集装箱在某个时间、某个地点发生了什么**"。
 */

/**
 * 两个"文字型枚举"的可选值。
 *
 * ⚠️ **提交时必须传这两个中文词**,不能传 `'1'/'0'`(source)或 `'Y'/'N'`(isEsti) ——
 *    库里存的是编码,但接口层做了转换,传编码会 400。
 */
export const EVENT_SOURCE_OPTIONS = ['船公司', '港区']
export const EVENT_IS_ESTI_OPTIONS = ['实际', '预计']

/**
 * 分页查询。四个条件都可选,同时传就是 AND。**排序按发生时间降序**(最近的排最前)。
 *
 * @param {object} [p]
 * @param {number} [p.page=1]              页码,从 1 开始
 * @param {number} [p.size=20]             每页条数,上限 100
 * @param {string} [p.containerNo]         箱号,**精确匹配**(整串传,不是前缀!)
 * @param {number} [p.eventStatusId]       事件状态 ID,精确匹配
 * @param {string} [p.eventTimeFrom]       发生时间下界(含)
 * @param {string} [p.eventTimeTo]         发生时间上界(含)
 */
export const fetchContainerEvents = ({
  page = 1,
  size = 20,
  containerNo,
  eventStatusId,
  eventTimeFrom,
  eventTimeTo,
} = {}) =>
  request.get('/container-events', {
    params: {
      page,
      size,
      // 箱号是**精确匹配** —— 原样传,不做任何转换
      containerNo: containerNo || undefined,
      eventStatusId: eventStatusId ?? undefined,
      eventTimeFrom: eventTimeFrom || undefined,
      eventTimeTo: eventTimeTo || undefined,
    },
  })

export const fetchContainerEvent = id => request.get(`/container-events/${id}`)

/**
 * 新增 / 修改的请求体:
 *
 *   containerNo    箱号,**必填**,必须是已存在(且**未删除**)的集装箱
 *   source         **文字** `"船公司"` / `"港区"`,`'1'/'0'` 不行
 *   voyageId       航次 ID,必须是已存在的航次
 *   eventPlaceId   发生地,必须是已存在的港口(8.1 的港口下拉)
 *   eventStatusId  事件状态 ID(18 节的下拉)
 *   isEsti         **文字** `"实际"` / `"预计"` —— ⚠️ **不是 `'Y'/'N'`**
 *   eventTime      发生时间
 *
 * ⚠️ **`source` 和 `isEsti` 提交时也必须传中文文字。**
 *    库里存的是 `'1'/'0'` 和 `'Y'/'N'`,但接口层做了转换 ——
 *    传编码会返回 400 `请求体格式不正确, 请检查字段类型和时间格式`。
 *
 * ⚠️ `isEsti` 的映射方向容易搞反:列名是 `is_esti`(is estimated),
 *    所以 **`Y` = 是预计、`N` = 是实际**。别按字面把 N 理解成"否"。
 */
export const createContainerEvent = body => request.post('/container-events', body)

/** 修改。请求体同新增 */
export const updateContainerEvent = (id, body) =>
  request.put(`/container-events/${id}`, body)

/**
 * 单条删除。**逻辑删除** —— 不删数据行,只是把状态改成"已删除"(`eventStatusId = 6`)。
 *
 * | | 说明 |
 * |---|---|
 * | 列表 | 已删除的自动消失 |
 * | 轨迹 | 也**不会**出现在集装箱轨迹里(12.8) |
 * | 详情 | 仍然能查到 |
 *
 * ⚠️ 表里没有 `id` 之外的错误 —— **没有 409**(逻辑删除不受引用影响),
 *    但 404(事件不存在)还是有的。
 */
export const deleteContainerEvent = id => request.delete(`/container-events/${id}`)

/**
 * 批量删除。**逻辑删除 + 宽松语义**(存在就改状态、不存在的忽略、幂等),
 * 没有 404 / 409,只有 400(空数组或超 100 个)。
 *
 * ⚠️ 字段名是普通的 **`ids`**(事件 id 是自增数字)。
 */
export const batchDeleteContainerEvents = ids =>
  request.delete('/container-events/batch', { data: { ids } })

/**
 * **集装箱轨迹**(12.8)—— 某个箱的全部物流事件。
 *
 * ⚠️ **不是分页接口**:`data` 直接是数组,不接受 `page`/`size`。
 *    而且已经按发生时间**升序**排好了(= 时间轴顺序),前端不用再排。
 *
 * 📌 已删除的事件不会出现;但**已删除的集装箱仍然能查轨迹** ——
 *    箱子退役了,它走过的历史链路还要留着。
 */
export const fetchContainerTrack = no => request.get(`/containers/${no}/track`)
