import { FileControlPlugin, registerEditorPlugin } from 'amis-editor'

export class OuroborosFileControlPlugin extends FileControlPlugin {
  rendererName = 'OuroborosInputFile'
  disabledRendererPlugin = true // 组件面板不显示
}

registerEditorPlugin(OuroborosFileControlPlugin)
