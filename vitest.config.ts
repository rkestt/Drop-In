import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [path.resolve(__dirname, 'lib/__tests__/setup.ts')],
    include: ['lib/**/*.{test,spec}.ts', 'lib/**/*.{test,spec}.tsx', 'components/**/*.{test,spec}.ts', 'components/**/*.{test,spec}.tsx'],
    exclude: ['node_modules', '.next', 'dist'],
  },
  resolve: {
    alias: {
      '@': __dirname,
    },
  },
})