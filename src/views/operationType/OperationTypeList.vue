<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchOperationTypes, updateOperationType } from '@/api/operationType'
import { useOperationTypeDict } from '@/stores/dict'

/**
 * 操作类型。
 *
 * ⚠️⚠️ **这张表是固定的,只有「查询」和「修改」,没有新增、没有删除。**
 *
 * 文档原话:它只有 5 行,代码里的操作日志就是按这几个 id 记的 ——
 * **删一行会让新日志的"操作类型"列变空白(而且不报错)**,加一行则没有任何代码会用上。
 * 所以这个页面上**没有"新增""删除"按钮**,表格里也没有复选框和操作列(只有一个"保存")。
 *
 * ⚠️ **`type` 存的是英文**(`INSERT` / `UPDATE` / ...),会**原样显示**在操作日志的
 *    "操作类型"列里 —— 前端**不做中文翻译**(按产品口径,直接显示原值),
 *    所以这个页面上也就是直接编辑那串英文值本身。
 */
const dict = useOperationTypeDict()

const pager = reactive({ current: 1, size: 20, total: 0 })
const rows = ref([])
const loading = ref(false)
/** 正在保存的行 id */
const savingId = ref(null)

/** 这一行是不是改动了 */
const isDirty = row => row._type !== row.type

async function loadTable() {
  loading.value = true
  try {
    const data = await fetchOperationTypes({ page: pager.current, size: pager.size })
    rows.value = data.list.map(i => ({ ...i, _type: i.type }))
    pager.total = data.total
  } catch {
    // 错误提示已由 axios 拦截器统一处理
  } finally {
    loading.value = false
  }
}

function onSizeChange() {
  pager.current = 1
  loadTable()
}

async function onSave(row) {
  const type = row._type.trim()
  if (!type) return ElMessage.warning('类型名称不能为空')
  if (type.length > 50) return ElMessage.warning('类型名称最长 50 个字符')

  savingId.value = row.id
  try {
    await updateOperationType(row.id, { type })
    ElMessage.success('保存成功')
    await loadTable()
    // 字典变了,操作日志页那个筛选下拉也要跟着更新
    await dict.refresh()
  } catch {
    // 409(类型名重复)· 404 由拦截器弹出
  } finally {
    savingId.value = null
  }
}

onMounted(loadTable)
</script>

<template>
  <div class="page">
    <el-alert type="warning" :closable="false" show-icon class="hint">
      <template #title>
        这是一张<strong>固定的字典</strong>:只有 5 行,而且<strong>只能改名字,不能增删</strong>。
        代码里的操作日志就是按这几个 id 记的 —— 删一行会让新日志的「操作类型」列变空白(而且不报错),
        加一行则没有任何代码会用上。所以这个页面上没有新增和删除。
      </template>
    </el-alert>

    <el-alert type="info" :closable="false" show-icon class="hint">
      <template #title>
        <strong>改名字会影响历史记录</strong>:日志存的是类型的 id,查询时才去取名字 ——
        所以你把 <code>INSERT</code> 改成别的,<strong>所有历史日志的「操作类型」列都会跟着变</strong>。
        另外后端存的是<strong>英文</strong>(<code>INSERT</code> / <code>UPDATE</code> / …),
        它会<strong>原样显示</strong>在操作日志的「操作类型」列里,前端不做翻译。
      </template>
    </el-alert>

    <el-table v-loading="loading" :data="rows" border row-key="id">
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column label="类型值" min-width="240">
        <template #default="{ row }">
          <el-input v-model="row._type" maxlength="50" placeholder="如 INSERT" />
        </template>
      </el-table-column>
      <el-table-column prop="insertTime" label="创建时间" width="170" />
      <el-table-column prop="updateTime" label="修改时间" width="170" />
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-button
            link
            type="primary"
            :disabled="!isDirty(row)"
            :loading="savingId === row.id"
            @click="onSave(row)"
          >
            保存
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      v-model:current-page="pager.current"
      v-model:page-size="pager.size"
      :total="pager.total"
      :page-sizes="[10, 20, 50, 100]"
      layout="total, sizes, prev, pager, next, jumper"
      class="pager"
      @current-change="loadTable"
      @size-change="onSizeChange"
    />
  </div>
</template>
