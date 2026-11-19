import { describe, expect, it, vi } from 'vitest'

vi.mock('amis-editor', () => ({
  PagePlugin: class {},
  registerEditorPlugin: vi.fn(),
  unRegisterEditorPlugin: vi.fn(),
}))
vi.mock('amis-editor-core', () => ({
  defaultValue: (fallback) => (value) => (value == null ? fallback : value),
}))

import { OuroborosPagePlugin } from '@/components/amis/editor/plugins/patch/Page'

describe('page property panel defaults', () => {
  it('displays disabled defaults without initializing schema properties and preserves explicit values', () => {
    const plugin = new OuroborosPagePlugin()
    const original = [
      {
        body: [
          {
            name: 'asideResizor',
            value: false,
            form: { body: [{ name: 'asideMinWidth', pipeIn: (value) => value ?? 160 }] },
          },
          {
            type: 'combo',
            name: 'pullRefresh',
            items: [
              { name: 'disabled', value: true },
              { name: 'pullingText', label: 'Text' },
            ],
          },
          { name: 'disabled', value: 'unrelated' },
        ],
      },
    ]
    let panel
    plugin.afterBuildPanelBody({
      context: { plugin, data: original },
      setData: (value) => {
        panel = value
      },
    })
    const [resizor, refresh, unrelated] = panel[0].body
    expect(resizor).not.toHaveProperty('value')
    expect(refresh.items[0]).not.toHaveProperty('value')
    expect(refresh.syncDefaultValue).toBe(false)
    expect(resizor.pipeIn(undefined)).toBe(false)
    expect(refresh.items[0].pipeIn(undefined)).toBe(true)
    expect(resizor.pipeIn(true)).toBe(true)
    expect(refresh.items[0].pipeIn(false)).toBe(false)
    expect(resizor.form.body[0].pipeIn(undefined)).toBe(160)
    expect(unrelated.value).toBe('unrelated')
    expect(original[0].body[0].value).toBe(false)
    expect(original[0].body[1].items[0].value).toBe(true)
  })

  it('does not modify another plugin panel', () => {
    const plugin = new OuroborosPagePlugin()
    const setData = vi.fn()
    plugin.afterBuildPanelBody({
      context: { plugin: {}, data: [{ name: 'asideResizor', value: false }] },
      setData,
    })
    expect(setData).not.toHaveBeenCalled()
  })
})
