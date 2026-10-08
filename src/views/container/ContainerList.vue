<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  batchDeleteContainers,
  deleteContainer,
  fetchContainers,
} from '@/api/container'
import { cleanQuery } from '@/utils/exportExcel'
import { useExport } from '@/composables/useExport'
import { useContainerStatusDict } from '@/stores/dict'
import ContainerFormDialog from './ContainerFormDialog.vue'
import ContainerTrackDialog from './ContainerTrackDialog.vue'

const statusDict = useContainerStatusDict()
const router = useRouter()
const route = useRoute()

const query = reactive({
  no: '', // 箱号,前缀匹配
  status: null, // 状态 ID,精确匹配
})

/**
 * 从公司页「集装箱详情」跳过来时带的筛选(这家公司作为箱主 / 操作方)。
 *
 * 📌 **不放进上面的查询表单** —— 表单只有"箱号 + 状态"两个框,而且这两个条件
 *    是从别的页面带进来的上下文,不是用户在这个页面上能编辑的东西。
 *    改成显示一个**可关闭的标签**,让用户知道列表为什么被过滤了,并且能一键去掉。
 */
const companyFilter = computed(() => {
  const { ownerId, operatorId, companyName, companyRole } = route.query
  if (!ownerId && !operatorId) return null
  return {
    ownerId: ownerId ? Number(ownerId) : undefined,
    operatorId: operatorId ? Number(operatorId) : undefined,
    name: companyName || '',
    role: companyRole || (ownerId ? '箱主' : '操作方'),
  }
})

/** 去掉公司筛选:清掉 URL 上的那几个参数,再重新查一次 */
async function clearCompanyFilter() {
  const rest = { ...route.query }
  delete rest.ownerId
  delete rest.operatorId
  delete rest.companyName
  delete rest.companyRole
  // 等导航完成再查 —— route.query 是异步更新的,不等的话这次查询还会用旧的筛选
  await router.replace({ path: '/containers', query: rest })
  onSearch()
}

const { exporting, doExport } = useExport()

const pager = reactive({ current: 1, size: 20, total: 0 })
const rows = ref([])
const loading = ref(false)
const selectedRows = ref([])

const dialogVisible = ref(false)
const editingRow = ref(null)

// 「查看轨迹」弹窗
const trackVisible = ref(false)
const trackNo = ref('')

function onViewTrack(row) {
  trackNo.value = row.no
  trackVisible.value = true
}

/** 箱型显示成「普通箱 / 40英尺」,两栏都可能为空 */
const fmtType = row => [row.typeName, row.typeSize].filter(Boolean).join(' / ') || '—'

function onSelectionChange(selection) {
  selectedRows.value = selection
}

async function loadList() {
  loading.value = true
  try {
    const data = await fetchContainers({
      page: pager.current,
      size: pager.size,
      ...query,
      // 公司筛选(如果从公司页跳过来的话)
      ownerId: companyFilter.value?.ownerId,
      operatorId: companyFilter.value?.operatorId,
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
  Object.assign(query, { no: '', status: null })
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

/**
 * 查看箱主 / 查看操作方 —— 跳到公司管理,并把公司名称预填进那边的关键字查询。
 *
 * ⚠️ 公司的 `keyword` 是**前缀匹配**(而且同时匹配名称和代码),不是按 id 精确查。
 *    我们带过去的是**完整公司名**,所以实际只会命中它自己(以及名字以它开头的),
 *    但严格说这不是精确定位 —— 公司列表接口没有按 id 筛的参数。
 *    要精确得到"点某个箱主只看那一家",得让后端给 `/companies` 加个 id 参数。
 */
function onViewCompany(name) {
  router.push({ path: '/companies', query: { keyword: name } })
}

async function onDelete(row) {
  try {
    await ElMessageBox.confirm(
      `确定删除集装箱「${row.no}」吗?删除后它的状态会变成「已删除」,默认列表里不再显示。`,
      '提示',
      { type: 'warning' }
    )
    await deleteContainer(row.no)
    ElMessage.success('删除成功')
    loadList()
  } catch {
    // 用户取消,或 404(msg 由拦截器弹出)
  }
}

/**
 * 批量删除。
 *
 * ⚠️ 两个和别处不一样的地方:
 *   1. 请求体的字段名是 **`nos`**(箱号字符串数组),不是 `ids` —— 这张表的主键是箱号
 *   2. 语义是**宽松的**(存在就删、不存在忽略、幂等),因为是逻辑删除,没有"删不掉"的情况。
 *      所以确认框里**不用**写"整批拒绝",也**不用**写"无法恢复"(能在状态里筛回来看)
 */
async function onBatchDelete() {
  // 箱号本来就是字符串,原样收集
  const nos = selectedRows.value.map(r => r.no)
  if (!nos.length) return ElMessage.warning('请先选择要删除的集装箱')
  if (nos.length > 100) return ElMessage.warning('一次最多删除 100 个,请分批操作')

  try {
    await ElMessageBox.confirm(
      `确定删除选中的 ${nos.length} 个集装箱吗?删除后它们的状态会变成「已删除」,默认列表里不再显示。`,
      '提示',
      { type: 'warning' }
    )
  } catch {
    return // 用户取消
  }

  try {
    await batchDeleteContainers(nos)
    ElMessage.success(`已删除 ${nos.length} 个`)
    selectedRows.value = []
    loadList()
  } catch {
    // 400(空数组 / 超过 100)由拦截器提示
  }
}

/** 导出。**查询条件原样带过去** —— 导出的内容和你列表里看到的一致。
 *
 * ⚠️ **公司筛选也要带上** —— 它是从公司页「集装箱详情」跳过来时带的上下文,
 *    不在查询表单里,如果漏了,导出的会是全部集装箱而不是当前看到的那些。
 *    空的那几项由 cleanQuery 剔掉,不然后端会当成"按空值筛"。
 */
function onExport() {
  doExport(
    '/containers/export',
    cleanQuery({
      ...query,
      ownerId: companyFilter.value?.ownerId,
      operatorId: companyFilter.value?.operatorId,
    }),
    '集装箱'
  )
}

onMounted(() => {
  statusDict.load()
  loadList()
})
</script>

<template>
  <div class="page">
    <!-- 查询条件行 -->
    <el-form :inline="true" :model="query" class="query-form" @submit.prevent>
      <el-form-item label="箱号">
        <el-input
          v-model="query.no"
          placeholder="输入箱号开头几个字符"
          clearable
          style="width: 200px"
          @keyup.enter="onSearch"
        />
      </el-form-item>
      <el-form-item label="状态">
        <!-- 这个下拉**包含「已删除」** —— 12.1 说了,不传 status 时已删除的不显示,
             要看得显式筛。所以它和表单里那个下拉不一样(那个要滤掉已删除) -->
        <el-select
          v-model="query.status"
          placeholder="全部状态"
          clearable
          style="width: 160px"
        >
          <el-option
            v-for="o in statusDict.options"
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
        箱号只能从<strong>开头</strong>匹配。不选状态时<strong>已删除的集装箱不会出现在列表里</strong>,
        要看已删除的把状态筛成「已删除」。删除是<strong>改状态</strong>,数据还在,
        但<strong>已删除的箱子不能再用来装货</strong>。
      </template>
    </el-alert>

    <div class="toolbar">
      <el-button type="primary" @click="onCreate">+ 新增集装箱</el-button>
      <el-button
        type="danger"
        :disabled="!selectedRows.length"
        @click="onBatchDelete"
      >
        批量删除
      </el-button>

      <!-- 从公司页跳过来时的筛选提示,点 × 去掉 -->
      <el-tag
        v-if="companyFilter"
        closable
        type="info"
        size="large"
        class="company-tag"
        @close="clearCompanyFilter"
      >
        {{ companyFilter.role }}:{{ companyFilter.name || '已选公司' }}
      </el-tag>
      <el-button :loading="exporting" @click="onExport">导出</el-button>
    </div>

    <el-table
      v-loading="loading"
      :data="rows"
      border
      row-key="no"
      @selection-change="onSelectionChange"
    >
      <el-table-column type="selection" width="48" />
      <el-table-column prop="no" label="箱号" width="150" />
      <el-table-column label="箱型" min-width="130" show-overflow-tooltip>
        <template #default="{ row }">{{ fmtType(row) }}</template>
      </el-table-column>
      <el-table-column prop="ownerName" label="箱主" min-width="160" show-overflow-tooltip />
      <el-table-column prop="operatorName" label="操作方" min-width="160" show-overflow-tooltip />
      <el-table-column prop="sealNo" label="铅封号" width="120" />
      <el-table-column prop="statusDescription" label="状态" width="100" />
      <el-table-column label="危险品" width="90" align="center">
        <template #default="{ row }">
          <el-tag v-if="row.dangerFlag" type="danger" effect="light">危险品</el-tag>
          <span v-else>否</span>
        </template>
      </el-table-column>
      <el-table-column label="海事标识" width="90" align="center">
        <template #default="{ row }">
          <el-tag v-if="row.maritimeFlag" type="warning" effect="light">是</el-tag>
          <span v-else>否</span>
        </template>
      </el-table-column>
      <el-table-column
        prop="ctrStatusTerminal"
        label="堆场状态"
        min-width="130"
        show-overflow-tooltip
      />
      <el-table-column prop="insertTime" label="创建时间" width="170" />
      <el-table-column label="操作" width="360" fixed="right">
        <template #default="{ row }">
          <!-- 轨迹是"这个箱子发生过什么"的时间轴,任何箱子都能看(没有事件就是空) -->
          <el-button link type="primary" @click="onViewTrack(row)">查看轨迹</el-button>
          <!-- 没关联公司时不给点:跳过去只能是一张没过滤的全量列表 -->
          <el-button
            link
            type="primary"
            :disabled="!row.ownerId"
            @click="onViewCompany(row.ownerName)"
          >
            查看箱主
          </el-button>
          <el-button
            link
            type="primary"
            :disabled="!row.operatorId"
            @click="onViewCompany(row.operatorName)"
          >
            查看操作方
          </el-button>
          <!--
            只有编辑 / 删除,**没有"恢复"** —— 恢复可以把状态改回非「已删除」,
            但那是"编辑"能干的事,单独做一个入口产品上没提,先不加。
          -->
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

    <ContainerFormDialog v-model="dialogVisible" :row="editingRow" @success="loadList" />

    <ContainerTrackDialog v-model="trackVisible" :no="trackNo" />
  </div>
</template>

<style scoped>
/* 公司筛选标签:跟在两个按钮后面,留点间距,别贴太紧 */
.company-tag {
  margin-left: 12px;
  vertical-align: middle;
}
</style>
