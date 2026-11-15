import React from 'react'
import { FormItem, buildApi } from 'amis'
import { isEqual } from 'lodash'
import { createScriptEditorIntelligenceBridge } from './script-editor-intelligence/bridge'
import { subscribeCodeEnvironment } from './script-editor-intelligence/environment'
import type {
  ScriptEditorIntelligenceBridge,
  ScriptEditorPropsLike,
} from './script-editor-intelligence/types'

import type { FormControlProps } from 'amis'

export interface JsonDataEditorProps extends FormControlProps {
  allowValueTypes: string
  onInputStateChange?: (error: string) => void
  jsonSchema?: object
  codeContext?: ScriptEditorPropsLike
}

export default class JsonDataEditorControl extends React.Component<
  JsonDataEditorProps,
  any
> {
  private intelligenceBridge?: ScriptEditorIntelligenceBridge
  private rawValue?: string
  private emittedValue: any
  static defaultProps: Partial<JsonDataEditorProps> = {
    allowValueTypes: 'object',
  }
  constructor(props: JsonDataEditorProps) {
    super(props)
    this.handleChange = this.handleChange.bind(this)
    this.handleValidate = this.handleValidate.bind(this)
    this.state = {
      value: props.value,
    }
    this.rawValue = JSON.stringify(props.value, null, 2)
    this.emittedValue = props.value
  }

  componentWillUnmount() {
    this.intelligenceBridge?.dispose()
  }

  private refreshIntelligence() {
    const context = this.props.codeContext
    const intelligenceApi = context?.intelligenceApi
      ? buildApi({ url: context.intelligenceApi, method: 'post' }, this.props.data).url
      : undefined
    void this.intelligenceBridge?.refresh({
      ...this.props,
      ...context,
      intelligenceApi,
      codeEmbedding: 'json',
      value: this.props.value,
    })
  }

  componentDidUpdate(prevProps: JsonDataEditorProps): void {
    this.refreshIntelligence()
    if (
      prevProps.value !== this.props.value &&
      !isEqual(this.props.value, this.emittedValue)
    ) {
      this.rawValue = JSON.stringify(this.props.value, null, 2)
      this.emittedValue = this.props.value
      this.setState({
        value: this.props.value,
      })
    }
  }

  handleChange(value: any) {
    if (this.rawValue === undefined && (value === undefined || value === '')) return
    this.rawValue = value
    this.props.onInputStateChange?.(this.handleValidate(value))
    try {
      const newValue = JSON.parse(value)
      if (isEqual(this.props.value, newValue)) return
      this.emittedValue = newValue
      this.props.onChange(newValue, undefined, true)
    } catch {
      return
    }
  }

  validate() {
    return this.rawValue === undefined ? '' : this.handleValidate(this.rawValue)
  }

  handleValidate(value: string) {
    try {
      const v = JSON.parse(value)
      const allowValueTypes: string[] = (this.props.allowValueTypes ?? 'object')
        .split(',')
        .map((item: string) => item.trim())
      const valueType = Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v
      if (!allowValueTypes.includes(valueType)) {
        return '数据类型错误'
      }
      return ''
    } catch {
      return '格式错误'
    }
  }

  handleEditorMounted(editor: any, monaco: any) {
    this.intelligenceBridge?.dispose()
    if (typeof window !== 'undefined') {
      ;(window as any).__OUROBOROS_SCRIPT_EDITOR_DEBUG__?.onMounted?.({
        editor,
        monaco,
        props: this.props,
      })
    }
    this.intelligenceBridge = createScriptEditorIntelligenceBridge({
      editor,
      monaco,
      subscribeEnvironment: subscribeCodeEnvironment,
    })
    this.refreshIntelligence()
    if (!this.props.jsonSchema) return () => this.intelligenceBridge?.dispose()
    const defaults = monaco.languages.json.jsonDefaults
    const modelUri = editor.getModel().uri.toString()
    const schemaUri = `${modelUri}/schema`
    defaults.setDiagnosticsOptions({
      ...defaults.diagnosticsOptions,
      validate: true,
      schemas: [
        ...(defaults.diagnosticsOptions.schemas || []),
        {
          uri: schemaUri,
          fileMatch: [modelUri],
          schema: this.props.jsonSchema,
        },
      ],
    })
    return () => {
      this.intelligenceBridge?.dispose()
      defaults.setDiagnosticsOptions({
        ...defaults.diagnosticsOptions,
        schemas: (defaults.diagnosticsOptions.schemas || []).filter(
          (schema: any) => schema.uri !== schemaUri
        ),
      })
    }
  }
  render(): React.ReactNode {
    const { render, static: isStatic } = this.props
    const data = {
      jsonData: this.rawValue,
    }
    return render(
      'json-data-editor',
      {
        type: 'json-editor',
        name: 'jsonData',
        label: false,
        wrap: false,
        changeImmediately: true,
        options: {
          lineNumbers: 'off',
          tabSize: 2,
          insertSpaces: true,
        },
        disabled: isStatic,
        editorDidMount: this.handleEditorMounted.bind(this),
      },
      {
        data,
        onChange: this.handleChange,
        validate: this.handleValidate,
      }
    )
  }
}

@FormItem({
  type: 'json-data-editor',
  autoVar: true,
  strictMode: false,
})
export class JsonDataEditorControlRenderer extends JsonDataEditorControl {}
