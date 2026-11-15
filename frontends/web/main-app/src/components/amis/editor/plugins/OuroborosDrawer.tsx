import { DrawerPlugin, registerEditorPlugin } from 'amis-editor'
import {
  createModalBodyRegionRenderMethodOverride,
  injectModalReferencePanel,
} from './modalEditorShared'

export class OuroborosDrawerPlugin extends DrawerPlugin {
  rendererName = 'OuroborosDrawer'

  constructor(manager: any) {
    super(manager)
    this.regions = (this.regions || []).map((region: any) =>
      region?.key === 'body'
        ? {
            ...region,
            renderMethodOverride: createModalBodyRegionRenderMethodOverride(),
          }
        : region
    )

    const inheritedPanelBodyCreator = this.panelBodyCreator
    this.panelBodyCreator = (context: any): any => {
      const panelBody = inheritedPanelBodyCreator.call(this, context)
      return injectModalReferencePanel(panelBody)
    }
  }
}

registerEditorPlugin(OuroborosDrawerPlugin)
