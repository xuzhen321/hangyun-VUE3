/**
 * 提交前归一化表单:把空串转成 null,避免把 "" 写进库。
 *
 * 顺带说明时间字段:到这里它已经是 "YYYY-MM-DD HH:mm:ss" 字符串了,
 * 由 date-picker 的 value-format 保证 —— 全程不经手 Date 对象。
 * JSON.stringify(new Date()) 会产出带 Z 和毫秒的 UTC 串,后端会返回 400。
 */
export function toPayload(form) {
  const out = {}
  for (const [key, value] of Object.entries(form)) {
    if (typeof value === 'string') {
      const trimmed = value.trim()
      out[key] = trimmed === '' ? null : trimmed
    } else {
      // statusId 这类数字字段原样保留(可空)
      out[key] = value ?? null
    }
  }
  return out
}
