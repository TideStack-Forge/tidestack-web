import { PagePlugin, registerEditorPlugin, unRegisterEditorPlugin } from 'amis-editor'
import { defaultValue } from 'amis-editor-core'
import type { AfterBuildPanelBody, PluginEvent } from 'amis-editor-core'

unRegisterEditorPlugin('PagePlugin')

// Panel defaults must affect the control display without initializing schema fields.
function displayPageDefaults(panel: any, inPullRefresh = false): any {
  if (Array.isArray(panel)) {
    return panel.map((entry) => displayPageDefaults(entry, inPullRefresh))
  }
  if (!panel || typeof panel !== 'object') return panel

  const nestedPullRefresh = inPullRefresh || panel.name === 'pullRefresh'
  const next = Object.fromEntries(
    Object.entries(panel).map(([key, value]) => [
      key,
      displayPageDefaults(value, nestedPullRefresh),
    ])
  )
  if (panel.name === 'pullRefresh' && panel.type === 'combo') {
    next.syncDefaultValue = false
  }
  if (panel.name === 'asideResizor' || (inPullRefresh && panel.name === 'disabled')) {
    delete next.value
    next.pipeIn = defaultValue(panel.name === 'disabled')
  }
  return next
}

export class OuroborosPagePlugin extends PagePlugin {
  static id = 'OuroborosPagePlugin'

  afterBuildPanelBody(event: PluginEvent<AfterBuildPanelBody>) {
    if (event.context.plugin !== this) return
    event.setData(displayPageDefaults(event.context.data))
  }
}

registerEditorPlugin(OuroborosPagePlugin)
