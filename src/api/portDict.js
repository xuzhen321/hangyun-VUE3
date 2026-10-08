import request from './request'

/**
 * 港口的五个小字典(文档 25 节):区域 / 时区 / 尺寸 / 级别 / 类型。
 *
 * 文档自己说了"它们的接口形状完全一样",所以这里也**不用写五遍** ——
 * 一个工厂、五份路径即可。每个资源都是同一套六个接口:
 *
 *   分页 / options(下拉) / 详情 / 新增 / 修改 / 删除
 *
 * 📌 `keyword` 只有**区域 / 时区 / 尺寸 / 类型**支持;**级别**没有(数字做前缀搜索没意义)。
 *    这里统一带上,级别那边不传就是了(多传一个后端不认识的可选参数也没关系 ——
 *    但更稳妥的做法是级别页根本不配 search,所以压根不会传)。
 */
function createPortDictApi(base) {
  return {
    /** 分页。`keyword` 前缀匹配各自的业务字段 */
    fetchPage: ({ page = 1, size = 20, keyword } = {}) =>
      request.get(base, {
        params: { page, size, keyword: keyword || undefined },
      }),

    /** 下拉框:一次性返回全部,不分页、不截断 */
    fetchAll: () => request.get(`${base}/options`),

    fetchOne: id => request.get(`${base}/${id}`),

    create: body => request.post(base, body),
    update: (id, body) => request.put(`${base}/${id}`, body),

    /**
     * 删除。**有港口在用就 409**,msg 形如 `该区域下有 3 个港口, 无法删除`。
     *
     * ⚠️ 那个数字**包含已逻辑删除的港口** —— 所以会出现"列表里一个港口都看不见,
     *    删这个区域照样 409"。不是算错,是全项目统一口径。
     */
    remove: id => request.delete(`${base}/${id}`),
  }
}

export const areaApi = createPortDictApi('/areas')
export const timezoneApi = createPortDictApi('/timezones')
export const harborSizeApi = createPortDictApi('/harbor-sizes')
export const portLevelApi = createPortDictApi('/port-levels')
export const portTypeApi = createPortDictApi('/port-types')
