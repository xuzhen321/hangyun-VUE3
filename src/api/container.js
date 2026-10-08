import request from './request'

/**
 * 集装箱接口(文档第 12 节)。
 *
 * ⚠️ 本轮**只用到 12.1 的分页查询**,而且是作为"箱号下拉框"用的 ——
 *    因为 11.3 要求装箱登记的 `containerNo` **必须是已存在的集装箱**,
 *    传一个库里没有的箱号会 400「集装箱不存在」,所以不能做成自由文本输入。
 *
 * 集装箱本身的增删改(12.3~12.6)本轮没做。
 */

/**
 * 分页查询集装箱。排序按 `no` 升序(箱号字典序)。
 *
 * @param {object} [p]
 * @param {number} [p.page=1]   页码,从 1 开始
 * @param {number} [p.size=20]  每页条数,上限 100
 * @param {string} [p.no]       箱号,**前缀匹配**(传 `SEGU` 能筛出该箱主的所有箱)
 * @param {number} [p.status]   集装箱状态 ID,精确匹配
 *
 * 📌 注意 `no` 是**前缀匹配**,和装箱结果那边的 `containerNo`(精确匹配)**不一样** ——
 *    同一个概念在两处的匹配方式不同,别混。
 */
export const fetchContainers = ({ page = 1, size = 20, no, status } = {}) =>
  request.get('/containers', {
    params: {
      page,
      size,
      no: no || undefined,
      status: status ?? undefined,
    },
  })
