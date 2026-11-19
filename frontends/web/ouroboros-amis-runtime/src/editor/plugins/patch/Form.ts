import { FormPlugin, registerEditorPlugin, unRegisterEditorPlugin } from 'amis-editor'
import {
  defaultValue,
  getSchemaTpl,
  tipedLabel,
} from 'amis-editor-core'
import type {
  AfterBuildPanelBody,
  PluginEvent,
} from 'amis-editor-core'
import type { RendererConfig, Schema } from 'amis-core'

import {
  injectFormSmartLayoutControl,
  isCrudFilterFormContext,
} from './formSmartLayoutPanel'

function createFormSmartLayoutControls() {
  return [
    getSchemaTpl('switch', {
      name: 'smartLayout',
      label: tipedLabel(
        '智能布局',
        '普通 Form 默认关闭。开启后自动按字段数量切到 1/2 列；显式 columnCount 仍优先于自动列数。'
      ),
      pipeIn: (value: any) => value === true,
      pipeOut: (value: boolean | undefined) => (value === true ? true : undefined),
    }),
  ]
}

// Default selections belong to the panel display until the author changes them.
function displayFormDefaults(panel: any): any {
  if (!panel || typeof panel !== 'object') return panel
  if (Array.isArray(panel)) {
    const next = panel.map(displayFormDefaults)
    return next.some((value, index) => value !== panel[index]) ? next : panel
  }
  const entries = Object.entries(panel).map(([key, value]) => [key, displayFormDefaults(value)])
  const changed = entries.some(([key, value]) => panel[key] !== value)
  const isDefaultSelection = panel.type === 'select' && ['dsType', 'labelAlign'].includes(panel.name)
  if (!changed && !isDefaultSelection) return panel
  const next = Object.fromEntries(entries)
  if (isDefaultSelection) {
    delete next.value
    next.selectFirst = false
    next.pipeIn = panel.pipeIn || defaultValue(panel.value ?? panel.options?.[0]?.value)
  }
  return next
}

export class OuroborosBaseFormPlugin extends FormPlugin {
  static id = 'OuroborosBaseFormPlugin'

  afterBuildPanelBody(event: PluginEvent<AfterBuildPanelBody>) {
    if (event.context.plugin !== this) return
    const panel = displayFormDefaults(event.context.data)
    if (panel !== event.context.data) event.setData(panel)
  }

  patchSchema(schema: Schema, info: RendererConfig, props: any): Schema | void {
    const patchedSchema = super.patchSchema(schema, info, props)

    // AMIS infers CRUD purpose and materializes the renderer's default submit
    // action while opening the editor. Neither inference is an authored edit.
    if (patchedSchema) {
      for (const key of ['feat', 'actions']) {
        if (Object.prototype.hasOwnProperty.call(schema, key)) {
          patchedSchema[key] = schema[key]
        } else {
          delete patchedSchema[key]
        }
      }
    }

    return patchedSchema
  }
}

export class OuroborosFormPlugin extends OuroborosBaseFormPlugin {
  static id = 'OuroborosFormPlugin'
  rendererName = 'OuroborosForm'
  disabledRendererPlugin = true // 组件面板不显示

  afterBuildPanelBody(event: PluginEvent<AfterBuildPanelBody>) {
    super.afterBuildPanelBody(event)
    const { context, data, plugin } = event.context

    if (plugin !== this || isCrudFilterFormContext(context)) {
      return
    }

    event.setData(
      injectFormSmartLayoutControl(data, createFormSmartLayoutControls())
    )
  }
}

unRegisterEditorPlugin('FormPlugin')
registerEditorPlugin(OuroborosBaseFormPlugin)
registerEditorPlugin(OuroborosFormPlugin)
