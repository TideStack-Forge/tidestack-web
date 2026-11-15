import { beforeEach, describe, expect, test, vi } from 'vitest'
import * as SDK from '../../../src/main'

global.window = global.window || ({} as any)

describe('business Action calls through platform request injection', () => {
  const identity = { modelFullName: 'sales.Order', actionName: 'submit', expectedContractFingerprint: 'schema-v1' }
  let post: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    post = vi.fn(async () => ({ data: { code: 0, data: { accepted: true } } }))
    await SDK.initMicroApp({ render: async () => ({}) }).mount({ __utils__: { request: { post } } } as any)
  })

  test('typed identity uses the unified endpoint and keeps output values', async () => {
    const output = await SDK.businessActions.invoke<{ data: { comment: string } }, { accepted: boolean }>(identity, { data: { comment: 'ok' } })
    expect(output).toEqual({ accepted: true })
    expect(post).toHaveBeenCalledWith('/api/business-model-behaviors/sales.Order/actions/submit/invoke', {
      input: { data: { comment: 'ok' } }, expectedContractFingerprint: 'schema-v1',
    })
  })

  test('availability preserves the server tri-state without invoking the Action', async () => {
    post.mockResolvedValue({ data: { code: 0, data: { status: 'NEEDS_INPUT', reasons: ['needs comment'], blockage: 'NONE' } } })
    const result = await SDK.businessActions.checkAvailability(identity, { data: {} })
    expect(result.status).toBe('NEEDS_INPUT')
    expect(post.mock.calls[0][0]).toMatch(/\/availability$/)
  })

  test('file invocation uses the platform blob transport once and returns native content for the caller', async () => {
    const file = { fileName: 'orders.xlsx', fileContent: new Blob(['native content']), fileSize: 14, fileType: 'application/octet-stream' }
    post.mockResolvedValue({ data: { code: 0, data: file } })
    expect(await SDK.businessActions.invokeFile(identity, { params: { query: {} } })).toBe(file)
    expect(post).toHaveBeenCalledExactlyOnceWith('/api/business-model-behaviors/sales.Order/actions/submit/invoke', {
      input: { params: { query: {} } }, expectedContractFingerprint: 'schema-v1',
    }, { responseType: 'blob', noSave: false, throwOnError: true })
    expect(await file.fileContent.text()).toBe('native content')
  })

  test('file invocation rejects server errors and successful non-file results', async () => {
    post.mockResolvedValue({ data: { code: -1, msg: 'export denied' } })
    await expect(SDK.businessActions.invokeFile(identity, {})).rejects.toThrow('export denied')
    post.mockResolvedValue({ data: { code: 0, data: 'not a file' } })
    await expect(SDK.businessActions.invokeFile(identity, {})).rejects.toThrow('did not return a file')
  })

  test('availability preserves business precondition blockage', async () => {
    post.mockResolvedValue({ data: { code: 0, data: { status: 'BLOCKED', reasons: ['draft required'], blockage: 'PRECONDITION' } } })
    const result = await SDK.businessActions.checkAvailability(identity, {})
    expect(result).toEqual({ status: 'BLOCKED', reasons: ['draft required'], blockage: 'PRECONDITION' })
    expect(post).toHaveBeenCalledTimes(1)
  })

  test('business failures reject with the original diagnostic instead of returning a typed result', async () => {
    post.mockResolvedValue({ data: { code: -1, msg: 'SDK contract changed', data: null } })
    await expect(SDK.businessActions.invoke(identity, {})).rejects.toThrow('SDK contract changed')
    const error = new Error('unauthorized')
    post.mockRejectedValue(error)
    await expect(SDK.businessActions.invoke(identity, {})).rejects.toBe(error)
  })

  test('dynamic callers omit the fingerprint and paths encode member names', async () => {
    await SDK.businessActions.invoke({ modelFullName: 'sales.Order', actionName: 'submit/payment' }, { data: { amount: 1 } })
    expect(post.mock.calls[0]).toEqual(['/api/business-model-behaviors/sales.Order/actions/submit%2Fpayment/invoke', {
      input: { data: { amount: 1 } },
    }])
  })

  test('existing clients use the latest injected request after remount', async () => {
    const replacement = vi.fn(async () => ({ data: { code: 0, data: false } }))
    await SDK.initMicroApp({ render: async () => ({}) }).mount({ __utils__: { request: { post: replacement } } } as any)
    expect(await SDK.businessActions.invoke(identity, {})).toBe(false)
    expect(post).not.toHaveBeenCalled()
  })
})
