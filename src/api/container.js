import request from './request'

/**
 * 集装箱接口(文档第 12 节)。
 *
 * ⚠️ 三点和别的模块不一样:
 *   1. **主键是箱号 `no`(字符串),不是自增 id** —— 所以路径里是 `/{no}`,
 *      批量删除的字段名是 **`nos`** 而不是 `ids`,元素也是箱号字符串
 *   2. **箱号由前端提供**(和订单号相反,订单号是后端生成的雪花 id)
 *   3. **箱号不可修改** —— 要换箱号只能删了重建
 */

/**
 * 分页查询。排序按 `no` 升序(箱号字典序)。
 *
 * @param {object} [p]
 * @param {number} [p.page=1]   页码
 * @param {number} [p.size=20]  每页条数,上限 100
 * @param {string} [p.no]         箱号,**前缀匹配**(传 `SEGU` 能筛出该箱主的所有箱)
 * @param {number} [p.status]     集装箱状态 ID,精确匹配
 * @param {number} [p.ownerId]    箱主 ID,精确匹配 —— 用来看"这个公司名下的箱子"(15.7)
 * @param {number} [p.operatorId] 操作方 ID,精确匹配
 *
 * ⚠️ **不传 `status` 时,已删除(`statusId = 7`)的集装箱不会出现在列表里。**
 *    要看已删除的,显式传 `status=7`。
 *
 * ⚠️ **`ownerId` 和 `operatorId` 是两个独立字段,必须分开传**
 *    (同时传是 AND)。一个集装箱的箱主和操作方**可以是不同的公司** ——
 *    租箱的情况很常见,比如箱主是"泰腾箱务"、操作方是"中远海运"。
 *    所以"看这个公司的箱子"要看两遍:作为箱主一次、作为操作方一次。
 */
export const fetchContainers = ({
  page = 1,
  size = 20,
  no,
  status,
  ownerId,
  operatorId,
} = {}) =>
  request.get('/containers', {
    params: {
      page,
      size,
      no: no || undefined,
      status: status ?? undefined,
      ownerId: ownerId ?? undefined,
      operatorId: operatorId ?? undefined,
    },
  })

/**
 * 下拉框(12.7)—— **给"新增装箱结果"选箱子用**,装箱登记那边就调这个。
 *
 * 固定最多返回 20 条,不是分页接口。`keyword` 是箱号前缀匹配。
 *
 * 📌 比列表接口多给一个 `statusDescription`,**显示出来让用户知道这箱子现在能不能用**。
 * 📌 **已删除的集装箱不会出现在候选里** —— 它们不能再装货。
 */
export const fetchContainerOptions = keyword =>
  request.get('/containers/options', { params: { keyword: keyword || undefined } })

/** 详情。不存在时 404(msg: 集装箱不存在) */
export const fetchContainer = no => request.get(`/containers/${no}`)

/**
 * 新增。
 *   no          箱号,**必填**、最长 30、不能重复 —— **由前端提供**
 *   typeId      箱型,用 13 节的下拉框选
 *   ownerId     箱主,用 15.6 的下拉框选
 *   operatorId  操作方,**同一个下拉框**(它们指向同一张 company 表)
 *   statusId    当前状态,用 14 节的下拉框选
 *   sealNo / carrierOperate / ctrStatusTerminal  自由文本
 *   dangerFlag / maritimeFlag    **布尔值,传 `true`/`false`,不要传 `'1'`/`'0'`**
 *
 * ⚠️ 两个标志位:库里存 `char(1)`,但接口层做了转换 —— 读出来是布尔,提交也按布尔传。
 *    传字符串 `'1'` 后端按布尔解析会失败或得到意外结果。
 */
export const createContainer = body => request.post('/containers', body)

/**
 * 修改。请求体同新增,**但没有 `no`**。
 *
 * 🚫 **箱号不可修改** —— 它是主键。硬塞 `no` 进请求体**不会报错,会被安静忽略**。
 *    前端编辑表单里箱号那一栏应该是**只读的**。
 *
 * 语义是**整体覆盖**:没传的字段会被置为 null(这张表的业务列允许为空,
 * 和 11.4 装箱结果那种"必填"的不一样)。
 */
export const updateContainer = (no, body) => request.put(`/containers/${no}`, body)

/**
 * 单条删除。**逻辑删除** —— 不删数据行,只是把状态改成"已删除"(`statusId = 7`)。
 *
 * | | 说明 |
 * |---|---|
 * | 错误 | **只有 404**(箱号不存在) |
 * | 列表 | 已删除的自动从列表消失 |
 * | 详情 | 仍然能查到,`statusDescription` 会是"已删除" |
 * | 幂等 | 重复调用也返回成功 |
 *
 * 📌 **历史记录保得住**:装箱结果引用的箱号还在库里,不会变成悬空数据。
 * ⚠️ 但**已删除的集装箱不能再装货** —— 新增/修改装箱结果时传它会 400 `集装箱已删除, 不能装箱`。
 */
export const deleteContainer = no => request.delete(`/containers/${no}`)

/**
 * 批量删除。**宽松语义**(和 5.6 客户、7.6 订单一致):
 * 存在的改成"已删除",不存在的箱号直接忽略,幂等,**没有 404 / 409**,
 * 只有 400(空数组或超过 100 个)。
 *
 * ⚠️ **字段名是 `nos` 不是 `ids`,元素是箱号字符串**(这张表的主键是箱号)。
 *    别的模块都是 `ids`,这里别照抄。
 *
 * ⚠️ axios 的 delete 第二个参数是 config 不是 body,必须包在 config.data 里。
 */
export const batchDeleteContainers = nos =>
  request.delete('/containers/batch', { data: { nos } })
