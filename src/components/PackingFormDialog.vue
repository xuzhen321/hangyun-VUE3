<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { createPackingRecord, updatePackingRecord } from '@/api/packingRecord'
import { searchCargoOptions } from '@/api/cargo'
import { fetchContainerOptions } from '@/api/container'
import { debounce } from '@/utils/debounce'

/**
 * 装箱登记的新增 / 编辑弹窗。被两个页面共用:
 *   订单货物管理 → 操作列「登记装箱」(新增,货物预先选好)
 *   货物装箱结果 → 工具栏「登记装箱」(新增,货物自己挑) / 操作列「编辑」
 *
 * ⚠️ **两个字段都是实体引用,都得从下拉里选,不能自由输入:**
 *   - `cargoId`     必须是已存在的货物(10.6 的 /cargos/options)
 *   - `containerNo` 必须是已存在的集装箱(12.1 的 /containers)—— 传库里没有的箱号会 400
 */
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  /** 编辑时传整行(装箱记录);新增时传 null */
  row: { type: Object, default: null },
  /** 新增时预选的货物(来自订单货物列表那一行) */
  cargo: { type: Object, default: null },
})
const emit = defineEmits(['update:modelValue', 'success'])

const formRef = ref(null)
const submitting = ref(false)

const visible = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v),
})

const isEdit = computed(() => props.row !== null && props.row !== undefined)

const form = reactive({ cargoId: null, containerNo: '', quantity: null })

// ---- 货物下拉 ----
const cargoOptions = ref([])
const cargoLoading = ref(false)
/** cargoId -> { name, orderId },保证选中项永远有东西可显示 */
const cargoLabels = ref({})
/**
 * cargoId -> 这批货物的总件数。
 *
 * ⚠️ 11.3 / 11.4 有一条业务校验:**同一批货物的所有装箱记录之和不能超过该货物的 quantity**,
 *    超了返回 409。所以知道总量就能提前提示 + 挡掉明显超量的输入,
 *    不用等提交完才看到"最多还能装 N 件"。
 *
 * 📌 10.6 的选项里本来就带 `quantity`,顺手收下来即可。
 *    注意这只是**上限**(最多能装多少),不是**余额**(还能装多少) ——
 *    已经装掉多少前端算不出来,精确判断仍然以后端的 409 为准。
 */
const cargoTotals = ref({})
const selectedCargoTotal = computed(
  () => cargoTotals.value[form.cargoId] ?? null
)

// ---- 集装箱下拉 ----
const containerOptions = ref([])
const containerLoading = ref(false)
const containerLabels = ref({}) // 箱号 -> 显示文本

const rules = {
  cargoId: [{ required: true, message: '请选择货物', trigger: 'change' }],
  containerNo: [{ required: true, message: '请选择集装箱', trigger: 'change' }],
  quantity: [{ required: true, message: '请输入装入数量', trigger: 'blur' }],
}

/**
 * 把"当前选中的值"补回选项列表。
 * el-select 在 options 里找不到当前值时会退化成显示 id / 空,而远程搜索每次都整个替换数组。
 */
function withSelected(list, selected) {
  const out = [...list]
  const have = new Set(out.map(o => o.value))
  for (const item of selected) {
    if (item.value && !have.has(item.value)) {
      out.push(item)
      have.add(item.value)
    }
  }
  return out
}

// 序号守卫:丢弃过期响应,防慢请求后到覆盖新结果
let cargoSeq = 0
let containerSeq = 0

/**
 * 10.6 的 `cargoTypeName`(前缀)和 `orderId`(精确)是 **AND** 关系 ——
 * 同时传会互相收窄,所以一次只能用其中一个维度搜。这里按输入内容决定用哪个:
 *
 *   一串长数字 → 当成订单号(用户一般是整串粘贴过来的)
 *   其它       → 当成货物名称
 *
 * 📌 **为什么要支持按订单号搜:** 同名货物可能跨多张订单(文档说示例数据里"钢材"就有 4 条),
 *    只按名称找的话用户根本分不清该选哪一条,很容易把货装错单。
 *    订单号是精确的,粘进来就能唯一定位。
 */
const looksLikeOrderId = kw => /^\d{10,}$/.test(kw)

async function loadCargos(keyword) {
  cargoLoading.value = true
  const seq = ++cargoSeq
  const kw = keyword.trim()
  try {
    const list = await searchCargoOptions(
      looksLikeOrderId(kw) ? { orderId: kw } : { cargoTypeName: kw }
    )
    if (seq !== cargoSeq) return
    const found = (list || []).map(c => {
      cargoLabels.value[c.id] = { name: c.cargoTypeName, orderId: c.orderId }
      cargoTotals.value[c.id] = c.quantity // 这批货共多少件
      return {
        value: c.id,
        label: c.cargoTypeName,
        sub: c.orderId, // 同名货物靠订单号区分
      }
    })
    cargoOptions.value = withSelected(found, [cargoAsOption(form.cargoId)])
  } catch {
    // 拦截器已提示
  } finally {
    if (seq === cargoSeq) cargoLoading.value = false
  }
}

/**
 * 箱号下拉用 **12.7 的 `/containers/options`** —— 它是专门给这个场景做的。
 *
 * 比列表接口多两点好处:
 *   1. 多返回一个 `statusDescription`,**显示出来让用户知道这箱子现在能不能用**
 *   2. **已删除的集装箱不会出现在候选里**(它们不能再装货,12.5),不用自己过滤
 */
async function loadContainers(keyword) {
  containerLoading.value = true
  const seq = ++containerSeq
  try {
    const list = await fetchContainerOptions(keyword)
    if (seq !== containerSeq) return
    const found = (list || []).map(c => {
      containerLabels.value[c.no] = c.no
      return {
        value: c.no,
        label: c.no,
        sub: c.statusDescription || '',
      }
    })
    containerOptions.value = withSelected(found, [containerAsOption(form.containerNo)])
  } catch {
    // 拦截器已提示
  } finally {
    if (seq === containerSeq) containerLoading.value = false
  }
}

const searchCargo = debounce(loadCargos, 300)
const searchContainer = debounce(loadContainers, 300)

function cargoAsOption(id) {
  if (!id) return { value: null }
  const info = cargoLabels.value[id]
  return {
    value: id,
    label: info?.name ?? String(id),
    sub: info?.orderId ?? '',
  }
}

function containerAsOption(no) {
  if (!no) return { value: null }
  return { value: no, label: containerLabels.value[no] ?? no, sub: '' }
}

watch(visible, async open => {
  if (!open) return
  formRef.value?.clearValidate()
  cargoLabels.value = {}
  cargoTotals.value = {}
  containerLabels.value = {}

  // 值先落定,再去拉选项 —— 拉回来时 withSelected 会把选中的那一项补进列表
  if (isEdit.value) {
    Object.assign(form, {
      cargoId: props.row.cargoId ?? null,
      containerNo: props.row.containerNo ?? '',
      quantity: props.row.quantity ?? null,
    })
    cargoLabels.value[props.row.cargoId] = {
      name: props.row.cargoTypeName,
      orderId: props.row.orderId,
    }
    containerLabels.value[props.row.containerNo] = props.row.containerNo

    // 装箱记录行里只有"已装多少",没有"这批货共多少"。
    // 用订单号去 10.6 捞一次,把总量补齐,好显示上限提示。
    if (props.row.orderId) {
      searchCargoOptions({ orderId: props.row.orderId })
        .then(list => {
          for (const c of list || []) cargoTotals.value[c.id] = c.quantity
        })
        .catch(() => {
          // 捞不到就不显示提示,不影响主流程 —— 后端的 409 仍然兜底
        })
    }
  } else {
    Object.assign(form, {
      cargoId: props.cargo?.id ?? null,
      containerNo: '',
      quantity: null,
    })
    if (props.cargo?.id) {
      cargoLabels.value[props.cargo.id] = {
        name: props.cargo.cargoTypeName,
        orderId: props.cargo.orderId,
      }
      cargoTotals.value[props.cargo.id] = props.cargo.quantity
    }
  }

  // 下拉先各自加载一批(两个接口不传关键词都会返回前 20 条)
  loadCargos('')
  loadContainers('')
})

async function onSubmit() {
  try {
    await formRef.value.validate()
  } catch {
    return // 校验不通过,表单上已有红字提示
  }

  submitting.value = true
  try {
    // 三个字段都必填 —— 库里那三列都是 not null,少传直接 400(不是"没传就清空")
    const body = {
      cargoId: form.cargoId,
      containerNo: form.containerNo,
      quantity: form.quantity,
    }

    if (isEdit.value) await updatePackingRecord(props.row.id, body)
    else await createPackingRecord(body)

    ElMessage.success('保存成功')
    visible.value = false
    // 增删改不返回数据 —— 只能让父组件重新拉列表
    emit('success')
  } catch {
    // 400(货物/集装箱不存在)·404 由拦截器弹出
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="isEdit ? '编辑装箱记录' : '登记装箱'"
    width="520px"
    :close-on-click-modal="false"
    destroy-on-close
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="120px">
      <!-- 标签写成「货物|订单号」:这个框两种都能搜,只写"货物"会让人以为只能按名称找 -->
      <el-form-item label="货物|订单号" prop="cargoId">
        <el-select
          v-model="form.cargoId"
          filterable
          remote
          clearable
          :remote-method="searchCargo"
          :loading="cargoLoading"
          placeholder="输入货物名称,或粘贴完整订单号"
          style="width: 100%"
        >
          <!-- 选项必须同时显示名称 + 订单号:同名货物可能跨多张订单 -->
          <el-option
            v-for="o in cargoOptions"
            :key="o.value"
            :value="o.value"
            :label="o.label"
          >
            <span>{{ o.label }}</span>
            <span class="option-sub">{{ o.sub }}</span>
          </el-option>
        </el-select>
      </el-form-item>

      <el-form-item label="集装箱号" prop="containerNo">
        <el-select
          v-model="form.containerNo"
          filterable
          remote
          clearable
          :remote-method="searchContainer"
          :loading="containerLoading"
          placeholder="输入箱号开头几个字符搜索"
          style="width: 100%"
        >
          <el-option
            v-for="o in containerOptions"
            :key="o.value"
            :value="o.value"
            :label="o.label"
          >
            <span>{{ o.label }}</span>
            <span class="option-sub">{{ o.sub }}</span>
          </el-option>
        </el-select>
      </el-form-item>

      <el-form-item label="装入数量" prop="quantity">
        <!-- 上限取这批货物的总件数(拿得到的话)—— 装进去的总量不可能超过它 -->
        <el-input-number
          v-model="form.quantity"
          :min="0"
          :max="selectedCargoTotal ?? 2147483647"
          :precision="0"
          :controls="false"
          placeholder="请输入装入数量"
          style="width: 100%"
        />
        <div v-if="selectedCargoTotal != null" class="field-hint">
          这批货物共 {{ selectedCargoTotal }} 件;同一批货的所有装箱记录加起来不能超过它。
        </div>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="onSubmit">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
/* 选项右侧的附加信息(订单号 / 箱型),用来区分同名项 */
.option-sub {
  float: right;
  margin-left: 16px;
  color: #909399;
  font-size: 12px;
}

.field-hint {
  margin-top: 4px;
  color: #909399;
  font-size: 12px;
  line-height: 1.5;
}
</style>
