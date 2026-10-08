<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { deleteVoyage, fetchVoyages } from '@/api/voyage'
import { cleanQuery } from '@/utils/exportExcel'
import { useExport } from '@/composables/useExport'
import { searchPorts } from '@/api/port'
import { useRemoteSelect } from '@/composables/useRemoteSelect'
import VoyageFormDialog from './VoyageFormDialog.vue'

const route = useRoute()

const query = reactive({
  no: '', // 航次号,前缀匹配
  loadingPortId: null, // 起始港口 ID,精确匹配
})

const { exporting, doExport } = useExport()

const pager = reactive({ current: 1, size: 20, total: 0 })
const rows = ref([])
const loading = ref(false)

const dialogVisible = ref(false)
const editingRow = ref(null)

// 查询条件里的"起始港口"下拉 —— 复用 8.1 的港口搜索
const {
  options: portOptions,
  loading: portLoading,
  search: searchPort,
  load: loadPortList,
} = useRemoteSelect(kw => searchPorts(kw), {
  toOption: p => ({ value: p.id, label: p.cnname, sub: p.unlocode || '' }),
  selected: () => [query.loadingPortId],
  // 查询条件不是表单,选中项被搜索冲掉时用 id 兜底显示
  labelOf: id => `港口 #${id}`,
})

async function loadList() {
  loading.value = true
  try {
    const data = await fetchVoyages({
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
  Object.assign(query, { no: '', loadingPortId: null })
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
      `确定删除航次「${row.no || '#' + row.id}」吗?删除后无法恢复。`,
      '提示',
      { type: 'warning' }
    )
    await deleteVoyage(row.id)
    ElMessage.success('删除成功')
    loadList()
  } catch {
    // 用户取消,或 404 / 409(还有物流事件挂在这个航次上)由拦截器弹出
  }
}

/**
 * 导出。**查询条件原样带过去** —— 导出的内容和你列表里看到的一致。
 * 空的那几项由 cleanQuery 剔掉,不然后端会当成"按空值筛"。
 */
function onExport() {
  doExport('/voyages/export', cleanQuery(query), '航次')
}

onMounted(() => {
  // 从物流事件页点「查看航次」跳过来时带着 ?no=,填进查询框直接定位。
  // ⚠️ 航次号的筛选是**前缀匹配**,不是按 id 精确查 ——
  //    我们带的是完整航次号,所以实际只会命中它自己(以及号以它开头的),
  //    严格说不是精确定位。要"点某条事件只看那个航次",得让后端加个 id 参数。
  if (route.query.no) query.no = String(route.query.no)

  loadPortList('')
  loadList()
})
</script>

<template>
  <div class="page">
    <!-- 查询条件行 -->
    <el-form :inline="true" :model="query" class="query-form" @submit.prevent>
      <el-form-item label="航次号">
        <el-input
          v-model="query.no"
          placeholder="输入航次号开头几个字符"
          clearable
          style="width: 200px"
          @keyup.enter="onSearch"
        />
      </el-form-item>
      <el-form-item label="起始港口">
        <el-select
          v-model="query.loadingPortId"
          filterable
          remote
          clearable
          :remote-method="searchPort"
          :loading="portLoading"
          placeholder="输入港口名称搜索"
          style="width: 220px"
        >
          <el-option
            v-for="o in portOptions"
            :key="o.value"
            :value="o.value"
            :label="o.label"
          >
            <span>{{ o.label }}</span>
            <span class="option-sub">{{ o.sub }}</span>
          </el-option>
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="onSearch">查询</el-button>
        <el-button @click="onReset">清空</el-button>
      </el-form-item>
    </el-form>

    <el-alert type="info" :closable="false" show-icon class="hint">
      <template #title>
        航次号从<strong>开头</strong>匹配。列表按<strong>最新录入的排最前</strong>。
        航次号<strong>不是全库唯一</strong> —— 唯一的是「<strong>船 + 航次号</strong>」这一对:
        同一条船下不能有重复的航次号,不同船之间可以重号(航次号是船公司自编的,重号很常见)。
        <strong>船或航次号任一为空就不查重</strong>。删除后<strong>无法恢复</strong>;
        如果还有物流事件挂在这个航次上,后端会拒绝并说明原因。
      </template>
    </el-alert>

    <div class="toolbar">
      <el-button type="primary" @click="onCreate">+ 新增航次</el-button>
      <!-- 航次没有批量删除接口,所以不放"批量删除"、表格也不放复选框列 -->
      <el-button :loading="exporting" @click="onExport">导出</el-button>
    </div>

    <el-table v-loading="loading" :data="rows" border row-key="id">
      <el-table-column prop="no" label="航次号" width="160" />
      <!-- 船名后端联表带出来了,直接用 -->
      <el-table-column prop="vslName" label="船舶" min-width="160" show-overflow-tooltip />
      <el-table-column
        prop="loadingPortName"
        label="起始港口"
        min-width="180"
        show-overflow-tooltip
      />
      <el-table-column
        prop="dischargePortName"
        label="目的港口"
        min-width="180"
        show-overflow-tooltip
      />
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

    <VoyageFormDialog v-model="dialogVisible" :row="editingRow" @success="loadList" />
  </div>
</template>

<style scoped>
.option-sub {
  float: right;
  margin-left: 16px;
  color: #909399;
  font-size: 12px;
}
</style>
