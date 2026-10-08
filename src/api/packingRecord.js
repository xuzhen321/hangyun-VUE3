import request from './request'

/**
 * 货物装箱结果接口(文档第 11 节,路径 `/cargo-container-results`)。
 *
 * 语义是"哪一批货物装进了哪个集装箱、装了多少" —— 货物和集装箱之间的装箱关系。
 *
 * ⚠️ **批量删除的语义是本项目里的第三种组合**,别照搬前面任何一个模块:
 *
 * |                    | 宽松 / 严格        | 删除方式   |
 * |--------------------|-------------------|-----------|
 * | 客户 / 订单         | 宽松(跳过无效的)   | 逻辑删除   |
 * | 货物种类 / 订单货物  | **严格**(整批拒绝) | **物理删除** |
 * | **装箱结果**        | **宽松**           | **物理删除** |
 *
 * 原因:这张表**没有被别的表引用**,所以没有 409 保护 ——
 * 既不会因为数据冲突整批失败(宽松),又不像客户/订单那样能找回来(物理删除)。
 */

/**
 * 分页查询装箱记录。三个条件都可选,同时传就是 AND。排序按 `id` 升序。
 *
 * @param {object} [p]
 * @param {number} [p.page=1]           页码,从 1 开始
 * @param {number} [p.size=20]          每页条数,上限 100
 * @param {string} [p.cargoTypeName]    货物名称,**前缀匹配**
 * @param {string} [p.orderId]          订单号,**精确匹配**,整串传
 * @param {string} [p.containerNo]      集装箱号,**精确匹配**,整串传(箱号是标识符,不是前缀)
 */
export function fetchPackingRecords({
  page = 1,
  size = 20,
  cargoTypeName,
  orderId,
  containerNo,
} = {}) {
  return request.get('/cargo-container-results', {
    params: {
      page,
      size,
      cargoTypeName: cargoTypeName || undefined,
      // ⚠️ 订单号是 19 位字符串,原样传;精确匹配,转了数字就永远查不到
      orderId: orderId || undefined,
      containerNo: containerNo || undefined,
    },
  })
}

/** 详情。不存在时 404(msg: 装箱记录不存在) */
export const fetchPackingRecord = id => request.get(`/cargo-container-results/${id}`)

/**
 * 新增。**三个字段全必填**(库里那三列都是 not null):
 *
 *   cargoId     货物 ID —— 新增入口放在订单货物页,由那一行的 cargoId 带过来
 *   containerNo 集装箱号,不能为空、不能全空格、最长 30
 *   quantity    装入数量,不能为负
 */
export const createPackingRecord = body =>
  request.post('/cargo-container-results', body)

/**
 * 修改。请求体同新增,**三个字段都必填**。
 *
 * ⚠️ 这是"整体覆盖"的**另一种含义**:不是"没传就清空",而是**没传直接 400**
 *    —— 因为库里那三列是 not null。所以表单必须把三个字段都带上。
 *    (和 10.3 订单货物是同一类,别套用客户/订单那套"可以留空"的理解。)
 */
export const updatePackingRecord = (id, body) =>
  request.put(`/cargo-container-results/${id}`, body)

/**
 * 单条删除。**物理删除**,删掉就真的没了。
 *
 * 📌 这张表**没有被别的表引用**,所以**没有 409 保护** —— 只要 id 存在就一定删得掉。
 *    错误只有 404。正因为删了就回不来,前端**必须加确认弹窗**。
 */
export const deletePackingRecord = id =>
  request.delete(`/cargo-container-results/${id}`)

/**
 * 批量删除。**宽松语义 + 物理删除**(见文件头的对照表)。
 *
 *   - 存在的删掉,不存在的忽略,**幂等**
 *   - 没有 404,只有 400(空数组,或超过 100 个)
 *   - 不会因为数据冲突整批失败
 *
 * ⚠️ 但"宽松"只指"不会整批失败",**不代表删错了能找回来** —— 这是物理删除。
 *    所以确认弹窗必须写清楚不可恢复。
 *
 * ⚠️ axios 的 delete 第二个参数是 config 不是 body,必须包在 config.data 里。
 */
export const batchDeletePackingRecords = ids =>
  request.delete('/cargo-container-results/batch', { data: { ids } })
