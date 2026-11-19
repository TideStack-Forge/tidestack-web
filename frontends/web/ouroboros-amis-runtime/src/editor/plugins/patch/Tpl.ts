import { registerEditorPlugin, unRegisterEditorPlugin, getSchemaTpl } from 'amis-editor-core'
import { TplPlugin } from 'amis-editor'

unRegisterEditorPlugin('TplPlugin')

class OuroborosTplPlugin extends TplPlugin {
  popOverBody?: any[]  = [
    getSchemaTpl('tpl:content'),
    getSchemaTpl('tpl:rich-text'),
    getSchemaTpl('tpl:wrapperComponent')
  ]
}

registerEditorPlugin(OuroborosTplPlugin)