import request from './request'

/**
 * 系统用户(文档 27 节)。
 *
 * 📌 **`id` 是数据库自增的普通整数**(就是 1、2、3 这样),不像订单号那样有精度问题 ——
 *    **直接当数字用即可**,不需要任何特殊处理。
 *
 *    ⚠️ 早期版本的文档把它写成过"19 位雪花号",后来后端改成自增主键了。
 *    全项目只有**订单号**是大数字符串(后端雪花算法生成,19 位),别混。
 */

/**
 * 分页查询。排序按 `id` **降序**(最新录入的在最前)。
 *
 * @param {object} [p]
 * @param {number} [p.page=1]    页码
 * @param {number} [p.size=20]   每页条数,上限 100
 * @param {string} [p.keyword]   **前缀匹配登录名 / 真实姓名**
 * @param {string} [p.status]    账号状态,精确:`0` 正常 / `1` 冻结 / `2` 已删除
 *
 * ⚠️ **不传 `status` 时,已删除(`status='2'`)的用户不会出现**;显式传 `status=2` 才看得到。
 *    详情接口则**始终能查到**(逻辑删除,行还在)。
 */
export const fetchUsers = ({ page = 1, size = 20, keyword, status } = {}) =>
  request.get('/users', {
    params: {
      page,
      size,
      keyword: keyword || undefined,
      status: status || undefined,
    },
  })

export const fetchUser = id => request.get(`/users/${id}`)

/**
 * 新增。
 *   username  登录名,**必填**、最长 50、**不能重复**
 *   password  **明文密码**,6~64 位(后端用 BCrypt 哈希后落库)—— **只有新增才有这个字段**
 *   realName  真实姓名,最长 100
 *   phone     电话,最长 30
 *   status    不传按 `0` 正常处理
 */
export const createUser = body => request.post('/users', body)

/**
 * 修改。
 *
 * ⚠️ **请求体里没有密码字段** —— 改密码走 `resetUserPassword`。
 *    原因是"整体覆盖"碰上密码会歧义:编辑表单不填密码时,到底是"不改密码"还是"清空密码"?
 *    把密码摘出去,两种语义都不用猜。
 *
 * ⚠️ **`status` 是这个接口里唯一"不传就保持原状"的字段**(其余字段不传会被清空)。
 *    因为状态被写成 null 的账号**既登不进去、也不出现在任何列表里**,等于被静默停用 ——
 *    前端漏传一个字段就出事。所以编辑表单**一定要把 status 带上**。
 */
export const updateUser = (id, body) => request.put(`/users/${id}`, body)

/**
 * 重置密码。**管理员给用户重置,不要求输入旧密码。**
 * @param {string} newPassword 明文新密码,6~64 位
 */
export const resetUserPassword = (id, newPassword) =>
  request.put(`/users/${id}/password`, { newPassword })

/**
 * 单条删除。**逻辑删除** —— 不删行,只是把 `status` 改成 `'2'`(已删除)。
 *
 * | 错误 | 场景 |
 * |---|---|
 * | **409** | **删除内置管理员(id=1)** |
 * | 404 | 该 id 不存在 |
 *
 * 📌 有操作日志引用了它也**不影响删除**(行还在)。
 * 📌 **删掉的用户名不能被重新注册** —— `username` 有唯一约束,而删除是逻辑删除(行还在表里)。
 */
export const deleteUser = id => request.delete(`/users/${id}`)

/**
 * 批量删除。逻辑删除,`ids` 是**数字数组**(自增主键)。
 *
 * ⚠️ **严格语义**:批量里含内置管理员时**整批拒绝**,不做部分删除。
 */
export const batchDeleteUsers = ids => request.delete('/users/batch', { data: { ids } })

/** 下拉框。最多 20 条,**已删除的用户不会出现在候选里** */
export const fetchUserOptions = keyword =>
  request.get('/users/options', { params: { keyword: keyword || undefined } })
