import { ref } from 'vue'
import { debounce } from '@/utils/debounce'

/**
 * 远程搜索下拉的通用逻辑。
 *
 * 这套东西在本项目已经重复写了四遍(订单表单的客户/港口、装箱表单的货物/集装箱、
 * 集装箱表单的箱主/操作方、提空箱登记的箱号/拖车号),所以第五次抽出来。
 *
 * 它解决三件事,少一个都会出问题:
 *
 *   1. **防抖** —— `el-select` 的 remote-method 每敲一个字都会触发,不防抖会打出一串请求
 *   2. **序号守卫** —— 丢弃过期响应。慢请求后到会用旧结果覆盖新结果
 *   3. **回填补选项** —— 远程搜索每次都**整个替换**选项数组,而 `el-select`
 *      在 options 里找不到当前值时会退化成显示空白 / id 数字。
 *      所以每次搜索完都要把"当前选中的值"补回去
 *
 * ```js
 * const containerSel = useRemoteSelect(kw => fetchContainerOptions(kw), {
 *   toOption: c => ({ value: c.no, label: c.no, sub: c.statusDescription || '' }),
 *   selected: () => [form.containerNo],   // 当前选中的值(空值会被忽略)
 * })
 *
 * // 打开弹窗时:先记住回填值的显示文本,再加载一批
 * containerSel.remember(form.containerNo, form.containerNo)
 * containerSel.load('')
 * ```
 * 模板里用 `containerSel.options` / `containerSel.loading` / `containerSel.search`。
 *
 * @param {Function} fetcher        `(keyword) => Promise<item[]>`
 * @param {object}   opts
 * @param {Function} opts.toOption  `item => { value, label, sub }`
 * @param {Function} opts.selected  返回当前选中的值数组,用于把选中项补回列表
 * @param {Function} [opts.labelOf] 选中值的兜底显示文本,默认 `String(value)`
 * @param {number}   [opts.wait]    防抖毫秒数,默认 300
 */
export function useRemoteSelect(fetcher, { toOption, selected, labelOf, wait = 300 } = {}) {
  const options = ref([])
  const loading = ref(false)
  /** value -> 显示文本。搜到的和回填的都会记进来,保证选中项永远有东西可显示 */
  const labels = ref({})
  /** 序号守卫用的计数器 */
  let seq = 0

  /** 把当前选中的值补进选项列表(找不到显示文本时退化成 String(value)) */
  function withSelected(list) {
    const out = [...list]
    const have = new Set(out.map(o => o.value))
    for (const value of selected?.() ?? []) {
      if (value && !have.has(value)) {
        out.push({
          value,
          label: labels.value[value] ?? labelOf?.(value) ?? String(value),
          sub: '',
        })
        have.add(value)
      }
    }
    return out
  }

  async function load(keyword = '') {
    loading.value = true
    const my = ++seq
    try {
      const list = await fetcher(keyword)
      if (my !== seq) return // 已经有更新的搜索发出去了,丢弃这次结果
      const found = (list || []).map(item => {
        const o = toOption(item)
        labels.value[o.value] = o.label
        return o
      })
      options.value = withSelected(found)
    } catch {
      // 错误提示由 axios 拦截器统一处理
    } finally {
      if (my === seq) loading.value = false
    }
  }

  /** 可直接绑给 `:remote-method` */
  const search = debounce(load, wait)

  /**
   * 回填用:记下某个值该显示成什么。
   * **要在 `load()` 之前调**,这样那次加载就会把它补进选项列表。
   */
  function remember(value, label) {
    if (value) labels.value[value] = label ?? String(value)
  }

  return { options, loading, labels, search, load, remember }
}
