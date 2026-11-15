import { TreeSelectControlPlugin, registerEditorPlugin } from 'amis-editor'

export class OuroborosTreeSelectControlPlugin extends TreeSelectControlPlugin {
  rendererName = 'OuroborosTreeSelect'
  disabledRendererPlugin = true // 组件面板不显示
}

registerEditorPlugin(OuroborosTreeSelectControlPlugin)
