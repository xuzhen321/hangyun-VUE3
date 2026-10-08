import request from './request'

/**
 * 船舶(文档 23 节)。
 *
 * ⚠️ **一个字段名陷阱:返回里叫 `shipname`**(全小写,不是 `name`)——
 *    文档专门标了"注意字段名叫 `shipname`,不是 `name`"。
 *    但**提交时用的是 `name`**。读和写不同名,别混。
 *
 * ⚠️ **`gt` / `nt` / `dwt` / `length` / `width` 来自"船型"** ——
 *    它们描述的是这个**型号**的规格,不是这条船的实际参数,所以同型号的船这几项会一样。
 *    它们是**只读的**(不在提交字段里),改船型才会变。
 */

/**
 * 分页查询。排序按 `id` 升序。
 *
 * @param {object} [p]
 * @param {number} [p.page=1]          页码
 * @param {number} [p.size=20]         每页条数,上限 100
 * @param {string} [p.keyword]         **前缀匹配船名 / MMSI / IMO**
 * @param {number} [p.countryId]       船旗国 ID,精确
 * @param {number} [p.vesselTypeId]    船舶类型 ID,精确
 */
export const fetchVessels = ({
  page = 1,
  size = 20,
  keyword,
  countryId,
  vesselTypeId,
} = {}) =>
  request.get('/vessels', {
    params: {
      page,
      size,
      keyword: keyword || undefined,
      countryId: countryId ?? undefined,
      vesselTypeId: vesselTypeId ?? undefined,
    },
  })

/**
 * 下拉框(23.5)—— **给新增航次选船用**。
 * 返回 `[{ id, shipname, mmsi }]`,最多 20 条,`keyword` 前缀匹配船名 / MMSI。
 *
 * ⚠️ **选项里要同时显示「船名 + MMSI」** ——
 *    船名可能相近(同一个船东旗下多条"××之星"),MMSI 是船舶的全球唯一识别码,用来消歧。
 */
export const fetchVesselOptions = keyword =>
  request.get('/vessels/options', { params: { keyword: keyword || undefined } })

export const fetchVessel = id => request.get(`/vessels/${id}`)

/**
 * 新增 / 修改。
 *   `name`              船名,**必填**、最长 100 —— **提交时叫 `name`,返回里叫 `shipname`**
 *   `vesselTypeId`      船型,**必填**(22 节的下拉)
 *   `countryId`         船旗国,**必填**(21 节的下拉)
 *   `buildYear`         **必填**,1900 ~ 2100
 *   `ownerCompanyId`    船东,**必填**(15.6 的公司下拉)
 *   `managerCompanyId`  管理公司,**必填**(同上)
 *   `mmsi` / `imo` / `callsign`   **必填**,而且**不能和别的船重复**(分别查,任意一个撞了都 409)
 *
 * ⚠️ **必填项比看上去多** —— 文档专门解释了原因:列表里那些列不允许空白,
 *    而它们要么靠这几个外键联出来、要么是 vessel 表自己的列:
 *    船型 → 船舶类型 + 总吨净吨载重吨长宽(六列);船旗国 → 船旗国列;
 *    船东/管理公司 → 那两列 + 各自的代码列;建造年份 → 它自己。
 *
 * ⚠️ **船东 / 管理公司还必须是"已填公司代码"的公司** ——
 *    传一个没填 `code` 的公司会 400「船东必须填写公司代码」。
 *    界面上直接把没代码的公司从下拉里滤掉了。
 *
 * ⚠️ **MMSI / IMO / 呼号也是必填的** —— 曾经是可选的,后来改成了"不能留空"。
 *    它们是船舶的全球识别码,真实船舶必有,也是区分名称相近的船的依据。
 *    三项**全库唯一**,所以既不能空、也不能和别的船撞。
 *
 * 📌 **修改(PUT)也是整体覆盖**,少传一个就清成 null,所以必填项和新增完全一样。
 * 📌 一句话:**9 个字段全是必填**。
 */
export const createVessel = body => request.post('/vessels', body)
export const updateVessel = (id, body) => request.put(`/vessels/${id}`, body)

/**
 * 单条删除。**物理删除**(和集装箱不一样,集装箱是逻辑删除),所以删了就没有了。
 *
 * 409:被航次引用,msg 形如 `该船被 2 个航次引用, 无法删除`。
 */
export const deleteVessel = id => request.delete(`/vessels/${id}`)

/**
 * 批量删除。**严格语义**:只要**有一艘被航次引用,整批都不删**(409),
 * `msg` 里会列出是哪几艘:`以下船舶被航次引用, 无法删除: 中远海运之星、马士基哥本哈根`。
 *
 * 📌 所以收到 409 时列表要保持原样,**不能**当"部分成功"处理。
 *
 * ⚠️ axios 的 delete 第二个参数是 config 不是 body,必须包在 config.data 里。
 */
export const batchDeleteVessels = ids =>
  request.delete('/vessels/batch', { data: { ids } })
