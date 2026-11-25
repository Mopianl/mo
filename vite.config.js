import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  base: './',
  plugins: [vue()],
  build: {
    outDir: 'dist',
    assetsInlineLimit: 2048
  },
  server: {
    port: 5173,
    // 本地 vite dev 时把 /api 打到 wrangler pages dev (8788)
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8788',
        changeOrigin: true
      }
    }
  }
})
