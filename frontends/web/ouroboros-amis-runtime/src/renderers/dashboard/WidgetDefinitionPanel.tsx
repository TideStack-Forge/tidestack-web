import React from 'react'
import type { RendererProps } from 'amis'
import type { WidgetDefinition } from './common'

export interface WidgetDefinitionPanelProps {
  widgetDefinitions: WidgetDefinition[]
  categoriesCollapsed: Record<string, boolean>
  onToggleCollapse: (key: string) => void
  onDragStart: (widgetDef: WidgetDefinition, e: React.DragEvent) => void
  onDragEnd: () => void
  render: RendererProps['render']
}

export class WidgetDefinitionPanel extends React.Component<WidgetDefinitionPanelProps> {
  render() {
    const {
      widgetDefinitions,
      categoriesCollapsed,
      onToggleCollapse,
      onDragStart,
      onDragEnd,
      render,
    } = this.props

    // 按 category 分组
    const groupedData = widgetDefinitions.reduce((acc: any, def: WidgetDefinition) => {
      const itemType = def.category || '未分类'
      if (!acc[itemType]) {
        acc[itemType] = []
      }
      acc[itemType].push(def)
      return acc
    }, {})

    if (!Object.keys(groupedData).length) return null

    return (
      <>
        {Object.keys(groupedData).map((key, index) => {
          const collapsed = categoriesCollapsed[key] || false
          const widgetDefinitions = groupedData[key]
          return (
            <div className="widget-definitions-panel" key={key}>
              <div className="widget-category-title" onClick={() => onToggleCollapse(key)}>
                <p>{key}</p>
                <i className={`fas fa-chevron-down ${collapsed ? '' : 'rotate'}`}></i>
              </div>
              <div
                className={`widget-definitions-container ${collapsed ? 'collapsed' : 'expanded'}`}>
                {widgetDefinitions.map((def: WidgetDefinition) => (
                  <div
                    key={def.name}
                    draggable="true"
                    className="widget-definition-item"
                    onDragStart={(e) => onDragStart(def, e)}
                    onDragEnd={onDragEnd}>
                    {render('widget-definition-item', {
                      type: 'widget-definition',
                      definition: def,
                    })}
                    <div className="widget-definition-item__title">{def.title}</div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </>
    )
  }
}
