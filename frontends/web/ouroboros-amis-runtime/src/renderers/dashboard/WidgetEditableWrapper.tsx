import React from 'react'
import { Button, Icon } from 'amis'
import { openDialog } from '#ouroboros-host/common/modal'
import type { WidgetDefinition, WidgetInstance } from './common'
import { getWidgetConfigFormSchema } from './WidgetConfigForm'
import { getWidgetStyleConfigFormSchema } from './WidgetStyleConfigForm'

import type { Schema } from 'amis'

export interface WidgetWrapperProps {
  widget: WidgetInstance
  definition?: WidgetDefinition
  data?: Record<string, any>
  onUpdate: (widget: WidgetInstance) => void
  onRemove: (widget: WidgetInstance) => void
  children: React.ReactNode
}

export class WidgetWrapper extends React.Component<WidgetWrapperProps> {
  buildDialogData(
    runtimeData: Record<string, any> | undefined,
    localData: Record<string, any> | undefined
  ) {
    const dialogData: Record<string, any> = {}
    if (runtimeData && typeof runtimeData === 'object') {
      for (const key in runtimeData) {
        dialogData[key] = runtimeData[key]
      }
    }
    return {
      ...dialogData,
      ...(localData || {}),
    }
  }

  pickDeclaredFormData(schema: Schema, data: Record<string, any>) {
    const fieldNames = new Set<string>()
    const visit = (node: any) => {
      if (!node || typeof node !== 'object') return
      if (typeof node.name === 'string') {
        fieldNames.add(node.name)
      }
      const childKeys = ['body', 'items', 'tabs']
      childKeys.forEach((key) => {
        const child = node[key]
        if (Array.isArray(child)) {
          child.forEach(visit)
        } else {
          visit(child)
        }
      })
    }
    visit(schema)

    return Array.from(fieldNames).reduce((result: Record<string, any>, fieldName) => {
      if (Object.prototype.hasOwnProperty.call(data, fieldName)) {
        result[fieldName] = data[fieldName]
      }
      return result
    }, {})
  }

  // 编辑组件配置
  async handleEditItem() {
    const { widget, definition, data: runtimeData, onUpdate } = this.props

    // 异步获取配置表单 schema
    const configFormSchema = await getWidgetConfigFormSchema(widget, definition)

    const formData = await openDialog(
      {
        title: '小组件配置',
        size: definition?.configDialogSize || 'md',
        body: [configFormSchema],
      },
      this.buildDialogData(runtimeData, widget.config)
    )

    if (!formData || !formData.length) return

    // 更新 widget 数据
    const data = formData[0]
    const configData = this.pickDeclaredFormData(configFormSchema, data)
    const updatedWidget = {
      ...widget,
      config: {
        ...widget.config,
        ...configData,
      },
    }

    onUpdate(updatedWidget)
  }

  // 编辑组件样式
  async handleEditItemStyle() {
    const { widget, data: runtimeData, onUpdate } = this.props

    // 异步获取样式配置表单 schema
    const styleFormSchema = await getWidgetStyleConfigFormSchema()

    const formData = await openDialog(
      {
        title: '样式配置',
        body: [styleFormSchema],
      },
      this.buildDialogData(runtimeData, {
        ...(widget.styleConfig || {}),
        ...(widget.config || {}),
      })
    )

    if (!formData || !formData.length) return

    // 更新 widget 的样式配置
    const styleData = formData[0]
    const declaredStyleData = this.pickDeclaredFormData(styleFormSchema, styleData)
    const updatedWidget = {
      ...widget,
      styleConfig: {
        ...widget.styleConfig,
        ...declaredStyleData,
      },
    }

    onUpdate(updatedWidget)
  }

  // 删除组件
  handleRemoveItem() {
    const { widget, onRemove } = this.props
    onRemove(widget)
  }

  render() {
    const { children, widget, definition } = this.props

    return (
      <>
        <div className="edit-toolbar">
          <div className="draggable" title="拖动组件">
            <Icon icon="fa fa-arrows" />
            <span>{widget.config?.title || definition?.title || widget.widgetName}</span>
          </div>
          <div className="widget-edit-actions">
            <Button
              level="link"
              size="sm"
              onClick={this.handleEditItem.bind(this)}
              title="配置组件"
              tooltip="配置"
            >
              <span aria-hidden="true">
                <Icon icon="fa fa-cog" />
              </span>
            </Button>
            <Button
              level="link"
              size="sm"
              onClick={this.handleEditItemStyle.bind(this)}
              title="组件样式"
              tooltip="样式"
            >
              <span aria-hidden="true">
                <Icon icon="fa fa-paint-brush" />
              </span>
            </Button>
            <Button
              level="link"
              size="sm"
              className="text-danger"
              onClick={this.handleRemoveItem.bind(this)}
              title="删除组件"
              tooltip="删除"
            >
              <span aria-hidden="true">
                <Icon icon="fa fa-trash" />
              </span>
            </Button>
          </div>
        </div>
        {children}
      </>
    )
  }
}
