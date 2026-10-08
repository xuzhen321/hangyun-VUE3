import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // host: true = 监听所有网卡(0.0.0.0),同一个 server 既能在 localhost 打开、
    // 也能被局域网里其它设备访问,不用加 --host 参数。
    host: true,
    // 不配代理:后端跨域已全放行(allowCredentials=false),直连即可
  },
})
