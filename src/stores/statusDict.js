import { defineStore } from 'pinia'
import { fetchAllStatuses } from '@/api/customerStatus'

/** 系统内置状态 id,语义固定:1 正常 / 2 异常 / 3 注销 */
export const BUILTIN_STATUS_IDS = [1, 2, 3]

/** 是否系统内置状态 —— 不允许改名、不允许删除 */
export const isBuiltinStatus = id => BUILTIN_STATUS_IDS.includes(id)

/**
 * 状态标签配色。三个内置状态各占一种固定颜色;
 * 自定义状态(id > 3)统一用 primary(蓝)—— 内置三种都没用到 primary,
 * 所以自定义状态一眼就能和内置的区分开。
 */
export function statusTagType(id) {
  switch (id) {
    case 1:
      return 'success' // 正常
    case 2:
      return 'warning' // 异常
    case 3:
      return 'info' // 注销
    default:
      return 'primary' // 自定义状态
  }
}

/**
 * 客户状态字典。被三处消费:客户列表的筛选下拉、客户表单的状态下拉、状态管理页。
 *
 * 数据量极小,所以做单例缓存 + 变更后 refresh,而不是每个页面各拉一次
 * (否则不同页面的下拉可能短暂不一致)。
 */
export const useStatusDictStore = defineStore('statusDict', {
  state: () => ({
    list: [],
    loaded: false,
    _inflight: null, // 并发去重用的 promise
  }),

  getters: {
    /**
     * 下拉选项。包含"注销",所以用户选中它时就会显式传 status=3,
     * 天然就是"查看已注销客户"的入口,不需要额外加控件。
     */
    options: state => state.list.map(i => ({ value: i.id, label: i.description })),
  },

  actions: {
    async load(force = false) {
      if (this.loaded && !force) return this.list
      if (this._inflight) return this._inflight // 并发去重:多个组件同时 onMounted 只发一次请求
      this._inflight = fetchAllStatuses()
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

    /** 增/改/删状态成功后调用,让客户页的下拉跟着更新 */
    refresh() {
      return this.load(true)
    },
  },
})
