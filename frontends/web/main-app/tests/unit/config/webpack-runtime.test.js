import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const { resolve } = require('node:path')

const { createRuntimeOptions } = require(
  resolve(__dirname, '../../../webpack.runtime.js')
)
const createWebpackConfig = require(resolve(__dirname, '../../../webpack.config.js'))

const ORIGINAL_ARGV = [...process.argv]
const ORIGINAL_NODE_ENV = process.env.NODE_ENV
const ORIGINAL_PLAYWRIGHT_HARNESS = process.env.PLAYWRIGHT_HARNESS

function restoreOptionalEnv(key, value) {
  if (typeof value === 'undefined') {
    delete process.env[key]
    return
  }

  process.env[key] = value
}

describe('webpack runtime micro proxy map', () => {
  beforeEach(() => {
    process.argv = [...ORIGINAL_ARGV]
    process.env.NODE_ENV = 'test'
    delete process.env.PLAYWRIGHT_HARNESS
  })

  afterEach(() => {
    process.argv = [...ORIGINAL_ARGV]
    restoreOptionalEnv('NODE_ENV', ORIGINAL_NODE_ENV)
    restoreOptionalEnv('PLAYWRIGHT_HARNESS', ORIGINAL_PLAYWRIGHT_HARNESS)
    vi.restoreAllMocks()
  })

  test('createRuntimeOptions merges normalized dynamic micro_map entries into the proxy map', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const runtime = createRuntimeOptions([
      'node',
      'scripts/webpack-serve.js',
      '--debug_console',
      'http://127.0.0.1:9000',
      '--micro_map',
      'custom=http://127.0.0.1:9100',
      '--micro-map',
      '/custom-two/=http://127.0.0.1:9200',
      '--micro_map',
      '/micro-app-other/=http://127.0.0.1:9300',
    ])

    expect(runtime.microWebProxyMap).toEqual({
      '/debug-console-header/': 'http://127.0.0.1:9000',
      '/micro-logicflow-editor/': 'http://127.0.0.1:88/',
      '/micro-workflow-editor/': 'http://127.0.0.1:88/',
      '/micro-app-other/': 'http://127.0.0.1:9300',
      '/custom/': 'http://127.0.0.1:9100',
      '/custom-two/': 'http://127.0.0.1:9200',
    })
    expect(warnSpy).not.toHaveBeenCalled()
  })

  test('createRuntimeOptions ignores malformed dynamic micro_map entries', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const runtime = createRuntimeOptions([
      'node',
      'scripts/webpack-serve.js',
      '--micro_map',
      'invalid-format',
      '--micro_map',
    ])

    expect(runtime.microWebProxyMap).toEqual({
      '/debug-console-header/': 'http://127.0.0.1:88/',
      '/micro-logicflow-editor/': 'http://127.0.0.1:88/',
      '/micro-workflow-editor/': 'http://127.0.0.1:88/',
      '/micro-app-other/': 'http://127.0.0.1:88/',
    })
    expect(warnSpy).toHaveBeenCalledTimes(2)
    expect(warnSpy.mock.calls[0][0]).toContain(
      '忽略非法的微前端代理参数 "invalid-format"'
    )
    expect(warnSpy.mock.calls[1][0]).toContain('忽略缺少值的 --micro_map 参数')
  })

  test('createRuntimeOptions exposes the debug entrypoint outside production', () => {
    process.env.NODE_ENV = 'development'

    const runtime = createRuntimeOptions(['node', 'scripts/webpack-serve.js'])

    expect(runtime.pages.index.entry).toBe('src/main.ts')
    expect(runtime.pages.debug).toMatchObject({
      entry: 'src/debug-main.ts',
      filename: 'debug.html',
    })
  })

  test('createRuntimeOptions excludes the debug entrypoint from production', () => {
    process.env.NODE_ENV = 'production'

    const runtime = createRuntimeOptions(['node', 'scripts/webpack-build.js'])

    expect(runtime.pages.index.entry).toBe('src/main.ts')
    expect(runtime.pages.debug).toBeUndefined()
  })

  test('webpack config exposes dynamic micro_map entries through devServer proxy', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    process.env.NODE_ENV = 'development'
    process.argv = [
      'node',
      'scripts/webpack-serve.js',
      '--micro_map',
      'custom=http://127.0.0.1:9100',
    ]

    const config = createWebpackConfig({}, { mode: 'development' })
    const proxyEntry = config.devServer.proxy.find((entry) =>
      entry.context.includes('/custom/')
    )

    expect(proxyEntry).toEqual({
      context: ['/custom/'],
      target: 'http://127.0.0.1:9100',
    })
    expect(
      config.devServer.proxy.find((entry) =>
        entry.context.includes('/debug-console-header/')
      )
    ).toEqual({
      context: ['/debug-console-header/'],
      target: 'http://127.0.0.1:88/',
    })
    expect(warnSpy).toHaveBeenCalled()
  })

  test('webpack config disables browser-blocking error overlays in development', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    process.env.NODE_ENV = 'development'
    process.argv = ['node', 'scripts/webpack-serve.js']

    const config = createWebpackConfig({}, { mode: 'development' })

    expect(config.devServer.client.overlay).toEqual({
      warnings: false,
      errors: false,
      runtimeErrors: false,
    })
  })

  test('webpack config serves debug paths from the debug entrypoint in development', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    process.env.NODE_ENV = 'development'
    process.argv = ['node', 'scripts/webpack-serve.js']

    const config = createWebpackConfig({}, { mode: 'development' })
    const [rewrite] = config.devServer.historyApiFallback.rewrites

    expect(rewrite.to).toBe('/debug.html')
    expect(rewrite.from.test('/debug/amis-tooltip-patch')).toBe(true)
    expect(rewrite.from.test('/welcome')).toBe(false)
  })
})
