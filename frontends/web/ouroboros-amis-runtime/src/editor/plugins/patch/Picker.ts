import { PickerControlPlugin, registerEditorPlugin } from 'amis-editor'

export class OuroborosPickerControlPlugin extends PickerControlPlugin {
  rendererName = 'OuroborosPicker'
  disabledRendererPlugin = true // 组件面板不显示
}

registerEditorPlugin(OuroborosPickerControlPlugin)
