const path = require('path')
const { defineConfig } = require('vitest/config')

module.exports = defineConfig({
  resolve: {
    alias: {
      ...Object.fromEntries(Object.keys(require('./package.json').dependencies).filter(name => name !== 'ouroboros-amis-runtime').map(name => [name, path.resolve(__dirname, 'node_modules', name)])),
      'ouroboros-amis-runtime': path.resolve(__dirname, '../ouroboros-amis-runtime/src'),
      ...Object.fromEntries(require('../ouroboros-amis-runtime/host-ports.json').map((port) => [`#ouroboros-host/${port}`, path.resolve(__dirname, 'src', port)])),
      '@': path.resolve(__dirname, './src'),
    },
  },
  plugins: [{ name: 'shared-amis-test-paths', enforce: 'pre', resolveId(source, importer) {
    if (!importer || !source.startsWith('.')) return
    const absolute = path.resolve(path.dirname(importer), source)
    const prefix = path.resolve(__dirname, 'src/components/amis') + path.sep
    if (absolute.startsWith(prefix) && !/Amis(?:Component|Page)\.tsx$/.test(absolute)) {
      return this.resolve(absolute.replace(prefix, path.resolve(__dirname, '../ouroboros-amis-runtime/src') + path.sep), importer, { skipSelf: true })
    }
  } }],
  test: {
    globals: true,
    environment: 'node',
    server: { deps: { inline: [/ouroboros-amis-runtime/] } },
    include: ['tests/unit/**/*.test.js'],
  },
})
