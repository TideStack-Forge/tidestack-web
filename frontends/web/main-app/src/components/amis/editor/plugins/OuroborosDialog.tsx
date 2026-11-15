import { DialogPlugin, registerEditorPlugin } from 'amis-editor'
import {
  createModalBodyRegionRenderMethodOverride,
  injectDialogEditorPanels,
  injectDialogResizePanel,
  injectModalReferencePanel,
  isReferencedModalSchema,
} from './modalEditorShared'

export {
  createModalBodyRegionRenderMethodOverride as createDialogBodyRegionRenderMethodOverride,
  injectDialogEditorPanels,
  injectDialogResizePanel,
  injectModalReferencePanel as injectDialogReferencePanel,
  isReferencedModalSchema as isReferencedDialogSchema,
}

export class OuroborosDialogPlugin extends DialogPlugin {
  rendererName = 'OuroborosDialog'

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
      return context?.schema?.dialogType === 'confirm'
        ? panelBody
        : injectDialogEditorPanels(panelBody)
    }
  }
}

registerEditorPlugin(OuroborosDialogPlugin)
