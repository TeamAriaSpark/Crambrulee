import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // pdf.js ships its worker as an ES module
  worker: { format: 'es' },
})
