<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
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
   *   columns      [{ prop, label, max, required, immutable, kind, min, numMax, precision }]
   *                  - 默认按**文本**渲染,`max` 是最大长度
   *                  - `kind: 'number'` 改成数字输入,用 `min` / `numMax` / `precision`
   *                    (`max` 这个词已经被"字符串长度"占了,所以数字上限叫 `numMax`)
   *   hint         顶部提示条文案
   *   builtinIds       可选;空/不传 = 没有内置概念
   *   builtinLabel     可选;内置项的补充说明,会在 tooltip 里拼成「(正常/异常/注销)」那样
   *   search       可选;有就在列表上方渲染一个关键字查询框,{ param, label, placeholder }
   *   rowActions   可选;额外的行操作按钮,`[{ label, onClick(row) }]`,渲染在"保存/删除"前面
   *   api          { fetchPage, create, update, remove }
   *   useDict      **可选**;该字典的下拉缓存 store。不传 = 这个字典没有"一次拉全量"的下拉
   */
  config: { type: Object, required: true },
})

// config 是静态配置,解构一次即可
const { api, columns, hint, name } = props.config

/**
 * 下拉缓存 store —— **可选**。
 *
 * 只有"一次拉全量"的字典(`/xxx/options` 说不截断的)才有它;
 * 像公司这种下拉接口**只返回前 20 条**的,缓存一份没有意义,下拉应该做成远程搜索,
 * 所以那边不传 useDict,这里跳过刷新即可。
 */
const dict = props.config.useDict ? props.config.useDict() : null

/**
 * 主键字段名,默认 `id`。
 * 有些表的主键**不是自增 id** —— 比如拖车的主键是拖车号 `no`。
 */
const keyField = props.config.keyField ?? 'id'
const keyOf = row => row[keyField]

/** 这一行是不是"内置"的(没有内置概念的字典恒为 false) */
/** `hasBuiltin` 为 false 时整条短路 —— 没有内置概念的字典完全不受影响 */
const isBuiltinRow = row => hasBuiltin && isBuiltin(keyOf(row))

/** 可选的列表关键字查询。不配就没有查询框 */
const searchCfg = props.config.search ?? null
const keyword = ref('')

/**
 * 额外的行操作按钮(可选)。处理函数由**视图**提供 —— 它要跳路由,而 `constants/dict.js`
 * 是纯配置、不该碰到 router。
 */
const rowActions = props.config.rowActions ?? []
/** 操作列宽度按按钮个数撑开,免得挤成两行 */
const actionColWidth = 160 + rowActions.length * 80

const route = useRoute()

function onSearch() {
  pager.current = 1
  loadTable()
}

function onResetSearch() {
  keyword.value = ''
  onSearch()
}

const builtinIds = props.config.builtinIds ?? []
/** 内置状态 id 白名单 —— 如客户状态的 1/2/3、订单状态的 1/4 */
const hasBuiltin = builtinIds.length > 0
const builtinLabel = props.config.builtinLabel ?? ''
/** 有 builtinLabel 才拼成「(正常/异常/注销)」,没有就留空,免得出现「系统内置状态()」 */
const builtinTip = builtinLabel ? `(${builtinLabel})` : ''
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
    // 数字列单独处理:required 必须标 `type: 'number'`,
    // 否则 async-validator 会拿字符串的规则去套数字(而且数字不能带 whitespace / maxlength)
    if (col.kind === 'number') {
      r[col.prop] = col.required
        ? [{ required: true, type: 'number', message: `请输入${col.label}`, trigger: 'blur' }]
        : []
      continue
    }

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
    const data = await api.fetchPage({
      page: pager.current,
      size: pager.size,
      // 只有配了 search 的字典才带这个参数
      ...(searchCfg ? { [searchCfg.param]: keyword.value.trim() || undefined } : {}),
    })
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
  // 没有缓存 store 的字典(如公司)跳过 —— 它的下拉是远程搜索,不吃缓存
  if (dict) await dict.refresh()
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
    await api.update(keyOf(row), collect(row, '_'))
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
    await api.remove(keyOf(row))
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

onMounted(() => {
  // 支持从别处带 ?<search.param>= 跳进来 —— 集装箱列表的「查看箱主 / 查看操作方」就是这个用法。
  // 参数名取自配置,所以任何配了 search 的字典都自动支持
  const fromUrl = searchCfg ? route.query[searchCfg.param] : null
  if (fromUrl) keyword.value = String(fromUrl)

  loadTable()
})
</script>

<template>
  <div class="page">
    <!-- 可选的列表查询(配了 config.search 才有) -->
    <el-form v-if="searchCfg" :inline="true" class="query-form" @submit.prevent>
      <el-form-item :label="searchCfg.label">
        <el-input
          v-model="keyword"
          :placeholder="searchCfg.placeholder"
          clearable
          style="width: 240px"
          @keyup.enter="onSearch"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="onSearch">查询</el-button>
        <el-button @click="onResetSearch">清空</el-button>
      </el-form-item>
    </el-form>

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
          <!--
            两种情况下置灰:
              1. 内置行 —— 后端也会拒绝改,别让用户改了才收到 409
              2. 列上标了 immutable —— 一般是主键(如拖车号),建了就不能改
          -->
          <el-input-number
            v-if="col.kind === 'number'"
            v-model="row['_' + col.prop]"
            :min="col.min ?? 0"
            :max="col.numMax"
            :precision="col.precision ?? 0"
            :controls="false"
            :disabled="isBuiltinRow(row) || col.immutable"
            style="width: 100%"
            @change="row._dirty = isDirty(row)"
          />
          <el-input
            v-else
            v-model="row['_' + col.prop]"
            :maxlength="col.max"
            :disabled="isBuiltinRow(row) || col.immutable"
            @input="row._dirty = isDirty(row)"
          />
        </template>
      </el-table-column>

      <el-table-column prop="insertTime" label="创建时间" width="180" />
      <el-table-column prop="updateTime" label="修改时间" width="180" />
      <el-table-column label="操作" :width="actionColWidth" fixed="right">
        <template #default="{ row }">
          <!-- 配置里带的额外行操作(如公司页的「集装箱详情」) -->
          <el-button
            v-for="act in rowActions"
            :key="act.label"
            link
            type="primary"
            @click="act.onClick(row)"
          >
            {{ act.label }}
          </el-button>

          <!-- 禁用的按钮不触发鼠标事件,tooltip 要包一层 span 才能生效 -->
          <el-tooltip
            :disabled="!isBuiltinRow(row)"
            :content="`系统内置状态${builtinTip}不允许修改`"
            placement="top"
          >
            <span>
              <el-button
                link
                type="primary"
                :disabled="isBuiltinRow(row) || !row._dirty"
                @click="onSave(row)"
              >
                保存
              </el-button>
            </span>
          </el-tooltip>

          <el-tooltip
            :disabled="!isBuiltinRow(row)"
            :content="`系统内置状态${builtinTip}不允许删除`"
            placement="top"
          >
            <span>
              <el-button
                link
                type="danger"
                :disabled="isBuiltinRow(row)"
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
          <!-- 数字列用数字输入(新增弹窗里不改 immutable,那个只管行内编辑) -->
          <el-input-number
            v-if="col.kind === 'number'"
            v-model="form[col.prop]"
            :min="col.min ?? 0"
            :max="col.numMax"
            :precision="col.precision ?? 0"
            :controls="false"
            :placeholder="`请输入${col.label}`"
            style="width: 100%"
          />
          <el-input
            v-else
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
