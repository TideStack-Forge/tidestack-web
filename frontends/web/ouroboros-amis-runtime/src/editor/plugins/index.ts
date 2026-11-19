// 因为 tpl-override 会覆写 SchemaTpl，所以先引入
import './tpl-override'

import './patch' // 补丁类 renderer 编辑器修复
// amis-editor 是按照 rendererName 来查找对应编辑器插件的
// 这里要把覆写后的 renderer 对应的编辑器插件也注册进来
import './OuroborosDialog'
import './OuroborosDrawer'
import './DataDictPicker'
import './OrganizationPicker'
import './OrganizationPeoplePicker'
import './PersonnelProfileField'

export { registerEditorPlugin } from 'amis-editor-core'
