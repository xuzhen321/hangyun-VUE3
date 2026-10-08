import request from './request'

/**
 * 操作日志(文档 29 节)。
 *
 * ⚠️ **只读** —— 没有增删改接口(审计记录只进不出,能改能删就失去意义了)。
 *    日志由后端在业务操作时**自动记录**,前端不需要调任何接口去写。
 */

/**
 * 分页查询。排序按 `operationTime` **降序**(最近发生的在最前)。
 *
 * @param {object} [p]
 * @param {number} [p.page=1]              页码
 * @param {number} [p.size=20]             每页条数,上限 100
 * @param {number} [p.userId]              操作人 ID,精确(数据库自增的普通整数)
 * @param {number} [p.operationTypeId]     操作类型 ID,精确(28 节的下拉)
 * @param {string} [p.targetTable]         目标表名,精确,如 `voyage`
 * @param {string} [p.resultStatus]        执行结果,精确:`1` 成功 / `0` 失败
 * @param {string} [p.operationTimeFrom]   操作时间下界(含)
 * @param {string} [p.operationTimeTo]     操作时间上界(含)
 * @param {string} [p.keyword]             **模糊匹配操作人姓名 / 目标记录主键**
 */
export const fetchLogs = ({
  page = 1,
  size = 20,
  userId,
  operationTypeId,
  targetTable,
  resultStatus,
  operationTimeFrom,
  operationTimeTo,
  keyword,
} = {}) =>
  request.get('/logs', {
    params: {
      page,
      size,
      // userId 是自增的普通整数,原样传
      userId: userId || undefined,
      operationTypeId: operationTypeId ?? undefined,
      targetTable: targetTable || undefined,
      resultStatus: resultStatus || undefined,
      operationTimeFrom: operationTimeFrom || undefined,
      operationTimeTo: operationTimeTo || undefined,
      keyword: keyword || undefined,
    },
  })

/** 详情。不存在时 404 */
export const fetchLog = id => request.get(`/logs/${id}`)
