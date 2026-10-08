<script setup>
import { h, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { batchDeleteUsers, deleteUser, fetchUsers } from '@/api/user'
import { useExport } from '@/composables/useExport'
import UserFormDialog from './UserFormDialog.vue'
import UserPasswordDialog from './UserPasswordDialog.vue'

/** `status`:`0` 正常 / `1` 冻结 / `2` 已删除 */
const STATUS_OPTIONS = [
  { value: '0', label: '正常', tag: 'success' },
  { value: '1', label: '冻结', tag: 'warning' },
  { value: '2', label: '已删除', tag: 'info' },
]
const statusOf = v => STATUS_OPTIONS.find(o => o.value === v) || null

const { exporting, doExport } = useExport()

const query = reactive({
  keyword: '', // 前缀匹配 登录名 / 真实姓名
  status: '', // 精确
})

const pager = reactive({ current: 1, size: 20, total: 0 })
const rows = ref([])
const loading = ref(false)
const selectedRows = ref([])

const dialogVisible = ref(false)
const editingRow = ref(null)

const pwdVisible = ref(false)
const pwdUser = ref(null)

function onSelectionChange(selection) {
  selectedRows.value = selection
}

async function loadList() {
  loading.value = true
  try {
    const data = await fetchUsers({
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
  Object.assign(query, { keyword: '', status: '' })
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

function onResetPassword(row) {
  pwdUser.value = row
  pwdVisible.value = true
}

/**
 * 导出。**查询条件原样带过去** —— 导出的内容和你列表里看到的一致。
 * ⚠️ `status` 为空串时不传(后端按"不传=排除已删除"处理),所以这里把空串删掉。
 */
function onExport() {
  doExport(
    '/users/export',
    { keyword: query.keyword || undefined, status: query.status || undefined },
    '系统用户'
  )
}

async function onDelete(row) {
  try {
    await ElMessageBox.confirm(
      `确定删除用户「${row.username}」吗?删除后它不会出现在列表里,但这个登录名也不能再被注册。`,
      '提示',
      { type: 'warning' }
    )
    // id 是自增的普通整数,原样传
    await deleteUser(row.id)
    ElMessage.success('删除成功')
    loadList()
  } catch {
    // 用户取消,或 404 / 409(内置管理员不允许删除)由拦截器弹出
  }
}

/**
 * 批量删除。
 *
 * ⚠️ **严格语义**:批量里**含内置管理员时整批拒绝**,不做部分删除。
 *    所以确认框要提前讲清楚,而且收到 409 时列表保持原样、不刷新。
 *
 * ⚠️ `ids` 是**数字数组**(自增主键)。
 */
async function onBatchDelete() {
  const ids = selectedRows.value.map(r => r.id)
  if (!ids.length) return ElMessage.warning('请先选择要删除的用户')
  if (ids.length > 100) return ElMessage.warning('一次最多删除 100 条,请分批操作')

  try {
    // 用 VNode 而不是拼接 \n:ElMessageBox 的 message 是普通文本节点,换行符不会渲染
    await ElMessageBox.confirm(
      h('div', { style: 'line-height: 1.9' }, [
        h('div', `确定删除选中的 ${ids.length} 个用户吗?`),
        h(
          'div',
          '只要选中项里有内置管理员,这次删除会整体取消,一个都不会删。'
        ),
      ]),
      '提示',
      { type: 'warning' }
    )
  } catch {
    return // 用户取消
  }

  try {
    await batchDeleteUsers(ids)
    ElMessage.success(`已删除 ${ids.length} 条`)
    selectedRows.value = []
    loadList()
  } catch {
    // 409 时什么都没删,列表保持原样即可
  }
}

onMounted(loadList)
</script>

<template>
  <div class="page">
    <!-- 查询条件行 -->
    <el-form :inline="true" :model="query" class="query-form" @submit.prevent>
      <el-form-item label="关键字">
        <el-input
          v-model="query.keyword"
          placeholder="登录名 / 真实姓名开头几个字"
          clearable
          style="width: 220px"
          @keyup.enter="onSearch"
        />
      </el-form-item>
      <el-form-item label="账号状态">
        <el-select
          v-model="query.status"
          placeholder="全部状态"
          clearable
          style="width: 150px"
        >
          <el-option
            v-for="o in STATUS_OPTIONS"
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
        关键字从<strong>开头</strong>匹配。不选状态时<strong>已删除的用户不会出现在列表里</strong>,
        要看已删除的把状态筛成「已删除」。
        <strong>内置管理员不允许删除、也不允许冻结</strong> —— 否则把唯一的管理员锁死就没人能登录进来改回去了。
        删除后<strong>这个登录名不能再被注册</strong>(逻辑删除,唯一约束还在)。
      </template>
    </el-alert>

    <div class="toolbar">
      <el-button type="primary" @click="onCreate">+ 新增用户</el-button>
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
      row-key="id"
      @selection-change="onSelectionChange"
    >
      <el-table-column type="selection" width="48" />
      <el-table-column prop="username" label="登录名" width="160" show-overflow-tooltip />
      <el-table-column prop="realName" label="真实姓名" width="140" show-overflow-tooltip />
      <el-table-column prop="phone" label="电话" width="150" />
      <el-table-column label="账号状态" width="110" align="center">
        <template #default="{ row }">
          <el-tag
            v-if="statusOf(row.status)"
            :type="statusOf(row.status).tag"
            effect="light"
          >
            {{ statusOf(row.status).label }}
          </el-tag>
          <span v-else>—</span>
        </template>
      </el-table-column>
      <el-table-column prop="insertTime" label="创建时间" width="170" />
      <el-table-column prop="updateTime" label="修改时间" width="170" />
      <el-table-column label="操作" width="210" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="onEdit(row)">编辑</el-button>
          <el-button link type="primary" @click="onResetPassword(row)">
            重置密码
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

    <UserFormDialog v-model="dialogVisible" :row="editingRow" @success="loadList" />
    <UserPasswordDialog v-model="pwdVisible" :user="pwdUser" @success="loadList" />
  </div>
</template>
