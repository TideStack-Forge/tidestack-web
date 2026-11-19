import { VideoPlugin, registerEditorPlugin, unRegisterEditorPlugin } from 'amis-editor'
import { replaceFrontendResourceFields } from '../../resource-browser/FrontendResourceInput'

unRegisterEditorPlugin('VideoPlugin')

export class OuroborosVideoPlugin extends VideoPlugin {
  static id = 'OuroborosVideoPlugin'

  private inheritedPanelBodyCreator: (context: any) => any

  constructor(manager: any) {
    super(manager)
    this.inheritedPanelBodyCreator = this.panelBodyCreator
    this.panelBodyCreator = (context: any): any =>
      replaceFrontendResourceFields(this.inheritedPanelBodyCreator(context), [
        {
          name: 'src',
          label: '视频地址',
          selectionMode: 'resource-or-url',
        },
        {
          name: 'poster',
          label: '视频封面',
          selectionMode: 'resource-or-url',
        },
      ])
  }
}

registerEditorPlugin(OuroborosVideoPlugin)
