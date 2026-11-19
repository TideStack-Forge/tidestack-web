import { ServicePlugin, registerEditorPlugin } from 'amis-editor'

export class OuroborosServicePlugin extends ServicePlugin {
  rendererName = 'OuroborosService'
  disabledRendererPlugin = true // 组件面板不显示
}

registerEditorPlugin(OuroborosServicePlugin)
