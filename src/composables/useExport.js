import { ref } from 'vue'
import { downloadExcel } from '@/utils/exportExcel'

/**
 * 列表页"导出"按钮的通用逻辑。
 *
 * ```js
 * const { exporting, doExport } = useExport()
 *
 * function onExport() {
 *   // 查询条件原样带过去 —— 导出的内容和你列表里看到的一致
 *   doExport('/customers/export', { ...query }, '客户')
 * }
 * ```
 * 模板里:`<el-button :loading="exporting" @click="onExport">导出</el-button>`
 *
 * 📌 **失败不用自己提示** —— `request.js` 的拦截器会把后端返回的 JSON 错误
 *    (在 blob 模式下被当成 Blob 收下来的那份)读回文本、弹出 `msg`。
 *    最常见的失败是"导出行数超过 50000 条,请缩小筛选范围后重试"。
 */
export function useExport() {
  const exporting = ref(false)

  async function doExport(url, params, baseName) {
    exporting.value = true
    try {
      await downloadExcel(url, params, baseName)
    } catch {
      // 拦截器已经弹过提示了
    } finally {
      exporting.value = false
    }
  }

  return { exporting, doExport }
}
