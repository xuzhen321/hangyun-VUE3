<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { createContainer, updateContainer } from '@/api/container'
import { fetchCompanyOptions } from '@/api/company'
import { CONTAINER_STATUS_DELETED_ID } from '@/constants/dict'
import { useContainerStatusDict, useContainerTypeDict } from '@/stores/dict'
import { debounce } from '@/utils/debounce'

/**
 * 集装箱的新增 / 编辑弹窗。
 *
 * ⚠️ 三点和别的表单不一样:
 *   1. **箱号由前端填**(不是后端生成),而且**编辑时不可改** —— 它是主键
 *   2. **箱主和操作方指向同一张公司表**,用同一个下拉,两次搜索要互不干扰
 *   3. **两个标志位传 `true`/`false`**,不要传 `'1'`/`'0'`
 */
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  /** 编辑时传整行;新增时传 null */
  row: { type: Object, default: null },
})
const emit = defineEmits(['update:modelValue', 'success'])

const typeDict = useContainerTypeDict()
const statusDict = useContainerStatusDict()

const formRef = ref(null)
const submitting = ref(false)

const visible = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v),
})

const isEdit = computed(() => props.row !== null && props.row !== undefined)
/** 箱号在编辑时只读 —— 后端 UPDATE 里根本没有这一列,硬塞也会被安静忽略 */
const theNo = computed(() => props.row?.no ?? '')

function emptyForm() {
  return {
    no: '',
    typeId: null,
    ownerId: null,
    operatorId: null,
    sealNo: '',
    statusId: null,
    dangerFlag: false,
    maritimeFlag: false,
    carrierOperate: '',
    ctrStatusTerminal: '',
  }
}

const form = reactive(emptyForm())

const rules = {
  no: [
    // whitespace: true 让"全是空格"也判为不通过
    { required: true, whitespace: true, message: '请输入箱号', trigger: 'blur' },
    { max: 30, message: '箱号最长 30 个字符', trigger: 'blur' },
  ],
  sealNo: [{ max: 50, message: '铅封号最长 50 个字符', trigger: 'blur' }],
  carrierOperate: [{ max: 10, message: '船公司操作最长 10 个字符', trigger: 'blur' }],
  ctrStatusTerminal: [
    { max: 50, message: '集装箱堆场状态最长 50 个字符', trigger: 'blur' },
  ],
}

/**
 * 状态下拉 —— **把「已删除」过滤掉**。
 *
 * 已删除是逻辑删除的结果,不是让用户挑的状态;留着它的话,用户一不小心就把新箱子建成"已删除"了。
 * 但编辑一条**已经删掉**的集装箱时,当前值就是它 —— 那种情况要补回列表里,否则下拉显示空白。
 */
const statusOptions = computed(() => {
  const all = statusDict.options
  const base = all.filter(o => o.value !== CONTAINER_STATUS_DELETED_ID)
  if (form.statusId && !base.some(o => o.value === form.statusId)) {
    const current = all.find(o => o.value === form.statusId)
    if (current) return [...base, current]
  }
  return base
})

// ---- 箱主 / 操作方:两个下拉共用公司接口,各自独立搜索 ----
const ownerOptions = ref([])
const ownerLoading = ref(false)
const operatorOptions = ref([])
const operatorLoading = ref(false)
/** 公司 id -> { name, code },保证选中项永远有东西可显示 */
const companyLabels = ref({})

/**
 * 把"当前选中的值"补回选项列表。
 * el-select 在 options 里找不到当前值时会退化成显示 id,而远程搜索每次都整个替换数组。
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

function toCompanyOption(id) {
  if (!id) return { value: null }
  const info = companyLabels.value[id]
  return {
    value: id,
    label: info?.name ?? String(id),
    sub: info?.code ?? '',
  }
}

function makeCompanyLoader(optionsRef, loadingRef, seqRef) {
  return async keyword => {
    loadingRef.value = true
    const seq = ++seqRef.n
    try {
      const list = await fetchCompanyOptions(keyword)
      if (seq !== seqRef.n) return
      const found = (list || []).map(c => {
        companyLabels.value[c.id] = { name: c.name, code: c.code }
        return {
          value: c.id,
          label: c.name,
          sub: c.code, // 公司名很容易相近,靠代码消歧
        }
      })
      optionsRef.value = withSelected(found, [
        toCompanyOption(form.ownerId),
        toCompanyOption(form.operatorId),
      ])
    } catch {
      // 拦截器已提示
    } finally {
      if (seq === seqRef.n) loadingRef.value = false
    }
  }
}

const ownerSeq = { n: 0 }
const operatorSeq = { n: 0 }

// 两个下拉共用 companyLabels,但各自的搜索互不干扰(各自维护一份选项 + 序号守卫)
const loadOwner = makeCompanyLoader(ownerOptions, ownerLoading, ownerSeq)
const loadOperator = makeCompanyLoader(operatorOptions, operatorLoading, operatorSeq)

const searchOwner = debounce(loadOwner, 300)
const searchOperator = debounce(loadOperator, 300)

watch(visible, async open => {
  if (!open) return
  formRef.value?.clearValidate()
  companyLabels.value = {}
  ownerOptions.value = []
  operatorOptions.value = []

  typeDict.load()
  statusDict.load()

  if (isEdit.value) {
    const r = props.row
    Object.assign(form, {
      no: r.no ?? '',
      typeId: r.typeId ?? null,
      ownerId: r.ownerId ?? null,
      operatorId: r.operatorId ?? null,
      sealNo: r.sealNo ?? '',
      statusId: r.statusId ?? null,
      // 后端返回的永远是 true/false,解构时兜一下底,别把 undefined 传给开关
      dangerFlag: r.dangerFlag === true,
      maritimeFlag: r.maritimeFlag === true,
      carrierOperate: r.carrierOperate ?? '',
      ctrStatusTerminal: r.ctrStatusTerminal ?? '',
    })
    // 回填时必须把选中的公司塞进选项,否则下拉显示的是 id 数字
    if (r.ownerId) companyLabels.value[r.ownerId] = { name: r.ownerName, code: '' }
    if (r.operatorId) {
      companyLabels.value[r.operatorId] = { name: r.operatorName, code: '' }
    }
  } else {
    Object.assign(form, emptyForm())
  }

  // 下拉先各加载一批(不传 keyword 返回前 20 条)
  loadOwner('')
  loadOperator('')
})

async function onSubmit() {
  try {
    await formRef.value.validate()
  } catch {
    return // 校验不通过,表单上已有红字提示
  }

  submitting.value = true
  try {
    // 刻意显式构造:编辑时**不带 no**(后端不收,硬塞也会被忽略)
    const body = {
      typeId: form.typeId,
      ownerId: form.ownerId,
      operatorId: form.operatorId,
      sealNo: form.sealNo.trim() || null,
      statusId: form.statusId,
      // ⚠️ 布尔值原样传 true/false,不要转成 '1'/'0'
      dangerFlag: form.dangerFlag,
      maritimeFlag: form.maritimeFlag,
      carrierOperate: form.carrierOperate.trim() || null,
      ctrStatusTerminal: form.ctrStatusTerminal.trim() || null,
    }

    if (isEdit.value) {
      await updateContainer(theNo.value, body)
    } else {
      await createContainer({ ...body, no: form.no.trim() })
    }

    ElMessage.success('保存成功')
    visible.value = false
    // 增删改不返回数据 —— 只能让父组件重新拉列表
    emit('success')
  } catch {
    // 409(箱号已存在)·400(引用不存在)由拦截器弹出
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="isEdit ? '编辑集装箱' : '新增集装箱'"
    width="720px"
    :close-on-click-modal="false"
    destroy-on-close
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="箱号" prop="no">
            <!-- 编辑时只读:箱号是主键,后端 UPDATE 里没有这一列 -->
            <el-input
              v-if="isEdit"
              :model-value="theNo"
              disabled
            />
            <el-input
              v-else
              v-model="form.no"
              maxlength="30"
              placeholder="如 SEGU9481570"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="箱型" prop="typeId">
            <el-select v-model="form.typeId" clearable filterable placeholder="请选择箱型" style="width: 100%">
              <el-option
                v-for="o in typeDict.options"
                :key="o.value"
                :label="o.label"
                :value="o.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="箱主" prop="ownerId">
            <el-select
              v-model="form.ownerId"
              filterable
              remote
              clearable
              :remote-method="searchOwner"
              :loading="ownerLoading"
              placeholder="输入公司名称或代码"
              style="width: 100%"
            >
              <el-option v-for="o in ownerOptions" :key="o.value" :value="o.value" :label="o.label">
                <span>{{ o.label }}</span>
                <span class="option-sub">{{ o.sub }}</span>
              </el-option>
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="操作方" prop="operatorId">
            <el-select
              v-model="form.operatorId"
              filterable
              remote
              clearable
              :remote-method="searchOperator"
              :loading="operatorLoading"
              placeholder="输入公司名称或代码"
              style="width: 100%"
            >
              <el-option v-for="o in operatorOptions" :key="o.value" :value="o.value" :label="o.label">
                <span>{{ o.label }}</span>
                <span class="option-sub">{{ o.sub }}</span>
              </el-option>
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="当前状态" prop="statusId">
            <!-- statusOptions 已经把「已删除」滤掉了 -->
            <el-select v-model="form.statusId" clearable placeholder="请选择状态" style="width: 100%">
              <el-option
                v-for="o in statusOptions"
                :key="o.value"
                :label="o.label"
                :value="o.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="铅封号" prop="sealNo">
            <el-input v-model="form.sealNo" maxlength="50" placeholder="请输入铅封号" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="是否危险品" prop="dangerFlag">
            <el-switch v-model="form.dangerFlag" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="海事标识" prop="maritimeFlag">
            <el-switch v-model="form.maritimeFlag" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="船公司操作" prop="carrierOperate">
            <el-input v-model="form.carrierOperate" maxlength="10" placeholder="如 加锁 / 截关" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="堆场状态" prop="ctrStatusTerminal">
            <el-input
              v-model="form.ctrStatusTerminal"
              maxlength="50"
              placeholder="集装箱堆场状态"
            />
          </el-form-item>
        </el-col>
      </el-row>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="onSubmit">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
/* 选项右侧的附加信息(公司代码),用来区分名字相近的公司 */
.option-sub {
  float: right;
  margin-left: 16px;
  color: #909399;
  font-size: 12px;
}
</style>
