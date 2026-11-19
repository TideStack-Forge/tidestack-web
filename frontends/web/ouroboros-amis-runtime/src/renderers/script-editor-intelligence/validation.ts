import type { ScriptEditorIntelligenceBridge, ScriptEditorPropsLike } from './types'

/** AMIS awaits this result through the renderer's official validate hook. */
export async function validateEditorCode(
  editor: any,
  monaco: any,
  bridge: ScriptEditorIntelligenceBridge | undefined,
  props: ScriptEditorPropsLike
): Promise<string> {
  if (props.validateCode === false) return ''
  if (!editor?.getModel()) return props.value ? '代码编辑器尚未就绪，请稍后重试' : ''
  const started = Date.now()
  try {
    for (;;) {
      const model = editor.getModel()
      const version = model.getVersionId()
      await bridge?.validate(props)
      if (props.validateCode === false) return ''
      if (model !== editor.getModel() || version !== model.getVersionId()) {
        if (Date.now() - started >= 30_000) throw new Error('代码持续变化，请停止编辑后重新提交')
        continue
      }
      // A native provider may finish after the model has switched to a backend language.
      const errors = monaco.editor.getModelMarkers({ resource: model.uri, owner: bridge?.diagnosticOwner })
        .filter((marker: any) => marker.severity === monaco.MarkerSeverity.Error)
        .map((marker: any) => `第 ${marker.startLineNumber} 行：${marker.message}`)
      return [...new Set(errors)].join('\n')
    }
  } catch (error) {
    return `代码校验未完成：${error instanceof Error ? error.message : String(error)}`
  }
}
