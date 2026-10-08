/**
 * 状态标签的配色规则(列表页"状态"那一列用)。
 *
 * 规则本身和具体实体无关 —— 把配置对象传进来就行,所以这里不 import 任何字典配置。
 * 四个字典各自的配置在 `constants/dict.js`。
 */

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
  return config.builtinIds?.includes(id)
    ? { type: config.tagTypes?.[id] ?? 'info', effect: 'light' }
    : { ...CUSTOM_TAG }
}

/** 是否系统内置状态 —— 不允许改名、不允许删除 */
export const isBuiltinOf = (config, id) => !!config.builtinIds?.includes(id)
