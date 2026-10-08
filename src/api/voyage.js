import request from './request'

/**
 * 航次(文档 20 节)。
 *
 * 物流事件(19 节)的 `voyageId` 指向它 —— 所以事件表单里那个航次下拉用的就是本模块的列表接口。
 */

/**
 * 分页查询。排序按 `id` 降序。
 *
 * @param {object} [p]
 * @param {number} [p.page=1]         页码,从 1 开始
 * @param {number} [p.size=20]        每页条数,上限 100
 * @param {string} [p.no]             航次号,**前缀匹配**(如 `2026E`)
 * @param {number} [p.loadingPortId]  起始港口 ID,精确匹配
 *
 * 📌 返回里除了 `no` / `vslId` / 两个港口 id,还有后端组装好的
 *    `loadingPortName` / `dischargePortName`,直接用。
 *
 * ⚠️ **`vslId` 目前没有任何校验,返回里也拿不到船名**(只有裸 id)—— 船舶模块还没做。
 *    所以航次下拉里显示不了船名,别指望。
 */
export const fetchVoyages = ({ page = 1, size = 20, no, loadingPortId } = {}) =>
  request.get('/voyages', {
    params: {
      page,
      size,
      no: no || undefined,
      loadingPortId: loadingPortId ?? undefined,
    },
  })

/** 详情。不存在时 404(msg: 航次不存在) */
export const fetchVoyage = id => request.get(`/voyages/${id}`)

/**
 * 新增 / 修改。四个字段**全可选**:
 *
 *   no              航次号(如 `2026E001`),最长 20
 *   vslId           船舶 ID —— **见下方警告**
 *   loadingPortId   起始港口,必须是已存在的港口
 *   dischargePortId 目的港口,同上
 *
 * ⚠️ `no` 在库里**没有唯一约束,后端不查重** —— 所以前端也**不要**做本地查重。
 *
 * ⚠️ **`vslId` 是个"半成品"字段:** 它指向 `vessel` 表,但**船舶模块还没做、表是空的**,
 *    所以后端**既不校验它、返回里也拿不到船名**(只有裸 id)。
 *    界面上因此只能填一个数字 id —— 没有下拉可选,填错了也不会报错。
 *    等船舶模块做完再补下拉。
 */
export const createVoyage = body => request.post('/voyages', body)

export const updateVoyage = (id, body) => request.put(`/voyages/${id}`, body)

/**
 * 删除。**物理删除**,没有批量删除。
 *
 * 409:还有物流事件挂在这个航次上,
 *      msg 形如 `该航次下存在 3 条物流事件, 无法删除`。
 */
export const deleteVoyage = id => request.delete(`/voyages/${id}`)
