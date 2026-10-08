<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { batchDeleteOrders, deleteOrder, fetchOrders } from '@/api/order'
import { cleanQuery } from '@/utils/exportExcel'
import { useExport } from '@/composables/useExport'
import { ORDER_STATUS } from '@/constants/dict'
import { tagStyleOf } from '@/constants/status'
import { useOrderStatusDict } from '@/stores/dict'
import OrderFormDialog from './OrderFormDialog.vue'
import CargoFormDialog from '@/components/CargoFormDialog.vue'

const dict = useOrderStatusDict()
const router = useRouter()
const statusTag = id => tagStyleOf(ORDER_STATUS, id)

/** 查询条件。字段名按 api 层的入参约定走 */
const query = reactive({
  customerName: '',
  orderDateFrom: '',
  orderDateTo: '',
  status: null,
})

const { exporting, doExport } = useExport()

const pager = reactive({ current: 1, size: 20, total: 0 })
const rows = ref([])
const loading = ref(false)
const selectedRows = ref([])

const dialogVisible = ref(false)
/** 订单号是**字符串**;null 表示新增 */
const editingId = ref(null)

// 点客户姓名弹出的操作表单
const customerDialogVisible = ref(false)
const activeCustomer = ref(null) // 来自被点击的那一行订单：{ id, name }

// 「货物增加」弹窗
const cargoFormVisible = ref(false)
const cargoFormOrderId = ref(null)

/**
 * 给这张订单加货物。
 *
 * 📌 **新增入口只放在这里,订单货物页没有"新增"按钮** ——
 *    `POST /cargos` 的 `orderId` 是必填的,货物必须挂在订单下,不能凭空建。
 *    从订单行进来,订单号由这一行带过去,用户不用手填(19 位数字手敲必错)。
 */
function onAddCargo(row) {
  cargoFormOrderId.value = row.id // 订单号字符串,原样带过去
  cargoFormVisible.value = true
}

async function loadList() {
  loading.value = true
  try {
    const data = await fetchOrders({
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
  Object.assign(query, {
    customerName: '',
    orderDateFrom: '',
    orderDateTo: '',
    status: null,
  })
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
  // 传原始字符串,不要做任何数值转换
  editingId.value = row.id
  dialogVisible.value = true
}

/**
 * 点订单行里的客户姓名 → 弹出操作表单。
 * OrderVO 的 customerId / customerName 都是可空的,没关联客户时不给点。
 */
function onCustomerClick(row) {
  if (!row.customerId) return
  activeCustomer.value = { id: row.customerId, name: row.customerName }
  customerDialogVisible.value = true
}

/**
 * 和客户列表操作列的「订单查询」进的是同一个页面。
 *
 * ⚠️ 必须带 `from=orders` —— 那个页面的「返回」按钮靠它决定回到哪:
 *    从订单页进来的要回订单列表,从客户页进来的要回客户列表。
 */
function onViewCustomerOrders() {
  router.push({
    name: 'customerOrders',
    params: { id: activeCustomer.value.id },
    query: { name: activeCustomer.value.name, from: 'orders' },
  })
  customerDialogVisible.value = false
}

/**
 * 跳回客户信息管理,并把客户姓名填进那边的查询条件。
 *
 * 只能按姓名找:客户列表没有 id 筛选参数(5.1 的参数就 name/qualification/有效期/status),
 * 而且 name 是**前缀匹配** —— 所以同名客户会一起列出来,这是接口本身的限制。
 */
function onViewCustomerDetail() {
  router.push({ path: '/customers', query: { name: activeCustomer.value.name } })
  customerDialogVisible.value = false
}

/**
 * 跳到"这单装了哪些货"。
 * 订单号按**精确匹配**查(后端就是这么设计的,见文档 10.1),所以整串带过去,不做任何转换。
 */
function onViewCargo(row) {
  router.push({ path: '/cargos', query: { orderId: row.id } })
}

async function onDelete(row) {
  try {
    await ElMessageBox.confirm(
      `确定删除订单「${row.id}」吗?删除后订单状态将变为「已取消」。`,
      '提示',
      { type: 'warning' }
    )
    await deleteOrder(row.id)
    ElMessage.success('删除成功')
    loadList()
  } catch {
    // 用户取消,或 404 由拦截器提示
  }
}

async function onBatchDelete() {
  // 订单号本来就是字符串,原样收集 —— 任何数值转换都会让末几位变成 0
  const ids = selectedRows.value.map(r => r.id)
  if (!ids.length) return ElMessage.warning('请先选择要删除的订单')
  if (ids.length > 100) return ElMessage.warning('一次最多删除 100 条,请分批操作')

  try {
    await ElMessageBox.confirm(
      `确定删除选中的 ${ids.length} 张订单吗?删除后订单状态将变为「已取消」。`,
      '提示',
      { type: 'warning' }
    )
  } catch {
    return // 用户取消
  }

  try {
    // 接口语义宽松:不存在的订单号会被忽略,返回 200 就是全部处理完了
    await batchDeleteOrders(ids)
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
  doExport('/orders/export', cleanQuery(query), '订单')
}

onMounted(() => {
  dict.load()
  loadList()
})
</script>

<template>
  <div class="page">
    <!-- 查询条件行 -->
    <el-form :inline="true" :model="query" class="query-form" @submit.prevent>
      <el-form-item label="客户姓名">
        <!--
          刻意用普通文本框,不做成客户下拉框:
          后端按客户筛选收的是「姓名前缀」而不是 id(文档 7.1),
          做成下拉反而会错位 —— 同名客户会互相干扰,已注销的客户也不在候选里。
        -->
        <el-input
          v-model="query.customerName"
          placeholder="输入姓名开头几个字"
          clearable
          style="width: 180px"
          @keyup.enter="onSearch"
        />
      </el-form-item>
      <el-form-item label="下单时间从">
        <!-- value-format 不能省,否则 v-model 拿到 Date 对象,提交时后端会 400 -->
        <el-date-picker
          v-model="query.orderDateFrom"
          type="datetime"
          value-format="YYYY-MM-DD HH:mm:ss"
          format="YYYY-MM-DD HH:mm:ss"
          placeholder="起始时间"
          style="width: 200px"
        />
      </el-form-item>
      <el-form-item label="下单时间至">
        <!-- 两个独立 picker 而不是 datetimerange:后端 From/To 都能单独传 -->
        <el-date-picker
          v-model="query.orderDateTo"
          type="datetime"
          value-format="YYYY-MM-DD HH:mm:ss"
          format="YYYY-MM-DD HH:mm:ss"
          placeholder="截止时间"
          style="width: 200px"
        />
      </el-form-item>
      <el-form-item label="状态">
        <el-select
          v-model="query.status"
          placeholder="全部状态"
          clearable
          style="width: 140px"
        >
          <el-option
            v-for="o in dict.options"
            :key="o.value"
            :label="o.label"
            :value="o.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="onSearch">查询</el-button>
        <el-button @click="onReset">清空</el-button>
      </el-form-item>
    </el-form>

    <el-alert type="info" :closable="false" show-icon class="hint">
      <template #title>
        客户姓名只能从<strong>开头</strong>匹配,同名客户会被一起搜出来。
        不选状态时<strong>已取消的订单不会出现在列表里</strong>,要看已取消订单请把状态选成「已取消」。
      </template>
    </el-alert>

    <div class="toolbar">
      <el-button type="primary" @click="onCreate">+ 新增订单</el-button>
      <el-button
        type="danger"
        :disabled="!selectedRows.length"
        @click="onBatchDelete"
      >
        批量删除
      </el-button>
      <el-button :loading="exporting" @click="onExport">导出</el-button>
    </div>

    <!-- row-key 用订单号字符串本身,千万不要包一层 Number() -->
    <el-table
      v-loading="loading"
      :data="rows"
      border
      row-key="id"
      @selection-change="onSelectionChange"
    >
      <el-table-column type="selection" width="48" />
      <!-- 订单号不做成链接:看货物走操作列的「货物查询」按钮更直观 -->
      <el-table-column prop="id" label="订单号" width="200" />
      <el-table-column label="客户姓名" width="120">
        <template #default="{ row }">
          <!-- 点开操作表单;订单没关联客户时不给点(customerId / customerName 都可空) -->
          <el-button
            v-if="row.customerId"
            link
            type="primary"
            @click="onCustomerClick(row)"
          >
            {{ row.customerName }}
          </el-button>
          <span v-else>{{ row.customerName || '—' }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="loadingPortName" label="起运港" min-width="140" show-overflow-tooltip />
      <el-table-column prop="dischargePortName" label="目的港" min-width="140" show-overflow-tooltip />
      <el-table-column prop="orderDate" label="下单时间" width="170" />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <!-- 直接用后端联表带出的中文描述,不再拿 status 去字典里 find -->
          <el-tag v-bind="statusTag(row.status)">
            {{ row.statusDescription }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="insertTime" label="创建时间" width="170" />
      <el-table-column label="操作" width="270" fixed="right">
        <template #default="{ row }">
          <!--
            已取消的订单**也保留"编辑"**(接口不拦,后端明确要求前端承担这个约束),
            但没有"恢复"按钮 —— 取消代表这笔单结束,产品上不给撤销入口。
            所以操作列不依赖 status,任何状态都只有这几个按钮。
          -->
          <el-button link type="primary" @click="onViewCargo(row)">货物查询</el-button>
          <el-button link type="primary" @click="onAddCargo(row)">货物增加</el-button>
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

    <OrderFormDialog v-model="dialogVisible" :id="editingId" @success="loadList" />

    <!-- 点客户姓名弹出的操作表单 -->
    <el-dialog
      v-model="customerDialogVisible"
      title="客户信息"
      width="400px"
      align-center
    >
      <!-- 只显示姓名:客户 id 是内部标识,对用户没有意义 -->
      <div v-if="activeCustomer" class="customer-line">
        <span class="customer-line__label">客户姓名</span>
        <span class="customer-line__value">{{ activeCustomer.name || '—' }}</span>
      </div>

      <template #footer>
        <el-button @click="onViewCustomerOrders">查询更多订单</el-button>
        <el-button type="primary" @click="onViewCustomerDetail">
          查询客户详细信息
        </el-button>
        <el-button @click="customerDialogVisible = false">取消</el-button>
      </template>
    </el-dialog>

    <!--
      给这张订单加货物(新增入口)。
      不监听 success:订单列表的字段里没有货物信息,加完货物这一页没有任何变化,不需要刷新。
    -->
    <CargoFormDialog v-model="cargoFormVisible" :order-id="cargoFormOrderId" />
  </div>
</template>

<style scoped>
.customer-line {
  display: flex;
  align-items: baseline;
  gap: 12px;
  font-size: 15px;
}

.customer-line__label {
  color: #909399;
}

.customer-line__value {
  font-weight: 600;
}
</style>
