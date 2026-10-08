<script setup>
import { h, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  batchDeleteContainerEvents,
  deleteContainerEvent,
  fetchContainerEvents,
} from '@/api/containerEvent'
import { useEventStatusDict } from '@/stores/dict'
import ContainerEventFormDialog from './ContainerEventFormDialog.vue'

const statusDict = useEventStatusDict()
const router = useRouter()

const query = reactive({
  containerNo: '', // 箱号,**精确匹配**(不是前缀)
  eventStatusId: null,
  eventTimeFrom: '',
  eventTimeTo: '',
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
    const data = await fetchContainerEvents({
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
    eventStatusId: null,
    eventTimeFrom: '',
    eventTimeTo: '',
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

/**
 * 查看航次 —— 跳「航次管理」,把航次号预填进那边的查询框。
 *
 * ⚠️ 只能用**航次号**筛,而且它是**前缀匹配**,不是按 id 精确查 ——
 *    事件行里只有 `voy`(航次号)**没有 `voyageId`**(见 `物流事件前端设计方案.md` 第 6 节)。
 *    我们带的是完整航次号,所以实际只会命中它自己(以及号以它开头的),但严格说不是精确定位。
 */
function onViewVoyage(row) {
  router.push({ path: '/voyages', query: { no: row.voy } })
}

async function onDelete(row) {
  try {
    await ElMessageBox.confirm(
      `确定删除这条物流事件吗?删除后它的状态会变成「已删除」,默认列表里不再显示。`,
      '提示',
      { type: 'warning' }
    )
    await deleteContainerEvent(row.id)
    ElMessage.success('删除成功')
    loadList()
  } catch {
    // 用户取消,或 404(msg 由拦截器弹出)
  }
}

/**
 * 批量删除。
 *
 * 📌 逻辑删除 + **宽松语义**:存在就改状态、不存在的忽略、幂等,没有 404/409。
 *    所以确认框里**不用**写"整批拒绝",也**不用**写"无法恢复"
 *    —— 反而该告诉用户**能筛回来**(把状态筛成「已删除」)。
 *
 * ⚠️ 字段名是普通的 `ids`(事件 id 是自增数字)。
 */
async function onBatchDelete() {
  const ids = selectedRows.value.map(r => r.id)
  if (!ids.length) return ElMessage.warning('请先选择要删除的事件')
  if (ids.length > 100) return ElMessage.warning('一次最多删除 100 条,请分批操作')

  try {
    await ElMessageBox.confirm(
      `确定删除选中的 ${ids.length} 条物流事件吗?删除后它们的状态会变成「已删除」,默认列表里不再显示。`,
      '提示',
      { type: 'warning' }
    )
  } catch {
    return // 用户取消
  }

  try {
    await batchDeleteContainerEvents(ids)
    ElMessage.success(`已删除 ${ids.length} 条`)
    selectedRows.value = []
    loadList()
  } catch {
    // 400(空数组 / 超过 100)由拦截器提示
  }
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
        <!-- 精确匹配:必须整串,不是前缀 -->
        <el-input
          v-model="query.containerNo"
          placeholder="箱号整串精确匹配"
          clearable
          style="width: 200px"
          @keyup.enter="onSearch"
        />
      </el-form-item>
      <el-form-item label="事件状态">
        <!-- 这个下拉**包含「已删除」** —— 要看已删除的事件得显式筛(和表单里那个不一样) -->
        <el-select
          v-model="query.eventStatusId"
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
      <el-form-item label="发生时间从">
        <el-date-picker
          v-model="query.eventTimeFrom"
          type="datetime"
          value-format="YYYY-MM-DD HH:mm:ss"
          format="YYYY-MM-DD HH:mm:ss"
          placeholder="起始时间"
          style="width: 200px"
        />
      </el-form-item>
      <el-form-item label="发生时间至">
        <!-- 两个独立 picker 而不是 datetimerange:后端 From/To 都能单独传 -->
        <el-date-picker
          v-model="query.eventTimeTo"
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

    <el-alert type="info" :closable="false" show-icon class="hint">
      <template #title>
        箱号要<strong>整串</strong>输入,只输入前几位是查不到的。列表按<strong>发生时间倒序</strong>(最近的排最前)。
        不选状态时<strong>已删除的事件不会出现在列表里</strong>,要看已删除的把状态筛成「已删除」。
        删除是<strong>改状态</strong>,数据还在,但<strong>不会再出现在集装箱轨迹里</strong>。
      </template>
    </el-alert>

    <div class="toolbar">
      <el-button type="primary" @click="onCreate">+ 新增物流事件</el-button>
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
      <el-table-column prop="containerNo" label="箱号" width="140" />
      <el-table-column prop="vslName" label="船名" min-width="120" show-overflow-tooltip />
      <el-table-column prop="voy" label="航次号" width="110" />
      <el-table-column label="事件状态" width="110">
        <template #default="{ row }">
          <!-- 状态描述后端带出来了,直接用 -->
          {{ row.descriptionCn || '—' }}
        </template>
      </el-table-column>
      <el-table-column prop="eventTime" label="发生时间" width="170" />
      <el-table-column label="实际/预计" width="100" align="center">
        <template #default="{ row }">
          <!-- isEsti 返回的就是中文文字("实际"/"预计"),直接用,不用转换 -->
          <el-tag v-if="row.isEsti === '预计'" type="warning" effect="light">预计</el-tag>
          <el-tag v-else-if="row.isEsti === '实际'" type="success" effect="light">实际</el-tag>
          <span v-else>—</span>
        </template>
      </el-table-column>
      <el-table-column prop="eventPlace" label="发生地" min-width="120" show-overflow-tooltip />
      <el-table-column prop="source" label="来源" width="90" />
      <el-table-column label="操作" width="280" fixed="right">
        <template #default="{ row }">
          <!-- 没关联航次时不给点:跳过去只能是一张没过滤的全量列表 -->
          <el-button
            link
            type="primary"
            :disabled="!row.voy"
            @click="onViewVoyage(row)"
          >
            查看航次
          </el-button>

          <!--
            ⚠️ 「查看船舶」暂时**置灰** —— 船舶模块还没做,它现在没有目的地。
            直接放一个点了没反应的按钮,比置灰更糟(用户会以为坏了)。
            等船舶模块做完,把 disabled 去掉、换成跳转即可。
            另外注意:事件行里只有 `vslName`(船名),没有 `vslId`,到时候也得先解决这个。
          -->
          <el-tooltip
            content="船舶模块还没做,做完之后这里会跳到该船舶"
            placement="top"
          >
            <span>
              <el-button link type="primary" disabled>查看船舶</el-button>
            </span>
          </el-tooltip>

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

    <ContainerEventFormDialog
      v-model="dialogVisible"
      :row="editingRow"
      @success="loadList"
    />
  </div>
</template>
