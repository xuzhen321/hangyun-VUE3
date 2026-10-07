<script setup>
import { h, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  batchDeleteCargoTypes,
  deleteCargoType,
  fetchCargoTypes,
} from '@/api/cargoType'
import CargoTypeFormDialog from './CargoTypeFormDialog.vue'

const query = reactive({ name: '' })

const pager = reactive({ current: 1, size: 20, total: 0 })
const rows = ref([])
const loading = ref(false)
const selectedRows = ref([])

const dialogVisible = ref(false)
const editingId = ref(null)

const route = useRoute()
const router = useRouter()

// 点货物名称 → 先弹个确认框,确认后跳到订单货物页按名称筛
const cargoDialogVisible = ref(false)
const activeCargoName = ref(null)

/**
 * 点货物名称 → 看这个货物种类被哪些订单用到了。
 * 单元格文字点了不像是明确的操作意图,容易误触,所以先问一句。
 */
function onViewCargo(row) {
  activeCargoName.value = row.name
  cargoDialogVisible.value = true
}

/**
 * ⚠️ 订单货物那边只提供了 `cargoTypeName` 参数,而且是**前缀匹配**,没有按种类 id 精确筛的入口。
 * 所以点「钢材」也会把「钢材卷」的明细一起带出来。这是接口的限制,不是实现问题。
 */
function onConfirmViewCargo() {
  router.push({ path: '/cargos', query: { cargoTypeName: activeCargoName.value } })
  cargoDialogVisible.value = false
}

/** 重量/体积是数字,可空 —— 空的时候显示占位符,不要显示成 0 */
const fmtNum = v =>
  v === null || v === undefined || v === '' ? '—' : Number(v).toFixed(2)

async function loadList() {
  loading.value = true
  try {
    const data = await fetchCargoTypes({
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
  query.name = ''
  onSearch()
}

function onSizeChange() {
  pager.current = 1
  loadList()
}

function onSelectionChange(selection) {
  selectedRows.value = selection
}

function onCreate() {
  editingId.value = null
  dialogVisible.value = true
}

function onEdit(row) {
  editingId.value = row.id
  dialogVisible.value = true
}

async function onDelete(row) {
  try {
    await ElMessageBox.confirm(
      `确定删除货物种类「${row.name}」吗?删除后无法恢复。`,
      '提示',
      { type: 'warning' }
    )
    await deleteCargoType(row.id)
    ElMessage.success('删除成功')
    loadList()
  } catch {
    // 用户取消,或 404 / 409(msg 由拦截器原样弹出)
  }
}

/**
 * 批量删除。
 *
 * ⚠️ 这里**不能**套用客户 / 订单那套"宽松语义"的写法 ——
 * 货物种类的批量删除是**严格**的:只要有任何一个被引用,整批都会被拒绝,一条都不删。
 * 所以确认框里要提前讲清楚,否则用户看到 409 会以为是自己选错了。
 */
async function onBatchDelete() {
  const ids = selectedRows.value.map(r => r.id)
  if (!ids.length) return ElMessage.warning('请先选择要删除的货物种类')
  if (ids.length > 100) return ElMessage.warning('一次最多删除 100 条,请分批操作')

  try {
    // 用 VNode 而不是拼接 \n:ElMessageBox 的 message 是普通文本节点,换行符不会渲染
    await ElMessageBox.confirm(
      h('div', { style: 'line-height: 1.9' }, [
        h('div', `确定删除选中的 ${ids.length} 个货物种类吗?`),
        h('div', { style: 'color: #f56c6c; font-weight: 600' }, '删除后无法恢复。'),
        h(
          'div',
          '只要选中的种类里有任何一个下面还有货物,这次删除会整体取消,一个都不会删。'
        ),
      ]),
      '提示',
      { type: 'warning' }
    )
  } catch {
    return // 用户取消
  }

  try {
    await batchDeleteCargoTypes(ids)
    ElMessage.success(`已删除 ${ids.length} 条`)
    selectedRows.value = []
    loadList()
  } catch {
    // 409 时**什么都没删**,列表保持原样即可,不需要刷新 ——
    // msg 里会列出是哪几个种类被引用了,用户去掉后可以重新提交
  }
}

onMounted(() => {
  // 从订单货物页点「货物种类」跳过来时带着 ?name=,填进查询框直接定位。
  // ⚠️ 名称是**前缀匹配**,所以点「钢材」也会把「钢材卷」一起列出来 —— 接口就这一个维度。
  if (route.query.name) query.name = String(route.query.name)

  loadList()
})
</script>

<template>
  <div class="page">
    <!-- 查询条件行 -->
    <el-form :inline="true" :model="query" class="query-form" @submit.prevent>
      <el-form-item label="货物名称">
        <!-- 前缀匹配,所以提示写"开头几个字" -->
        <el-input
          v-model="query.name"
          placeholder="输入名称开头几个字"
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
        货物名称只能从<strong>开头</strong>匹配,输入名称开头几个字即可。
        删除后<strong>无法恢复</strong>,请谨慎操作。
        批量删除时,只要选中的种类里有<strong>任何一个</strong>下面还有货物,这次删除会<strong>整体取消,一个都不会删</strong>。
      </template>
    </el-alert>

    <div class="toolbar">
      <el-button type="primary" @click="onCreate">+ 新增货物种类</el-button>
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
      <!-- 不显示自增 id:它是内部标识,用户拿着做不了任何事 -->
      <el-table-column label="货物名称" min-width="140" show-overflow-tooltip>
        <template #default="{ row }">
          <!-- 点名称 → 看这个货物种类被哪些订单用到 -->
          <el-button link type="primary" @click="onViewCargo(row)">
            {{ row.name }}
          </el-button>
        </template>
      </el-table-column>
      <el-table-column
        prop="description"
        label="货物描述"
        min-width="200"
        show-overflow-tooltip
      />
      <el-table-column label="单件重量(kg)" width="140" align="right">
        <template #default="{ row }">{{ fmtNum(row.weightKg) }}</template>
      </el-table-column>
      <el-table-column label="单件体积(m³)" width="140" align="right">
        <template #default="{ row }">{{ fmtNum(row.volumeM3) }}</template>
      </el-table-column>
      <el-table-column prop="insertTime" label="创建时间" width="170" />
      <el-table-column prop="updateTime" label="修改时间" width="170" />
      <el-table-column label="操作" width="130" fixed="right">
        <template #default="{ row }">
          <!-- 物理删除,没有"恢复",所以操作列不依赖任何状态 -->
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

    <CargoTypeFormDialog v-model="dialogVisible" :id="editingId" @success="loadList" />

    <!-- 点货物名称弹出的确认框 -->
    <el-dialog
      v-model="cargoDialogVisible"
      title="订单货物"
      width="420px"
      align-center
    >
      <div class="detail-line">
        <span class="detail-line__label">货物种类</span>
        <span class="detail-line__value">{{ activeCargoName }}</span>
      </div>
      <p class="dialog-question">是否查询该货物种类下的订单货物?</p>

      <template #footer>
        <el-button type="primary" @click="onConfirmViewCargo">查询</el-button>
        <el-button @click="cargoDialogVisible = false">取消</el-button>
      </template>
    </el-dialog>
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
}

.dialog-question {
  margin: 16px 0 0;
  color: #606266;
}
</style>
