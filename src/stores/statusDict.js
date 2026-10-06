import { defineStore } from 'pinia'
import { fetchAllCustomerStatuses } from '@/api/customerStatus'
import { fetchAllOrderStatuses } from '@/api/orderStatus'

/**
 * 状态字典的工厂 —— 客户 / 订单各实例化一次。
 *
 * 字典被多处消费(列表页的筛选下拉、表单的状态下拉、状态管理页自己),
 * 数据量极小,所以做单例缓存 + 变更后 refresh,而不是每个页面各拉一次
 * (否则不同页面的下拉可能短暂不一致)。
 */
function createStatusDictStore(storeId, fetchAll) {
  return defineStore(storeId, {
    state: () => ({
      list: [],
      loaded: false,
      _inflight: null, // 并发去重用的 promise
    }),

    getters: {
      /**
       * 下拉选项。包含"注销" / "已取消",所以用户选中它时就会显式传 status=3 / 4,
       * 天然就是"查看已注销客户 / 已取消订单"的入口,不需要额外加控件。
       */
      options: state => state.list.map(i => ({ value: i.id, label: i.description })),
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

      /** 增/改/删状态成功后调用,让用到下拉的页面跟着更新 */
      refresh() {
        return this.load(true)
      },
    },
  })
}

export const useCustomerStatusDict = createStatusDictStore(
  'customerStatusDict',
  fetchAllCustomerStatuses
)

export const useOrderStatusDict = createStatusDictStore(
  'orderStatusDict',
  fetchAllOrderStatuses
)
