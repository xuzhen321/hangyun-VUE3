<script setup>
import { h, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { batchDeleteCargos, deleteCargo, fetchCargos } from '@/api/cargo'
import { fetchOrder } from '@/api/order'
import CargoFormDialog from '@/components/CargoFormDialog.vue'

const route = useRoute()
const router = useRouter()

/** 两个筛选条件的匹配方式完全不同,placeholder 里要写清楚 */
const query = reactive({
  cargoTypeName: '', // 前缀匹配
  orderId: '', // 精确匹配,整串
})

const pager = reactive({ current: 1, size: 20, total: 0 })
const rows = ref([])
const loading = ref(false)
const selectedRows = ref([])

function onSelectionChange(selection) {
  selectedRows.value = selection
}

// ---- 点「所属订单号」:先问一句,确认后在同一个框里显示订单详情 ----
const orderDialogVisible = ref(false)
const orderDialogPhase = ref('confirm') // 'confirm' | 'detail'
const orderDialogLoading = ref(false)
const activeOrderId = ref(null)
const orderDetail = ref(null)

function onOrderClick(row) {
  activeOrderId.value = row.orderId
  orderDetail.value = null
  orderDialogPhase.value = 'confirm'
  orderDialogVisible.value = true
}

async function onConfirmOrderDetail() {
  orderDialogPhase.value = 'detail' // 先切过去,框里显示 loading
  orderDialogLoading.value = true
  try {
    orderDetail.value = await fetchOrder(activeOrderId.value)
  } catch {
    // 404 等由拦截器提示;直接关掉框,别停在一个加载不完的界面
    orderDialogVisible.value = false
  } finally {
    orderDialogLoading.value = false
  }
}

// ---- 点「货物种类」:先问一句,确认后跳到货物种类页并筛选 ----
const cargoTypeDialogVisible = ref(false)
const activeCargoTypeName = ref(null)

function onCargoTypeClick(row) {
  activeCargoTypeName.value = row.cargoTypeName
  cargoTypeDialogVisible.value = true
}

function onViewCargoType() {
  router.push({ path: '/cargo-types', query: { name: activeCargoTypeName.value } })
  cargoTypeDialogVisible.value = false
}

// ---- 编辑 / 删除 / 批量删除 ----
// 本页**没有"新增"** —— 货物必须挂在订单下,所以新增入口在订单列表的「货物增加」按钮上
const dialogVisible = ref(false)
const editingRow = ref(null)

function onEdit(row) {
  editingRow.value = row
  dialogVisible.value = true
}

async function onDelete(row) {
  try {
    await ElMessageBox.confirm(
      `确定删除这条货物吗?删除后无法恢复。`,
      '提示',
      { type: 'warning' }
    )
    await deleteCargo(row.id)
    ElMessage.success('删除成功')
    loadList()
  } catch {
    // 用户取消,或 404 / 409(msg 由拦截器原样弹出)
  }
}

/**
 * 批量删除。
 *
 * ⚠️ 和货物种类一样是**严格语义**:只要有一条被引用,整批都会被拒绝,一条都不删。
 *    所以确认框里要提前讲清楚,而且收到 409 时列表保持原样、不刷新。
 */
async function onBatchDelete() {
  const ids = selectedRows.value.map(r => r.id)
  if (!ids.length) return ElMessage.warning('请先选择要删除的货物')
  if (ids.length > 100) return ElMessage.warning('一次最多删除 100 条,请分批操作')

  try {
    // 用 VNode 而不是拼接 \n:ElMessageBox 的 message 是普通文本节点,换行符不会渲染
    await ElMessageBox.confirm(
      h('div', { style: 'line-height: 1.9' }, [
        h('div', `确定删除选中的 ${ids.length} 条货物吗?`),
        h('div', { style: 'color: #f56c6c; font-weight: 600' }, '删除后无法恢复。'),
        h(
          'div',
          '只要选中的货物里有任何一条已被装箱记录引用,这次删除会整体取消,一条都不会删。'
        ),
      ]),
      '提示',
      { type: 'warning' }
    )
  } catch {
    return // 用户取消
  }

  try {
    await batchDeleteCargos(ids)
    ElMessage.success(`已删除 ${ids.length} 条`)
    selectedRows.value = []
    loadList()
  } catch {
    // 409 时**什么都没删**,列表保持原样即可 —— msg 会说明原因
  }
}

// ---- 列表 ----
async function loadList() {
  loading.value = true
  try {
    const data = await fetchCargos({
      page: pager.current,
      size: pager.size,
      ...query,
    })
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
  Object.assign(query, { cargoTypeName: '', orderId: '' })
  onSearch()
}

function onSizeChange() {
  pager.current = 1
  loadList()
}

onMounted(() => {
  // 两个入口都会把筛选条件带在 URL 上,直接填好,省得用户再敲一遍
  //   订单列表点订单号        → ?orderId=xxx
  //   货物种类页点货物名称    → ?cargoTypeName=xxx
  if (route.query.orderId) query.orderId = String(route.query.orderId)
  if (route.query.cargoTypeName) {
    query.cargoTypeName = String(route.query.cargoTypeName)
  }

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
          style="width: 200px"
          @keyup.enter="onSearch"
        />
      </el-form-item>
      <el-form-item label="订单号">
        <!-- 精确匹配:必须整串,传前缀是查不到的 -->
        <el-input
          v-model="query.orderId"
          placeholder="订单号整串精确匹配"
          clearable
          style="width: 240px"
          @keyup.enter="onSearch"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="onSearch">查询</el-button>
        <el-button @click="onReset">清空</el-button>
      </el-form-item>
    </el-form>

    <el-alert type="info" :closable="false" show-icon class="hint">
      <template #title>
        货物名称只能从<strong>开头</strong>匹配;订单号要<strong>整串</strong>输入,只输入前几位是查不到的。
        两个条件同时填写时取<strong>同时满足</strong>。
        新增货物请到「订单信息管理」页面点对应订单的<strong>「货物增加」</strong> ——
        货物必须挂在订单下,不能凭空建。
      </template>
    </el-alert>

    <div class="toolbar">
      <!-- 本页没有"新增":货物必须挂在订单下,新增入口在订单页 -->
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
      <!-- 订单号放最前:这一页是"按订单看装了哪些货",订单号是主线索 -->
      <el-table-column label="所属订单号" width="220">
        <template #default="{ row }">
          <el-button
            v-if="row.orderId"
            link
            type="primary"
            @click="onOrderClick(row)"
          >
            {{ row.orderId }}
          </el-button>
          <span v-else>—</span>
        </template>
      </el-table-column>
      <el-table-column label="货物种类" min-width="160" show-overflow-tooltip>
        <template #default="{ row }">
          <!-- 没关联货物种类时不给点,免得弹一个查不到东西的框 -->
          <el-button
            v-if="row.cargoTypeName"
            link
            type="primary"
            @click="onCargoTypeClick(row)"
          >
            {{ row.cargoTypeName }}
          </el-button>
          <span v-else>—</span>
        </template>
      </el-table-column>
      <el-table-column prop="quantity" label="数量" width="120" align="right" />
      <el-table-column prop="insertTime" label="创建时间" width="180" />
      <el-table-column prop="updateTime" label="修改时间" width="180" />
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

    <!-- 点订单号:确认 → 在同一框里显示订单详情 -->
    <el-dialog
      v-model="orderDialogVisible"
      title="订单详情"
      width="560px"
      align-center
    >
      <template v-if="orderDialogPhase === 'confirm'">
        <div class="detail-line">
          <span class="detail-line__label">订单号</span>
          <span class="detail-line__value">{{ activeOrderId }}</span>
        </div>
        <p class="dialog-question">是否查询该订单的详细信息?</p>
      </template>

      <div v-else v-loading="orderDialogLoading" class="detail-body">
        <el-descriptions v-if="orderDetail" :column="1" border>
          <el-descriptions-item label="订单号">{{ orderDetail.id }}</el-descriptions-item>
          <el-descriptions-item label="客户姓名">
            {{ orderDetail.customerName || '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="起运港">
            {{ orderDetail.loadingPortName || '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="目的港">
            {{ orderDetail.dischargePortName || '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="下单时间">
            {{ orderDetail.orderDate || '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            {{ orderDetail.statusDescription || '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">
            {{ orderDetail.insertTime || '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="修改时间">
            {{ orderDetail.updateTime || '—' }}
          </el-descriptions-item>
        </el-descriptions>
      </div>

      <template #footer>
        <template v-if="orderDialogPhase === 'confirm'">
          <el-button type="primary" @click="onConfirmOrderDetail">查询</el-button>
          <el-button @click="orderDialogVisible = false">取消</el-button>
        </template>
        <el-button v-else @click="orderDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 点货物种类:确认 → 跳货物种类页并筛选 -->
    <el-dialog
      v-model="cargoTypeDialogVisible"
      title="货物种类"
      width="400px"
      align-center
    >
      <div class="detail-line">
        <span class="detail-line__label">货物种类</span>
        <span class="detail-line__value">{{ activeCargoTypeName }}</span>
      </div>
      <p class="dialog-question">是否查询该货物的相关信息?</p>

      <template #footer>
        <el-button type="primary" @click="onViewCargoType">查询</el-button>
        <el-button @click="cargoTypeDialogVisible = false">取消</el-button>
      </template>
    </el-dialog>

    <!-- 编辑货物。没有 GET /cargos/{id},所以整行直接传进去 -->
    <CargoFormDialog v-model="dialogVisible" :row="editingRow" @success="loadList" />
  </div>
</template>

<style scoped>
.detail-line {
  display: flex;
  align-items: baseline;
  gap: 12px;
  font-size: 15px;
}

.detail-line__label {
  color: #909399;
}

.detail-line__value {
  font-weight: 600;
  word-break: break-all;
}

.dialog-question {
  margin: 16px 0 0;
  color: #606266;
}

/* 给 loading 留出高度,避免加载时框子高度跳一下 */
.detail-body {
  min-height: 120px;
}
</style>
