import request from './request'

/**
 * 订单货物接口(文档第 10 节)。
 *
 * ⚠️ 这一组接口和本项目其他模块的约定**好几处都不一样**,别套用客户 / 订单那套:
 *
 *   |            | 客户 / 订单        | 订单货物                        |
 *   |------------|-------------------|--------------------------------|
 *   | 修改语义    | 整体覆盖,没传的清空 | **两个字段都必填**,没传直接 400 |
 *   | 所属订单    | 可改               | **改不了**(后端根本没有那一列)  |
 *   | 删除        | 逻辑删除            | **物理删除**                    |
 *   | 批量删除    | 宽松,跳过无效的      | **严格**,一条被引用就整批拒绝   |
 */

/**
 * 分页查询订单货物明细。排序按 `id` 升序(订单下的明细行,按录入顺序)。
 *
 * @param {object} [p]
 * @param {number} [p.page=1]         页码,从 1 开始
 * @param {number} [p.size=20]        每页条数,上限 100
 * @param {string} [p.cargoTypeName]  货物名称,**前缀匹配**(和货物种类列表同一套规则)
 * @param {string} [p.orderId]        订单号,**精确匹配** —— 不是前缀,必须整串传
 */
export function fetchCargos({
  page = 1,
  size = 20,
  cargoTypeName,
  orderId,
} = {}) {
  return request.get('/cargos', {
    params: {
      page,
      size,
      // undefined 的 key 会被 axios 丢弃,等价于"不传即不筛选"
      cargoTypeName: cargoTypeName || undefined,
      // ⚠️ 订单号是 19 位字符串,原样传。
      //    千万不要 parseInt —— 末几位会变成 0,而这是精确匹配,那就永远查不到东西。
      orderId: orderId || undefined,
    },
  })
}

/**
 * 新增订单货物。**三个字段全必填**(对应库里那三列都是 not null):
 *
 *   orderId     所属订单号,**字符串**,必须是已存在的订单
 *   cargoTypeId 货物种类 ID,用 9.7 的 `/cargo-types/options` 选
 *   quantity    数量,不能为负
 *
 * 📌 订单号必填意味着**货物必须挂在某个订单下,不能凭空建**。
 *    所以界面上没有"独立的新增入口",而是从订单列表点某张订单的「货物增加」进来,
 *    订单号由那一行带过来,不让用户手填。
 */
export const createCargo = body => request.post('/cargos', body)

/**
 * 修改订单货物。请求体**只有两个字段**:`cargoTypeId` + `quantity`,**两个都必填**。
 *
 * ⚠️ 三点和别的模块不一样:
 *
 * 1. **没有 `orderId`,所属订单改不了。** 不是接口漏了 —— 后端 UPDATE 语句里根本没有
 *    `order_id` 那一列,硬塞也会被忽略。语义上也对:"这条货物属于哪张订单"是它存在的依据。
 *    要换订单只能**把这条删掉,到目标订单下重新加一条**。
 * 2. **两个字段都必填,没传就是 400** —— **不会**像客户 / 订单那样把没传的字段清空。
 *    所以这里不是"整体覆盖"语义,编辑表单按需传两个字段即可。
 * 3. 编辑表单里订单号那一栏应该是**只读**的,别做成可编辑输入框。
 */
export const updateCargo = (id, body) => request.put(`/cargos/${id}`, body)

/**
 * 单条删除。**物理删除** —— 真删数据行,删了就没有了。
 *
 * 409:该货物已被装箱记录引用(`msg: 该货物已被装箱记录引用, 无法删除`)。
 *     📌 文档说明**目前触发不了** —— 装箱结果表是空的,装箱模块还没做。
 */
export const deleteCargo = id => request.delete(`/cargos/${id}`)

/**
 * 批量删除。**严格语义** —— 和货物种类(9.6)一致,和客户 / 订单的"宽松跳过"不同:
 *
 *   - 只要**有一条**被装箱记录引用 → **整批拒绝(409),一条都不删**
 *   - 不存在的 id 忽略(幂等)
 *   - 没有 404,只有 400(空数组,或超过 100 个)
 *
 * 所以收到 409 时列表要保持原样,**不能**当"部分成功"处理。
 *
 * ⚠️ axios 的 delete 第二个参数是 config 不是 body,必须包在 config.data 里。
 */
export const batchDeleteCargos = ids =>
  request.delete('/cargos/batch', { data: { ids } })

/**
 * 货物下拉框(文档 10.6)—— **新增装箱结果时选"装的是哪批货"用**。
 *
 * 两个参数都可选,同时传就是 AND。固定最多返回 **20 条**,不是分页接口。
 *
 * ⚠️ **选项里必须同时显示「货物名称 + 订单号」。**
 *    因为同名的货物可能出现在多张订单里(示例数据里"钢材"就有 4 条,分属不同订单),
 *    只显示"钢材"的话用户根本分不出该选哪一条,**很可能把货装错单**。
 */
export const searchCargoOptions = ({ cargoTypeName, orderId } = {}) =>
  request.get('/cargos/options', {
    params: {
      cargoTypeName: cargoTypeName || undefined,
      orderId: orderId || undefined,
    },
  })
