import React from 'react'

import { INPUT_TABLE_SCROLL_CONTAINER_CLASS } from './inputTableInlineEditPresentation'
import {
  DEFAULT_INPUT_TABLE_ADD_BUTTON_POSITION,
  INPUT_TABLE_TOP_ADD_ACTION_TYPE,
  getInputTableAddButtonJustifyContent,
  isInputTableAddButtonTopPosition,
  type InputTableAddButtonPosition,
} from './inputTableOperation'

export type InputTableTopAddActionSchemaOptions = {
  position: InputTableAddButtonPosition
  translate: (value: string) => string
  footerAddBtn?: any
  disabled?: boolean
}

export type InputTableRenderPatchOptions = {
  addButtonPosition: InputTableAddButtonPosition
  classnames?: (...classes: any[]) => string
  columnsTogglable: boolean
  cooperativeMaterializationDisabled?: boolean
  inputTableSizing?: Record<string, any>
  lazyRenderAfter?: number
  loadingMaxDuration?: number
  onAction?: (...args: any[]) => any
  renderProps: any
  schema: any
  shouldRenderTopAddButton: boolean
  topAddActionSchema?: any
}

export type InputTableHeaderToolbarRenderOptions = {
  actionSchema: any
  classnames?: (...classes: any[]) => string
  onAction?: (...args: any[]) => any
  position: InputTableAddButtonPosition
  renderProps: any
}

export function isInputTableToolbarElement(node: React.ReactNode) {
  return (
    React.isValidElement(node) &&
    typeof (node.props as any).className === 'string' &&
    (node.props as any).className.includes('InputTable-toolbar')
  )
}

export function cloneInputTableToolbarForAddButtonPosition(
  toolbar: React.ReactNode,
  position: InputTableAddButtonPosition
) {
  if (!React.isValidElement(toolbar)) {
    return toolbar
  }

  const props = toolbar.props as any
  const className = [
    props.className,
    `InputTable-addToolbar--${position}`,
  ]
    .filter(Boolean)
    .join(' ')

  return React.cloneElement(toolbar as React.ReactElement<any>, {
    className,
    style: {
      ...(props.style || {}),
      justifyContent: getInputTableAddButtonJustifyContent(position),
    },
  })
}

export function renderInputTableWithPositionedAddButton(
  table: React.ReactNode,
  addButtonPosition: InputTableAddButtonPosition
) {
  if (
    addButtonPosition === DEFAULT_INPUT_TABLE_ADD_BUTTON_POSITION ||
    isInputTableAddButtonTopPosition(addButtonPosition) ||
    !React.isValidElement(table)
  ) {
    return table
  }

  const children = React.Children.toArray((table.props as any).children)
  const toolbarIndex = children.findIndex((child) =>
    isInputTableToolbarElement(child)
  )

  if (toolbarIndex === -1) {
    return table
  }

  const toolbar = children[toolbarIndex]
  const positionedToolbar = cloneInputTableToolbarForAddButtonPosition(
    toolbar,
    addButtonPosition
  )
  const bodyChildren = children.filter((_, index) => index !== toolbarIndex)
  const positionedChildren = [...bodyChildren, positionedToolbar]

  return React.cloneElement(
    table as React.ReactElement<any>,
    undefined,
    positionedChildren
  )
}

export function buildInputTableTopAddActionSchema(
  options: InputTableTopAddActionSchemaOptions
) {
  const footerAddBtn =
    options.footerAddBtn &&
    typeof options.footerAddBtn === 'object'
      ? options.footerAddBtn
      : {}

  return {
    type: 'button',
    level: 'primary',
    size: 'sm',
    label: options.translate('Table.add'),
    icon: 'fa fa-plus',
    disabledTip: options.translate('Table.addButtonDisabledTip'),
    ...footerAddBtn,
    actionType: INPUT_TABLE_TOP_ADD_ACTION_TYPE,
    disabled: options.disabled,
  }
}

function formatInputTableContentLength(value: number | string | undefined) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? `${value}px` : undefined
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()

    return trimmed || undefined
  }

  return undefined
}

function buildInputTableContentCssVariables(options?: Record<string, any>) {
  const style: Record<string, string> = {}
  const height = formatInputTableContentLength(options?.height)
  const minHeight = formatInputTableContentLength(options?.minHeight)
  const maxHeight = formatInputTableContentLength(options?.maxHeight)
  const overflow = typeof options?.overflow === 'string' ? options.overflow.trim() : ''
  const overflowX = typeof options?.overflowX === 'string' ? options.overflowX.trim() : ''
  const overflowY = typeof options?.overflowY === 'string' ? options.overflowY.trim() : ''

  if (height) {
    style['--Table-content-height'] = height
  }

  if (minHeight) {
    style['--Table-content-minHeight'] = minHeight
  }

  if (maxHeight) {
    style['--Table-content-maxHeight'] = maxHeight
  }

  if (overflow) {
    style['--Table-content-overflow'] = overflow
  }

  if (overflowX) {
    style['--Table-content-overflowX'] = overflowX
  }

  if (overflowY) {
    style['--Table-content-overflowY'] = overflowY
  }

  return style
}

function buildInputTablePatchedTableStyle(
  style: unknown,
  inputTableSizing?: Record<string, any>
) {
  const cssVariables = buildInputTableContentCssVariables(inputTableSizing)

  if (!Object.keys(cssVariables).length) {
    return style
  }

  return {
    ...(style && typeof style === 'object' && !Array.isArray(style) ? style : {}),
    ...cssVariables,
  }
}

export function buildInputTableTopAddHeaderToolbarRender(
  options: InputTableHeaderToolbarRenderOptions
) {
  const originalHeaderToolbarRender = options.renderProps?.headerToolbarRender

  return (childProps: any, toolbarRenderer?: any) => {
    const originalToolbar =
      typeof originalHeaderToolbarRender === 'function'
        ? originalHeaderToolbarRender(childProps, toolbarRenderer)
        : null
    const render = childProps?.render

    if (typeof render !== 'function') {
      return originalToolbar
    }

    const store = childProps?.store
    const data =
      typeof store?.getData === 'function'
        ? store.getData(childProps?.data)
        : childProps?.data
    const button = render('inputTableTopAdd', options.actionSchema, {
      data,
      disabled: options.actionSchema?.disabled,
      key: 'input-table-top-add',
      onAction: options.onAction,
      testIdBuilder: childProps?.testIdBuilder?.getChild?.('add'),
    })
    const cx = childProps?.classnames || options.classnames
    const topAddToolbar = button ? (
      <div
        className={cx?.('Table-actions') || 'Table-actions'}
        key="input-table-top-add-toolbar"
        style={options.position === 'top-right' ? { marginLeft: 'auto' } : undefined}
      >
        {button}
      </div>
    ) : null

    return options.position === 'top-right' ? (
      <>
        {originalToolbar}
        {topAddToolbar}
      </>
    ) : (
      <>
        {topAddToolbar}
        {originalToolbar}
      </>
    )
  }
}

export function buildInputTablePatchedTableSchema(
  options: InputTableRenderPatchOptions
) {
  const {
    addButtonPosition,
    classnames,
    columnsTogglable,
    cooperativeMaterializationDisabled,
    lazyRenderAfter,
    loadingMaxDuration,
    schema,
    shouldRenderTopAddButton,
    inputTableSizing,
  } = options
  const tableContentClassName =
    classnames?.(
      schema.tableContentClassName,
      INPUT_TABLE_SCROLL_CONTAINER_CLASS
    ) ||
    [schema.tableContentClassName, INPUT_TABLE_SCROLL_CONTAINER_CLASS]
      .filter(Boolean)
      .join(' ')
  const topAddToolbarClassName = shouldRenderTopAddButton
    ? [
        schema.toolbarClassName,
        `InputTable-addToolbar--${addButtonPosition}`,
      ]
        .filter(Boolean)
        .join(' ')
    : schema.toolbarClassName
  const style = buildInputTablePatchedTableStyle(schema.style, inputTableSizing)

  return {
    ...schema,
    tableContentClassName,
    toolbarClassName: topAddToolbarClassName,
    ...(style ? { style } : {}),
    columnsTogglable,
    ...(typeof lazyRenderAfter === 'number'
      ? { lazyRenderAfter, lazyRenderAfterExplicit: true }
      : {}),
    ...(typeof loadingMaxDuration === 'number'
      ? { loadingMaxDuration }
      : {}),
    ...(typeof cooperativeMaterializationDisabled === 'boolean'
      ? { cooperativeMaterializationDisabled }
      : {}),
  }
}

export function buildInputTablePatchedRenderProps(
  options: InputTableRenderPatchOptions
) {
  const {
    columnsTogglable,
    cooperativeMaterializationDisabled,
    lazyRenderAfter,
    loadingMaxDuration,
    onAction,
    addButtonPosition,
    classnames,
    renderProps,
    shouldRenderTopAddButton,
    topAddActionSchema,
  } = options

  return {
    ...renderProps,
    columnsTogglable,
    ...(shouldRenderTopAddButton && topAddActionSchema
      ? {
          headerToolbarRender: buildInputTableTopAddHeaderToolbarRender({
            actionSchema: topAddActionSchema,
            classnames,
            onAction,
            position: addButtonPosition,
            renderProps,
          }),
        }
      : {}),
    ...(typeof lazyRenderAfter === 'number'
      ? { lazyRenderAfter, lazyRenderAfterExplicit: true }
      : {}),
    ...(typeof loadingMaxDuration === 'number'
      ? { loadingMaxDuration }
      : {}),
    ...(typeof cooperativeMaterializationDisabled === 'boolean'
      ? { cooperativeMaterializationDisabled }
      : {}),
  }
}
