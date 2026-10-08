<script setup>
import { h, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  batchDeletePackingRecords,
  deletePackingRecord,
  fetchPackingRecords,
} from '@/api/packingRecord'
import PackingFormDialog from '@/components/PackingFormDialog.vue'

const route = useRoute()

/** 三个筛选条件:一个是前缀匹配,两个是精确匹配 */
const query = reactive({
  cargoTypeName: '', // 前缀
  orderId: '', // 精确,整串
  containerNo: '', // 精确,整串
})

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
    const data = await fetchPackingRecords({
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
    // 错误提示已由 axios 拦截器统一弹出
  } finally {
    loading.value = false
  }
}

function onSearch() {
  pager.current = 1 // 查询条件变了,统一回到第 1 页
  loadList()
}

function onReset() {
  Object.assign(query, { cargoTypeName: '', orderId: '', containerNo: '' })
  onSearch()
}

function onSizeChange() {
  pager.current = 1
  loadList()
}

/** 从本页新增:货物要在弹窗里自己挑(从订单货物页进来的那条约会预选好) */
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
      `确定删除这条装箱记录吗?删除后无法恢复。`,
      '提示',
      { type: 'warning' }
    )
    await deletePackingRecord(row.id)
    ElMessage.success('删除成功')
    loadList()
  } catch {
    // 用户取消,或 404(msg 由拦截器弹出)
  }
}

/**
 * 批量删除。
 *
 * 📌 和别的模块**又不一样**:这张表没有被任何表引用,所以**没有 409 保护**,
 *    语义是**宽松**的(存在的删掉、不存在的忽略、幂等),不会整批失败。
 *    所以确认框里**不用**写"整批拒绝" —— 但**必须**写"无法恢复"。
 */
async function onBatchDelete() {
  const ids = selectedRows.value.map(r => r.id)
  if (!ids.length) return ElMessage.warning('请先选择要删除的装箱记录')
  if (ids.length > 100) return ElMessage.warning('一次最多删除 100 条,请分批操作')

  try {
    await ElMessageBox.confirm(
      `确定删除选中的 ${ids.length} 条装箱记录吗?删除后无法恢复。`,
      '提示',
      { type: 'warning' }
    )
  } catch {
    return // 用户取消
  }

  try {
    await batchDeletePackingRecords(ids)
    ElMessage.success(`已删除 ${ids.length} 条`)
    selectedRows.value = []
    loadList()
  } catch {
    // 400(空数组 / 超过 100)由拦截器提示
  }
}

onMounted(() => {
  // 从订单货物页点「登记查询」跳过来时带着 ?orderId=,填进筛选框直接定位。
  // ⚠️ 11.1 没有 cargoId 参数,所以只能按**订单号**筛 ——
  //    拿到的是这张订单下的全部装箱记录,而不是某一条货物的。这是接口能力决定的。
  if (route.query.orderId) query.orderId = String(route.query.orderId)

  loadList()
})
</script>

<template>
  <div class="page">
    <!-- 查询条件行 -->
    <el-form :inline="true" :model="query" class="query-form" @submit.prevent>
      <el-form-item label="货物名称">
        <el-input
          v-model="query.cargoTypeName"
          placeholder="输入名称开头几个字"
          clearable
          style="width: 180px"
          @keyup.enter="onSearch"
        />
      </el-form-item>
      <el-form-item label="订单号">
        <el-input
          v-model="query.orderId"
          placeholder="订单号整串精确匹配"
          clearable
          style="width: 220px"
          @keyup.enter="onSearch"
        />
      </el-form-item>
      <el-form-item label="集装箱号">
        <el-input
          v-model="query.containerNo"
          placeholder="箱号整串精确匹配"
          clearable
          style="width: 200px"
          @keyup.enter="onSearch"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="onSearch">查询</el-button>
        <el-button @click="onReset">清空</el-button>
      </el-form-item>
    </el-form>

    <el-alert type="warning" :closable="false" show-icon class="hint">
      <template #title>
        货物名称只能从<strong>开头</strong>匹配;<strong>订单号和集装箱号都要整串输入</strong>,只输入前几位是查不到的。
        删除后<strong>无法恢复</strong>,请谨慎操作。
        装箱时<strong>货物和集装箱都必须是系统里已有的</strong> —— 箱号需要先建好集装箱才能登记。
      </template>
    </el-alert>

    <div class="toolbar">
      <el-button type="primary" @click="onCreate">+ 登记装箱</el-button>
      <el-button
        type="danger"
        :disabled="!selectedRows.length"
        @click="onBatchDelete"
      >
        批量删除
      </el-button>
    </div>

    <el-table
      v-loading="loading"
      :data="rows"
      border
      row-key="id"
      @selection-change="onSelectionChange"
    >
      <el-table-column type="selection" width="48" />
      <el-table-column prop="containerNo" label="集装箱号" width="180" />
      <el-table-column prop="cargoTypeName" label="货物名称" min-width="140" show-overflow-tooltip />
      <el-table-column prop="orderId" label="所属订单号" width="220" />
      <el-table-column prop="quantity" label="装入数量" width="110" align="right" />
      <el-table-column prop="insertTime" label="创建时间" width="170" />
      <el-table-column prop="updateTime" label="修改时间" width="170" />
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

    <!-- 新增(货物自己挑) / 编辑 -->
    <PackingFormDialog v-model="dialogVisible" :row="editingRow" @success="loadList" />
  </div>
</template>
