import request from './request'

/**
 * 拖车管理(文档 16 节)。"**哪个拖车、司机是谁**" ——
 * 提空箱登记(17 节)要引用拖车号,所以先得有这张表。
 *
 * ⚠️ **主键是拖车号 `no`(字符串),不是自增 id** —— 路径里是 `/{no}`,
 *    而且**由前端提供**(和箱号一样是业务标识,不是后端生成的)。
 */

/**
 * 分页查询。排序按文档未说明(按后端默认)。
 *
 * @param {object} [p]
 * @param {number} [p.page=1]     页码,从 1 开始
 * @param {number} [p.size=20]    每页条数,上限 100
 * @param {string} [p.keyword]    **前缀匹配,同时匹配「拖车号」和「司机姓名」**
 */
export const fetchTrailers = ({ page = 1, size = 20, keyword } = {}) =>
  request.get('/trailers', {
    params: {
      page,
      size,
      keyword: keyword || undefined,
    },
  })

/**
 * 下拉框(16 节)—— **给提空箱登记选拖车用**。
 * 返回 `[{ no, name }]`,固定最多 20 条。
 *
 * ⚠️ **选项里要同时显示「拖车号 + 司机姓名」** ——
 *    同一车队车多,光看车牌不一定记得是谁在开。
 */
export const fetchTrailerOptions = keyword =>
  request.get('/trailers/options', { params: { keyword: keyword || undefined } })

export const fetchTrailer = no => request.get(`/trailers/${no}`)

/**
 * 新增。
 *   no     拖车号(车牌),**必填**、最长 30、不能重复
 *   name   司机姓名,可空、最长 50
 *   phone  联系电话,可空、最长 30
 */
export const createTrailer = body => request.post('/trailers', body)

/**
 * 修改。**不能改拖车号** —— 它是主键,前端编辑表单里那一栏应该置灰。
 * (和 12.4 的箱号一样:硬塞进请求体也不会报错,会被安静忽略。)
 */
export const updateTrailer = (no, body) => request.put(`/trailers/${no}`, body)

/**
 * 删除。**物理删除**,没有批量删除。
 *
 * 409:还有提空箱记录用了这个拖车,
 *      msg 形如 `该拖车已被 3 条提空箱记录引用, 无法删除`。
 */
export const deleteTrailer = no => request.delete(`/trailers/${no}`)
