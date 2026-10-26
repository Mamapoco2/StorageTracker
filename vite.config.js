import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// /api requests are proxied to Laravel (php artisan serve), so no CORS setup is needed in dev.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://127.0.0.1:8000' } },
})
