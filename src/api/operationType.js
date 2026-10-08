import request from './request'

/**
 * 操作类型(文档 28 节)。操作日志的"类型"就是这张表。
 *
 * ⚠️⚠️ **这张表是固定的,只有「查询」和「修改」,没有新增、没有删除。**
 *
 * 文档原话:它只有 5 行,代码里的操作日志就是按这几个 id 记的 ——
 * **删一行会让新日志的"操作类型"列变空白(而且不报错),加一行则没有任何代码会用上。**
 * 所以这个文件里**没有 create / remove**,页面上也不该有"新增""删除"按钮。
 *
 * ⚠️ **`type` 存的是英文**(`INSERT` / `UPDATE` / `DELETE` / `EXPORT` / `LOGIN`),
 *    它会**原样显示**在操作日志的"操作类型"列里 ——
 *    前端**不做中文翻译**(按产品口径,直接显示原值)。
 */

/** 分页。`keyword` 前缀匹配类型名 */
export const fetchOperationTypes = ({ page = 1, size = 20, keyword } = {}) =>
  request.get('/operation-types', {
    params: { page, size, keyword: keyword || undefined },
  })

/** 下拉框:一次性返回全部 */
export const fetchAllOperationTypes = () => request.get('/operation-types/options')

export const fetchOperationType = id => request.get(`/operation-types/${id}`)

/**
 * 修改名称。`type` 必填、最长 50、**不能重复**。
 *
 * 📌 **只改展示文字,不影响历史日志的语义** ——
 *    `Log.type_id` 存的是 id,查询时按 id 去 JOIN 名称。
 *    所以改完名字,所有历史记录的"操作类型"列都会跟着显示新名字。
 */
export const updateOperationType = (id, body) =>
  request.put(`/operation-types/${id}`, body)
