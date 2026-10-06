<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { deleteStatus, fetchStatusPage, updateStatus } from '@/api/customerStatus'
import { isBuiltinStatus, useStatusDictStore } from '@/stores/statusDict'
import CustomerStatusFormDialog from './CustomerStatusFormDialog.vue'

const dict = useStatusDictStore()

const pager = reactive({ current: 1, size: 20, total: 0 })
const rows = ref([])
const loading = ref(false)
const dialogVisible = ref(false)

async function loadTable() {
  loading.value = true
  try {
    const data = await fetchStatusPage({ page: pager.current, size: pager.size })
    if (!data.list.length && pager.current > 1) {
      pager.current -= 1
      return loadTable()
    }
    // 每行挂一个编辑副本和脏标记,不直接改列表原始数据
    rows.value = data.list.map(i => ({
      ...i,
      _desc: i.description,
      _dirty: false,
    }))
    pager.total = data.total
  } catch {
    // 拦截器已提示
  } finally {
    loading.value = false
  }
}

function onSizeChange() {
  pager.current = 1
  loadTable()
}

/** 状态字典变了,客户页的下拉也要跟着更新 */
async function afterMutate() {
  await loadTable()
  await dict.refresh()
}

async function onSave(row) {
  const desc = row._desc.trim()
  if (!desc) return ElMessage.warning('状态描述不能为空')
  if (desc.length > 50) return ElMessage.warning('状态描述最长 50 个字符')

  try {
    await updateStatus(row.id, { description: desc })
    ElMessage.success('保存成功')
    afterMutate()
  } catch {
    // 409(描述已存在)·404 由拦截器弹出
  }
}

async function onDelete(row) {
  try {
    await ElMessageBox.confirm(`确定删除状态「${row.description}」吗?`, '提示', {
      type: 'warning',
    })
  } catch {
    return // 用户取消
  }

  try {
    await deleteStatus(row.id)
    ElMessage.success('删除成功')
    afterMutate()
  } catch {
    // 两种 409 的 msg 由拦截器原样弹出,含具体原因(内置状态 / 还有 N 个客户在用)
  }
}

onMounted(loadTable)
</script>

<template>
  <div class="page">
    <el-alert type="info" :closable="false" show-icon class="hint">
      <template #title>
        系统内置状态(<strong>1 正常 / 2 异常 / 3 注销</strong>)不允许改名、不允许删除,已置灰。
        删除自定义状态时,如果还有客户正在使用它,后端会拒绝并说明原因。
        客户状态<strong>不支持批量删除</strong>。
      </template>
    </el-alert>

    <div class="toolbar">
      <el-button type="primary" @click="dialogVisible = true">+ 新增状态</el-button>
    </div>

    <el-table v-loading="loading" :data="rows" border>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column label="状态描述" min-width="240">
        <template #default="{ row }">
          <!-- 内置状态置灰:后端实际会拒绝改名(文档 4.5 的"允许改名"是过期信息) -->
          <el-input
            v-model="row._desc"
            maxlength="50"
            :disabled="isBuiltinStatus(row.id)"
            @input="row._dirty = row._desc !== row.description"
          />
        </template>
      </el-table-column>
      <el-table-column prop="insertTime" label="创建时间" width="180" />
      <el-table-column prop="updateTime" label="修改时间" width="180" />
      <el-table-column label="操作" width="160" fixed="right">
        <template #default="{ row }">
          <!-- 禁用的按钮不触发鼠标事件,tooltip 要包一层 span 才能生效 -->
          <el-tooltip
            :disabled="!isBuiltinStatus(row.id)"
            content="系统内置状态(正常/异常/注销)不允许改名"
            placement="top"
          >
            <span>
              <el-button
                link
                type="primary"
                :disabled="isBuiltinStatus(row.id) || !row._dirty"
                @click="onSave(row)"
              >
                保存
              </el-button>
            </span>
          </el-tooltip>

          <el-tooltip
            :disabled="!isBuiltinStatus(row.id)"
            content="系统内置状态(正常/异常/注销)不允许删除"
            placement="top"
          >
            <span>
              <el-button
                link
                type="danger"
                :disabled="isBuiltinStatus(row.id)"
                @click="onDelete(row)"
              >
                删除
              </el-button>
            </span>
          </el-tooltip>
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
      @current-change="loadTable"
      @size-change="onSizeChange"
    />

    <CustomerStatusFormDialog v-model="dialogVisible" @success="afterMutate" />
  </div>
</template>
