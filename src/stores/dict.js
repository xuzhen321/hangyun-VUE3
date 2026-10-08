import { defineStore } from 'pinia'
import { fetchAllCustomerStatuses } from '@/api/customerStatus'
import { fetchAllOrderStatuses } from '@/api/orderStatus'
import { fetchAllContainerTypes } from '@/api/containerType'
import { fetchAllContainerStatuses } from '@/api/containerStatus'

/**
 * 字典缓存 —— 四个字典各实例化一次。
 *
 * 字典会被多处消费(列表页的筛选下拉、表单里的下拉、字典管理页自己),数据量极小,
 * 所以做单例缓存 + 变更后 refresh,而不是每个页面各拉一次
 * (否则不同页面的下拉可能短暂不一致)。
 *
 * @param {string}   storeId  唯一 id
 * @param {Function} fetchAll 拉全量的接口(`/xxx/options` 或 `/xxx/all`)
 * @param {Function} labelOf  把一条记录拼成下拉显示文案,默认取 description
 */
function createDictStore(storeId, fetchAll, labelOf = i => i.description) {
  return defineStore(storeId, {
    state: () => ({
      list: [],
      loaded: false,
      _inflight: null, // 并发去重用的 promise
    }),

    getters: {
      options: state => state.list.map(i => ({ value: i.id, label: labelOf(i) })),
    },

    actions: {
      async load(force = false) {
        if (this.loaded && !force) return this.list
        if (this._inflight) return this._inflight // 并发去重:多个组件同时 onMounted 只发一次请求
        this._inflight = fetchAll()
          .then(data => {
            this.list = data || []
            this.loaded = true
            return this.list
          })
          .finally(() => {
            this._inflight = null
          })
        return this._inflight
      },

      /** 增/改/删字典成功后调用,让用到下拉的页面跟着更新 */
      refresh() {
        return this.load(true)
      },
    },
  })
}

/** 客户状态。含"注销",选中它即显式传 status=3 —— 天然是"查看已注销客户"的入口 */
export const useCustomerStatusDict = createDictStore(
  'customerStatusDict',
  fetchAllCustomerStatuses
)

/** 订单状态。同上,含"已取消" */
export const useOrderStatusDict = createDictStore(
  'orderStatusDict',
  fetchAllOrderStatuses
)

/** 集装箱箱型。下拉显示拼成「普通箱 / 40英尺」 */
export const useContainerTypeDict = createDictStore(
  'containerTypeDict',
  fetchAllContainerTypes,
  i => [i.type, i.size].filter(Boolean).join(' / ')
)

/** 集装箱状态。下拉显示拼成「在堆场 / At Yard」 */
export const useContainerStatusDict = createDictStore(
  'containerStatusDict',
  fetchAllContainerStatuses,
  i => [i.descriptionCn, i.descriptionEn].filter(Boolean).join(' / ')
)
