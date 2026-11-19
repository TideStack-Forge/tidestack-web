import { TreeControlPlugin, registerEditorPlugin } from 'amis-editor'
import { getSchemaTpl, tipedLabel } from 'amis-editor-core'
import type { AfterBuildPanelBody, PluginEvent } from 'amis-editor-core'

function createAutoFillHeightControl() {
  return getSchemaTpl('switch', {
    name: 'autoFillHeight',
    label: tipedLabel('自动填充高度', '填满有明确高度的父容器，搜索框固定在树内容上方。'),
    pipeIn: (value: any) => value === true,
    pipeOut: (value: boolean | undefined) => (value === true ? true : undefined),
    onChange: (value: boolean, _oldValue: boolean, _model: any, form: any) => {
      if (value) {
        form.deleteValueByName('heightAuto')
      }
    },
  })
}

export function injectInputTreeAutoFillHeightControl(panelBody: any): any {
  if (Array.isArray(panelBody)) {
    const nextPanelBody = panelBody.map((item) =>
      injectInputTreeAutoFillHeightControl(item)
    )
    const heightAutoIndex = nextPanelBody.findIndex((item) => item?.name === 'heightAuto')

    if (
      heightAutoIndex !== -1 &&
      !nextPanelBody.some((item) => item?.name === 'autoFillHeight')
    ) {
      const heightAutoControl = nextPanelBody[heightAutoIndex]
      const originalOnChange = heightAutoControl.onChange

      nextPanelBody[heightAutoIndex] = {
        ...heightAutoControl,
        onChange: (...args: any[]) => {
          if (args[0]) {
            args[3]?.deleteValueByName('autoFillHeight')
          }

          return originalOnChange?.(...args)
        },
      }
      nextPanelBody.splice(heightAutoIndex, 0, createAutoFillHeightControl())
    }

    return nextPanelBody
  }

  if (!panelBody || typeof panelBody !== 'object') {
    return panelBody
  }

  return Object.keys(panelBody).reduce(
    (nextPanelBody, key) => {
      nextPanelBody[key] = injectInputTreeAutoFillHeightControl(panelBody[key])
      return nextPanelBody
    },
    { ...panelBody } as Record<string, any>
  )
}

export class OuroborosInputTreePlugin extends TreeControlPlugin {
  rendererName = 'OuroborosInputTree'
  disabledRendererPlugin = true

  afterBuildPanelBody(event: PluginEvent<AfterBuildPanelBody>) {
    const { data, plugin } = event.context

    if (plugin !== this) {
      return
    }

    event.setData(injectInputTreeAutoFillHeightControl(data))
  }
}

registerEditorPlugin(OuroborosInputTreePlugin)
