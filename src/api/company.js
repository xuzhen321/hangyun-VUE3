import request from './request'

/**
 * 公司信息(文档 15 节)。
 *
 * 📌 **这是一张通用字典表** —— 箱主、操作方、船东、管理公司都指向它。
 *    目前只有集装箱在用(`ownerId` / `operatorId`),将来船舶模块也会用。
 */

/**
 * 分页查询。
 *
 * @param {object} [p]
 * @param {number} [p.page=1]     页码,从 1 开始
 * @param {number} [p.size=20]    每页条数,上限 100
 * @param {string} [p.keyword]    **前缀匹配,同时匹配「公司名称」和「公司代码」**,任一命中即返回
 *
 * ⚠️ 是前缀匹配:传 `COS` 命中代码 `COSU`,传 `中远` 命中"中远…"开头的公司;
 *    **不命中**名字中间含关键字的(`keyword=海运` 不命中"中远海运")。
 */
export function fetchCompanies({ page = 1, size = 20, keyword } = {}) {
  return request.get('/companies', {
    params: {
      page,
      size,
      keyword: keyword || undefined,
    },
  })
}

/**
 * 下拉框(15.6)—— 给新增集装箱时选**箱主 / 操作方**用。
 * 固定最多返回 20 条,不是分页接口。`keyword` 可传可不传。
 *
 * ⚠️ **选项里必须同时显示「公司名称 + 代码」。**
 *    因为公司名很容易相近("中远海运集装箱运输有限公司" vs "中海集装箱运输有限公司" vs
 *    "中远海运(香港)有限公司"),只显示名称用户分不清选哪个。
 */
export const fetchCompanyOptions = keyword =>
  request.get('/companies/options', { params: { keyword: keyword || undefined } })

export const fetchCompany = id => request.get(`/companies/${id}`)

/**
 * 新增。
 *   name  公司名称,**必填**、不能全空格、最长 100
 *   code  公司代码(箱主代码,如 `COSU`),可空、最长 20
 *
 * ⚠️ **两个字段在库里都没有唯一约束** —— 允许重名、也允许代码重复。
 *    新增时后端不查重、不报错,**前端也不要自作聪明加本地查重**。
 */
export const createCompany = body => request.post('/companies', body)

/** 修改。**整体覆盖**(没传的字段会被置 null),编辑表单要完整回填 */
export const updateCompany = (id, body) => request.put(`/companies/${id}`, body)

/**
 * 删除。**物理删除**,没有批量删除(15 节只有单条 DELETE)。
 *
 * 409:还有集装箱把它当箱主或操作方。
 *     📌 **两个字段都会查** —— 只要被任意一个集装箱的 `ownerId` **或** `operatorId` 指着就删不掉。
 *     msg 形如 `该公司被 3 个集装箱引用(箱主或操作方), 无法删除`。
 */
export const deleteCompany = id => request.delete(`/companies/${id}`)
