<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { batchDeleteCustomers, deleteCustomer, fetchCustomers } from '@/api/customer'
import { cleanQuery } from '@/utils/exportExcel'
import { useExport } from '@/composables/useExport'
import { CUSTOMER_STATUS } from '@/constants/dict'
import { tagStyleOf } from '@/constants/status'
import { useCustomerStatusDict } from '@/stores/dict'
import CustomerFormDialog from './CustomerFormDialog.vue'

const dict = useCustomerStatusDict()
const route = useRoute()
const router = useRouter()

// 配色规则收在 constants/status.js,客户和订单两个页面共用一套
const statusTag = id => tagStyleOf(CUSTOMER_STATUS, id)

/** 查询条件。字段名按 api 层的入参约定走(name/qualification/validFrom/validTo/status) */
const query = reactive({
  name: '',
  qualification: '',
  validFrom: '',
  validTo: '',
  status: null,
})

// 命名避开 api 层的 page/size
const { exporting, doExport } = useExport()

const pager = reactive({ current: 1, size: 20, total: 0 })
const rows = ref([])
const loading = ref(false)
const selectedRows = ref([])

const dialogVisible = ref(false)
const editingId = ref(null)

async function loadList() {
  loading.value = true
  try {
    const data = await fetchCustomers({
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
    name: '',
    qualification: '',
    validFrom: '',
    validTo: '',
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
  editingId.value = row.id
  dialogVisible.value = true
}

/**
 * 恢复已注销客户。
 * 没有专用接口,只能 PUT 把 statusId 改回 1 —— 所以直接复用编辑弹窗:
 * 它会先 GET 完整详情再回填,天然满足 PUT 的"整体覆盖"语义,不会漏字段。
 */
function onRestore(row) {
  editingId.value = row.id
  dialogVisible.value = true
  ElMessage.info('把状态改为「正常」后保存即可恢复')
}

/**
 * 跳到"该客户名下的订单"页。
 * 走 5.8 的 `/customers/{id}/orders` —— 按 id 精确查,不像订单列表那样只能按姓名前缀搜
 * (所以同名客户不会混进来)。
 */
function onViewOrders(row) {
  router.push({
    name: 'customerOrders',
    params: { id: row.id },
    // name 带过去当标题(省一次客户详情请求);
    // from 告诉那个页面「返回」该回到哪 —— 这里是客户列表
    query: { name: row.name, from: 'customers' },
  })
}

async function onDelete(row) {
  try {
    await ElMessageBox.confirm(
      `确定删除客户「${row.name}」吗?删除后客户状态将变为「注销」。`,
      '提示',
      { type: 'warning' }
    )
    await deleteCustomer(row.id)
    ElMessage.success('删除成功')
    loadList()
  } catch {
    // 用户取消,或 404 由拦截器提示
  }
}

async function onBatchDelete() {
  const ids = selectedRows.value.map(r => r.id)
  if (!ids.length) return ElMessage.warning('请先选择要删除的客户')
  if (ids.length > 100) return ElMessage.warning('一次最多删除 100 条,请分批操作')

  try {
    await ElMessageBox.confirm(
      `确定删除选中的 ${ids.length} 位客户吗?删除后客户状态将变为「注销」。`,
      '提示',
      { type: 'warning' }
    )
  } catch {
    return // 用户取消
  }

  try {
    // 接口语义宽松:不存在的 id 会被忽略,返回 200 就是全部处理完了
    await batchDeleteCustomers(ids)
    ElMessage.success(`已删除 ${ids.length} 条`)
    selectedRows.value = []
    loadList()
  } catch {
    // 400(空数组 / 超过 100)由拦截器提示
  }
}

/** 导出。**查询条件原样带过去** —— 导出的内容和你列表里看到的一致。
 *
 * ⚠️ **这两个时间字段在页面上叫 `validFrom` / `validTo`,后端要的是
 *    `qualificationValidToFrom` / `...To`** —— 列表接口那边是靠 api 层翻译的,
 *    导出这里也得自己翻一次,不能把 query 原样扔过去(原名后端不认)。
 *    空的那几项由 cleanQuery 剔掉,不然后端会当成"按空值筛"。
 */
function onExport() {
  const { validFrom, validTo, ...rest } = query
  doExport(
    '/customers/export',
    cleanQuery({
      ...rest,
      qualificationValidToFrom: validFrom,
      qualificationValidToTo: validTo,
    }),
    '客户'
  )
}

onMounted(() => {
  // 从订单页点客户姓名 →「查询客户详细信息」跳过来时带着 ?name=,
  // 把它填进姓名查询框,列表直接定位到这位客户。
  // ⚠️ 客户列表没有 id 筛选参数,只能按姓名找,而姓名是**前缀匹配** ——
  //    所以同名(或名字以它开头)的客户会一起列出来,这是接口本身的限制。
  if (route.query.name) query.name = String(route.query.name)

  dict.load()
  loadList()
})
</script>

<template>
  <div class="page">
    <!-- 查询条件行 -->
    <el-form :inline="true" :model="query" class="query-form" @submit.prevent>
      <el-form-item label="客户姓名">
        <el-input
          v-model="query.name"
          placeholder="输入姓名开头几个字"
          clearable
          style="width: 180px"
          @keyup.enter="onSearch"
        />
      </el-form-item>
      <el-form-item label="资质信息">
        <el-input
          v-model="query.qualification"
          placeholder="输入资质开头几个字"
          clearable
          style="width: 180px"
          @keyup.enter="onSearch"
        />
      </el-form-item>
      <el-form-item label="有效期从">
        <!-- value-format 不能省:不加的话 v-model 拿到 Date 对象,提交时后端会 400 -->
        <el-date-picker
          v-model="query.validFrom"
          type="datetime"
          value-format="YYYY-MM-DD HH:mm:ss"
          format="YYYY-MM-DD HH:mm:ss"
          placeholder="起始时间"
          style="width: 200px"
        />
      </el-form-item>
      <el-form-item label="有效期至">
        <!-- 刻意用两个独立的 picker 而不是 datetimerange:
             后端 From/To 都能单独传,range 只能两端全有或全无 -->
        <el-date-picker
          v-model="query.validTo"
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
        姓名 / 资质只能从<strong>开头</strong>匹配 —— 输入「张」能查到张伟,输入「马」查不到司马强。
        另外,不选状态时<strong>已注销的客户不会出现在列表里</strong>,要看已注销客户请把状态选成「注销」。
      </template>
    </el-alert>

    <!-- 操作按钮 -->
    <div class="toolbar">
      <el-button type="primary" @click="onCreate">+ 新增客户</el-button>
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
      @selection-change="onSelectionChange"
    >
      <el-table-column type="selection" width="48" />
      <el-table-column prop="name" label="客户姓名" width="110" />
      <el-table-column prop="phone" label="联系方式" width="140" />
      <el-table-column prop="email" label="电子邮箱" min-width="180" show-overflow-tooltip />
      <el-table-column prop="address" label="详细地址" min-width="200" show-overflow-tooltip />
      <el-table-column prop="qualification" label="资质信息" min-width="140" show-overflow-tooltip />
      <el-table-column prop="qualificationValidTo" label="资质有效期至" width="175" />
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <!-- 直接用后端联表带出的中文描述,不再拿 status 去字典里 find -->
          <el-tag v-bind="statusTag(row.status)">
            {{ row.statusDescription }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="250" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="onViewOrders(row)">订单查询</el-button>
          <el-button link type="primary" @click="onEdit(row)">编辑</el-button>
          <el-button v-if="row.status === 3" link type="success" @click="onRestore(row)">
            恢复
          </el-button>
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

    <CustomerFormDialog v-model="dialogVisible" :id="editingId" @success="loadList" />
  </div>
</template>
