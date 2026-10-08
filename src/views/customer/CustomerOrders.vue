<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchCustomerOrders } from '@/api/customer'
import { ORDER_STATUS } from '@/constants/dict'
import { tagStyleOf } from '@/constants/status'

const route = useRoute()
const router = useRouter()

const customerId = route.params.id
const statusTag = id => tagStyleOf(ORDER_STATUS, id)

const pager = reactive({ current: 1, size: 20, total: 0 })
const rows = ref([])
const loading = ref(false)
/** 404 = 客户不存在;和"这个客户没有订单"是两回事,要分开显示 */
const notFound = ref(false)

// 优先用客户列表带过来的姓名;直接打开链接时,退而用第一条订单里的客户姓名
const customerName = computed(
  () => route.query.name || rows.value[0]?.customerName || `#${customerId}`
)

/**
 * 返回按钮的目标和文案取决于**从哪进来的**:
 *   - 客户信息管理 →「订单查询」          → 回客户列表
 *   - 订单信息管理 → 客户姓名 →「查询更多订单」 → 回订单列表
 *
 * 用 URL 上的 `?from=` 记录来源,而不是 `router.back()` ——
 * 后者在刷新页面、或从收藏/外链直接打开时会退到应用外,不可靠。
 */
const backTarget = computed(() =>
  route.query.from === 'orders'
    ? { path: '/orders', label: '返回订单列表' }
    : { path: '/customers', label: '返回客户列表' }
)

async function loadList() {
  loading.value = true
  try {
    const data = await fetchCustomerOrders(customerId, {
      page: pager.current,
      size: pager.size,
    })
    // 删空当前页且不在第 1 页时回退一页
    if (!data.list.length && pager.current > 1) {
      pager.current -= 1
      return loadList()
    }
    rows.value = data.list
    pager.total = data.total
  } catch (err) {
    // 404 的 msg 拦截器已经弹过了,这里只负责把页面切成"客户不存在"
    if (err?.response?.status === 404) notFound.value = true
  } finally {
    loading.value = false
  }
}

function onSizeChange() {
  pager.current = 1
  loadList()
}

onMounted(loadList)
</script>

<template>
  <div class="page">
    <div class="page-head">
      <el-button link type="primary" @click="router.push(backTarget.path)">
        <el-icon><ArrowLeft /></el-icon>
        {{ backTarget.label }}
      </el-button>
      <span class="page-head__name">客户「{{ customerName }}」的订单</span>
    </div>

    <el-alert type="info" :closable="false" show-icon class="hint">
      <template #title>
        这里显示该客户<strong>全部</strong>订单、<strong>包含已取消的</strong> ——
        要的是完整往来记录,所以和「订单信息管理」的口径不同(那边默认不显示已取消的)。
      </template>
    </el-alert>

    <el-empty v-if="notFound" description="该客户不存在,可能已被删除" />

    <template v-else>
      <el-table v-loading="loading" :data="rows" border row-key="id">
        <el-table-column prop="id" label="订单号" width="200" />
        <el-table-column
          prop="loadingPortName"
          label="起运港"
          min-width="150"
          show-overflow-tooltip
        />
        <el-table-column
          prop="dischargePortName"
          label="目的港"
          min-width="150"
          show-overflow-tooltip
        />
        <el-table-column prop="orderDate" label="下单时间" width="170" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag v-bind="statusTag(row.status)">
              {{ row.statusDescription }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="insertTime" label="创建时间" width="170" />
      </el-table>

      <el-pagination
        v-model:current-page="pager.current"
        v-model:page-size="pager.size"
        :total="pager.total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        class="pager"
        @current-change="loadList"
        @size-change="onSizeChange"
      />
    </template>
  </div>
</template>

<style scoped>
.page-head {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.page-head__name {
  font-size: 16px;
  font-weight: 600;
}
</style>
