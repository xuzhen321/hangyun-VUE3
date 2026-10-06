<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { createOrder, fetchOrder, updateOrder } from '@/api/order'
import { searchCustomerOptions } from '@/api/customer'
import { searchPorts } from '@/api/port'
import { useOrderStatusDict } from '@/stores/statusDict'
import { debounce } from '@/utils/debounce'
import { toPayload } from '@/utils/payload'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  /** null = 新增;订单号**字符串** = 编辑该订单 */
  id: { type: String, default: null },
})
const emit = defineEmits(['update:modelValue', 'success'])

const dict = useOrderStatusDict()
const formRef = ref(null)
const loading = ref(false)
const submitting = ref(false)

const visible = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v),
})
const isEdit = computed(() => props.id !== null && props.id !== undefined)

// ---- 两个远程搜索下拉 ----
const customerOptions = ref([])
const customerLoading = ref(false)
const portOptions = ref([])
const portLoading = ref(false)

// id -> 名称。回填和搜索结果都往这里记,保证"选中项永远有 label 可显示"
const customerLabels = ref({})
const portLabels = ref({})

function emptyForm() {
  return {
    customerId: null,
    orderDate: '',
    loadingPortId: null,
    dischargePortId: null,
    statusId: 1, // 新增默认「已确认」
  }
}

const form = reactive(emptyForm())

const rules = {
  // 客户是外键,必填(不传后端返回 400)
  customerId: [{ required: true, message: '请选择客户', trigger: 'change' }],
}

/**
 * 把"当前选中的值"补回选项列表。
 *
 * ⚠️ 这是本页最关键的一步。el-select 如果在 options 里找不到当前值,
 *    **会退化成直接显示 id 数字**;而远程搜索每次都整个替换选项数组,
 *    所以选中项随时可能被"搜没"。
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

// 用序号丢弃过期响应:防抖 + 慢请求后到,不加这个会用旧结果覆盖新结果
let customerSeq = 0
let portSeq = 0

async function loadCustomers(keyword) {
  customerLoading.value = true
  const seq = ++customerSeq
  try {
    const list = await searchCustomerOptions(keyword)
    if (seq !== customerSeq) return
    const found = (list || []).map(c => ({
      value: c.id,
      label: c.name,
      sub: c.phone, // 同名客户靠电话区分
    }))
    for (const o of found) customerLabels.value[o.value] = o.label
    customerOptions.value = withSelected(found, [
      { value: form.customerId, label: customerLabels.value[form.customerId], sub: '' },
    ])
  } catch {
    // 拦截器已提示
  } finally {
    if (seq === customerSeq) customerLoading.value = false
  }
}

async function loadPorts(keyword) {
  portLoading.value = true
  const seq = ++portSeq
  try {
    const list = await searchPorts(keyword)
    if (seq !== portSeq) return
    const found = (list || []).map(p => ({
      value: p.id,
      label: p.cnname,
      sub: p.unlocode, // 五字码,港口较多时用来区分
    }))
    for (const o of found) portLabels.value[o.value] = o.label
    // 起运港和目的港共用同一份选项,所以两个选中值都要补进来
    portOptions.value = withSelected(found, [
      { value: form.loadingPortId, label: portLabels.value[form.loadingPortId], sub: '' },
      { value: form.dischargePortId, label: portLabels.value[form.dischargePortId], sub: '' },
    ])
  } catch {
    // 拦截器已提示
  } finally {
    if (seq === portSeq) portLoading.value = false
  }
}

const searchCustomer = debounce(loadCustomers, 300)
const searchPort = debounce(loadPorts, 300)

const onCustomerVisible = open => {
  // 下拉刚打开时先展示一批,不用等用户敲字(两个接口不传关键词都返回前 20 条)
  if (open && !customerOptions.value.length) loadCustomers('')
}

watch(visible, async open => {
  if (!open) return
  dict.load()
  formRef.value?.clearValidate()

  customerOptions.value = []
  portOptions.value = []
  customerLabels.value = {}
  portLabels.value = {}

  if (isEdit.value) {
    loading.value = true
    try {
      const o = await fetchOrder(props.id)
      Object.assign(form, {
        customerId: o.customerId ?? null,
        orderDate: o.orderDate ?? '',
        loadingPortId: o.loadingPortId ?? null,
        dischargePortId: o.dischargePortId ?? null,
        statusId: o.status ?? null,
      })
      seedOptions(o)
    } catch {
      visible.value = false // 404 等,拦截器已提示
    } finally {
      loading.value = false
    }
  } else {
    Object.assign(form, emptyForm())
  }
})

/**
 * 编辑回填时,详情接口只给「id + 名字」,而下拉的选项是**搜出来**的另一套数据:
 * 打开表单时搜索框是空的,搜不到这个客户;港口更极端 —— `portOptions` 现在可能直接是空数组
 * (港口表没数据)。不塞的话 el-select 就会显示 id 数字,用户看到 "1" 和 "12" 一脸茫然。
 */
function seedOptions(o) {
  customerLabels.value = {}
  portLabels.value = {}

  customerOptions.value = []
  if (o.customerId) {
    customerLabels.value[o.customerId] = o.customerName ?? String(o.customerId)
    customerOptions.value = [
      { value: o.customerId, label: customerLabels.value[o.customerId], sub: '' },
    ]
  }

  portOptions.value = []
  for (const [idField, nameField] of [
    ['loadingPortId', 'loadingPortName'],
    ['dischargePortId', 'dischargePortName'],
  ]) {
    const portId = o[idField]
    if (portId && !portLabels.value[portId]) {
      portLabels.value[portId] = o[nameField] ?? String(portId)
      portOptions.value.push({
        value: portId,
        label: portLabels.value[portId],
        sub: '',
      })
    }
  }
}

async function onSubmit() {
  try {
    await formRef.value.validate()
  } catch {
    return // 校验不通过,表单上已有红字提示
  }

  submitting.value = true
  try {
    const body = toPayload(form)
    if (isEdit.value) await updateOrder(props.id, body)
    else await createOrder(body)

    ElMessage.success('保存成功')
    visible.value = false
    // 增删改不返回数据,新增也**不返回生成的订单号** —— 只能让父组件重新拉列表
    emit('success')
  } catch {
    // 400(客户/状态/港口不存在)·404 由拦截器弹出
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="isEdit ? '编辑订单' : '新增订单'"
    width="560px"
    :close-on-click-modal="false"
    destroy-on-close
  >
    <el-form
      ref="formRef"
      v-loading="loading"
      :model="form"
      :rules="rules"
      label-width="100px"
    >
      <el-form-item label="客户" prop="customerId">
        <el-select
          v-model="form.customerId"
          filterable
          remote
          clearable
          :remote-method="searchCustomer"
          :loading="customerLoading"
          placeholder="输入客户姓名开头几个字"
          style="width: 100%"
          @visible-change="onCustomerVisible"
        >
          <el-option
            v-for="o in customerOptions"
            :key="o.value"
            :value="o.value"
            :label="o.label"
          >
            <span>{{ o.label }}</span>
            <span class="option-sub">{{ o.sub }}</span>
          </el-option>
        </el-select>
      </el-form-item>

      <el-form-item label="下单时间" prop="orderDate">
        <!-- value-format 不能省:不加的话 v-model 拿到 Date 对象,提交时后端会 400 -->
        <el-date-picker
          v-model="form.orderDate"
          type="datetime"
          value-format="YYYY-MM-DD HH:mm:ss"
          format="YYYY-MM-DD HH:mm:ss"
          placeholder="请选择下单时间"
          style="width: 100%"
        />
      </el-form-item>

      <el-form-item label="起运港" prop="loadingPortId">
        <el-select
          v-model="form.loadingPortId"
          filterable
          remote
          clearable
          :remote-method="searchPort"
          :loading="portLoading"
          placeholder="输入港口中文名 / 英文名 / 五字码"
          style="width: 100%"
          @visible-change="open => open && !portOptions.length && loadPorts('')"
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

      <el-form-item label="目的港" prop="dischargePortId">
        <el-select
          v-model="form.dischargePortId"
          filterable
          remote
          clearable
          :remote-method="searchPort"
          :loading="portLoading"
          placeholder="输入港口中文名 / 英文名 / 五字码"
          style="width: 100%"
          @visible-change="open => open && !portOptions.length && loadPorts('')"
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

      <el-form-item label="订单状态" prop="statusId">
        <el-select v-model="form.statusId" placeholder="请选择订单状态" style="width: 100%">
          <el-option
            v-for="o in dict.options"
            :key="o.value"
            :label="o.label"
            :value="o.value"
          />
        </el-select>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="onSubmit">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
/* 选项右侧的附加信息(客户电话 / 港口五字码),用来区分同名项 */
.option-sub {
  float: right;
  margin-left: 16px;
  color: #909399;
  font-size: 12px;
}
</style>
