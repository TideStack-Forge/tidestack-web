import {
  PdfViewerPlugin,
  registerEditorPlugin,
  unRegisterEditorPlugin,
} from 'amis-editor'
import { replaceFrontendResourceFields } from '../../resource-browser/FrontendResourceInput'

unRegisterEditorPlugin('PdfViewerPlugin')

export class OuroborosPdfViewerPlugin extends PdfViewerPlugin {
  static id = 'OuroborosPdfViewerPlugin'

  private inheritedPanelBodyCreator: (context: any) => any

  constructor(manager: any) {
    super(manager)
    this.inheritedPanelBodyCreator = this.panelBodyCreator
    this.panelBodyCreator = (context: any): any =>
      replaceFrontendResourceFields(this.inheritedPanelBodyCreator(context), [
        {
          name: 'src',
          label: '链接地址',
          selectionMode: 'resource-or-url',
        },
      ])
  }
}

registerEditorPlugin(OuroborosPdfViewerPlugin)
