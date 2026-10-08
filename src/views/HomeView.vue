<script setup>
/**
 * 首页。
 *
 * 配图放在 `public/home-banner.png` —— 放进 `public/` 的静态资源不会被 Vite 处理,
 * 按原样拷进产物,用 `/文件名` 就能访问。
 *
 * ⚠️ 路径用 `import.meta.env.BASE_URL` 拼,而不是写死 `/home-banner.png` ——
 *    这样将来把站点部署到子路径下(比如 `/hangyun/`)也不用改。
 */
const bannerSrc = `${import.meta.env.BASE_URL}home-banner.png`
</script>

<template>
  <div class="home">
    <img class="home__banner" :src="bannerSrc" alt="集装箱物流信息管理系统" />
    <p class="home__tip">请从左侧菜单选择功能</p>
  </div>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.home__banner {
  /* 跟着容器走,但别把图拉得太大 —— 它在 2560 宽的屏上也就占满内容区 */
  width: 100%;
  max-width: 1100px;
  height: auto;
  border-radius: 8px;
  /* 一点点阴影,让它从白色背景里"浮"起来 */
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.home__tip {
  margin: 20px 0 0;
  color: #909399;
  font-size: 14px;
}
</style>
