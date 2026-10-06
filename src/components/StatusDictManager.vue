<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { isBuiltinOf } from '@/constants/status'

/**
 * 状态字典管理页(客户 / 订单共用)。
 *
 * 行为口径(两边一致):
 *   - 可编辑表格,行内改描述
 *   - 内置状态 id 行:描述框和删除按钮都置灰(后端也会拒绝,置灰是主防线)
 *   - 删除前弹确认框;两种 409 的 msg 由拦截器原样弹出
 *   - 增/改/删成功后刷新表格 + 刷新字典(让别处的下拉跟着更新)
 *   - 不支持批量删除,所以没有复选框列
 */
const props = defineProps({
  /**
   * {
   *   builtinIds:   number[]                            内置状态 id 白名单
   *   builtinLabel: string                              内置状态文案,拼提示语用
   *   entityWord:   string                              「客户」/「订单」
   *   tagTypes:     Record<number, string>              内置状态的 el-tag 配色
   *   api:          { fetchPage, create, update, remove } 四个函数
   *   useDict:      () => store                         该实体的状态字典
   * }
   */
  config: { type: Object, required: true },
})

// config 是静态配置,解构一次即可
const { api, builtinLabel, entityWord } = props.config
const dict = props.config.useDict()

const isBuiltin = id => isBuiltinOf(props.config, id)

const pager = reactive({ current: 1, size: 20, total: 0 })
const rows = ref([])
const loading = ref(false)

const dialogVisible = ref(false)
const formRef = ref(null)
const submitting = ref(false)
const form = reactive({ description: '' })

const rules = {
  description: [
    // whitespace: true 让"全是空格"也判为不通过
    { required: true, whitespace: true, message: '请输入状态描述', trigger: 'blur' },
    { max: 50, message: '状态描述最长 50 个字符', trigger: 'blur' },
  ],
}

async function loadTable() {
  loading.value = true
  try {
    const data = await api.fetchPage({ page: pager.current, size: pager.size })
    // 删空当前页且不在第 1 页时回退一页,避免停在一条都没有的末页
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

/** 字典变了,用到下拉的页面(列表筛选、表单)也要跟着更新 */
async function afterMutate() {
  await loadTable()
  await dict.refresh()
}

async function onSave(row) {
  const desc = row._desc.trim()
  if (!desc) return ElMessage.warning('状态描述不能为空')
  if (desc.length > 50) return ElMessage.warning('状态描述最长 50 个字符')

  try {
    await api.update(row.id, { description: desc })
    ElMessage.success('保存成功')
    afterMutate()
  } catch {
    // 409(描述已存在 / 内置状态不允许修改)·404 由拦截器弹出
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
    await api.remove(row.id)
    ElMessage.success('删除成功')
    afterMutate()
  } catch {
    // 两种 409 的 msg 由拦截器原样弹出,含具体原因(内置状态 / 还有 N 个客户在用)
  }
}

function openCreate() {
  form.description = ''
  dialogVisible.value = true
}

async function onSubmit() {
  try {
    await formRef.value.validate()
  } catch {
    return // 校验不通过,表单上已有红字提示
  }

  submitting.value = true
  try {
    // 前后端都会去掉首尾空格再比较重复,所以"正常"和"正常 "视为同一个
    await api.create({ description: form.description.trim() })
    ElMessage.success('新增成功')
    dialogVisible.value = false
    afterMutate()
  } catch {
    // 409 重名由拦截器弹出;前端不做本地查重 —— 字典数据可能不全,本地判重容易误报
  } finally {
    submitting.value = false
  }
}

onMounted(loadTable)
</script>

<template>
  <div class="page">
    <el-alert type="info" :closable="false" show-icon class="hint">
      <template #title>
        系统内置状态(<strong>{{ builtinLabel }}</strong
        >)不允许改名、不允许删除,已置灰。 删除自定义状态时,如果还有{{ entityWord }}正在使用它,后端会拒绝并说明原因。
        {{ entityWord }}状态<strong>不支持批量删除</strong>。
      </template>
    </el-alert>

    <div class="toolbar">
      <el-button type="primary" @click="openCreate">+ 新增状态</el-button>
    </div>

    <el-table v-loading="loading" :data="rows" border>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column label="状态描述" min-width="240">
        <template #default="{ row }">
          <!-- 内置状态置灰:后端会拒绝改名,别让用户改了才收到 409 -->
          <el-input
            v-model="row._desc"
            maxlength="50"
            :disabled="isBuiltin(row.id)"
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
            :disabled="!isBuiltin(row.id)"
            :content="`系统内置状态(${builtinLabel})不允许改名`"
            placement="top"
          >
            <span>
              <el-button
                link
                type="primary"
                :disabled="isBuiltin(row.id) || !row._dirty"
                @click="onSave(row)"
              >
                保存
              </el-button>
            </span>
          </el-tooltip>

          <el-tooltip
            :disabled="!isBuiltin(row.id)"
            :content="`系统内置状态(${builtinLabel})不允许删除`"
            placement="top"
          >
            <span>
              <el-button
                link
                type="danger"
                :disabled="isBuiltin(row.id)"
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

    <el-dialog
      v-model="dialogVisible"
      title="新增状态"
      width="420px"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="状态描述" prop="description">
          <el-input
            v-model="form.description"
            maxlength="50"
            placeholder="请输入状态描述"
            @keyup.enter="onSubmit"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="onSubmit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>
