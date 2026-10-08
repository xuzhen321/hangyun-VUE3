import request from './request'

/**
 * 提空箱登记(文档 17 节)。
 * "**哪个拖车把哪个空箱提进场、什么时候出场**"。
 */

/**
 * 分页查询。四个条件都可选,同时传就是 AND。**排序按进场时间降序**(最近提箱的排最前)。
 *
 * @param {object} [p]
 * @param {number} [p.page=1]            页码,从 1 开始
 * @param {number} [p.size=20]           每页条数,上限 100
 * @param {string} [p.containerNo]       箱号,**前缀匹配**
 * @param {string} [p.trackNo]           拖车号,**前缀匹配**
 * @param {string} [p.dcInDateFrom]      进场时间下界(含)
 * @param {string} [p.dcInDateTo]        进场时间上界(含)
 */
export const fetchContainerTrailerRecords = ({
  page = 1,
  size = 20,
  containerNo,
  trackNo,
  dcInDateFrom,
  dcInDateTo,
} = {}) =>
  request.get('/container-trailer-records', {
    params: {
      page,
      size,
      containerNo: containerNo || undefined,
      trackNo: trackNo || undefined,
      dcInDateFrom: dcInDateFrom || undefined,
      dcInDateTo: dcInDateTo || undefined,
    },
  })

export const fetchContainerTrailerRecord = id =>
  request.get(`/container-trailer-records/${id}`)

/**
 * 新增。
 *   containerNo  箱号,**必填**,必须是已存在的集装箱(用 12.7 的下拉框选)
 *   trackNo      拖车号,**必填**,必须是已存在的拖车(用 16 的下拉框选)
 *   dcInDate     进场时间,可空
 *   dcOutDate    出场时间,可空
 *   useNote      箱使用备注,可空、最长 255
 *
 * ⚠️ 箱号指向的集装箱**已删除**时会 400 `集装箱已删除, 不能登记提空箱: xxx` ——
 *    逻辑删除的箱子还在库里,所以能指到,但不能再登记。
 */
export const createContainerTrailerRecord = body =>
  request.post('/container-trailer-records', body)

/** 修改。请求体同新增 */
export const updateContainerTrailerRecord = (id, body) =>
  request.put(`/container-trailer-records/${id}`, body)

/**
 * 单条删除。**物理删除**,而且**没有引用保护** —— 没有别的表引用它,
 * 所以只要 id 存在就一定删得掉。错误只有 404。
 * 正因为删了就回不来,前端**必须加确认弹窗**。
 */
export const deleteContainerTrailerRecord = id =>
  request.delete(`/container-trailer-records/${id}`)

/**
 * 批量删除。**宽松语义**:存在的删掉、不存在的忽略、幂等,
 * 没有 404 / 409,只有 400(空数组或超 100 个)。
 *
 * ⚠️ 字段名是普通的 **`ids`**(记录 id 是自增数字),和集装箱那种 `nos` 不一样。
 */
export const batchDeleteContainerTrailerRecords = ids =>
  request.delete('/container-trailer-records/batch', { data: { ids } })
