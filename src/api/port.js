import request from './request'

/**
 * 港口搜索(8.1 / 24.5)—— 下单时选起运港/目的港、航次选起始/目的港、物流事件选发生地都用它。
 *
 * `keyword` **前缀匹配**「五字码 / 中文名 / 英文名」三个字段,任一命中即返回,最多 20 条。
 * 不是分页接口:data 直接是数组,不接受 page/size。
 *
 * ⚠️ **已删除的港口(`state='3'`)不会出现在候选里。**
 *
 * ⚠️ 港口数据来自 `port-data.sql`。库里没装这个文件的话返回**空数组** —— 不是接口坏了。
 */
export const searchPorts = keyword =>
  request.get('/ports/options', { params: { keyword: keyword || undefined } })

// ===========================================================================
// 港口本身的增删改(文档 24 节)
// ===========================================================================

/**
 * 分页查询。排序按 `id` 升序。
 *
 * @param {object} [p]
 * @param {number} [p.page=1]      页码
 * @param {number} [p.size=20]     每页条数,上限 100
 * @param {string} [p.keyword]     **前缀匹配五字码 / 中文名 / 英文名**
 * @param {number} [p.countryId]   国家 ID,精确
 *
 * ⚠️ **已删除的港口(`state='3'`)永远不出现在列表里**,跟传不传 countryId 都无关
 *    (下拉框也是同样口径)。只有详情还查得到。
 */
export const fetchPorts = ({ page = 1, size = 20, keyword, countryId } = {}) =>
  request.get('/ports', {
    params: {
      page,
      size,
      keyword: keyword || undefined,
      countryId: countryId ?? undefined,
    },
  })

/** 详情。不存在时 404。📌 **已删除的港口详情仍然能查到**(逻辑删除,行还在),state 是 '3' */
export const fetchPort = id => request.get(`/ports/${id}`)

/**
 * 新增 / 修改。
 *
 * ⚠️ **`state` 不在请求体里** —— 它由后端维护(新增 `0`、删除 `3`)。
 *    所以前端**改不了一个港口的删除状态**,也就不会误把已删除的港口"复活"。
 */
export const createPort = body => request.post('/ports', body)
export const updatePort = (id, body) => request.put(`/ports/${id}`, body)

/**
 * 删除。**逻辑删除** —— 不删行,只是把 `state` 改成 `'3'`。
 *
 * | | 说明 |
 * |---|---|
 * | 错误 | **只有 404** |
 * | 列表 / 下拉 | 自动消失 |
 * | 详情 | 仍然查得到,`state` 是 `'3'` |
 * | 引用 | 订单/物流事件/航次引用了它**也不影响删除**(行还在,引用不会悬空) |
 * | 幂等 | 重复调用返回成功 |
 *
 * 📌 **没有批量删除接口。**
 */
export const deletePort = id => request.delete(`/ports/${id}`)
