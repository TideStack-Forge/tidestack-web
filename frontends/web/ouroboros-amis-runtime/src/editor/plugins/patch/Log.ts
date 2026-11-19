import { LogPlugin, registerEditorPlugin } from 'amis-editor'

export class OuroborosLogPlugin extends LogPlugin {
  rendererName = 'OuroborosLog'
  disabledRendererPlugin = true // 组件面板不显示
}

registerEditorPlugin(OuroborosLogPlugin)
