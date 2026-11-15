import React from 'react'
import { FormItem } from 'amis'

import type { FormControlProps, Schema } from 'amis'

export type WidgetStyleConfigControlProps = FormControlProps
export interface WidgetStyleConfigControlState {
  schema?: Schema | null
}

/**
 * 获取小组件的样式配置表单 schema
 */
export async function getWidgetStyleConfigFormSchema(): Promise<Schema> {
  // 异步加载 amis-theme-editor-helper
  await import('amis-theme-editor-helper')

  return {
    type: 'form',
    body: [
      {
        type: 'switch',
        name: 'showBorder',
        label: '显示边框',
        defaultValue: false,
      },
      {
        type: 'amis-theme-border',
        name: 'border',
        label: '边框设置',
        visibleOn: '${showBorder}',
      },
      {
        type: 'switch',
        name: 'showRadius',
        label: '圆角',
        defaultValue: false,
      },
      {
        type: 'amis-theme-radius',
        name: 'borderRadius',
        label: '圆角设置',
        visibleOn: '${showRadius}',
      },
      {
        type: 'switch',
        name: 'showShadow',
        label: '显示投影',
        defaultValue: false,
      },
      {
        type: 'amis-theme-shadow-editor',
        name: 'boxShadow',
        label: '投影设置',
        visibleOn: '${showShadow}',
        value: '0 1px 2px 0px rgba(0, 0, 0, 0.05)',
      },
      {
        type: 'input-text',
        name: 'bodyPadding',
        label: '内容体内边距',
        placeholder: '例如: 12px',
        value: '12px',
      },
      {
        type: 'amis-theme-color-picker',
        name: 'backgroundColor',
        label: '背景颜色',
        value: '#fff',
        labelMode: 'input',
        needCustom: true,
        needGradient: true,
      },
      {
        type: 'amis-theme-color-picker',
        name: 'headerBackgroundColor',
        label: '标题背景颜色',
        placeholder: '留空使用默认渐变',
        labelMode: 'input',
        needCustom: true,
        needGradient: true,
      },
    ],
  }
}

export class WidgetStyleConfigControl extends React.Component<
  WidgetStyleConfigControlProps,
  WidgetStyleConfigControlState
> {
  constructor(props: WidgetStyleConfigControlProps) {
    super(props)
    this.setState({
      schema: null,
    })
  }
  async componentDidMount() {
    // 获取小组件的样式配置表单 schema
    const schema = await getWidgetStyleConfigFormSchema()
    // 渲染样式配置表单
    this.setState({
      schema,
    })
  }

  handleChange(value: any) {
    this.props.onChange(value)
  }

  render() {
    const { render, value, subFormMode } = this.props
    const schema = this.state?.schema
    if (!schema) {
      return null
    }
    return render(
      'widget-style-config-form',
      {
        ...schema,
        wrapWithPanel: false,
        mode: subFormMode,
        actions: []
      },
      {
        data: value,
        onChange: this.handleChange.bind(this),
      }
    )
  }
}


@FormItem({
  type: 'ouroboros-widget-style-config',
})
export class WidgetStyleConfigControlRenderer extends WidgetStyleConfigControl {
  
}
