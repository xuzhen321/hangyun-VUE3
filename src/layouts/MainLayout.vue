<script setup>
import { useRoute } from 'vue-router'

const route = useRoute()
</script>

<template>
  <el-container class="layout">
    <!-- 顶部通栏(版式取自原型图) -->
    <el-header class="layout__header">
      <h1 class="layout__title">集装箱物流信息管理系统</h1>
    </el-header>

    <el-container class="layout__body">
      <!-- 左侧折叠菜单 -->
      <el-aside width="200px" class="layout__aside">
        <el-menu :default-active="route.path" :default-openeds="['customer']" router>
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

.layout__body {
  height: calc(100vh - 60px);
}

.layout__aside {
  background: #fff;
  border-right: 1px solid #e6e6e6;
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
