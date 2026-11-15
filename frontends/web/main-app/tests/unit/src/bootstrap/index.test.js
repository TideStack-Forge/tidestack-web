import { beforeEach, afterEach, expect, test, vi } from 'vitest'

const {
  getBootstrapMode,
  bootstrapHostApp,
  requestLegacyIframeBootstrapInput,
} = vi.hoisted(() => ({
  getBootstrapMode: vi.fn(),
  bootstrapHostApp: vi.fn(),
  requestLegacyIframeBootstrapInput: vi.fn(),
}))

vi.mock('@/utils', () => ({
  getBootstrapMode,
}))

vi.mock('../../../../src/bootstrap/bootstrapHostApp.ts', () => ({
  bootstrapHostApp,
}))

vi.mock('../../../../src/bootstrap/requestLegacyIframeBootstrapInput.ts', () => ({
  requestLegacyIframeBootstrapInput,
}))

import { bootstrap } from '../../../../src/bootstrap/index.ts'

const originalWindow = globalThis.window

beforeEach(() => {
  Object.defineProperty(globalThis, 'window', {
    value: { location: { href: 'https://example.test/' } },
    configurable: true,
    writable: true,
  })
  getBootstrapMode.mockReset()
  bootstrapHostApp.mockReset()
  requestLegacyIframeBootstrapInput.mockReset()
})

afterEach(() => {
  if (typeof originalWindow === 'undefined') {
    delete globalThis.window
    return
  }

  Object.defineProperty(globalThis, 'window', {
    value: originalWindow,
    configurable: true,
    writable: true,
  })
})

test('bootstrap dispatches legacy iframe bootstrap only for legacyIframe mode', () => {
  getBootstrapMode.mockReturnValue('legacyIframe')

  bootstrap()

  expect(requestLegacyIframeBootstrapInput).toHaveBeenCalledTimes(1)
  expect(bootstrapHostApp).not.toHaveBeenCalled()
})

test('bootstrap dispatches host bootstrap for host mode', () => {
  getBootstrapMode.mockReturnValue('host')

  bootstrap()

  expect(bootstrapHostApp).toHaveBeenCalledTimes(1)
  expect(requestLegacyIframeBootstrapInput).not.toHaveBeenCalled()
})
