<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { createPort, searchPorts, updatePort } from '@/api/port'
import { fetchCountryOptions } from '@/api/country'
import {
  useHarborSizeDict,
  usePortAreaDict,
  usePortLevelDict,
  usePortTypeDict,
  usePortTimezoneDict,
} from '@/stores/dict'
import { useRemoteSelect } from '@/composables/useRemoteSelect'

/**
 * 港口的新增 / 编辑弹窗。13 个字段,所以用了两栏布局。
 *
 * ⚠️ **`state` 不在请求体里** —— 它由后端维护(新增 `0`、删除 `3`)。
 *    所以前端改不了港口的删除状态,也就不会误把已删除的港口"复活"。
 *
 * ⚠️ **母港不能指向自己** —— 编辑时把当前港口从母港下拉里滤掉。
 */
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  /** 编辑时传整行;新增时传 null */
  row: { type: Object, default: null },
})
const emit = defineEmits(['update:modelValue', 'success'])

// 五个小字典都是"一次性返回全部",走缓存
const areaDict = usePortAreaDict()
const timezoneDict = usePortTimezoneDict()
const harborSizeDict = useHarborSizeDict()
const levelDict = usePortLevelDict()
const portTypeDict = usePortTypeDict()

const formRef = ref(null)
const submitting = ref(false)

const visible = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v),
})

const isEdit = computed(() => props.row !== null && props.row !== undefined)

const form = reactive({
  unlocode: '',
  cnname: '',
  enname: '',
  countryId: null,
  areaId: null,
  timezoneId: null,
  harborSizeId: null,
  levelId: null,
  portTypeId: null,
  parentPortId: null,
  latitude: null,
  longitude: null,
  geom: '',
  province: '',
})

const rules = {
  unlocode: [
    // whitespace: true 让"全是空格"也判为不通过
    { required: true, whitespace: true, message: '请输入港口五字码', trigger: 'blur' },
    { max: 10, message: '港口五字码最长 10 个字符', trigger: 'blur' },
  ],
  cnname: [{ max: 100, message: '中文名最长 100 个字符', trigger: 'blur' }],
  enname: [{ max: 100, message: '英文名最长 100 个字符', trigger: 'blur' }],
  geom: [{ max: 255, message: '港口范围最长 255 个字符', trigger: 'blur' }],
  province: [{ max: 50, message: '所在省份最长 50 个字符', trigger: 'blur' }],
}

// 国家:接口只返回前 20 条 → 远程搜索
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

// 母港:另一个港口,同样走 /ports/options 远程搜索
const {
  options: parentPortOptions,
  loading: parentPortLoading,
  search: searchParentPort,
  load: loadParentPortList,
  remember: rememberParentPort,
} = useRemoteSelect(kw => searchPorts(kw), {
  toOption: p => ({ value: p.id, label: p.cnname, sub: p.unlocode }),
  selected: () => [form.parentPortId],
})

/**
 * 母港的选项要把**自己**滤掉 —— 后端会 400「母港不能指向自己」,
 * 但让用户根本选不到比让他提交后挨一句报错更好。
 */
const parentPortOptionsFiltered = computed(() =>
  isEdit.value
    ? parentPortOptions.value.filter(o => o.value !== props.row.id)
    : parentPortOptions.value
)

watch(visible, open => {
  if (!open) return
  formRef.value?.clearValidate()

  const r = props.row
  Object.assign(form, {
    unlocode: r?.unlocode ?? '',
    cnname: r?.cnname ?? '',
    enname: r?.enname ?? '',
    countryId: r?.countryId ?? null,
    areaId: r?.areaId ?? null,
    timezoneId: r?.timezoneId ?? null,
    harborSizeId: r?.harborSizeId ?? null,
    levelId: r?.levelId ?? null,
    portTypeId: r?.portTypeId ?? null,
    parentPortId: r?.parentPortId ?? null,
    latitude: r?.latitude ?? null,
    longitude: r?.longitude ?? null,
    geom: r?.geom ?? '',
    province: r?.province ?? '',
  })

  // 两边都加载一批字典(缓存过就秒回)
  areaDict.load()
  timezoneDict.load()
  harborSizeDict.load()
  levelDict.load()
  portTypeDict.load()

  // 回填的显示文本要先 remember,后面的 load 才会把选中项补进选项列表
  rememberCountry(form.countryId, r?.countryCnname)
  rememberParentPort(form.parentPortId, r?.parentPortName)
  loadCountryList('')
  loadParentPortList('')
})

async function onSubmit() {
  try {
    await formRef.value.validate()
  } catch {
    return // 校验不通过,表单上已有红字提示
  }

  submitting.value = true
  try {
    // 显式构造:state 不在请求体里,别把它带上去
    const body = {
      unlocode: form.unlocode.trim(),
      cnname: form.cnname.trim() || null,
      enname: form.enname.trim() || null,
      countryId: form.countryId,
      areaId: form.areaId,
      timezoneId: form.timezoneId,
      harborSizeId: form.harborSizeId,
      levelId: form.levelId,
      portTypeId: form.portTypeId,
      parentPortId: form.parentPortId,
      latitude: form.latitude,
      longitude: form.longitude,
      geom: form.geom.trim() || null,
      province: form.province.trim() || null,
    }

    if (isEdit.value) await updatePort(props.row.id, body)
    else await createPort(body)

    ElMessage.success('保存成功')
    visible.value = false
    // 增删改不返回数据 —— 只能让父组件重新拉列表
    emit('success')
  } catch {
    // 409(五字码重复)·400(各种引用不存在 / 母港指向自己)由拦截器弹出
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="isEdit ? '编辑港口' : '新增港口'"
    width="760px"
    :close-on-click-modal="false"
    destroy-on-close
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="五字码" prop="unlocode">
            <el-input v-model="form.unlocode" maxlength="10" placeholder="如 CNSHA" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="中文名" prop="cnname">
            <el-input v-model="form.cnname" maxlength="100" placeholder="如 上海港" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="英文名" prop="enname">
            <el-input v-model="form.enname" maxlength="100" placeholder="如 Shanghai" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="所在省份" prop="province">
            <el-input v-model="form.province" maxlength="50" placeholder="如 上海市" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="国家" prop="countryId">
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
        <el-col :span="12">
          <el-form-item label="区域" prop="areaId">
            <el-select v-model="form.areaId" clearable placeholder="请选择区域" style="width: 100%">
              <el-option v-for="o in areaDict.options" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="时区" prop="timezoneId">
            <el-select v-model="form.timezoneId" clearable placeholder="请选择时区" style="width: 100%">
              <el-option v-for="o in timezoneDict.options" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="尺寸" prop="harborSizeId">
            <el-select v-model="form.harborSizeId" clearable placeholder="请选择尺寸" style="width: 100%">
              <el-option v-for="o in harborSizeDict.options" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="级别" prop="levelId">
            <el-select v-model="form.levelId" clearable placeholder="请选择级别" style="width: 100%">
              <el-option v-for="o in levelDict.options" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="类型" prop="portTypeId">
            <el-select v-model="form.portTypeId" clearable placeholder="请选择类型" style="width: 100%">
              <el-option v-for="o in portTypeDict.options" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item label="母港" prop="parentPortId">
        <!-- 选项里已经滤掉"自己"(后端会 400 母港不能指向自己) -->
        <el-select
          v-model="form.parentPortId"
          filterable
          remote
          clearable
          :remote-method="searchParentPort"
          :loading="parentPortLoading"
          placeholder="输入港口名称搜索(可选)"
          style="width: 100%"
        >
          <el-option
            v-for="o in parentPortOptionsFiltered"
            :key="o.value"
            :value="o.value"
            :label="o.label"
          >
            <span>{{ o.label }}</span>
            <span class="option-sub">{{ o.sub }}</span>
          </el-option>
        </el-select>
      </el-form-item>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="纬度" prop="latitude">
            <!-- 最多 3 位整数 + 6 位小数(后端约束) -->
            <el-input-number
              v-model="form.latitude"
              :min="-999.999999"
              :max="999.999999"
              :precision="6"
              :controls="false"
              placeholder="如 31.230416"
              style="width: 100%"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="经度" prop="longitude">
            <el-input-number
              v-model="form.longitude"
              :min="-999.999999"
              :max="999.999999"
              :precision="6"
              :controls="false"
              placeholder="如 121.473701"
              style="width: 100%"
            />
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item label="港口范围" prop="geom">
        <el-input v-model="form.geom" maxlength="255" placeholder="WKT 文本(可选)" />
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
</style>
