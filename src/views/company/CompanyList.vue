<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import DictManager from '@/components/DictManager.vue'
import { COMPANY } from '@/constants/dict'
import {
  fetchCompanies as fetchPage,
  createCompany as create,
  updateCompany as update,
  deleteCompany as remove,
} from '@/api/company'

const router = useRouter()

// 「集装箱详情」的选择框
const pickVisible = ref(false)
const activeCompany = ref(null)

function onViewContainers(row) {
  activeCompany.value = { id: row.id, name: row.name }
  pickVisible.value = true
}

/**
 * 跳到集装箱列表,按"这个公司作为箱主 / 作为操作方"筛。
 *
 * ⚠️ **必须让用户先选看哪一种,不能合成一次查询。**
 *    集装箱的 `ownerId` 和 `operatorId` 是**两个独立字段**(同时传是 AND),
 *    而且**可以是不同的公司** —— 租箱很常见,比如箱主是"泰腾箱务"、操作方是"中远海运"。
 *
 * 带上公司名和身份,是为了让集装箱列表能显示一个"当前在看谁"的标签,
 * 否则用户会看到一张没有理由被过滤的列表。
 */
function goAs(role) {
  const { id, name } = activeCompany.value
  router.push({
    path: '/containers',
    query:
      role === 'owner'
        ? { ownerId: id, companyName: name, companyRole: '箱主' }
        : { operatorId: id, companyName: name, companyRole: '操作方' },
  })
  pickVisible.value = false
}

// 页面全部行为都在 DictManager 里,这里只接线 + 一个额外的行操作按钮。
// ⚠️ 刻意**不传 useDict** —— 公司的下拉接口只返回前 20 条,不是全量,缓存没意义。
const config = {
  ...COMPANY,
  api: { fetchPage, create, update, remove },
  rowActions: [{ label: '集装箱详情', onClick: onViewContainers }],
}
</script>

<template>
  <DictManager :config="config" />

  <el-dialog
    v-model="pickVisible"
    title="集装箱详情"
    width="440px"
    align-center
  >
    <div v-if="activeCompany" class="company-line">
      <span class="company-line__label">公司</span>
      <span class="company-line__value">{{ activeCompany.name }}</span>
    </div>
    <p class="dialog-question">按哪种身份看它名下的集装箱?</p>

    <template #footer>
      <el-button type="primary" @click="goAs('owner')">作为箱主</el-button>
      <el-button type="primary" @click="goAs('operator')">作为操作方</el-button>
      <el-button @click="pickVisible = false">取消</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.company-line {
  display: flex;
  align-items: baseline;
  gap: 12px;
  font-size: 15px;
}

.company-line__label {
  color: #909399;
}

.company-line__value {
  font-weight: 600;
}

.dialog-question {
  margin: 16px 0 0;
  color: #606266;
}
</style>
