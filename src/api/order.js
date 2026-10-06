import request from './request'

/**
 * 订单接口。和客户一样有"同一概念多处不同名"的问题,本文件是**唯一的映射点**:
 *
 *   列表筛选(按客户) -> customerName  姓名,**前缀匹配**
 *   提交(选客户)     -> customerId    id,**精确**
 *   列表筛选(按状态) -> status
 *   提交(状态)       -> statusId
 *   返回体           -> customerId + customerName、status + statusDescription
 */

/**
 * 分页查询订单。全部参数可选,不传即不参与筛选,多个条件是 AND。
 *
 * @param {object} [p]
 * @param {number} [p.page=1]        页码,从 1 开始
 * @param {number} [p.size=20]       每页条数,上限 100
 * @param {string} [p.customerName]  客户姓名,**前缀匹配**
 * @param {number} [p.status]        订单状态 ID 精确筛选
 * @param {string} [p.orderDateFrom] 下单时间下界(含)
 * @param {string} [p.orderDateTo]   下单时间上界(含)
 */
export function fetchOrders({
  page = 1,
  size = 20,
  customerName,
  status,
  orderDateFrom,
  orderDateTo,
} = {}) {
  return request.get('/orders', {
    params: {
      page,
      size,
      // undefined 的 key 会被 axios 丢弃,等价于"不传即不筛选"
      customerName: customerName || undefined,
      status: status ?? undefined,
      orderDateFrom: orderDateFrom || undefined,
      orderDateTo: orderDateTo || undefined,
    },
  })
}

/**
 * 详情。
 *
 * ⚠️ 订单号是 **19 位字符串**,直接内插进 URL 即可 ——
 * 千万不要 parseInt:它超出 JS `Number` 的安全整数范围,末几位会变成 0。
 */
export const fetchOrder = id => request.get(`/orders/${id}`)

/** 新增。body **不含 id**(订单号由后端雪花算法生成),状态字段叫 statusId */
export const createOrder = body => request.post('/orders', body)

/** 修改。**整体覆盖**语义:没传的字段会被置 null,调用方必须带全字段 */
export const updateOrder = (id, body) => request.put(`/orders/${id}`, body)

/**
 * 单条逻辑删除:不删数据行,只是把状态改成"已取消"(statusId = 4)。
 * 错误只有 404(订单号不存在)。
 */
export const deleteOrder = id => request.delete(`/orders/${id}`)

/**
 * 批量删除订单(同样是逻辑删除),一次最多 100 个,`ids` 不能为空数组。
 *
 * ⚠️⚠️ **订单号必须原样传字符串,不要做任何数值转换。**
 * 订单号是 19 位,超出 JS `Number` 的安全整数范围 —— 一旦转成数字,末几位会变成 0,
 * 后端查不到这条记录,而在宽松语义下**会被静默忽略**:用户以为删掉了,其实什么都没发生。
 * 所以前端传 `["1783123456789012345", ...]`,后端也要按字符串收。
 *
 * 语义与 `/customers/batch` 一致(待后端提供):
 *   - 不存在的订单号直接忽略,返回 200 就当全部处理完,**不需要处理"部分成功"**
 *   - 幂等:重复提交、或混进已被别人删掉的订单号,都不会报错
 *
 * ⚠️ axios 的 delete 第二个参数是 config 不是 body:
 *    写成 request.delete(url, { ids }) 的话 body 根本发不出去,必须包在 config.data 里。
 */
export const batchDeleteOrders = ids =>
  request.delete('/orders/batch', { data: { ids } })
