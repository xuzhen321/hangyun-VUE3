<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { isBuiltinOf } from '@/constants/status'

/**
 * 字典管理页 —— 四个字典共用(客户状态 / 订单状态 / 集装箱箱型 / 集装箱状态)。
 *
 * 行为口径:
 *   - 可编辑表格,行内改;有几个字段就渲染几列(由 config.columns 决定)
 *   - **内置 id 行**(如果有):输入框和删除按钮置灰,后端也会拒绝,置灰是主防线
 *   - 没有内置概念的字典(builtinIds 为空):所有行都能改能删
 *   - 删除前弹确认框;各种 409 的 msg 由拦截器原样弹出
 *   - 增/改/删成功后刷新表格 + 刷新字典(让别处的下拉跟着更新)
 *   - **不支持批量删除**(这四个字典都没有批量删除接口,所以没有复选框列)
 */
const props = defineProps({
  /**
   * 见 `constants/dict.js`。字段:
   *   name         字典名,拼按钮和弹窗标题用
   *   entityWord   删除确认里的主体词
   *   columns      [{ prop, label, max, required }]
   *   hint         顶部提示条文案
   *   builtinIds   可选;空/不传 = 没有内置概念
   *   builtinLabel 可选
   *   api          { fetchPage, create, update, remove }
   *   useDict      () => store
   */
  config: { type: Object, required: true },
})

// config 是静态配置,解构一次即可
const { api, columns, hint, name } = props.config
const dict = props.config.useDict()

const builtinIds = props.config.builtinIds ?? []
const hasBuiltin = builtinIds.length > 0
const builtinLabel = props.config.builtinLabel ?? ''
const isBuiltin = id => isBuiltinOf(props.config, id)

const pager = reactive({ current: 1, size: 20, total: 0 })
const rows = ref([])
const loading = ref(false)

const dialogVisible = ref(false)
const formRef = ref(null)
const submitting = ref(false)
const form = reactive({})

/** 校验规则按 columns 生成:必填的加 required,有长度上限的加 max */
const rules = computed(() => {
  const r = {}
  for (const col of columns) {
    const list = []
    if (col.required) {
      // whitespace: true 让"全是空格"也判为不通过
      list.push({
        required: true,
        whitespace: true,
        message: `请输入${col.label}`,
        trigger: 'blur',
      })
    }
    if (col.max) {
      list.push({
        max: col.max,
        message: `${col.label}最长 ${col.max} 个字符`,
        trigger: 'blur',
      })
    }
    r[col.prop] = list
  }
  return r
})

/** 给一行挂上各列的编辑副本 + 脏标记,不直接改列表原始数据 */
function decorate(item) {
  const row = { ...item, _dirty: false }
  for (const col of columns) row['_' + col.prop] = item[col.prop] ?? ''
  return row
}

const isDirty = row =>
  columns.some(
    col => String(row['_' + col.prop] ?? '') !== String(row[col.prop] ?? '')
  )

/**
 * 把 `_{prop}`(行内编辑)或 `{prop}`(弹窗表单)收集成提交体。
 * 去掉首尾空格;空串统一成 null(可空字段不留 "")
 */
function collect(src, prefix = '') {
  const body = {}
  for (const col of columns) {
    const raw = src[prefix + col.prop]
    const v = typeof raw === 'string' ? raw.trim() : raw
    body[col.prop] = v === '' || v === undefined ? null : v
  }
  return body
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
    rows.value = data.list.map(decorate)
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

/** 字典变了,用到下拉的页面(表单、列表筛选)也要跟着更新 */
async function afterMutate() {
  await loadTable()
  await dict.refresh()
}

/** 行内保存:先本地校验一遍必填和长度,别等后端 400 */
async function onSave(row) {
  for (const col of columns) {
    const v = String(row['_' + col.prop] ?? '').trim()
    if (col.required && !v) return ElMessage.warning(`「${col.label}」不能为空`)
    if (col.max && v.length > col.max) {
      return ElMessage.warning(`「${col.label}」最长 ${col.max} 个字符`)
    }
  }

  try {
    await api.update(row.id, collect(row, '_'))
    ElMessage.success('保存成功')
    afterMutate()
  } catch {
    // 409(重复 / 内置不允许改)·404 由拦截器弹出
  }
}

async function onDelete(row) {
  const label = columns.map(col => row[col.prop]).filter(Boolean).join(' / ')
  try {
    await ElMessageBox.confirm(`确定删除「${label}」吗?`, '提示', {
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
    // 409 的 msg 由拦截器原样弹出,含具体原因(内置状态 / 还有 N 个在用)
  }
}

function openCreate() {
  for (const col of columns) form[col.prop] = ''
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
    await api.create(collect(form))
    ElMessage.success('新增成功')
    dialogVisible.value = false
    afterMutate()
  } catch {
    // 409 重复由拦截器弹出;前端不做本地查重 —— 字典数据可能不全,本地判重容易误报
  } finally {
    submitting.value = false
  }
}

onMounted(loadTable)
</script>

<template>
  <div class="page">
    <el-alert type="info" :closable="false" show-icon class="hint">
      <template #title>{{ hint }}</template>
    </el-alert>

    <div class="toolbar">
      <el-button type="primary" @click="openCreate">+ 新增{{ name }}</el-button>
    </div>

    <el-table v-loading="loading" :data="rows" border>
      <!-- 有几个字段就渲染几列,列定义在 config.columns 里 -->
      <el-table-column
        v-for="col in columns"
        :key="col.prop"
        :label="col.label"
        min-width="180"
      >
        <template #default="{ row }">
          <!-- 内置行置灰:后端也会拒绝改,别让用户改了才收到 409 -->
          <el-input
            v-model="row['_' + col.prop]"
            :maxlength="col.max"
            :disabled="hasBuiltin && isBuiltin(row.id)"
            @input="row._dirty = isDirty(row)"
          />
        </template>
      </el-table-column>

      <el-table-column prop="insertTime" label="创建时间" width="180" />
      <el-table-column prop="updateTime" label="修改时间" width="180" />
      <el-table-column label="操作" width="160" fixed="right">
        <template #default="{ row }">
          <!-- 禁用的按钮不触发鼠标事件,tooltip 要包一层 span 才能生效 -->
          <el-tooltip
            :disabled="!(hasBuiltin && isBuiltin(row.id))"
            :content="`系统内置状态(${builtinLabel})不允许修改`"
            placement="top"
          >
            <span>
              <el-button
                link
                type="primary"
                :disabled="(hasBuiltin && isBuiltin(row.id)) || !row._dirty"
                @click="onSave(row)"
              >
                保存
              </el-button>
            </span>
          </el-tooltip>

          <el-tooltip
            :disabled="!(hasBuiltin && isBuiltin(row.id))"
            :content="`系统内置状态(${builtinLabel})不允许删除`"
            placement="top"
          >
            <span>
              <el-button
                link
                type="danger"
                :disabled="hasBuiltin && isBuiltin(row.id)"
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
      :title="`新增${name}`"
      width="460px"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item
          v-for="col in columns"
          :key="col.prop"
          :label="col.label"
          :prop="col.prop"
        >
          <el-input
            v-model="form[col.prop]"
            :maxlength="col.max"
            :placeholder="`请输入${col.label}`"
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
