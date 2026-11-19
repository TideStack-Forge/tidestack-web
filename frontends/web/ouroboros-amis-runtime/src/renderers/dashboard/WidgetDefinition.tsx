import React from 'react'
import { dataMapping, Renderer } from 'amis'
import { createWidgetInstance } from './common'

import type { RendererProps } from 'amis'
import type { WidgetDefinition, WidgetInstance } from './common'

export type WidgetDefineProps = RendererProps & {
  definition?: WidgetDefinition
  definitions?: WidgetDefinition[]
  widgetName?: string
  source?: string
}

export class WidgetDefinitionControl extends React.Component<WidgetDefineProps, any> {
  constructor(props: WidgetDefineProps) {
    super(props)
  }

  getDefinition() {
    const { definition, definitions, widgetName, source } = this.props
    if (definition) {
      return definition
    }
    if (definitions && widgetName) {
      return definitions.find((item) => item.name === widgetName)
    }
    return null
  }

  renderPreviewWidget() {
    const { render } = this.props
    const definition = this.getDefinition()
    if (!definition) {
      return null
    }
    if (definition.thumbSchema) {
      return render('widget-definition-preview', {
        type: 'widget',
        widget: {...createWidgetInstance(definition), schemaTpl: definition?.thumbSchema},
        definition
      })
    }
    return render('widget-definition-preview', {
      type: 'widget',
      widget: createWidgetInstance(definition),
      definition
    })
  }

  render() {
    const preview = this.renderPreviewWidget()
    return <div className="widget-definition">{preview}</div>
  }
}

@Renderer({
  type: 'widget-definition',
})
export class WidgetRenderer extends WidgetDefinitionControl {}
