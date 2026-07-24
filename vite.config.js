import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
// GitHub Pages 프로젝트 페이지는 /<repo>/ 하위에서 서빙되므로 base 를 맞춰야 합니다.
// 배포(Actions)에서는 VITE_BASE=/<repo>/ 를 주입하고, 로컬은 '/' 로 동작합니다.
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
  },
})
