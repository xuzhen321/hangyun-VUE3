<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { deletePort, fetchPorts, searchPorts } from '@/api/port'
import { cleanQuery } from '@/utils/exportExcel'
import { useExport } from '@/composables/useExport'
import { fetchCountryOptions } from '@/api/country'
import { useRemoteSelect } from '@/composables/useRemoteSelect'
import PortFormDialog from './PortFormDialog.vue'

/**
 * `state` 的取值(后端维护,前端只读)。
 * 列表里**看不到 3**(已删除的永远不出现),但详情里能看到。
 */
const STATE_TEXT = { 0: '默认', 1: '新增', 2: '修改', 3: '已删除' }
const stateText = s => STATE_TEXT[s] ?? '—'

const query = reactive({
  keyword: '', // 前缀匹配 五字码 / 中文名 / 英文名
  countryId: null,
})

const { exporting, doExport } = useExport()

const pager = reactive({ current: 1, size: 20, total: 0 })
const rows = ref([])
const loading = ref(false)

const dialogVisible = ref(false)
const editingRow = ref(null)

// 查询条件里的"国家"下拉
const {
  options: countryOptions,
  loading: countryLoading,
  search: searchCountry,
  load: loadCountryList,
} = useRemoteSelect(kw => fetchCountryOptions(kw), {
  toOption: c => ({ value: c.id, label: c.countryCnname || c.countryCode, sub: c.countryCode }),
  selected: () => [query.countryId],
  labelOf: id => `国家 #${id}`,
})

async function loadList() {
  loading.value = true
  try {
    const data = await fetchPorts({
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
  Object.assign(query, { keyword: '', countryId: null })
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
      `确定删除港口「${row.cnname || row.unlocode}」吗?删除后它会从列表和下拉框里消失。`,
      '提示',
      { type: 'warning' }
    )
    await deletePort(row.id)
    ElMessage.success('删除成功')
    loadList()
  } catch {
    // 用户取消,或 404(msg 由拦截器弹出)
  }
}

/**
 * 导出。**查询条件原样带过去** —— 导出的内容和你列表里看到的一致。
 * 空的那几项由 cleanQuery 剔掉,不然后端会当成"按空值筛"。
 */
function onExport() {
  doExport('/ports/export', cleanQuery(query), '港口')
}

onMounted(() => {
  loadCountryList('')
  loadList()
})
</script>

<template>
  <div class="page">
    <!-- 查询条件行 -->
    <el-form :inline="true" :model="query" class="query-form" @submit.prevent>
      <el-form-item label="关键字">
        <el-input
          v-model="query.keyword"
          placeholder="五字码 / 中文名 / 英文名开头几个字"
          clearable
          style="width: 240px"
          @keyup.enter="onSearch"
        />
      </el-form-item>
      <el-form-item label="国家">
        <el-select
          v-model="query.countryId"
          filterable
          remote
          clearable
          :remote-method="searchCountry"
          :loading="countryLoading"
          placeholder="输入国家代码 / 中英文名"
          style="width: 220px"
        >
          <el-option v-for="o in countryOptions" :key="o.value" :value="o.value" :label="o.label">
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
        关键字从<strong>开头</strong>匹配。已删除的港口<strong>不会出现在列表里,也不会出现在下拉框里</strong>
        (下单、航次、物流事件选港口时都选不到它)。删除是<strong>改状态</strong>,已被引用的港口照样删得掉,
        历史记录不会悬空。港口<strong>不支持批量删除</strong>。
      </template>
    </el-alert>

    <div class="toolbar">
      <el-button type="primary" @click="onCreate">+ 新增港口</el-button>
      <!-- 港口没有批量删除接口,所以不放"批量删除"、表格也不放复选框列 -->
      <el-button :loading="exporting" @click="onExport">导出</el-button>
    </div>

    <!--
      列**铺满文档 24.1 返回的全部业务字段**(除了 id —— 内部标识,见"表格不显示自增 id"的口径)。
      所以表很宽,横向滚动是预期的。
    -->
    <el-table v-loading="loading" :data="rows" border row-key="id">
      <el-table-column prop="unlocode" label="五字码" width="110" fixed="left" />
      <el-table-column prop="cnname" label="中文名" width="140" show-overflow-tooltip />
      <el-table-column prop="enname" label="英文名" width="150" show-overflow-tooltip />
      <el-table-column prop="province" label="所在省份" width="110" show-overflow-tooltip />
      <el-table-column prop="countryCnname" label="国家" width="110" show-overflow-tooltip />
      <el-table-column prop="countryCode" label="国家代码" width="100" />
      <el-table-column prop="countryEnname" label="国家英文名" width="130" show-overflow-tooltip />
      <el-table-column prop="areaName" label="区域" width="110" show-overflow-tooltip />
      <el-table-column prop="timezone" label="时区" width="130" show-overflow-tooltip />
      <el-table-column prop="timezone2" label="时区(+8)" width="130" show-overflow-tooltip />
      <el-table-column prop="harborSize" label="尺寸" width="110" show-overflow-tooltip />
      <el-table-column prop="level" label="级别" width="80" align="right" />
      <el-table-column prop="portType" label="类型" width="110" show-overflow-tooltip />
      <el-table-column prop="parentPortName" label="母港" width="130" show-overflow-tooltip />
      <el-table-column prop="latitude" label="纬度" width="110" align="right" />
      <el-table-column prop="longitude" label="经度" width="110" align="right" />
      <!--
        港口范围是 WKT 文本,最长 255 字 —— 只加宽是治不了的(给多少像素都不够),
        所以**去掉 show-overflow-tooltip 让它换行**,不用悬停就能看全。
        代价是这一格有内容时行会变高,但 geom 经常是空的,所以实际影响不大。
      -->
      <el-table-column prop="geom" label="港口范围" min-width="360" class-name="cell-wrap" />
      <el-table-column label="状态" width="90" align="center">
        <template #default="{ row }">
          <!-- 列表里看不到"已删除"(它永远不出现),详情里才看得到 -->
          <el-tag v-if="row.state === '3'" type="danger" effect="light">已删除</el-tag>
          <span v-else>{{ stateText(row.state) }}</span>
        </template>
      </el-table-column>
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

    <PortFormDialog v-model="dialogVisible" :row="editingRow" @success="loadList" />
  </div>
</template>

<style scoped>
.option-sub {
  float: right;
  margin-left: 16px;
  color: #909399;
  font-size: 12px;
}

/* 港口范围那一格:WKT 里是一堆数字和逗号,允许折行、并且长串也能断开 */
:deep(.cell-wrap .cell) {
  white-space: normal;
  word-break: break-all;
  line-height: 1.5;
}
</style>
