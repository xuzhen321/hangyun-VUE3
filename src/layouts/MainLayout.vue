<script setup>
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { getToken } from '@/utils/token'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

/**
 * 菜单高亮项。
 * 子页面(如 `/customers/:id/orders`「客户订单查询」)不属于任何菜单项,
 * 直接用 route.path 去匹配会导致"哪个都不亮",所以把它归到所属的一级菜单上。
 * 注意 `/customer-statuses` 不会被 `/customers` 前缀吃掉(第 10 个字符是 `-` 不是 `s`)。
 */
const activeMenu = computed(() =>
  route.path.startsWith('/customers') ? '/customers' : route.path
)

/**
 * 刷新页面后 Pinia 是空的,但令牌还在 —— 补拉一次当前用户,顶栏才能显示名字。
 *
 * 📌 如果令牌已经失效,这个请求会 401,由 `request.js` 的拦截器统一
 *    「清令牌 + 跳登录页」,这里不用自己处理。
 */
onMounted(() => {
  if (getToken() && !userStore.user) {
    userStore.loadMe().catch(() => {
      // 401 已在拦截器里处理过了
    })
  }
})

async function onLogout() {
  try {
    await ElMessageBox.confirm('确定退出登录吗?', '提示', { type: 'warning' })
  } catch {
    return // 用户取消
  }

  await userStore.logout()
  router.replace({ name: 'login' })
}
</script>

<template>
  <el-container class="layout">
    <!-- 顶部通栏(版式取自原型图) -->
    <el-header class="layout__header">
      <h1 class="layout__title">集装箱物流信息管理系统</h1>

      <!-- 右侧:当前登录用户 + 登出 -->
      <el-dropdown v-if="userStore.displayName" trigger="click" @command="onLogout">
        <span class="layout__user">
          {{ userStore.displayName }}
          <el-icon><ArrowDown /></el-icon>
        </span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="logout">退出登录</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </el-header>

    <el-container class="layout__body">
      <!-- 左侧折叠菜单 -->
      <el-aside width="200px" class="layout__aside">
        <el-menu
          :default-active="activeMenu"
          :default-openeds="[
            'customer',
            'order',
            'cargo',
            'container',
            'company',
            'event',
            'port',
            'vessel',
            'system',
          ]"
          router
        >
          <el-menu-item index="/home">
            <el-icon><Guide /></el-icon>
            <span>首页</span>
          </el-menu-item>

          <el-sub-menu index="customer">
            <template #title>
              <el-icon><Grid /></el-icon>
              <span>客户管理</span>
            </template>
            <el-menu-item index="/customers">
              <el-icon><User /></el-icon>
              <span>客户信息管理</span>
            </el-menu-item>
            <el-menu-item index="/customer-statuses">
              <el-icon><Tickets /></el-icon>
              <span>客户状态管理</span>
            </el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="order">
            <template #title>
              <el-icon><Van /></el-icon>
              <span>订单管理</span>
            </template>
            <el-menu-item index="/orders">
              <el-icon><Document /></el-icon>
              <span>订单信息管理</span>
            </el-menu-item>
            <el-menu-item index="/order-statuses">
              <el-icon><Collection /></el-icon>
              <span>订单状态管理</span>
            </el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="cargo">
            <template #title>
              <el-icon><Box /></el-icon>
              <span>货物管理</span>
            </template>
            <el-menu-item index="/cargo-types">
              <el-icon><Goods /></el-icon>
              <span>货物种类管理</span>
            </el-menu-item>
            <el-menu-item index="/cargos">
              <el-icon><List /></el-icon>
              <span>订单货物管理</span>
            </el-menu-item>
            <el-menu-item index="/cargo-container-results">
              <el-icon><Files /></el-icon>
              <span>装箱情况登记管理</span>
            </el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="container">
            <template #title>
              <el-icon><TakeawayBox /></el-icon>
              <span>集装箱管理</span>
            </template>
            <el-menu-item index="/containers">
              <el-icon><Suitcase /></el-icon>
              <span>集装箱信息管理</span>
            </el-menu-item>
            <el-menu-item index="/container-types">
              <el-icon><Postcard /></el-icon>
              <span>箱型管理</span>
            </el-menu-item>
            <el-menu-item index="/container-statuses">
              <el-icon><Switch /></el-icon>
              <span>集装箱状态管理</span>
            </el-menu-item>
            <el-menu-item index="/trailers">
              <el-icon><Odometer /></el-icon>
              <span>拖车管理</span>
            </el-menu-item>
            <el-menu-item index="/container-trailer-records">
              <el-icon><DocumentChecked /></el-icon>
              <span>提空箱登记</span>
            </el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="event">
            <template #title>
              <el-icon><Compass /></el-icon>
              <span>物流事件</span>
            </template>
            <el-menu-item index="/container-events">
              <el-icon><Location /></el-icon>
              <span>物流事件管理</span>
            </el-menu-item>
            <el-menu-item index="/event-statuses">
              <el-icon><Flag /></el-icon>
              <span>事件状态管理</span>
            </el-menu-item>
            <el-menu-item index="/voyages">
              <el-icon><Promotion /></el-icon>
              <span>航次管理</span>
            </el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="port">
            <template #title>
              <el-icon><Position /></el-icon>
              <span>港口管理</span>
            </template>
            <el-menu-item index="/ports">
              <el-icon><Coordinate /></el-icon>
              <span>港口信息管理</span>
            </el-menu-item>
            <el-menu-item index="/areas">
              <el-icon><MapLocation /></el-icon>
              <span>港口区域</span>
            </el-menu-item>
            <el-menu-item index="/timezones">
              <el-icon><Clock /></el-icon>
              <span>港口时区</span>
            </el-menu-item>
            <el-menu-item index="/harbor-sizes">
              <el-icon><FullScreen /></el-icon>
              <span>港口尺寸</span>
            </el-menu-item>
            <el-menu-item index="/port-levels">
              <el-icon><Sort /></el-icon>
              <span>港口级别</span>
            </el-menu-item>
            <el-menu-item index="/port-types">
              <el-icon><PriceTag /></el-icon>
              <span>港口类型</span>
            </el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="vessel">
            <template #title>
              <el-icon><Ship /></el-icon>
              <span>船舶管理</span>
            </template>
            <el-menu-item index="/vessels">
              <el-icon><Notebook /></el-icon>
              <span>船舶信息管理</span>
            </el-menu-item>
            <el-menu-item index="/countries">
              <el-icon><Memo /></el-icon>
              <span>国家字典</span>
            </el-menu-item>
            <el-menu-item index="/ship-types">
              <el-icon><DataLine /></el-icon>
              <span>船舶类型</span>
            </el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="system">
            <template #title>
              <el-icon><Setting /></el-icon>
              <span>系统管理</span>
            </template>
            <el-menu-item index="/users">
              <el-icon><UserFilled /></el-icon>
              <span>系统用户</span>
            </el-menu-item>
            <el-menu-item index="/operation-types">
              <el-icon><Operation /></el-icon>
              <span>操作类型</span>
            </el-menu-item>
            <el-menu-item index="/logs">
              <el-icon><DocumentCopy /></el-icon>
              <span>操作日志</span>
            </el-menu-item>
          </el-sub-menu>
        </el-menu>
      </el-aside>

      <el-main class="layout__main">
        <h2 class="page-title">{{ route.meta.title }}</h2>
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
.layout {
  height: 100vh;
}

.layout__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 60px;
  background: linear-gradient(90deg, #1f6fd0 0%, #17a2c9 55%, #7ddc3f 100%);
}

.layout__title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: 1px;
  color: #fff;
}

.layout__user {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  outline: none;
}

.layout__body {
  height: calc(100vh - 60px);
}

.layout__aside {
  background: #fff;
  border-right: 1px solid #e6e6e6;
  overflow: auto;
}

.layout__aside :deep(.el-menu) {
  border-right: none;
}

.layout__main {
  padding: 20px 24px;
  overflow: auto;
}

.page-title {
  margin: 0 0 20px;
  font-size: 26px;
  font-weight: 700;
}
</style>
