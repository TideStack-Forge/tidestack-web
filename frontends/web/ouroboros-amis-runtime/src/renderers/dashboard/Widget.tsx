import React from 'react'
import { Renderer, createObject, cloneObject, render as amisRender } from 'amis'
import { createWidgetSchema } from './common'
import { isEqual } from 'lodash'

import type { RendererProps, SchemaNode } from 'amis'
import type { WidgetDefinition, WidgetInstance } from './common'

export type WidgetProps = RendererProps & {
  placeholder?: SchemaNode
  widget: WidgetInstance
  definition?: WidgetDefinition
  isolated?: boolean
}

export type WidgetState = {
  schema: SchemaNode | null
}

export class WidgetControl extends React.Component<WidgetProps, WidgetState> {
  constructor(props: WidgetProps) {
    super(props)
    this.state = {
      schema: null,
    }
  }

  componentDidMount() {
    const { widget, definition } = this.props
    return this.setState({
      schema: createWidgetSchema(widget, definition),
    })
  }

  componentDidUpdate(prevProps: Readonly<WidgetProps>): void {
    const { widget, definition } = this.props
    // 当 widget.config 或 definition 发生变化时，重新生成 schema
    if (
      !isEqual(prevProps.widget?.config, widget?.config) ||
      prevProps.definition !== definition
    ) {
      this.setState({
        schema: createWidgetSchema(widget, definition),
      })
    }
  }

  renderWidgetHeader(data: any, headerStyle?: React.CSSProperties) {
    const { widget, definition, classnames, headerClassName, render, ...rest } =
      this.props
    if (definition?.allowHeader === false) {
      return null
    }
    if (widget.config?.showHeader === false) {
      return null
    }
    if (widget.config?.header) {
      return render('widget-header', widget.config.header, {
        ...rest,
        headerClassName,
        classnames,
        data,
      })
    }
    if (!widget.config?.title) {
      return null
    }
    return (
      <div
        className={classnames('widget-header', headerClassName)}
        style={headerStyle}
        data-testid="widget-header">
        <div className="widget-title">
          {render('widget-title', widget.config?.title, {
            ...rest,
            headerClassName,
            classnames,
            data,
          })}
        </div>
      </div>
    )
  }

  renderWidgetBody(data: any, bodyStyle?: React.CSSProperties) {
    const {
      render,
      placeholder = '<空>',
      bodyClassName,
      classnames: cx,
      isolated = false,
      style,
      ...rest
    } = this.props
    const { schema = placeholder } = this.state
    const finalSchema =
      typeof schema === 'string'
        ? {
            type: 'tpl',
            tpl: schema,
          }
        : schema
    // isolated mode renders directly through amis for standalone widget previews.
    const body = isolated
      ? amisRender(
          (Array.isArray(finalSchema)
            ? { type: 'container', wrapBody: false, body: finalSchema }
            : finalSchema) as any,
          {
            data,
          },
          { ...rest.env } as any
        )
      : render('widget-body', schema || placeholder, {
          ...rest,
          style: typeof style === 'object' ? { ...style } : undefined,
          classnames: cx,
          data,
        })

    return (
      <div
        className={cx('widget-body content-autofill', bodyClassName)}
        style={bodyStyle}
        data-testid="widget-body">
        {body}
      </div>
    )
  }

  renderWidgetFooter(data: any) {
    const { widget, definition, classnames, footerClassName, render, ...rest } =
      this.props
    if (definition?.allowFooter === false) {
      return null
    }
    const footerContent = widget.config?.footer ?? ''
    if (!footerContent) {
      return null
    }
    return (
      <div className={classnames('widget-footer', footerClassName)}>
        {render('widget-footer', footerContent, {
          ...rest,
          footerClassName,
          classnames,
          data,
        })}
      </div>
    )
  }

  render(): React.ReactNode {
    const { widget, classnames, className, data: superData } = this.props
    const data = createObject(cloneObject(superData), { config: widget.config ?? {} })

    // 从 widget.styleConfig 中获取样式配置
    const styleConfig = widget.styleConfig || {}
    const {
      showBorder = false,
      border,
      showRadius = false,
      borderRadius,
      showShadow = false,
      boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)',
      bodyPadding = '12px',
      backgroundColor = '#fff',
      headerBackgroundColor,
    } = styleConfig

    // 处理边框样式
    const getBorderStyle = (): React.CSSProperties => {
      if (!showBorder) {
        return { border: 'none' }
      }

      // 如果 border 是字符串，直接使用
      if (typeof border === 'string') {
        return { border }
      }

      // 如果 border 是对象（amis-theme-border 返回的格式）
      if (border && typeof border === 'object') {
        const borderStyle: React.CSSProperties = {}

        // 处理四个方向的边框
        const directions = ['top', 'right', 'bottom', 'left'] as const
        directions.forEach((dir) => {
          const width = (border as any)[`${dir}-border-width`]
          const style = (border as any)[`${dir}-border-style`]
          const color = (border as any)[`${dir}-border-color`]

          if (width && style && color) {
            // @ts-ignore
            borderStyle[`border${dir.charAt(0).toUpperCase() + dir.slice(1)}` as any] =
              `${width} ${style} ${color}`
          }
        })

        return borderStyle
      }

      // 默认边框
      return { border: '1px solid #e8e8e8' }
    }

    // 处理圆角样式
    const getBorderRadiusStyle = (): React.CSSProperties => {
      if (!showRadius) {
        return {}
      }

      // 如果 borderRadius 是字符串，直接使用
      if (typeof borderRadius === 'string') {
        return { borderRadius }
      }

      // 如果 borderRadius 是对象（amis-theme-radius 返回的格式）
      if (borderRadius && typeof borderRadius === 'object') {
        const radiusStyle: React.CSSProperties = {}

        // 处理四个角的圆角
        const corners = [
          { key: 'top-left-border-radius', css: 'borderTopLeftRadius' },
          { key: 'top-right-border-radius', css: 'borderTopRightRadius' },
          { key: 'bottom-left-border-radius', css: 'borderBottomLeftRadius' },
          { key: 'bottom-right-border-radius', css: 'borderBottomRightRadius' },
        ]

        corners.forEach(({ key, css }) => {
          const value = (borderRadius as any)[key]
          if (value) {
            // @ts-ignore
            radiusStyle[css as any] = value
          }
        })

        return radiusStyle
      }

      return {}
    }

    // 构建容器样式
    const containerStyle: React.CSSProperties = {
      backgroundColor,
      ...getBorderStyle(),
      ...getBorderRadiusStyle(),
      boxShadow: showShadow ? boxShadow : 'none',
    }

    // 构建 header 样式
    const headerStyle: React.CSSProperties = headerBackgroundColor
      ? { background: headerBackgroundColor }
      : {}

    // 构建 body 样式
    const bodyStyle: React.CSSProperties = {
      padding: bodyPadding,
    }

    return (
      <div
        className={classnames('widget', className)}
        style={containerStyle}
        data-testid="widget"
        data-widget-id={widget.id}
        data-widget-name={widget.widgetName}>
        {this.renderWidgetHeader(data, headerStyle)}
        {this.renderWidgetBody(data, bodyStyle)}
        {this.renderWidgetFooter(data)}
      </div>
    )
  }
}

@Renderer({
  type: 'widget',
})
export class WidgetRenderer extends WidgetControl {}
