/**
 * 尾部防抖。用于远程搜索下拉 —— el-select 的 remote-method 每敲一个字都会触发,
 * 不防抖的话会打出一串请求,而且慢请求可能后到、覆盖掉新结果。
 */
export function debounce(fn, wait = 300) {
  let timer = null
  return function (...args) {
    clearTimeout(timer)
    timer = setTimeout(() => fn.apply(this, args), wait)
  }
}
