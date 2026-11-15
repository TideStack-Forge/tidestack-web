import { FormPlugin, registerEditorPlugin } from 'amis-editor'
import {
  getSchemaTpl,
  tipedLabel,
} from 'amis-editor-core'
import type {
  AfterBuildPanelBody,
  PluginEvent,
} from 'amis-editor-core'

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

export class OuroborosFormPlugin extends FormPlugin {
  rendererName = 'OuroborosForm'
  disabledRendererPlugin = true // 组件面板不显示

  afterBuildPanelBody(event: PluginEvent<AfterBuildPanelBody>) {
    const { context, data, plugin } = event.context

    if (plugin !== this || isCrudFilterFormContext(context)) {
      return
    }

    event.setData(
      injectFormSmartLayoutControl(data, createFormSmartLayoutControls())
    )
  }
}

registerEditorPlugin(OuroborosFormPlugin)
