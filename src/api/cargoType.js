import request from './request'

/**
 * 货物种类接口(文档第 9 节)。标准 CRUD + 批量删除。
 *
 * ⚠️ 和客户 / 订单最根本的区别:**这里是物理删除**(真删数据行),不是改状态。
 *    所以删掉就找不回来了,界面上也**没有"恢复"**。
 */

/**
 * 分页查询。排序按 `id` 升序(和客户/订单的降序相反)。
 *
 * @param {object} [p]
 * @param {number} [p.page=1]   页码,从 1 开始
 * @param {number} [p.size=20]  每页条数,上限 100
 * @param {string} [p.name]     货物名称,**前缀匹配**(同客户列表,只能从开头匹配)
 */
export function fetchCargoTypes({ page = 1, size = 20, name } = {}) {
  return request.get('/cargo-types', {
    params: {
      page,
      size,
      // undefined 的 key 会被 axios 丢弃,等价于"不传即不筛选"
      name: name || undefined,
    },
  })
}

/** 详情。不存在时 404(msg: 货物种类不存在) */
export const fetchCargoType = id => request.get(`/cargo-types/${id}`)

/**
 * 新增。
 *   name        必填、不能全空格、最长 100
 *   description 可空、最长 255
 *   weightKg / volumeM3  可空、不能为负、最多 8 位整数 + 2 位小数
 */
export const createCargoType = body => request.post('/cargo-types', body)

/** 修改。**整体覆盖**语义:没传的字段会被置 null,编辑表单要完整回填 */
export const updateCargoType = (id, body) => request.put(`/cargo-types/${id}`, body)

/**
 * 单条删除。**物理删除** —— 真删数据行,删了就没有了。
 *
 * 409:该种类下还有货物,`msg` 形如 `该货物种类下还有货物, 无法删除: 钢材`。
 */
export const deleteCargoType = id => request.delete(`/cargo-types/${id}`)

/**
 * 批量删除。
 *
 * ⚠️⚠️ **语义是"严格"的,和客户(5.6)、订单(7.6)的宽松语义相反:**
 *
 *   | | 客户 / 订单 | 货物种类 |
 *   |---|---|---|
 *   | 删除方式 | 逻辑删除 | **物理删除** |
 *   | 有不存在的 id | 忽略 | 忽略(幂等) |
 *   | 有被引用的记录 | 不适用 | **整批拒绝,一条都不删(409)** |
 *
 * 所以前端**绝不能**当"部分成功"处理:收到 409 就是**一条都没删**,
 * 列表保持原样,把那几个被引用的种类名原样提示给用户,让他去掉后重新提交。
 * 409 的 msg 形如 `以下货物种类下还有货物, 无法删除: 钢材、木材`。
 *
 * ⚠️ axios 的 delete 第二个参数是 config 不是 body:
 *    写成 request.delete(url, { ids }) 的话 body 根本发不出去,必须包在 config.data 里。
 */
export const batchDeleteCargoTypes = ids =>
  request.delete('/cargo-types/batch', { data: { ids } })
