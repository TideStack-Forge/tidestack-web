import { expect, test, vi } from 'vitest'

vi.mock('amis', () => ({ FormItem: () => component => component }))
vi.mock('amis/lib/renderers/Form/Editor', () => ({ default: class {
  constructor(props) { this.props = props }
} }))
import ScriptEditor from 'ouroboros-amis-runtime/renderers/ScriptEditor'

function fixture() {
  let version = 1
  const model = { uri: 'current', getVersionId: () => version }
  const editor = new ScriptEditor({ value: 'return (' })
  editor.editor = { getModel: () => model }
  const markers = []
  editor.monaco = { MarkerSeverity: { Error: 8 }, editor: {
    getModelMarkers: vi.fn(({ owner }) => markers.filter(marker => !marker.owner || marker.owner === owner)),
  } }
  editor.intelligenceBridge = { diagnosticOwner: 'editor-current', validate: vi.fn(async () => {}) }
  return { editor, markers, change: () => version++ }
}

test('AMIS validate reports error diagnostics but accepts warnings and corrected code', async () => {
  const { editor, markers } = fixture()
  markers.push({ severity: 8, message: '缺少右括号', startLineNumber: 2, startColumn: 4 })
  expect(await editor.validate()).toContain('缺少右括号')
  expect(editor.monaco.editor.getModelMarkers).toHaveBeenCalledWith({ resource: 'current', owner: 'editor-current' })
  markers[0].severity = 4
  expect(await editor.validate()).toBe('')
  markers.length = 0
  expect(await editor.validate()).toBe('')
  markers.push({ owner: 'javascript', severity: 8, message: 'late error from a former language provider' })
  expect(await editor.validate()).toBe('')
})

test('validateCode false bypasses code checking and can be switched back on', async () => {
  const { editor, markers } = fixture()
  markers.push({ severity: 8, message: '代码错误' })
  editor.props = { ...editor.props, validateCode: false }
  expect(await editor.validate()).toBe('')
  expect(editor.intelligenceBridge.validate).not.toHaveBeenCalled()
  editor.props = { ...editor.props, validateCode: true }
  expect(await editor.validate()).toContain('代码错误')
})

test('validation failures block submission and a document changed during validation is checked again', async () => {
  const { editor, change } = fixture()
  editor.intelligenceBridge.validate.mockRejectedValueOnce(new Error('语言服务不可用'))
  expect(await editor.validate()).toContain('语言服务不可用')
  editor.intelligenceBridge.validate.mockImplementationOnce(async () => { change() })
  expect(await editor.validate()).toBe('')
  expect(editor.intelligenceBridge.validate).toHaveBeenCalledTimes(3)
})

test('an unmounted nonempty editor cannot silently pass code validation', async () => {
  const editor = new ScriptEditor({ value: 'return (' })
  expect(await editor.validate()).toContain('尚未就绪')
  editor.props = { value: '' }
  expect(await editor.validate()).toBe('')
  editor.props = { value: 'return (', validateCode: false }
  expect(await editor.validate()).toBe('')
})
