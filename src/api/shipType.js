import request from './request'

/**
 * 船舶类型字典(文档 22 节)。
 *
 * 📌 **字段名用小写**:库里那三列是带引号的大写 `"GT"` / `"NT"` / `"DWT"`
 *    (POSTGRES 大小写敏感列名),但**接口层统一给小写**,前端按小驼峰取即可。
 */

/** 分页。`keyword` 前缀匹配类型名 */
export const fetchShipTypes = ({ page = 1, size = 20, keyword } = {}) =>
  request.get('/ship-types', {
    params: { page, size, keyword: keyword || undefined },
  })

/**
 * 下拉框(22 节)—— 给船舶选船型用。
 *
 * ⚠️ 文档**没说它会不会截断**。所以按"可能截断"处理:
 *    表单里做成**远程搜索**(远程搜索在两种情况下都能用,而"缓存全量"只在真全量时才对)。
 */
export const fetchShipTypeOptions = keyword =>
  request.get('/ship-types/options', { params: { keyword: keyword || undefined } })

export const fetchShipType = id => request.get(`/ship-types/${id}`)

/**
 * 新增 / 修改。
 *   type   类型名称(如"集装箱船")
 *   gt / nt / dwt       总吨 / 净吨 / 载重吨(最多 10 位整数 + 2 位小数)
 *   length / width      长度 / 宽度(最多 6 位整数 + 2 位小数)
 *
 * ⚠️ **六个字段全是必填** —— 之前那五个数值是可选的,后来改成必填了。
 *    原因:船舶列表里的「总吨 / 净吨 / 载重吨 / 长度 / 宽度」五列是从**船型**联出来的,
 *    船型不填,挂这个船型的**每一条船**那五列都会是空白,所以约束放在船型这一层。
 *
 * 📌 这几个数值是**该类船的典型规格(参考值)**,不是具体某条船的参数。
 */
export const createShipType = body => request.post('/ship-types', body)
export const updateShipType = (id, body) => request.put(`/ship-types/${id}`, body)

/**
 * 删除。**物理删除**,没有批量删除。
 * 409:有船舶在用该船型,msg 形如 `该船型下存在 3 艘船, 无法删除`。
 *      ⚠️ 那个数字包含已删除的船舶,别拿列表条数去对。
 */
export const deleteShipType = id => request.delete(`/ship-types/${id}`)
