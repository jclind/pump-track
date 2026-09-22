import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'build', // matches Netlify publish dir
    target: 'es2020', // browser floor, see vite-migration-plan.md decisions
    sourcemap: true, // CRA parity; Vite defaults to false
  },
  css: {
    preprocessorOptions: {
      scss: {
        silenceDeprecations: ['import'], // 28 files still use Sass @import
      },
    },
  },
  server: { port: 3000 }, // CRA parity; firebase authorizes all localhost ports
  preview: { port: 3000 },
  test: {
    environment: 'jsdom',
    globals: true, // App.test.tsx uses bare test/expect
    setupFiles: './src/setupTests.ts',
    include: ['src/**/*.{test,spec}.{ts,tsx}'], // keep vitest out of functions/
  },
})
