import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base mora ustrezati imenu GitHub repozitorija, ker Pages servira iz /<repo>/
export default defineConfig({
  base: process.env.BASE_PATH ?? '/loopmaker/',
  plugins: [react()],
})
