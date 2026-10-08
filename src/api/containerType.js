import request from './request'

/**
 * 集装箱箱型字典(文档 13 节)。给新增集装箱时"箱型"那一栏用的字典。
 *
 * 一条记录是"**类别 + 尺寸**"的组合:`type`(如"普通箱")+ `size`(如"40英尺")。
 * 返回里是两个**分开的字段**,要拼着显示时前端自己拼(如"普通箱 / 40英尺")。
 */

/** 分页。只接受 page/size —— 字典表数据量小,没有关键字搜索 */
export const fetchContainerTypePage = ({ page = 1, size = 20 } = {}) =>
  request.get('/container-types', { params: { page, size } })

/** 下拉框专用:一次性返回全部,不分页、不截断(给集装箱表单的"箱型"用) */
export const fetchAllContainerTypes = () => request.get('/container-types/options')

export const fetchContainerType = id => request.get(`/container-types/${id}`)

/**
 * 新增。
 *   type  箱型类别,**必填**、不能为空、最长 50
 *   size  箱尺寸,可空、最长 20
 *
 * ⚠️ **这两个字段在库里都没有唯一约束,所以允许存在重复的箱型**
 *    (比如两条都叫"普通箱 / 40英尺")。新增时后端不查重、也不会报错 ——
 *    前端也**不要**做本地查重,那是给用户添堵(字典表本来就允许重名)。
 */
export const createContainerType = body => request.post('/container-types', body)

/** 修改。整体覆盖语义,字段同新增 */
export const updateContainerType = (id, body) =>
  request.put(`/container-types/${id}`, body)

/**
 * 删除。**没有批量删除**(13 节只有单条 DELETE)。
 *
 * 409:还有集装箱在用这个箱型,`msg` 形如 `该箱型下存在 3 个集装箱, 无法删除`。
 */
export const deleteContainerType = id => request.delete(`/container-types/${id}`)
