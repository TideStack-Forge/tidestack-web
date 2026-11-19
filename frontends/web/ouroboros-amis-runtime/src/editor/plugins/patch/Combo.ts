import { ComboControlPlugin, registerEditorPlugin } from 'amis-editor'
import type { RegionConfig, PluginEvent, InsertEventContext } from 'amis-editor-core'

export class OuroborosComboControlPlugin extends ComboControlPlugin {
  disabledRendererPlugin = true // 组件面板不显示

  beforeInsert(event: PluginEvent<InsertEventContext>) {
    if (event.context.schema.type === 'combo') {
      event.context.region = 'items'
    }
  }
}

registerEditorPlugin(OuroborosComboControlPlugin)
