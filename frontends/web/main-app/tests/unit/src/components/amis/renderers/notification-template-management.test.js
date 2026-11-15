import { describe, expect, test, vi } from 'vitest'
import {
  NotificationTemplateManagementState,
  differences,
} from '@/components/amis/renderers/notificationTemplateManagement'

function definition(overrides = {}) {
  return {
    name: 'notice/a',
    hasOverride: false,
    defaultExists: true,
    defaultRevision: 'default-1',
    overrideRevision: 'NONE',
    effectiveSource: 'DEFAULT',
    baseChanged: false,
    availableActions: { view: true, edit: true, restore: false },
    diagnostics: [],
    differences: [],
    effectiveTemplate: {
      name: 'notice/a',
      title: '原标题',
      isEnabled: true,
      payloadSchema: { name: 'string' },
      channel: { email: { schema: { body: '原文' }, options: {} } },
    },
    ...overrides,
  }
}
async function editor(request = vi.fn()) {
  const model = new NotificationTemplateManagementState('notice/a', request, vi.fn())
  request.mockResolvedValueOnce({ code: 0, data: definition() })
  await model.load()
  model.beginEdit()
  return model
}

describe('notification runtime management', () => {
  test('editing another field preserves an unchanged nullable deployment title', async () => {
    const request = vi.fn().mockResolvedValueOnce({
      code: 0,
      data: definition({
        effectiveTemplate: { ...definition().effectiveTemplate, title: null },
      }),
    })
    const model = new NotificationTemplateManagementState('notice/a', request, vi.fn())
    await model.load()
    model.beginEdit()
    model.change({ isEnabled: false })
    expect(model.command().changes).toEqual({ isEnabled: false })
    expect(model.draft.title).toBeNull()
  })
  test('writes only mutable fields with observed tokens and retains false/empty channels', async () => {
    const request = vi.fn(),
      model = await editor(request)
    model.change({ title: '', isEnabled: false, channel: {} })
    expect(model.command()).toEqual({
      expectedDefaultRevision: 'default-1',
      expectedOverrideRevision: 'NONE',
      changes: { title: '', isEnabled: false, channel: {} },
    })
    expect(model.canWrite).toBe(true)
    expect(model.definition.effectiveTemplate.channel.email.schema.body).toBe('原文')
    request.mockResolvedValueOnce({
      code: 0,
      data: {
        committed: true,
        confirmed: true,
        changed: true,
        definition: definition({
          hasOverride: true,
          effectiveSource: 'OVERRIDE',
          overrideRevision: 'row:1',
        }),
      },
    })
    await model.write()
    expect(request).toHaveBeenLastCalledWith(
      'put',
      '/api/sys/notification-template/notice%2Fa/runtime-override',
      expect.objectContaining({ expectedOverrideRevision: 'NONE' })
    )
    expect(model.editing).toBe(false)
    expect(model.message).toBe('配置已保存并生效')
  })
  test('no changes and invalid JSON block writes; checking performs no persistence', async () => {
    const request = vi.fn(),
      model = await editor(request)
    expect(model.canWrite).toBe(false)
    await model.write()
    model.change({ title: '新标题' })
    model.inputState('channel.email.options.headers', '格式错误')
    await model.check()
    await model.write()
    expect(request).toHaveBeenCalledTimes(1)
    model.inputState('channel.email.options.headers', '')
    request.mockResolvedValueOnce({
      code: 0,
      data: { valid: true, errors: [], warnings: [], changes: [], overrides: [] },
    })
    expect(await model.check()).toBe(true)
    expect(request).toHaveBeenLastCalledWith(
      'post',
      expect.stringContaining('/validate'),
      model.command()
    )
    expect(model.editing).toBe(true)
    expect(model.dirty).toBe(true)
  })
  test('a conflict retains input and tokens until explicit comparison and adoption', async () => {
    const request = vi.fn(),
      model = await editor(request)
    model.change({ title: '本次编辑' })
    request.mockResolvedValueOnce({
      code: 409,
      msg: '版本冲突',
      data: { defaultRevision: 'default-2', overrideRevision: 'row:2' },
    })
    await model.write()
    expect(model.draft.title).toBe('本次编辑')
    expect(model.command().expectedDefaultRevision).toBe('default-1')
    expect(model.canWrite).toBe(false)
    request.mockResolvedValueOnce({
      code: 0,
      data: definition({ defaultRevision: 'default-2', overrideRevision: 'row:2' }),
    })
    await model.load(true)
    expect(model.command().expectedOverrideRevision).toBe('NONE')
    expect(model.draft.title).toBe('本次编辑')
    model.acceptLatest()
    expect(model.command().expectedOverrideRevision).toBe('row:2')
    expect(model.draft.title).toBe('本次编辑')
    expect(model.canWrite).toBe(true)
  })
  test('committed but unconfirmed and lost responses disable blind resubmission', async () => {
    for (const response of [
      {
        code: 503,
        data: { committed: true, confirmed: false, overrideRevision: 'row:1' },
      },
      { code: -1, msg: 'network lost', data: null },
      { code: 503, msg: 'proxy unavailable', data: null },
      new Error('network lost'),
    ]) {
      const request = vi.fn(),
        model = await editor(request)
      model.change({ title: '新标题' })
      if (response instanceof Error) request.mockRejectedValueOnce(response)
      else request.mockResolvedValueOnce(response)
      await model.write()
      await model.write()
      expect(model.pendingCommit).toBeTruthy()
      expect(model.canWrite).toBe(false)
      expect(request).toHaveBeenCalledTimes(2)
      request.mockResolvedValueOnce({ code: 0, data: definition() })
      await model.load(true)
      expect(model.pendingCommit).toBeTruthy()
      request.mockResolvedValueOnce({ code: 0, data: definition() })
      await model.load()
      expect(model.pendingCommit).toBeUndefined()
    }
  })
  test('channel catalog accepts the original Client items response', async () => {
    const request = vi
      .fn()
      .mockResolvedValue({ code: 0, data: { items: [{ id: 'email', title: '邮件' }] } })
    const model = new NotificationTemplateManagementState('notice/a', request, vi.fn())
    await model.loadChannels()
    expect(model.channels).toEqual([{ id: 'email', title: '邮件' }])
    expect(model.channelError).toBe('')
  })
  test('restore submits only the observed versions and returns the deployment default', async () => {
    const request = vi.fn(),
      model = await editor(request)
    model.definition.availableActions.restore = true
    model.definition.hasOverride = true
    model.definition.overrideRevision = 'row:7'
    request.mockResolvedValueOnce({
      code: 0,
      data: { committed: true, confirmed: true, changed: true, definition: definition() },
    })
    await model.write(true)
    expect(request).toHaveBeenLastCalledWith(
      'post',
      expect.stringContaining('/restore-default'),
      {
        expectedDefaultRevision: 'default-1',
        expectedOverrideRevision: 'row:7',
        changes: {},
      }
    )
    expect(model.definition.hasOverride).toBe(false)
  })
  test('read failures retain the last snapshot and readonly records cannot enter edit mode', async () => {
    const request = vi.fn(),
      model = await editor(request)
    model.cancel()
    model.definition.availableActions.edit = false
    model.beginEdit()
    expect(model.editing).toBe(false)
    request.mockRejectedValueOnce(new Error('database unavailable'))
    await model.load()
    expect(model.error).toBe('database unavailable')
    expect(model.definition.name).toBe('notice/a')
  })
  test('difference display distinguishes a removed field from explicit null and treats arrays as values', () => {
    expect(differences({ a: null, b: [1, 2] }, { c: null, b: [2, 1] })).toEqual([
      { path: 'a', operation: 'REMOVE', before: null },
      { path: 'b', operation: 'REPLACE', before: [1, 2], after: [2, 1] },
      { path: 'c', operation: 'ADD', after: null },
    ])
  })
})
