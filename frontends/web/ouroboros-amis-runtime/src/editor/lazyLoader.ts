import './modifier'
import { registerEditorPlugin } from './plugins'
import { registerValidator } from './validators'


// @ts-ignore
import 'amis-editor-core/lib/style.css'

import { setActureEditorPluginRegister, setActureValidatorRegister } from './lazyRegister'

setActureEditorPluginRegister(registerEditorPlugin)
setActureValidatorRegister(registerValidator)