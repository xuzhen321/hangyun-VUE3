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
 * 事件状态字典里"已删除"的 id。
 *
 * 物流事件的逻辑删除(19.4)就是改到它 —— 所以既**内置不可改删**,
 * 也**不该让用户手动选**(新增/编辑事件时那个下拉要滤掉),
 * 否则用户一不小心就把事件标成已删除了。
 */
export const EVENT_STATUS_DELETED_ID = 6

/**
 * 事件状态字典(文档 18 节)。
 *
 * ⚠️ 和**集装箱状态是同一条规则** —— 中英两列、两列都唯一、只有 id=6 是内置的。
 *    内置 6 条:`1 预安排 / 2 装船中 / 3 航行中 / 4 卸货中 / 5 已完成 / 6 已删除`。
 */
export const EVENT_STATUS = {
  builtinIds: [EVENT_STATUS_DELETED_ID],
  builtinLabel: '已删除',
  entityWord: '物流事件',
  name: '事件状态',
  columns: [
    { prop: 'descriptionCn', label: '中文描述', max: 50, required: true },
    { prop: 'descriptionEn', label: '英文描述', max: 50, required: false },
  ],
  hint:
    '中英文描述**各自唯一**,重复会返回 409。' +
    '**只有 id=6「已删除」是内置的**(物流事件的逻辑删除就是改到它),不允许修改、不允许删除,已置灰;' +
    '其余几条(预安排 / 装船中 / 航行中 / 卸货中 / 已完成)只要没被物流事件引用,都能改、都能删。' +
    '事件状态不支持批量删除。',
}

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

// ===========================================================================
// 港口的五个小字典(文档 25 节)
//
// 这五个接口形状**完全一样**(分页 / options / 详情 / 增删改),差别只有两点:
//   1. 唯一的业务字段不同
//   2. **区域名和时区的两个字段有唯一约束,尺寸/级别/类型没有**
// 所以配置写得很像,这是对的 —— 它们本来就是同一套东西。
// ===========================================================================

/** 港口区域。区域名唯一 */
export const PORT_AREA = {
  builtinIds: [],
  builtinLabel: '',
  entityWord: '港口',
  name: '港口区域',
  columns: [{ prop: 'areaName', label: '区域名称', max: 50, required: true }],
  search: { param: 'keyword', label: '关键字', placeholder: '区域名称开头几个字' },
  hint:
    '区域名称**唯一**,重复会返回 409。' +
    '删除时如果还有港口在用这个区域,后端会拒绝并说明原因。' +
    '⚠️ 报的条数**包含已删除的港口** —— 所以"列表里一个港口都看不见却删不掉"是正常的,' +
    '别拿列表条数去对。港口区域不支持批量删除。',
}

/**
 * 港口时区。**两个字段都必填、都唯一**。
 *
 * ⚠️ 每个 UTC 偏移只能出现一次 —— 上海和新加坡都是 UTC+8,但表里只有一条 `UTC+08:00`,
 *    新加坡港用的也是同一条。
 */
export const PORT_TIMEZONE = {
  builtinIds: [],
  builtinLabel: '',
  entityWord: '港口',
  name: '港口时区',
  columns: [
    { prop: 'timezoneUtc8', label: 'UTC 偏移', max: 20, required: true },
    { prop: 'timezoneAsiaShanghai', label: '时区名', max: 50, required: true },
  ],
  search: { param: 'keyword', label: '关键字', placeholder: '时区开头几个字' },
  hint:
    '**两个字段都必填,而且都唯一** —— 每个 UTC 偏移只能出现一次(所以上海和新加坡共用一条 UTC+08:00)。' +
    '删除时如果还有港口在用这个时区,后端会拒绝。港口时区不支持批量删除。',
}

/** 港口尺寸。没有唯一约束 */
export const HARBOR_SIZE = {
  builtinIds: [],
  builtinLabel: '',
  entityWord: '港口',
  name: '港口尺寸',
  columns: [{ prop: 'size', label: '尺寸', max: 20, required: true }],
  search: { param: 'keyword', label: '关键字', placeholder: '尺寸开头几个字' },
  hint:
    '这一栏**没有唯一约束**,允许重复,这是正常的。' +
    '删除时如果还有港口在用,后端会拒绝。港口尺寸不支持批量删除。',
}

/**
 * 港口级别。**这一列是数字,不是文本。**
 *
 * 📌 它是五个小字典里**唯一没有关键字搜索**的 —— 数字做前缀搜索没意义,后端也没提供。
 */
export const PORT_LEVEL = {
  builtinIds: [],
  builtinLabel: '',
  entityWord: '港口',
  name: '港口级别',
  columns: [
    {
      prop: 'level',
      label: '级别',
      kind: 'number',
      min: 0,
      numMax: 9999,
      precision: 0,
      required: true,
    },
  ],
  // 刻意不配 search:后端只提供分页,数字做前缀搜索没意义
  hint:
    '级别是一个**非负整数**。这一栏**没有唯一约束**,允许重复。' +
    '删除时如果还有港口在用,后端会拒绝。港口级别不支持批量删除,也**没有关键字搜索**。',
}

/** 港口类型。没有唯一约束 */
export const PORT_TYPE = {
  builtinIds: [],
  builtinLabel: '',
  entityWord: '港口',
  name: '港口类型',
  columns: [{ prop: 'type', label: '类型名称', max: 20, required: true }],
  search: { param: 'keyword', label: '关键字', placeholder: '类型名称开头几个字' },
  hint:
    '这一栏**没有唯一约束**,允许重复,这是正常的。' +
    '删除时如果还有港口在用,后端会拒绝。港口类型不支持批量删除。',
}

// ===========================================================================
// 船舶相关(文档 21 / 22 节)
// ===========================================================================

/**
 * 国家字典。
 *
 * 📌 **共用表** —— 船舶的"船旗国"和港口的"所在国家"用的是同一张表、同一组接口。
 *    所以删除时会**同时查船舶和港口两处引用**,两处都干净才允许删。
 */
export const COUNTRY = {
  builtinIds: [],
  builtinLabel: '',
  entityWord: '船舶',
  name: '国家',
  columns: [
    { prop: 'countryCode', label: '国家代码', max: 10, required: true },
    { prop: 'countryCnname', label: '中文名', max: 100, required: false },
    { prop: 'countryEnname', label: '英文名', max: 100, required: false },
  ],
  search: {
    param: 'keyword',
    label: '关键字',
    placeholder: '代码 / 中文名 / 英文名开头几个字',
  },
  hint:
    '国家代码**唯一**(如 CN),重复会返回 409;中英文名可空、不查重。' +
    '删除时如果还有**船舶把它当船旗国**或**港口把它当所在国家**,后端会拒绝并说明原因(两处都会查)。' +
    '国家不支持批量删除。',
}

/**
 * 船舶类型字典。一条记录是"类型名 + 五个规格数值"。
 *
 * 📌 这几个数值是**该类船的典型规格(参考值)**,不是具体某条船的参数 ——
 *    所以同型号的船在船舶列表里这几个数会一样。
 */
export const SHIP_TYPE = {
  builtinIds: [],
  builtinLabel: '',
  entityWord: '船舶',
  name: '船舶类型',
  columns: [
    { prop: 'type', label: '类型名称', max: 50, required: true },
    { prop: 'gt', label: '总吨', kind: 'number', min: 0, numMax: 9999999999.99, precision: 2, required: true },
    { prop: 'nt', label: '净吨', kind: 'number', min: 0, numMax: 9999999999.99, precision: 2, required: true },
    { prop: 'dwt', label: '载重吨', kind: 'number', min: 0, numMax: 9999999999.99, precision: 2, required: true },
    { prop: 'length', label: '长度', kind: 'number', min: 0, numMax: 999999.99, precision: 2, required: true },
    { prop: 'width', label: '宽度', kind: 'number', min: 0, numMax: 999999.99, precision: 2, required: true },
  ],
  search: { param: 'keyword', label: '关键字', placeholder: '类型名称开头几个字' },
  hint:
    '**六个字段全部必填**,都没有唯一约束(允许重复)。' +
    '后面五个是**数字规格**(单位为吨 / 米)——' +
    '船舶列表里的「总吨 / 净吨 / 载重吨 / 长度 / 宽度」五列就是从**船型**联出来的,' +
    '船型不填,挂这个船型的**每一条船**那五列都会是空白,所以约束放在船型这一层。' +
    '这几个是**该类船的典型规格**,不是某条具体船的参数 —— 所以同型号的船这几个数会一样。' +
    '删除时如果有船舶在用这个船型,后端会拒绝。⚠️ 报的条数包含已删除的船舶,别拿列表条数去对。' +
    '船舶类型不支持批量删除。',
}
