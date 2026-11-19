import { GroupControlPlugin, registerEditorPlugin } from 'amis-editor'

export class OuroborosGroupControlPlugin extends GroupControlPlugin {
  disabledRendererPlugin = false
}

registerEditorPlugin(OuroborosGroupControlPlugin)
