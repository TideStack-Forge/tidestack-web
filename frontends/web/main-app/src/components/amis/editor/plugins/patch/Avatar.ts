import { AvatarPlugin, registerEditorPlugin, unRegisterEditorPlugin } from 'amis-editor'
import { replaceFrontendResourceFields } from '../../resource-browser/FrontendResourceInput'

unRegisterEditorPlugin('AvatarPlugin')

export class OuroborosAvatarPlugin extends AvatarPlugin {
  static id = 'OuroborosAvatarPlugin'

  private inheritedPanelBodyCreator: (context: any) => any

  constructor(manager: any) {
    super(manager)
    this.inheritedPanelBodyCreator = this.panelBodyCreator
    this.panelBodyCreator = (context: any): any =>
      replaceFrontendResourceFields(this.inheritedPanelBodyCreator(context), [
        {
          name: 'src',
          selectionMode: 'resource-or-url',
        },
      ])
  }
}

registerEditorPlugin(OuroborosAvatarPlugin)
