import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// https://vite.dev/config/
export default defineConfig({
  server: {
    port: 5174,
    strictPort: true
  },
  plugins: [
    react(),
    tailwindcss(),
  ],
});
