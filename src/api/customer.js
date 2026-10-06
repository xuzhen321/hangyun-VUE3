import request from './request'

/**
 * 后端对"客户状态"用了三个不同的名字,本文件是**唯一的映射点**:
 *
 *   列表筛选参数 -> status
 *   新增/修改提交 -> statusId
 *   返回体       -> status(以及 statusDescription 中文描述)
 *
 * 页面里只保留一套词汇,避免"查询时误传 statusId、提交时误传 status"
 * 这类 bug 散落到各个页面;将来后端改名也只改这一个文件。
 */

/**
 * 分页查询客户
 * @param {object} [p]
 * @param {number} [p.page=1]         页码,从 1 开始
 * @param {number} [p.size=20]        每页条数,上限 100
 * @param {string} [p.name]           客户姓名,**前缀匹配**
 * @param {string} [p.qualification]  资质信息,**前缀匹配**
 * @param {string} [p.validFrom]      资质有效期下界(含),页面命名 -> qualificationValidToFrom
 * @param {string} [p.validTo]        资质有效期上界(含),页面命名 -> qualificationValidToTo
 * @param {number} [p.status]         状态 ID 精确筛选
 */
export function fetchCustomers({
  page = 1,
  size = 20,
  name,
  qualification,
  validFrom,
  validTo,
  status,
} = {}) {
  return request.get('/customers', {
    params: {
      page,
      size,
      // undefined 的 key 会被 axios 丢弃,正好等价于"不传即不参与筛选"
      name: name || undefined,
      qualification: qualification || undefined,
      status: status ?? undefined,
      // 时间串中间的空格交给 axios 自动做 URL 编码,不要手拼 URL
      qualificationValidToFrom: validFrom || undefined,
      qualificationValidToTo: validTo || undefined,
    },
  })
}

/** 详情。删除后的客户用这个仍然查得到,statusDescription 会是"注销" */
export const fetchCustomer = id => request.get(`/customers/${id}`)

/** 新增。body 里的状态字段叫 **statusId** */
export const createCustomer = body => request.post('/customers', body)

/** 修改。**整体覆盖**语义:没传的字段会被置 null,调用方必须带全字段 */
export const updateCustomer = (id, body) => request.put(`/customers/${id}`, body)

/** 单条删除。**逻辑删除**:不删数据行,只是把状态改成"注销"(statusId = 3) */
export const deleteCustomer = id => request.delete(`/customers/${id}`)

/**
 * 批量删除(同样是逻辑删除),一次最多 100 个,`ids` 不能为空数组。
 *
 * 语义宽松:不存在的 id 会被直接忽略,接口照样返回成功 ——
 * 所以前端**不需要处理"部分成功"**,拿到 200 就当全部处理完了。
 *
 * ⚠️ axios 的 delete 第二个参数是 config 不是 body:
 *    写成 request.delete(url, { ids }) 的话 body 根本发不出去,
 *    必须包在 config.data 里。
 */
export const batchDeleteCustomers = ids =>
  request.delete('/customers/batch', { data: { ids } })

/**
 * 客户下拉搜索 —— 新增/修改**订单**时选客户用。
 *
 * `name` **前缀匹配**(和 5.1 列表同一套规则),不传则返回前 20 条。
 * 不是分页接口:data 直接是数组,只返回 `{id, name, phone}` 三个字段。
 * **已注销的客户不会出现在候选里。**
 *
 * ⚠️ 下拉框必须用这个,不要拿 5.1 的列表接口代替(字段多、还多一条 COUNT 查询)。
 *    `phone` 是用来区分**同名客户**的,选项里要一起显示。
 */
export const searchCustomerOptions = name =>
  request.get('/customers/options', { params: { name: name || undefined } })

/**
 * 查询**某个客户名下**的订单(分页)。客户列表操作列的"订单查询"用它。
 *
 * ⚠️ 和 7.1 的 `/orders` 列表**口径不同**:这个接口**包含已取消的订单** ——
 *    它要的是"这个客户的完整往来记录",所以不做状态过滤,也不接受状态/日期筛选。
 *    同一个客户在两个接口看到的条数可能不一样,这是故意的,不是谁算错了。
 *
 * ⚠️ 客户不存在时返回 **404**(而不是空列表)—— 这样前端能区分
 *    "这个客户确实没有订单" 和 "客户 id 传错了"。所以 404 要单独处理,别当成"没有订单"。
 *
 * 只有 page/size 两个参数,客户 id 在路径里。
 */
export const fetchCustomerOrders = (customerId, { page = 1, size = 20 } = {}) =>
  request.get(`/customers/${customerId}/orders`, { params: { page, size } })
