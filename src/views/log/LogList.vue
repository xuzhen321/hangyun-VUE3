<script setup>
import { onMounted, reactive, ref } from 'vue'
import { fetchLogs } from '@/api/log'
import { fetchUserOptions } from '@/api/user'
import { useOperationTypeDict } from '@/stores/dict'
import { useRemoteSelect } from '@/composables/useRemoteSelect'
import { useExport } from '@/composables/useExport'
import LogDetailDialog from './LogDetailDialog.vue'

const typeDict = useOperationTypeDict()
const { exporting, doExport } = useExport()

/** `resultStatus`:`1` 成功 / `0` 失败 */
const RESULT_OPTIONS = [
  { value: '1', label: '成功' },
  { value: '0', label: '失败' },
]

const query = reactive({
  userId: '', // 操作人 ID(自增整数)
  operationTypeId: null,
  targetTable: '',
  resultStatus: '',
  operationTimeFrom: '',
  operationTimeTo: '',
  keyword: '',
})

const pager = reactive({ current: 1, size: 20, total: 0 })
const rows = ref([])
const loading = ref(false)

const detailVisible = ref(false)
const detailRow = ref(null)

// 操作人下拉
const {
  options: userOptions,
  loading: userLoading,
  search: searchUser,
  load: loadUserList,
} = useRemoteSelect(kw => fetchUserOptions(kw), {
  toOption: u => ({
    value: u.id,
    label: u.realName || u.username,
    sub: u.username,
  }),
  selected: () => [query.userId],
  labelOf: id => `用户 #${id}`,
})

async function loadList() {
  loading.value = true
  try {
    const data = await fetchLogs({
      page: pager.current,
      size: pager.size,
      ...query,
    })
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
    userId: '',
    operationTypeId: null,
    targetTable: '',
    resultStatus: '',
    operationTimeFrom: '',
    operationTimeTo: '',
    keyword: '',
  })
  onSearch()
}

function onSizeChange() {
  pager.current = 1
  loadList()
}

function onDetail(row) {
  detailRow.value = row
  detailVisible.value = true
}

/**
 * 导出。**查询条件原样带过去** —— 导出的内容和你列表里看到的一致。
 * ⚠️ 空串的筛选项要剔掉,不然后端会当成"按空值筛"。
 */
function onExport() {
  const params = {}
  for (const [k, v] of Object.entries(query)) {
    if (v !== '' && v !== null && v !== undefined) params[k] = v
  }
  doExport('/logs/export', params, '操作日志')
}

onMounted(() => {
  typeDict.load()
  loadUserList('')
  loadList()
})
</script>

<template>
  <div class="page">
    <!-- 查询条件行(比别处多,分两排) -->
    <el-form :inline="true" :model="query" class="query-form" @submit.prevent>
      <el-form-item label="操作人">
        <el-select
          v-model="query.userId"
          filterable
          remote
          clearable
          :remote-method="searchUser"
          :loading="userLoading"
          placeholder="输入登录名 / 姓名"
          style="width: 180px"
        >
          <el-option v-for="o in userOptions" :key="o.value" :value="o.value" :label="o.label">
            <span>{{ o.label }}</span>
            <span class="option-sub">{{ o.sub }}</span>
          </el-option>
        </el-select>
      </el-form-item>
      <el-form-item label="操作类型">
        <el-select
          v-model="query.operationTypeId"
          placeholder="全部类型"
          clearable
          style="width: 140px"
        >
          <el-option
            v-for="o in typeDict.options"
            :key="o.value"
            :label="o.label"
            :value="o.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="执行结果">
        <el-select
          v-model="query.resultStatus"
          placeholder="全部"
          clearable
          style="width: 120px"
        >
          <el-option v-for="o in RESULT_OPTIONS" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="目标表">
        <el-input
          v-model="query.targetTable"
          placeholder="如表 voyage"
          clearable
          style="width: 150px"
          @keyup.enter="onSearch"
        />
      </el-form-item>
      <el-form-item label="关键字">
        <!-- 这个和别的筛选不一样:**模糊匹配**,不是前缀 -->
        <el-input
          v-model="query.keyword"
          placeholder="操作人姓名 / 目标主键"
          clearable
          style="width: 180px"
          @keyup.enter="onSearch"
        />
      </el-form-item>
      <el-form-item label="操作时间从">
        <el-date-picker
          v-model="query.operationTimeFrom"
          type="datetime"
          value-format="YYYY-MM-DD HH:mm:ss"
          format="YYYY-MM-DD HH:mm:ss"
          placeholder="起始时间"
          style="width: 190px"
        />
      </el-form-item>
      <el-form-item label="操作时间至">
        <el-date-picker
          v-model="query.operationTimeTo"
          type="datetime"
          value-format="YYYY-MM-DD HH:mm:ss"
          format="YYYY-MM-DD HH:mm:ss"
          placeholder="截止时间"
          style="width: 190px"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="onSearch">查询</el-button>
        <el-button @click="onReset">清空</el-button>
      </el-form-item>
    </el-form>

    <el-alert type="info" :closable="false" show-icon class="hint">
      <template #title>
        日志是<strong>只读</strong>的 —— 业务操作时后端自动记录,没有增删改。
        列表按<strong>操作时间倒序</strong>(最近发生的在最前)。
        <strong>失败的操作也会记</strong>(结果列显示「失败」,错误信息里是原因),
        所以你会看到「失败」的日志而对应数据没被改动 —— 这是对的,日志写在独立事务里,不受业务回滚影响。
        导出上限 <strong>5 万行</strong>,超了要缩小筛选范围。
      </template>
    </el-alert>

    <div class="toolbar">
      <!-- 日志只读,所以这里没有新增/删除,只有导出 -->
      <el-button :loading="exporting" @click="onExport">导出</el-button>
    </div>

    <el-table v-loading="loading" :data="rows" border row-key="id">
      <el-table-column prop="operationTime" label="操作时间" width="170" />
      <el-table-column prop="operatorName" label="操作人" width="120" show-overflow-tooltip />
      <!-- ⚠️ 后端存的是英文(INSERT / UPDATE / ...),**原样显示,不做翻译** -->
      <el-table-column prop="operationType" label="操作类型" width="110" />
      <el-table-column prop="targetTable" label="目标表" width="150" show-overflow-tooltip />
      <el-table-column prop="targetId" label="目标主键" width="190" show-overflow-tooltip />
      <el-table-column label="结果" width="90" align="center">
        <template #default="{ row }">
          <el-tag v-if="row.resultStatus === '1'" type="success" effect="light">成功</el-tag>
          <el-tag v-else-if="row.resultStatus === '0'" type="danger" effect="light">失败</el-tag>
          <span v-else>—</span>
        </template>
      </el-table-column>
      <el-table-column prop="errorMessage" label="错误信息" min-width="200" show-overflow-tooltip />
      <el-table-column label="操作" width="90" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="onDetail(row)">详情</el-button>
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

    <LogDetailDialog v-model="detailVisible" :row="detailRow" />
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
