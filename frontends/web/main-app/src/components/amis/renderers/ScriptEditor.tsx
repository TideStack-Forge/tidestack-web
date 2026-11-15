import { FormItem } from 'amis'
import EditorControl from 'amis/lib/renderers/Form/Editor'
import groovy from './language/groovy'
import { subscribeCodeEnvironment } from './script-editor-intelligence/environment'
import { createScriptEditorIntelligenceBridge } from './script-editor-intelligence/bridge'
import type { ScriptEditorIntelligenceBridge } from './script-editor-intelligence/types'

class ScriptEditor extends EditorControl {
  monaco?: any
  intelligenceBridge?: ScriptEditorIntelligenceBridge
  handleEditorMounted(editor: any, monaco: any) {
    groovy(monaco, editor)
    super.handleEditorMounted(editor, monaco)
    this.monaco = monaco
    this.intelligenceBridge = createScriptEditorIntelligenceBridge({
      editor,
      monaco,
      subscribeEnvironment: subscribeCodeEnvironment,
    })
    if (typeof window !== 'undefined') {
      ;(window as any).__OUROBOROS_SCRIPT_EDITOR_DEBUG__?.onMounted?.({
        editor,
        monaco,
        props: this.props,
      })
    }
    this.intelligenceBridge?.refresh(this.props)
  }

  async componentDidUpdate(prevProps: any) {
    if (this.props.static || this.props.static !== prevProps.static) {
      this.editor?.updateOptions?.({ readOnly: this.props.static })
    }
    const model = this.editor?.getModel?.()
    if (prevProps.language !== this.props.language && model) {
      this.monaco?.editor.setModelLanguage(model, this.props.language)
    }
    await this.intelligenceBridge?.refresh(this.props)
  }

  componentWillUnmount() {
    this.intelligenceBridge?.dispose()
    super.componentWillUnmount()
  }
}

FormItem({
  type: 'script-editor',
  autoVar: true,
  sizeMutable: false,
  // Code context depends on sibling fields in the resource draft.
  strictMode: false,
})(ScriptEditor)

export default ScriptEditor
