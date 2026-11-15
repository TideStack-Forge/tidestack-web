import { beforeEach, expect, test, vi } from 'vitest'
import { I18nManager } from '../../../../../src/common/i18n/I18nManager.ts'

const state = vi.hoisted(() => ({ manager: null }))
vi.mock('@/common/i18n', () => ({ i18nService: { getManager: () => state.manager } }))
const { processAmisSchema } = await import('../../../../../src/common/i18n/amis.ts')

beforeEach(() => {
  state.manager = new I18nManager({ publish: vi.fn() })
  state.manager.setLocale({
    locale: 'en-US',
    messages: {
      'logicflow-editor': {
        名称: 'Name',
        删除: 'Delete',
        '共 {{count}} 项': '{{count}} items',
      },
      'workflow-editor': { 名称: 'Workflow name' },
      common: { 名称: 'Common name', 'button.label': 'Common button' },
    },
  })
})

test('development schemas translate display properties in their own namespace and preserve persisted values', () => {
  const schema = {
    type: 'form',
    body: [
      {
        type: 'input-text',
        name: '名称',
        label: '名称',
        value: '名称',
        data: { label: '名称' },
      },
    ],
    actions: [{ type: 'button', label: '删除' }],
  }
  const original = structuredClone(schema)
  expect(processAmisSchema('logicflow-editor', schema)).toEqual({
    ...schema,
    body: [{ ...schema.body[0], label: 'Name' }],
    actions: [{ type: 'button', label: 'Delete' }],
  })
  expect(schema).toEqual(original)
  expect(processAmisSchema('workflow-editor', schema).body[0].label).toBe('Workflow name')
})

test('bound namespace translators share fallback and interpolation behavior across language changes', () => {
  const translate = state.manager.useNamespace('logicflow-editor')
  expect(translate('missing.path', '名称')).toBe('Name')
  expect(translate('missing.count', '共 {{count}} 项', { count: 3 })).toBe('3 items')
  expect(translate('button.label', '删除')).toBe('Common button')
  state.manager.setLocale({ locale: 'zh-CN', messages: {} })
  expect(translate('missing.path', '名称')).toBe('名称')
})
