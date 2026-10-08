/**
 * 四个"字典类"模块的配置。
 *
 * 客户状态、订单状态、集装箱箱型、集装箱状态 —— 结构、接口、页面行为**完全一样**,
 * 只有字段和几条业务规则不同,所以差异全部集中在这里,页面和通用组件都不硬编码任何一方。
 *
 * 每个配置的字段:
 *   builtinIds   内置 id 白名单 **可选**;不传/空数组 = 没有"内置"概念,所有行都能改能删
 *   builtinLabel 内置状态文案,拼 tooltip 用
 *   entityWord   删除确认和错误兜底里的主体词
 *   tagTypes     列表里状态标签的配色(**只有客户/订单状态用得上**)
 *   columns      可编辑的列,`{ prop, label, max, required }`
 *   hint         页面顶部提示条文案
 */

/** 客户状态:内置 1 正常 / 2 异常 / 3 注销 */
export const CUSTOMER_STATUS = {
  builtinIds: [1, 2, 3],
  builtinLabel: '正常/异常/注销',
  entityWord: '客户',
  name: '客户状态',
  tagTypes: { 1: 'success', 2: 'warning', 3: 'danger' },
  columns: [{ prop: 'description', label: '状态描述', max: 50, required: true }],
  hint:
    '系统内置状态(正常/异常/注销)不允许改名、不允许删除,已置灰。' +
    '删除自定义状态时,如果还有客户正在使用它,后端会拒绝并说明原因。' +
    '客户状态不支持批量删除。',
}

/** 订单状态:内置 1 已确认 / 2 执行中 / 3 已完成 / 4 已取消 */
export const ORDER_STATUS = {
  builtinIds: [1, 2, 3, 4],
  builtinLabel: '已确认/执行中/已完成/已取消',
  entityWord: '订单',
  name: '订单状态',
  tagTypes: { 1: 'primary', 2: 'warning', 3: 'success', 4: 'danger' },
  columns: [{ prop: 'description', label: '状态描述', max: 50, required: true }],
  hint:
    '系统内置状态(已确认/执行中/已完成/已取消)不允许改名、不允许删除,已置灰。' +
    '删除自定义状态时,如果还有订单正在使用它,后端会拒绝并说明原因。' +
    '订单状态不支持批量删除。',
}

/**
 * 集装箱箱型(文档 13 节)。
 *
 * ⚠️ 和两个状态字典的两点不同:
 *   1. **没有内置概念** —— builtinIds 是空数组,所有行都能改能删
 *   2. **两个字段都没有唯一约束**,所以**允许存在重复的箱型** —— 后端不查重,前端也不该做本地查重
 */
export const CONTAINER_TYPE = {
  builtinIds: [],
  builtinLabel: '',
  entityWord: '集装箱',
  name: '箱型',
  columns: [
    { prop: 'type', label: '箱型类别', max: 50, required: true },
    { prop: 'size', label: '箱尺寸', max: 20, required: false },
  ],
  hint:
    '一条记录是「箱型类别 + 箱尺寸」的组合(如「普通箱 / 40英尺」),两个字段分开填写。' +
    '这两栏都没有唯一约束,**允许存在重复的箱型**,这是正常的。' +
    '删除时如果还有集装箱在用这个箱型,后端会拒绝并说明原因。箱型不支持批量删除。',
}

/**
 * 集装箱状态(文档 14 节)。
 *
 * ⚠️ 和客户状态 / 订单状态的两点不同:
 *   1. **中英文两列,而且两列各自唯一**(重复会返回 409)
 *   2. **内置的只有一个 id=7「已删除」** —— 不是整段内置
 *
 * 📌 为什么只有 id=7:集装箱的逻辑删除(12.5)就是把状态改成它,被代码写死依赖。
 *    其余几条(1-6)只要没被集装箱引用,都能改、都能删。
 *    ── 注意这一点**改过一次**:早先文档说的是"没有内置概念",所以这里原本传的是空数组。
 */
export const CONTAINER_STATUS = {
  builtinIds: [7],
  builtinLabel: '已删除',
  entityWord: '集装箱',
  name: '集装箱状态',
  columns: [
    { prop: 'descriptionCn', label: '中文描述', max: 50, required: true },
    { prop: 'descriptionEn', label: '英文描述', max: 50, required: false },
  ],
  hint:
    '中英文描述**各自唯一**,重复会返回 409。' +
    '**只有「已删除」这一条是内置的**(集装箱的逻辑删除就是改到它),不允许修改、不允许删除,已置灰;' +
    '其余几条只要没被集装箱引用,都能改、都能删。集装箱状态不支持批量删除。',
}
