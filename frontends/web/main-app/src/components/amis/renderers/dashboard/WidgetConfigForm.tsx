import React from 'react'
import type { Schema } from 'amis'
import type { WidgetDefinition, WidgetInstance } from './common'

export interface WidgetConfigFormProps {
  widget: WidgetInstance
  definition?: WidgetDefinition
}

/**
 * 获取小组件的配置表单 schema
 */
export async function getWidgetConfigFormSchema(
  widget: WidgetInstance,
  definition?: WidgetDefinition
): Promise<Schema> {
  const headerConfigSchemas = getHeaderConfigSchemas(definition)

  await require('@/components/amis/editor/lazyLoader')

  return {
    type: 'form',
    body: [...headerConfigSchemas, ...(definition?.configFormItems ?? [])],
  }
}

/**
 * 获取标题配置项
 */
function getHeaderConfigSchemas(definition?: WidgetDefinition): (string | Schema)[] {
  if (definition?.allowHeader === false) {
    return []
  }
  return [
    {
      type: 'switch',
      name: 'showHeader',
      label: '显示标题',
      defaultValue: true,
    },
    {
      type: 'input-text',
      name: 'title',
      label: '标题',
      visibleOn: '${showHeader}',
    },
  ]
}
