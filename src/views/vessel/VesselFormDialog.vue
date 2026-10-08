<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { createVessel, updateVessel } from '@/api/vessel'
import { fetchShipType, fetchShipTypeOptions } from '@/api/shipType'
import { fetchCountryOptions } from '@/api/country'
import { fetchCompanyOptions } from '@/api/company'
import { useRemoteSelect } from '@/composables/useRemoteSelect'

/**
 * 船舶的新增 / 编辑弹窗。
 *
 * ⚠️ **读写字段名不一样:提交时船名叫 `name`,返回里叫 `shipname`。**
 *    文档专门标了这一点,别按返回的字段名去提交。
 *
 * ⚠️ `gt` / `nt` / `dwt` / `length` / `width` **不在提交字段里** ——
 *    它们来自"船型",是那个**型号**的规格,改船型才会变。所以界面上不出现。
 */
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  /** 编辑时传整行;新增时传 null */
  row: { type: Object, default: null },
})
const emit = defineEmits(['update:modelValue', 'success'])

const formRef = ref(null)
const submitting = ref(false)

const visible = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v),
})

const isEdit = computed(() => props.row !== null && props.row !== undefined)

const form = reactive({
  name: '',
  vesselTypeId: null,
  countryId: null,
  mmsi: '',
  imo: '',
  callsign: '',
  buildYear: null,
  ownerCompanyId: null,
  managerCompanyId: null,
})

const rules = {
  name: [
    // whitespace: true 让"全是空格"也判为不通过
    { required: true, whitespace: true, message: '请输入船名', trigger: 'blur' },
    { max: 100, message: '船名最长 100 个字符', trigger: 'blur' },
  ],
  // ⚠️ 这五个现在都是**必填** —— 文档说得很清楚:列表里对应的列"不允许空白",
  //    而这些列要么靠这几个外键联出来、要么是 vessel 表自己的列
  vesselTypeId: [{ required: true, message: '请选择船舶类型', trigger: 'change' }],
  countryId: [{ required: true, message: '请选择船旗国', trigger: 'change' }],
  // 数字字段的 required 要标 type: 'number',否则 async-validator 会拿字符串规则去套
  buildYear: [
    { required: true, type: 'number', message: '请输入建造年份', trigger: 'blur' },
  ],
  ownerCompanyId: [{ required: true, message: '请选择船东', trigger: 'change' }],
  managerCompanyId: [{ required: true, message: '请选择管理公司', trigger: 'change' }],
  // ⚠️ MMSI / IMO / 呼号**现在也是必填** —— 之前是可选的,后来改了。
  //    文档的说法:这三项是"船舶的全球识别码,真实船舶必有",而且**不能留空**。
  //    它们同时也是**全库唯一**的,所以既不能空、也不能和别的船撞。
  mmsi: [
    { required: true, whitespace: true, message: '请输入 MMSI', trigger: 'blur' },
    { max: 20, message: 'MMSI 最长 20 个字符', trigger: 'blur' },
  ],
  imo: [
    { required: true, whitespace: true, message: '请输入 IMO', trigger: 'blur' },
    { max: 20, message: 'IMO 最长 20 个字符', trigger: 'blur' },
  ],
  callsign: [
    { required: true, whitespace: true, message: '请输入呼号', trigger: 'blur' },
    { max: 20, message: '呼号最长 20 个字符', trigger: 'blur' },
  ],
}

/**
 * 所选船型带出来的**规格**,只读展示。
 *
 * ⚠️ 这几个(`gt` / `nt` / `dwt` / `length` / `width`)**不是提交字段** ——
 *    它们描述的是那个**型号**的规格,不是这条船的实际参数,所以不能单独填、改船型才会变。
 *    但列表里有这几列、表单里却没有,用户会以为"少字段了",所以这里显示出来做个交代。
 *
 * 📌 下拉接口 `/ship-types/options` 只返回「类型名 + 总吨」,拿不到另外四个,
 *    所以要单独调一次详情 `GET /ship-types/{id}`。
 */
const typeSpec = ref(null)
let specSeq = 0

watch(
  () => form.vesselTypeId,
  async id => {
    if (!id) {
      typeSpec.value = null
      return
    }
    const my = ++specSeq
    try {
      const t = await fetchShipType(id)
      if (my !== specSeq) return // 丢弃过期响应
      typeSpec.value = t
        ? { gt: t.gt, nt: t.nt, dwt: t.dwt, length: t.length, width: t.width }
        : null
    } catch {
      // 拿不到就不显示,不影响主流程
      typeSpec.value = null
    }
  }
)

// ---- 四个远程搜索下拉 ----
const {
  options: typeOptions,
  loading: typeLoading,
  search: searchType,
  load: loadTypeList,
  remember: rememberType,
} = useRemoteSelect(kw => fetchShipTypeOptions(kw), {
  toOption: t => ({ value: t.id, label: t.type, sub: '' }),
  selected: () => [form.vesselTypeId],
})

const {
  options: countryOptions,
  loading: countryLoading,
  search: searchCountry,
  load: loadCountryList,
  remember: rememberCountry,
} = useRemoteSelect(kw => fetchCountryOptions(kw), {
  toOption: c => ({ value: c.id, label: c.countryCnname || c.countryCode, sub: c.countryCode }),
  selected: () => [form.countryId],
})

/** 船东和管理公司指向同一张公司表、同一个接口,但各自独立搜索 */
const {
  options: ownerOptions,
  loading: ownerLoading,
  search: searchOwner,
  load: loadOwnerList,
  remember: rememberOwner,
} = useRemoteSelect(kw => fetchCompanyOptions(kw), {
  toOption: c => ({ value: c.id, label: c.name, sub: c.code || '' }),
  selected: () => [form.ownerCompanyId],
})

const {
  options: managerOptions,
  loading: managerLoading,
  search: searchManager,
  load: loadManagerList,
  remember: rememberManager,
} = useRemoteSelect(kw => fetchCompanyOptions(kw), {
  toOption: c => ({ value: c.id, label: c.name, sub: c.code || '' }),
  selected: () => [form.managerCompanyId],
})

/**
 * ⚠️ **船东 / 管理公司必须选"已填公司代码"的公司。**
 *
 * 后端的约束:传一个没填 `code` 的公司会 **400「船东必须填写公司代码」** ——
 * 因为船舶列表里的「船东代码 / 管理公司代码」两列就是从公司联出来的,公司没代码那两列就空白。
 *
 * 所以这里**直接把没代码的公司从下拉里滤掉**,不让用户选到一个必然报错的项。
 * 📌 但**当前已选中的那个要保留** —— 否则编辑一条历史数据时下拉会显示空白,
 *    用户连自己原来选的是哪家都看不到。
 */
const ownerOptionsFiltered = computed(() =>
  ownerOptions.value.filter(o => o.sub || o.value === form.ownerCompanyId)
)
const managerOptionsFiltered = computed(() =>
  managerOptions.value.filter(o => o.sub || o.value === form.managerCompanyId)
)

watch(visible, open => {
  if (!open) return
  formRef.value?.clearValidate()

  const r = props.row
  Object.assign(form, {
    // ⚠️ 读 `shipname`,写 `name`
    name: r?.shipname ?? '',
    vesselTypeId: r?.vesselTypeId ?? null,
    countryId: r?.countryId ?? null,
    mmsi: r?.mmsi ?? '',
    imo: r?.imo ?? '',
    callsign: r?.callsign ?? '',
    buildYear: r?.buildYear ?? null,
    ownerCompanyId: r?.ownerCompanyId ?? null,
    managerCompanyId: r?.managerCompanyId ?? null,
  })

  // 回填的显示文本要先 remember,后面的 load 才会把选中项补进选项列表
  rememberType(form.vesselTypeId, r?.shiptype)
  rememberCountry(form.countryId, r?.flagState)
  rememberOwner(form.ownerCompanyId, r?.shipOwner)
  rememberManager(form.managerCompanyId, r?.shipManager)

  loadTypeList('')
  loadCountryList('')
  loadOwnerList('')
  loadManagerList('')
})

async function onSubmit() {
  try {
    await formRef.value.validate()
  } catch {
    return // 校验不通过,表单上已有红字提示
  }

  submitting.value = true
  try {
    const body = {
      // ⚠️ 提交用 `name`,不是 `shipname`
      name: form.name.trim(),
      vesselTypeId: form.vesselTypeId,
      countryId: form.countryId,
      // 三个唯一项:现在是必填,所以这里正常不会为空;`|| null` 只是兜底
      mmsi: form.mmsi.trim() || null,
      imo: form.imo.trim() || null,
      callsign: form.callsign.trim() || null,
      buildYear: form.buildYear,
      ownerCompanyId: form.ownerCompanyId,
      managerCompanyId: form.managerCompanyId,
    }

    if (isEdit.value) await updateVessel(props.row.id, body)
    else await createVessel(body)

    ElMessage.success('保存成功')
    visible.value = false
    // 增删改不返回数据 —— 只能让父组件重新拉列表
    emit('success')
  } catch {
    // 409(MMSI / IMO / 呼号重复)· 400(各种引用不存在)由拦截器弹出
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="isEdit ? '编辑船舶' : '新增船舶'"
    width="720px"
    :close-on-click-modal="false"
    destroy-on-close
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
      <el-form-item label="船名" prop="name">
        <el-input v-model="form.name" maxlength="100" placeholder="请输入船名" />
      </el-form-item>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="船舶类型" prop="vesselTypeId">
            <el-select
              v-model="form.vesselTypeId"
              filterable
              remote
              clearable
              :remote-method="searchType"
              :loading="typeLoading"
              placeholder="输入类型名称搜索"
              style="width: 100%"
            >
              <el-option v-for="o in typeOptions" :key="o.value" :value="o.value" :label="o.label" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="船旗国" prop="countryId">
            <el-select
              v-model="form.countryId"
              filterable
              remote
              clearable
              :remote-method="searchCountry"
              :loading="countryLoading"
              placeholder="输入国家代码 / 中英文名"
              style="width: 100%"
            >
              <el-option v-for="o in countryOptions" :key="o.value" :value="o.value" :label="o.label">
                <span>{{ o.label }}</span>
                <span class="option-sub">{{ o.sub }}</span>
              </el-option>
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="MMSI" prop="mmsi">
            <el-input v-model="form.mmsi" maxlength="20" placeholder="全球唯一,不能重复" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="IMO" prop="imo">
            <el-input v-model="form.imo" maxlength="20" placeholder="不能重复" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="呼号" prop="callsign">
            <el-input v-model="form.callsign" maxlength="20" placeholder="不能重复" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="建造年份" prop="buildYear">
            <el-input-number
              v-model="form.buildYear"
              :min="1900"
              :max="2100"
              :precision="0"
              :controls="false"
              placeholder="1900 ~ 2100"
              style="width: 100%"
            />
          </el-form-item>
        </el-col>
      </el-row>

      <!-- 船型带出来的规格:只读,不能单独填 -->
      <el-form-item v-if="typeSpec" label="规格">
        <div class="spec-row">
          <span>总吨 {{ typeSpec.gt ?? '—' }}</span>
          <span>净吨 {{ typeSpec.nt ?? '—' }}</span>
          <span>载重吨 {{ typeSpec.dwt ?? '—' }}</span>
          <span>长 {{ typeSpec.length ?? '—' }}</span>
          <span>宽 {{ typeSpec.width ?? '—' }}</span>
        </div>
        <div class="field-hint">
          这几项来自所选的<strong>船型</strong>,不能单独填 —— 换船型才会变。
          同型号的船这几项会一样。
        </div>
      </el-form-item>

      <el-form-item label="船东" prop="ownerCompanyId">
        <el-select
          v-model="form.ownerCompanyId"
          filterable
          remote
          clearable
          :remote-method="searchOwner"
          :loading="ownerLoading"
          placeholder="输入公司名称或代码"
          style="width: 100%"
        >
          <el-option v-for="o in ownerOptionsFiltered" :key="o.value" :value="o.value" :label="o.label">
            <span>{{ o.label }}</span>
            <span class="option-sub">{{ o.sub }}</span>
          </el-option>
        </el-select>
      </el-form-item>

      <el-form-item label="管理公司" prop="managerCompanyId">
        <el-select
          v-model="form.managerCompanyId"
          filterable
          remote
          clearable
          :remote-method="searchManager"
          :loading="managerLoading"
          placeholder="输入公司名称或代码"
          style="width: 100%"
        >
          <el-option v-for="o in managerOptionsFiltered" :key="o.value" :value="o.value" :label="o.label">
            <span>{{ o.label }}</span>
            <span class="option-sub">{{ o.sub }}</span>
          </el-option>
        </el-select>
      </el-form-item>
      <el-form-item>
        <div class="field-hint">
          ⚠️ 船东和管理公司**只能选已经填了「公司代码」的公司** ——
          船舶列表里那两列「船东代码 / 管理公司代码」就是从公司联出来的。
          下拉里找不到某家公司,多半是它在公司管理里还没填代码。
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
.option-sub {
  float: right;
  margin-left: 16px;
  color: #909399;
  font-size: 12px;
}

/* 船型规格的只读展示 */
.spec-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  color: #606266;
}

.field-hint {
  margin-top: 4px;
  color: #909399;
  font-size: 12px;
  line-height: 1.5;
}
</style>
