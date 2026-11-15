const path = require('path')
const { defineConfig } = require('vitest/config')

module.exports = defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/unit/**/*.test.js'],
  },
})
