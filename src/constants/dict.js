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

/**
 * 拖车管理(文档 16 节)。"哪个拖车、司机是谁" —— 提空箱登记要引用拖车号,所以先得有这张表。
 *
 * ⚠️ 和另外几个字典的三点不同:
 *   1. **主键是拖车号 `no`(字符串),不是自增 id** → 要配 `keyField: 'no'`
 *   2. **拖车号建了就不能改**(后端 UPDATE 里根本没有这一列)→ 那一列标 `immutable`
 *   3. 和公司一样,**下拉接口只返回前 20 条**,不是全量,所以**不配 useDict**
 */
export const TRAILER = {
  builtinIds: [],
  builtinLabel: '',
  entityWord: '拖车',
  name: '拖车',
  keyField: 'no',
  columns: [
    // immutable:只在"行内编辑"时置灰;新增弹窗里照样要填
    { prop: 'no', label: '拖车号', max: 30, required: true, immutable: true },
    { prop: 'name', label: '司机姓名', max: 50, required: false },
    { prop: 'phone', label: '联系电话', max: 30, required: false },
  ],
  search: {
    param: 'keyword',
    label: '关键字',
    placeholder: '拖车号或司机姓名开头几个字',
  },
  hint:
    '关键字是**前缀匹配**,同时匹配拖车号和司机姓名。' +
    '拖车号是主键,**建好之后不能修改** —— 要换号只能删了重建;而且不能重复。' +
    '删除时如果还有提空箱记录用了它,后端会拒绝并说明原因。拖车不支持批量删除。',
}

/**
 * 公司信息(文档 15 节)。
 *
 * 📌 这是一张**通用字典表** —— 箱主、操作方、船东、管理公司都指向它,目前只有集装箱在用。
 *
 * ⚠️ 和另外几个字典的两点不同:
 *   1. **列表带关键字查询**(`keyword` 前缀匹配,同时匹配名称和代码);其余几个字典都只能分页
 *   2. **不配 useDict** —— 它的下拉接口 `/companies/options` **只返回前 20 条**,
 *      不是"一次拉全量",缓存一份没意义;集装箱表单那边会做成远程搜索
 */
export const COMPANY = {
  builtinIds: [],
  builtinLabel: '',
  entityWord: '集装箱',
  name: '公司',
  columns: [
    { prop: 'name', label: '公司名称', max: 100, required: true },
    { prop: 'code', label: '公司代码', max: 20, required: false },
  ],
  search: {
    param: 'keyword',
    label: '关键字',
    placeholder: '公司名称或代码开头几个字',
  },
  hint:
    '关键字是**前缀匹配**,同时匹配公司名称和公司代码(传 COS 命中代码 COSU,传 中远 命中"中远…"开头的公司)。' +
    '公司名和代码**都没有唯一约束**,允许重名、允许代码重复,这是正常的。' +
    '删除时如果还有集装箱把它当**箱主或操作方**,后端会拒绝并说明原因。公司不支持批量删除。',
}

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
/**
 * 集装箱状态里"已删除"的 id。
 *
 * 集装箱的逻辑删除(12.5)就是改到它,被代码写死依赖 —— 所以它既是**内置不可改删**的,
 * 也是**不该让用户手动选**的:新增/编辑集装箱时那个下拉要把它过滤掉,
 * 否则用户一不小心就把新箱子建成"已删除"了。
 */
export const CONTAINER_STATUS_DELETED_ID = 7

export const CONTAINER_STATUS = {
  builtinIds: [CONTAINER_STATUS_DELETED_ID],
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
