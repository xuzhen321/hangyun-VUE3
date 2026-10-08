<script setup>
import { h, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  batchDeleteContainerTrailerRecords,
  deleteContainerTrailerRecord,
  fetchContainerTrailerRecords,
} from '@/api/containerTrailerRecord'
import { cleanQuery } from '@/utils/exportExcel'
import { useExport } from '@/composables/useExport'
import ContainerTrailerRecordFormDialog from './ContainerTrailerRecordFormDialog.vue'

/** 四个筛选条件:两个前缀匹配 + 一个进场时间闭区间 */
const query = reactive({
  containerNo: '', // 前缀
  trackNo: '', // 前缀
  dcInDateFrom: '',
  dcInDateTo: '',
})

const { exporting, doExport } = useExport()

const pager = reactive({ current: 1, size: 20, total: 0 })
const rows = ref([])
const loading = ref(false)
const selectedRows = ref([])

const dialogVisible = ref(false)
const editingRow = ref(null)

function onSelectionChange(selection) {
  selectedRows.value = selection
}

async function loadList() {
  loading.value = true
  try {
    const data = await fetchContainerTrailerRecords({
      page: pager.current,
      size: pager.size,
      ...query,
    })
    // 删空当前页且不在第 1 页时回退一页,避免停在一条都没有的末页
    if (!data.list.length && pager.current > 1) {
      pager.current -= 1
      return loadList()
    }
    rows.value = data.list
    pager.total = data.total
  } catch {
    // 错误提示已由 axios 拦截器统一处理
  } finally {
    loading.value = false
  }
}

function onSearch() {
  pager.current = 1 // 查询条件变了,统一回到第 1 页
  loadList()
}

function onReset() {
  Object.assign(query, {
    containerNo: '',
    trackNo: '',
    dcInDateFrom: '',
    dcInDateTo: '',
  })
  onSearch()
}

function onSizeChange() {
  pager.current = 1
  loadList()
}

function onCreate() {
  editingRow.value = null
  dialogVisible.value = true
}

function onEdit(row) {
  editingRow.value = row
  dialogVisible.value = true
}

async function onDelete(row) {
  try {
    await ElMessageBox.confirm(
      `确定删除这条提空箱记录吗?删除后无法恢复。`,
      '提示',
      { type: 'warning' }
    )
    await deleteContainerTrailerRecord(row.id)
    ElMessage.success('删除成功')
    loadList()
  } catch {
    // 用户取消,或 404(msg 由拦截器弹出)
  }
}

/**
 * 批量删除。
 *
 * 📌 这张表**没有被别的表引用**,所以**没有引用保护**:语义是**宽松**的
 *    (存在的删掉、不存在的忽略、幂等),不会整批失败。
 *    所以确认框里不用写"整批拒绝" —— 但**必须**写"无法恢复"(是物理删除)。
 *
 * ⚠️ 字段名是普通的 `ids`(记录 id 是自增数字),**不是**集装箱那种 `nos`。
 */
async function onBatchDelete() {
  const ids = selectedRows.value.map(r => r.id)
  if (!ids.length) return ElMessage.warning('请先选择要删除的记录')
  if (ids.length > 100) return ElMessage.warning('一次最多删除 100 条,请分批操作')

  try {
    // 用 VNode 而不是拼接 \n:ElMessageBox 的 message 是普通文本节点,换行符不会渲染
    await ElMessageBox.confirm(
      h('div', { style: 'line-height: 1.9' }, [
        h('div', `确定删除选中的 ${ids.length} 条提空箱记录吗?`),
        h('div', { style: 'color: #f56c6c; font-weight: 600' }, '删除后无法恢复。'),
      ]),
      '提示',
      { type: 'warning' }
    )
  } catch {
    return // 用户取消
  }

  try {
    await batchDeleteContainerTrailerRecords(ids)
    ElMessage.success(`已删除 ${ids.length} 条`)
    selectedRows.value = []
    loadList()
  } catch {
    // 400(空数组 / 超过 100)由拦截器提示
  }
}

/**
 * 导出。**查询条件原样带过去** —— 导出的内容和你列表里看到的一致。
 * 空的那几项由 cleanQuery 剔掉,不然后端会当成"按空值筛"。
 */
function onExport() {
  doExport('/container-trailer-records/export', cleanQuery(query), '提空箱登记')
}

onMounted(loadList)
</script>

<template>
  <div class="page">
    <!-- 查询条件行 -->
    <el-form :inline="true" :model="query" class="query-form" @submit.prevent>
      <el-form-item label="箱号">
        <el-input
          v-model="query.containerNo"
          placeholder="输入箱号开头几个字符"
          clearable
          style="width: 180px"
          @keyup.enter="onSearch"
        />
      </el-form-item>
      <el-form-item label="拖车号">
        <el-input
          v-model="query.trackNo"
          placeholder="输入拖车号开头几个字"
          clearable
          style="width: 180px"
          @keyup.enter="onSearch"
        />
      </el-form-item>
      <el-form-item label="进场时间从">
        <el-date-picker
          v-model="query.dcInDateFrom"
          type="datetime"
          value-format="YYYY-MM-DD HH:mm:ss"
          format="YYYY-MM-DD HH:mm:ss"
          placeholder="起始时间"
          style="width: 200px"
        />
      </el-form-item>
      <el-form-item label="进场时间至">
        <!-- 两个独立 picker 而不是 datetimerange:后端 From/To 都能单独传 -->
        <el-date-picker
          v-model="query.dcInDateTo"
          type="datetime"
          value-format="YYYY-MM-DD HH:mm:ss"
          format="YYYY-MM-DD HH:mm:ss"
          placeholder="截止时间"
          style="width: 200px"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="onSearch">查询</el-button>
        <el-button @click="onReset">清空</el-button>
      </el-form-item>
    </el-form>

    <el-alert type="warning" :closable="false" show-icon class="hint">
      <template #title>
        箱号和拖车号都只能从<strong>开头</strong>匹配。登记时<strong>箱子和拖车都必须是系统里已有的</strong>,
        而且<strong>已删除的箱子不能用来登记</strong>。列表按<strong>进场时间倒序</strong>(最近提箱的排最前)。
        删除后<strong>无法恢复</strong>,请谨慎操作。
      </template>
    </el-alert>

    <div class="toolbar">
      <el-button type="primary" @click="onCreate">+ 新增提空箱登记</el-button>
      <el-button
        type="danger"
        :disabled="!selectedRows.length"
        @click="onBatchDelete"
      >
        批量删除
      </el-button>
      <el-button :loading="exporting" @click="onExport">导出</el-button>
    </div>

    <el-table
      v-loading="loading"
      :data="rows"
      border
      row-key="id"
      @selection-change="onSelectionChange"
    >
      <el-table-column type="selection" width="48" />
      <el-table-column prop="containerNo" label="箱号" width="150" />
      <el-table-column prop="trackNo" label="拖车号" width="130" />
      <el-table-column prop="driverName" label="司机姓名" width="110" />
      <el-table-column prop="dcInDate" label="进场时间" width="170" />
      <el-table-column prop="dcOutDate" label="出场时间" width="170" />
      <el-table-column prop="useNote" label="箱使用备注" min-width="160" show-overflow-tooltip />
      <el-table-column prop="insertTime" label="创建时间" width="170" />
      <el-table-column label="操作" width="130" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="onEdit(row)">编辑</el-button>
          <el-button link type="danger" @click="onDelete(row)">删除</el-button>
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
      @current-change="loadList"
      @size-change="onSizeChange"
    />

    <ContainerTrailerRecordFormDialog
      v-model="dialogVisible"
      :row="editingRow"
      @success="loadList"
    />
  </div>
</template>
