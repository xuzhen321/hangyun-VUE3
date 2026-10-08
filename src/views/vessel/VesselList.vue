<script setup>
import { h, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { batchDeleteVessels, deleteVessel, fetchVessels } from '@/api/vessel'
import { fetchShipTypeOptions } from '@/api/shipType'
import { fetchCountryOptions } from '@/api/country'
import { useRemoteSelect } from '@/composables/useRemoteSelect'
import VesselFormDialog from './VesselFormDialog.vue'

const route = useRoute()

const query = reactive({
  keyword: '', // 前缀匹配 船名 / MMSI / IMO
  countryId: null,
  vesselTypeId: null,
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

// 查询条件里的两个下拉
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

const {
  options: typeOptions,
  loading: typeLoading,
  search: searchType,
  load: loadTypeList,
} = useRemoteSelect(kw => fetchShipTypeOptions(kw), {
  toOption: t => ({ value: t.id, label: t.type, sub: '' }),
  selected: () => [query.vesselTypeId],
  labelOf: id => `船型 #${id}`,
})

async function loadList() {
  loading.value = true
  try {
    const data = await fetchVessels({
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
  Object.assign(query, { keyword: '', countryId: null, vesselTypeId: null })
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
      `确定删除船舶「${row.shipname}」吗?删除后无法恢复。`,
      '提示',
      { type: 'warning' }
    )
    await deleteVessel(row.id)
    ElMessage.success('删除成功')
    loadList()
  } catch {
    // 用户取消,或 404 / 409(被航次引用)由拦截器弹出
  }
}

/**
 * 批量删除。
 *
 * ⚠️ **严格语义**:只要**有一艘被航次引用,整批都不删**(409),
 *    msg 里会列出是哪几艘。所以确认框要提前讲清楚,而且收到 409 时列表保持原样、不刷新。
 *
 * ⚠️ 船舶是**物理删除**(和集装箱的逻辑删除不一样),所以确认框也要写"无法恢复"。
 */
async function onBatchDelete() {
  const ids = selectedRows.value.map(r => r.id)
  if (!ids.length) return ElMessage.warning('请先选择要删除的船舶')
  if (ids.length > 100) return ElMessage.warning('一次最多删除 100 条,请分批操作')

  try {
    // 用 VNode 而不是拼接 \n:ElMessageBox 的 message 是普通文本节点,换行符不会渲染
    await ElMessageBox.confirm(
      h('div', { style: 'line-height: 1.9' }, [
        h('div', `确定删除选中的 ${ids.length} 艘船舶吗?`),
        h('div', { style: 'color: #f56c6c; font-weight: 600' }, '删除后无法恢复。'),
        h(
          'div',
          '只要其中任何一艘被航次引用,这次删除会整体取消,一艘都不会删。'
        ),
      ]),
      '提示',
      { type: 'warning' }
    )
  } catch {
    return // 用户取消
  }

  try {
    await batchDeleteVessels(ids)
    ElMessage.success(`已删除 ${ids.length} 条`)
    selectedRows.value = []
    loadList()
  } catch {
    // 409 时**什么都没删**,列表保持原样即可 —— msg 会列出被引用的船名
  }
}

onMounted(() => {
  // 从物流事件页点「查看船舶」跳过来时带着 ?keyword=<船名>,填进关键字直接定位。
  // ⚠️ 只能用**船名**筛,而且是**前缀匹配** —— 事件行里只有 `vslName` 没有 `vslId`。
  //    带的是完整船名,所以实际只命中它自己(以及名字以它开头的),但严格说不是精确定位。
  if (route.query.keyword) query.keyword = String(route.query.keyword)

  loadCountryList('')
  loadTypeList('')
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
          placeholder="船名 / MMSI / IMO 开头几个字"
          clearable
          style="width: 220px"
          @keyup.enter="onSearch"
        />
      </el-form-item>
      <el-form-item label="船旗国">
        <el-select
          v-model="query.countryId"
          filterable
          remote
          clearable
          :remote-method="searchCountry"
          :loading="countryLoading"
          placeholder="输入国家代码 / 中英文名"
          style="width: 200px"
        >
          <el-option v-for="o in countryOptions" :key="o.value" :value="o.value" :label="o.label">
            <span>{{ o.label }}</span>
            <span class="option-sub">{{ o.sub }}</span>
          </el-option>
        </el-select>
      </el-form-item>
      <el-form-item label="船舶类型">
        <el-select
          v-model="query.vesselTypeId"
          filterable
          remote
          clearable
          :remote-method="searchType"
          :loading="typeLoading"
          placeholder="输入类型名称"
          style="width: 180px"
        >
          <el-option v-for="o in typeOptions" :key="o.value" :value="o.value" :label="o.label" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="onSearch">查询</el-button>
        <el-button @click="onReset">清空</el-button>
      </el-form-item>
    </el-form>

    <el-alert type="warning" :closable="false" show-icon class="hint">
      <template #title>
        关键字从<strong>开头</strong>匹配。MMSI、IMO、呼号<strong>都不能和别的船重复</strong>。
        <strong>船舶是物理删除,删了回不来</strong>;被航次引用时删不掉。
        批量删除时,只要选中项里<strong>有任何一艘被航次引用,整批都会被拒绝,一艘都不会删</strong>。
      </template>
    </el-alert>

    <div class="toolbar">
      <el-button type="primary" @click="onCreate">+ 新增船舶</el-button>
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
      <el-table-column type="selection" width="48" fixed="left" />
      <el-table-column prop="shipname" label="船名" width="160" fixed="left" show-overflow-tooltip />
      <el-table-column prop="mmsi" label="MMSI" width="120" />
      <el-table-column prop="imo" label="IMO" width="110" />
      <el-table-column prop="callsign" label="呼号" width="90" />
      <el-table-column prop="shiptype" label="船舶类型" width="120" show-overflow-tooltip />
      <el-table-column prop="flagState" label="船旗国" width="110" show-overflow-tooltip />
      <el-table-column prop="shipOwner" label="船东" min-width="150" show-overflow-tooltip />
      <el-table-column prop="shipOwnerCode" label="船东代码" width="110" />
      <el-table-column prop="shipManager" label="管理公司" min-width="150" show-overflow-tooltip />
      <el-table-column prop="shipManagerCode" label="管理公司代码" width="120" />
      <!-- 下面五个来自"船型",是那个型号的规格 —— 同型号的船这几项会一样 -->
      <el-table-column prop="gt" label="总吨" width="100" align="right" />
      <el-table-column prop="nt" label="净吨" width="100" align="right" />
      <el-table-column prop="dwt" label="载重吨" width="100" align="right" />
      <el-table-column prop="length" label="长度" width="90" align="right" />
      <el-table-column prop="width" label="宽度" width="90" align="right" />
      <el-table-column prop="buildYear" label="建造年份" width="100" align="right" />
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

    <VesselFormDialog v-model="dialogVisible" :row="editingRow" @success="loadList" />
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
