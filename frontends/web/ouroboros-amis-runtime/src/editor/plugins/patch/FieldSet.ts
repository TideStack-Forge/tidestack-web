import { FieldSetControlPlugin, registerEditorPlugin } from 'amis-editor'

export class OuroborosFieldSetControlPlugin extends FieldSetControlPlugin {
  rendererName = 'OuroborosFieldset'
  disabledRendererPlugin = true // 组件面板不显示
}

registerEditorPlugin(OuroborosFieldSetControlPlugin)
