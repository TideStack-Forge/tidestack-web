import { registerActionPanel } from './actions'

import type { Validator, BasePlugin, PluginClass } from 'amis-editor'
import type { ActionPanel, RegisteredRendererPluginAction, RendererPluginAction } from './actions'

const validators: Validator[] = []
const plugins: BasePlugin[] = []

let actureEditorPluginRegister: ((plugin: BasePlugin) => void) | null = null;
let actureValidatorRegister: ((validator: Validator) => void) | null = null;

/**
 * 注册插件
 */
export function registerEditorPlugin(plugin: BasePlugin) {
  if (actureEditorPluginRegister) {
    actureEditorPluginRegister(plugin)
  } else {
    plugins.push(plugin)
  }
}

/**
 * 注册校验器
 */
export function registerValidator(validator: Validator) {
  if (actureValidatorRegister) {
    actureValidatorRegister(validator)
  } else {
    validators.push(validator)
  }
}

/**
 * 注册多个校验器
 */
export function registerValidators(validators: Validator[]) {
  validators.forEach(registerValidator)
}

export function setActureEditorPluginRegister(register: (plugin: PluginClass) => void) {
  actureEditorPluginRegister = register as any
  plugins.forEach(actureEditorPluginRegister!)
  plugins.length = 0
}

export function setActureValidatorRegister(register: (validator: Validator) => void) {
  actureValidatorRegister = register
  validators.forEach(register)
  validators.length = 0
}

export type { BasePlugin, Validator, RendererPluginAction, ActionPanel }

export { registerActionPanel }