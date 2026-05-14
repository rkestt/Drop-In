import { defineConfig } from 'vitest/config'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['lib/**/*.{test,spec}.ts', 'lib/**/*.{test,spec}.tsx', 'components/**/*.{test,spec}.ts', 'components/**/*.{test,spec}.tsx'],
    exclude: ['node_modules', '.next', 'dist'],
  },
  resolve: {
    alias: {
      '@': __dirname,
    },
  },
})