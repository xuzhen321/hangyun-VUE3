import request from './request'

/**
 * 国家字典(文档 21 节)。
 *
 * 📌 **共用表** —— 船舶的"船旗国"和港口的"所在国家"用的是同一张表、同一组接口。
 *    所以删除时会**同时查船舶和港口两处引用**,两处都干净才允许删。
 */

/** 分页。`keyword` 前缀匹配**代码 / 中文名 / 英文名** */
export const fetchCountries = ({ page = 1, size = 20, keyword } = {}) =>
  request.get('/countries', {
    params: { page, size, keyword: keyword || undefined },
  })

/**
 * 下拉框(21 节)—— 给船舶选船旗国、给港口选所在国家用。
 *
 * ⚠️ **最多 20 条,不是"全量"** —— 所以表单里要做**远程搜索**,不能像港口那几个字典一样缓存全量。
 */
export const fetchCountryOptions = keyword =>
  request.get('/countries/options', { params: { keyword: keyword || undefined } })

export const fetchCountry = id => request.get(`/countries/${id}`)

/**
 * 新增 / 修改。
 *   countryCode   国家代码(如 `CN`),**必填、唯一**
 *   countryCnname 中文名,可空
 *   countryEnname 英文名,可空
 */
export const createCountry = body => request.post('/countries', body)
export const updateCountry = (id, body) => request.put(`/countries/${id}`, body)

/**
 * 删除。**物理删除**,没有批量删除。
 *
 * 409:被引用 —— **船舶的船旗国 或 港口的所在国家**,两处都会查。
 *      msg 形如 `该国家被 3 条记录引用(船舶船旗国或港口所在国家), 无法删除`。
 */
export const deleteCountry = id => request.delete(`/countries/${id}`)
