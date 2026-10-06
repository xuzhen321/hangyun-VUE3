/**
 * 状态字典的配置。
 *
 * 客户状态和订单状态的结构、接口、页面行为**完全一样**,只有内置 id 和文案不同,
 * 所以把差异集中在这里 —— 页面和通用组件都不硬编码任何一方的细节。
 */

/** 客户状态:内置 1 正常 / 2 异常 / 3 注销 */
export const CUSTOMER_STATUS = {
  builtinIds: [1, 2, 3],
  builtinLabel: '正常/异常/注销',
  entityWord: '客户',
  tagTypes: { 1: 'success', 2: 'warning', 3: 'danger' },
}

/** 订单状态:内置 1 已确认 / 2 执行中 / 3 已完成 / 4 已取消 */
export const ORDER_STATUS = {
  builtinIds: [1, 2, 3, 4],
  builtinLabel: '已确认/执行中/已完成/已取消',
  entityWord: '订单',
  tagTypes: { 1: 'primary', 2: 'warning', 3: 'success', 4: 'danger' },
}

/**
 * 自定义状态:两个实体统一用这一套。
 *
 * 中性灰,不抢任何语义 —— 自定义状态是用户自己加的(可能是「待审核」,也可能是「VIP优先」),
 * 不该自带"好/坏"倾向;再叠一层 plain(描边)而不是 light(填充),让它一眼就是"用户加的"。
 */
export const CUSTOM_TAG = { type: 'info', effect: 'plain' }

/**
 * 取状态标签的 el-tag 样式,配合 `v-bind` 使用。
 *
 * ⚠️ 判断"是否内置"永远走 builtinIds 白名单,**不要靠颜色反推** ——
 * 配色将来调整时,靠颜色判断的逻辑会静默失效。
 */
export function tagStyleOf(config, id) {
  return config.builtinIds.includes(id)
    ? { type: config.tagTypes[id] ?? 'info', effect: 'light' }
    : { ...CUSTOM_TAG }
}

/** 是否系统内置状态 —— 不允许改名、不允许删除 */
export const isBuiltinOf = (config, id) => config.builtinIds.includes(id)
