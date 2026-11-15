import React from 'react'
import type { CSSProperties, MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import { DialogRenderer } from 'amis/lib/renderers/Dialog'
import type { DialogProps } from 'amis/lib/renderers/Dialog'
import Spinner from 'amis-ui/lib/components/Spinner'
import {
  IScopedContext,
  ModalStore,
  Renderer,
  IServiceStore,
  isObjectShallowModified,
  ActionSchema,
} from 'amis'
import { popModalMethods, pushModalMethods } from '@/common/modal'
import { readGetters } from '@/store/storeFacade'
import {
  DialogPresetSize,
  resolveDialogResizeConfig,
} from './dialog-resize/dialogResizeConfig'
import {
  buildModalFooterActionData,
  resolveModalBodySchema,
  resetModalBodySchema,
  withModalSchemaResolvedHandler,
  getModalActionsFromProps,
} from './modalFormActions'

const DialogRendererComponent = (DialogRenderer as any)
  .ComposedComponent as typeof DialogRenderer

const DIALOG_SIZE_LABELS: Record<DialogPresetSize, string> = {
  '': '默认',
  sm: '小',
  md: '中',
  lg: '大',
  xl: '超大',
  full: '铺满',
}

const PRIMARY_DIALOG_SIZE_COUNT = 3

const MIN_RESIZE_WIDTH = 320
const MIN_RESIZE_HEIGHT = 240
const RESIZE_VIEWPORT_MARGIN = 32

type DialogResizeState = {
  updatedActions?: Array<ActionSchema> | null
  activeSize?: DialogPresetSize | 'custom'
  resizeWidth?: number
  resizeHeight?: number
  sizeMenuOpen?: boolean
}

function appendClassName(className: unknown, ...extraClassNames: string[]) {
  return [className, ...extraClassNames]
    .filter((item) => typeof item === 'string' && item.trim())
    .join(' ')
}

function omitSizeStyle(style: CSSProperties | undefined): CSSProperties | undefined {
  if (!style) {
    return style
  }

  const rest = { ...style }
  delete rest.width
  delete rest.height
  return rest
}

function clampSize(value: number, min: number, max: number) {
  return Math.round(Math.min(Math.max(value, min), max))
}

function isModalHeaderElement(child: ReactNode): child is React.ReactElement {
  return (
    React.isValidElement(child) &&
    typeof child.props?.className === 'string' &&
    child.props.className.includes('Modal-header')
  )
}

function isModalTitleElement(child: ReactNode): child is React.ReactElement {
  return (
    React.isValidElement(child) &&
    typeof child.props?.className === 'string' &&
    child.props.className.includes('Modal-title')
  )
}

function isNativeModalFullscreenElement(child: ReactNode): child is React.ReactElement {
  return (
    React.isValidElement(child) &&
    typeof child.props?.className === 'string' &&
    child.props.className.includes('Modal-screen')
  )
}

@Renderer({
  type: 'dialog',
  name: 'OuroborosDialog',
  storeType: ModalStore.name,
  storeExtendsData: false,
  weight: -100,
  isolateScope: true,
  override: true,
  shouldSyncSuperStore: (store: IServiceStore, props: any, prevProps: any) => {
    const shouldSync = !!(
      (store.dialogOpen || props.show) &&
      (props.show !== prevProps.show ||
        isObjectShallowModified(prevProps.data, props.data))
    )
    return shouldSync
  },
})
export default class OuroborosDialog extends DialogRendererComponent {
  private clearResizeListeners: (() => void) | null = null
  private clearSizeMenuListeners: (() => void) | null = null
  private renderingModalActionBody = false
  private modalSchemaGeneration = 0
  private modalUnmounted = false
  private sizeSwitchRef = React.createRef<HTMLDivElement>()

  constructor(props: DialogProps, context: IScopedContext) {
    super(props, context)
    this.state = {
      updatedActions: null,
    }
  }

  buildActions(): Array<ActionSchema> {
    const explicitActions = this.getModalActions()
    if (typeof explicitActions !== 'undefined') {
      return Array.isArray(explicitActions) ? explicitActions : []
    }

    const updatedActions = (this.state as DialogResizeState).updatedActions
    if (updatedActions !== null && typeof updatedActions !== 'undefined') {
      return updatedActions
    }

    return super.buildActions()
  }

  renderFooter() {
    const store = (this.props as any).store
    const render = (this.props as any).render
    const cx = (this.props as any).classnames
    if (!store || typeof render !== 'function' || typeof cx !== 'function') {
      return super.renderFooter()
    }

    const actions = this.buildActions()
    const { env, showErrorMsg, showLoading, show, dialogFooterClassName, hideActions } =
      this.props as any
    if (!actions || !actions.length || hideActions) {
      return null
    }

    const actionData = buildModalFooterActionData(store)
    return (
      <div className={cx('Modal-footer', dialogFooterClassName)}>
        {(showLoading !== false && store.loading) ||
        (showErrorMsg !== false && store.error) ? (
          <div className={cx('Dialog-info')} key="info">
            {showLoading !== false ? (
              <Spinner size="sm" key="info" show={store.loading} />
            ) : null}
            {!env?.forceSilenceInsideError && store.error && showErrorMsg !== false ? (
              <span className={cx('Dialog-error')}>{store.msg}</span>
            ) : null}
          </div>
        ) : null}
        {actions.map((action, key) =>
          render(`action/${key}`, action, {
            data: actionData,
            onAction: this.handleAction,
            onActionSensor: undefined,
            btnDisabled: store.loading,
            key,
            disabled: action.disabled || store.loading || !show,
          })
        )}
      </div>
    )
  }

  renderBody(body: any, key?: any): React.ReactNode {
    if (this.renderingModalActionBody) return super.renderBody(body, key)
    const generation = this.modalSchemaGeneration
    const modalBody =
      (this.props as any).updateActions === false
        ? body
        : withModalSchemaResolvedHandler(
            body,
            (schema: any) => {
              if (
                this.modalUnmounted ||
                generation !== this.modalSchemaGeneration ||
                (this.props as any).show === false
              )
                return schema
              return resolveModalBodySchema(this.props, schema)
            },
            this.getModalActions() !== undefined
          )
    this.renderingModalActionBody = true
    try {
      return super.renderBody(modalBody, key)
    } finally {
      this.renderingModalActionBody = false
    }
  }

  private getModalActions() {
    return getModalActionsFromProps(this.props, 'dialogSchema')
  }

  async handleAction(
    e: any,
    action: any,
    data: object,
    throwErrors: boolean = false,
    delegate: IScopedContext
  ) {
    const result = await super.handleAction(e, action, data, throwErrors, delegate)
    if (action?.actionType === 'confirm' && action?.reload) {
      const parent = (this.context as any)?.parent?.component
      if (parent) {
        parent.reload?.()
      }
    }
    return result
  }

  handleEntered() {
    pushModalMethods((action: any, ctx: any) => {
      super.handleAction(undefined, action, ctx)
    })
    return super.handleEntered()
  }

  handleExited() {
    this.modalSchemaGeneration += 1
    resetModalBodySchema(this.props)
    popModalMethods()
    this.clearActiveResize()
    this.clearSizeMenu(false)
    this.setState({
      updatedActions: null,
      activeSize: undefined,
      resizeWidth: undefined,
      resizeHeight: undefined,
      sizeMenuOpen: false,
    })
    return super.handleExited()
  }

  componentWillUnmount() {
    this.modalUnmounted = true
    this.clearActiveResize()
    this.clearSizeMenu(false)
    super.componentWillUnmount?.()
  }

  private clearActiveResize() {
    this.clearResizeListeners?.()
    this.clearResizeListeners = null
  }

  private clearSizeMenu(updateState: boolean = true) {
    this.clearSizeMenuListeners?.()
    this.clearSizeMenuListeners = null
    if (updateState && (this.state as DialogResizeState).sizeMenuOpen) {
      this.setState({ sizeMenuOpen: false })
    }
  }

  private openSizeMenu() {
    if (typeof document === 'undefined') {
      this.setState({ sizeMenuOpen: true })
      return
    }

    const handleDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target
      if (target instanceof Node && this.sizeSwitchRef.current?.contains(target)) {
        return
      }

      this.clearSizeMenu()
    }

    this.clearSizeMenu(false)
    document.addEventListener('mousedown', handleDocumentMouseDown)
    this.clearSizeMenuListeners = () => {
      document.removeEventListener('mousedown', handleDocumentMouseDown)
    }
    this.setState({ sizeMenuOpen: true })
  }

  private readAppConfig() {
    const data = (this.props as any).data || {}
    return (
      data.SystemConfig ||
      data.SystemContext?.config ||
      readGetters()?.['app/config'] ||
      {}
    )
  }

  private getDialogSchemaProps() {
    return {
      ...(this.props as any),
      ...((this.props as any).store?.schema || {}),
    }
  }

  private getDialogResizeConfig() {
    return resolveDialogResizeConfig(this.getDialogSchemaProps(), this.readAppConfig())
  }

  private handleFullscreenToggle(event: ReactMouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()
    this.clearSizeMenu(false)

    const store = (this.props as any).store
    store?.setFullScreen?.(!store?.isFullscreen)
  }

  private handlePresetSizeChange(size: DialogPresetSize) {
    this.clearSizeMenu(false)
    this.setState({
      activeSize: size,
      resizeWidth: undefined,
      resizeHeight: undefined,
      sizeMenuOpen: false,
    })
  }

  private handleSizeMenuToggle() {
    if ((this.state as DialogResizeState).sizeMenuOpen) {
      this.clearSizeMenu()
      return
    }

    this.openSizeMenu()
  }

  private handleResizeMouseDown(event: ReactMouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()

    const content = event.currentTarget.parentElement
    if (!content || typeof window === 'undefined') {
      return
    }

    this.clearActiveResize()

    const rect = content.getBoundingClientRect()
    const startX = event.clientX
    const startY = event.clientY
    const startWidth = rect.width
    const startHeight = rect.height

    const handleMouseMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault()
      const maxWidth = Math.max(
        MIN_RESIZE_WIDTH,
        window.innerWidth - RESIZE_VIEWPORT_MARGIN
      )
      const maxHeight = Math.max(
        MIN_RESIZE_HEIGHT,
        window.innerHeight - RESIZE_VIEWPORT_MARGIN
      )

      this.setState({
        activeSize: 'custom',
        resizeWidth: clampSize(
          startWidth + moveEvent.clientX - startX,
          MIN_RESIZE_WIDTH,
          maxWidth
        ),
        resizeHeight: clampSize(
          startHeight + moveEvent.clientY - startY,
          MIN_RESIZE_HEIGHT,
          maxHeight
        ),
      })
    }

    const handleMouseUp = () => {
      this.clearActiveResize()
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp, { once: true })
    this.clearResizeListeners = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }

  private renderSizeSwitch(activeSize: DialogPresetSize | 'custom') {
    const config = this.getDialogResizeConfig()
    const store = (this.props as any).store
    if (!config.sizeSwitchable || store?.isFullscreen) {
      return null
    }

    const primaryOptions = config.sizeOptions.slice(0, PRIMARY_DIALOG_SIZE_COUNT)
    const overflowOptions = config.sizeOptions.slice(PRIMARY_DIALOG_SIZE_COUNT)
    const hasActiveOverflowSize = overflowOptions.includes(activeSize as DialogPresetSize)
    const state = this.state as DialogResizeState

    return (
      <div
        aria-label="弹窗尺寸"
        className="OuroborosDialog-sizeSwitch"
        key="ouroboros-dialog-size-switch"
        ref={this.sizeSwitchRef}
        role="group"
        onMouseDown={(event) => event.stopPropagation()}>
        {primaryOptions.map((size, index) => (
          <button
            aria-label={`切换为${DIALOG_SIZE_LABELS[size]}尺寸`}
            aria-pressed={activeSize === size}
            className={appendClassName(
              'OuroborosDialog-sizeSwitchButton',
              'OuroborosDialog-sizePresetButton',
              index === 0 ? 'is-first' : '',
              index === primaryOptions.length - 1 ? 'is-last' : '',
              activeSize === size ? 'is-active' : ''
            )}
            key={size || 'default'}
            onClick={() => this.handlePresetSizeChange(size)}
            title={`切换为${DIALOG_SIZE_LABELS[size]}尺寸`}
            type="button">
            <span
              aria-hidden="true"
              className={`OuroborosDialog-sizeIcon is-${size || 'default'}`}
            />
          </button>
        ))}
        {overflowOptions.length ? (
          <div className="OuroborosDialog-sizeMenu">
            <button
              aria-expanded={!!state.sizeMenuOpen}
              aria-haspopup="menu"
              aria-label="选择更多弹窗尺寸"
              className={appendClassName(
                'OuroborosDialog-sizeSwitchButton',
                'OuroborosDialog-sizeMoreButton',
                hasActiveOverflowSize ? 'is-active' : ''
              )}
              onClick={() => this.handleSizeMenuToggle()}
              title="更多尺寸"
              type="button">
              <span aria-hidden="true" className="OuroborosDialog-sizeMoreIcon" />
            </button>
            {state.sizeMenuOpen ? (
              <div className="OuroborosDialog-sizeMenuList" role="menu">
                {overflowOptions.map((size) => (
                  <button
                    aria-checked={activeSize === size}
                    className={appendClassName(
                      'OuroborosDialog-sizeMenuItem',
                      activeSize === size ? 'is-active' : ''
                    )}
                    key={size || 'default'}
                    onClick={() => this.handlePresetSizeChange(size)}
                    role="menuitemradio"
                    type="button">
                    <span
                      aria-hidden="true"
                      className={`OuroborosDialog-sizeIcon is-${size || 'default'}`}
                    />
                    <span>{DIALOG_SIZE_LABELS[size]}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    )
  }

  private renderResizeHandle(activeSize: DialogPresetSize | 'custom') {
    const config = this.getDialogResizeConfig()
    const store = (this.props as any).store
    if (!config.resizable || store?.isFullscreen || activeSize === 'full') {
      return null
    }

    return (
      <button
        aria-label="拖拽调整弹窗尺寸"
        className="OuroborosDialog-resizeHandle"
        key="ouroboros-dialog-resize-handle"
        onMouseDown={(event) => this.handleResizeMouseDown(event)}
        title="拖拽调整弹窗尺寸"
        type="button"
      />
    )
  }

  private renderFullscreenToggle() {
    if (!this.getDialogSchemaProps().allowFullscreen) {
      return null
    }

    const store = (this.props as any).store
    const isFullscreen = !!store?.isFullscreen
    const label = isFullscreen ? '退出全屏' : '全屏'

    return (
      <button
        aria-label={label}
        aria-pressed={isFullscreen}
        className={appendClassName(
          'OuroborosDialog-headerButton',
          'OuroborosDialog-fullscreenButton',
          isFullscreen ? 'is-active' : ''
        )}
        key="ouroboros-dialog-fullscreen-toggle"
        onClick={(event) => this.handleFullscreenToggle(event)}
        title={label}
        type="button">
        <span
          aria-hidden="true"
          className={appendClassName(
            'OuroborosDialog-fullscreenIcon',
            isFullscreen ? 'is-restore' : 'is-expand'
          )}
        />
      </button>
    )
  }

  private enhanceHeaderChildren(children: ReactNode, headerTools: ReactNode[]) {
    const headerChildren = React.Children.toArray(children).filter(
      (child) => !isNativeModalFullscreenElement(child)
    )
    const titleIndex = headerChildren.findIndex(isModalTitleElement)
    const tools = headerTools.filter(Boolean)

    if (!tools.length) {
      return headerChildren
    }

    if (titleIndex === -1) {
      return [...headerChildren, ...tools]
    }

    return [
      ...headerChildren.slice(0, titleIndex),
      ...tools,
      ...headerChildren.slice(titleIndex),
    ]
  }

  private enhanceModalChildren(
    children: ReactNode,
    activeSize: DialogPresetSize | 'custom'
  ) {
    const sizeSwitch = this.renderSizeSwitch(activeSize)
    const fullscreenToggle = this.renderFullscreenToggle()
    const resizeHandle = this.renderResizeHandle(activeSize)

    const enhancedChildren = React.Children.map(children, (child) => {
      if (!isModalHeaderElement(child)) {
        return child
      }

      return React.cloneElement(
        child,
        undefined,
        this.enhanceHeaderChildren(child.props.children, [fullscreenToggle, sizeSwitch])
      )
    })

    return resizeHandle
      ? [...React.Children.toArray(enhancedChildren), resizeHandle]
      : enhancedChildren
  }

  render() {
    const modal = super.render()
    if (!React.isValidElement(modal)) {
      return modal
    }

    const state = this.state as DialogResizeState
    const hasRuntimeResize =
      typeof state.resizeWidth === 'number' && typeof state.resizeHeight === 'number'
    const activeSize = hasRuntimeResize
      ? 'custom'
      : (state.activeSize ?? ((modal.props as any).size || ''))
    const hasPresetOverride = typeof state.activeSize !== 'undefined'
    const runtimeStyle = hasRuntimeResize
      ? {
          ...(omitSizeStyle((modal.props as any).style) || {}),
          width: `${state.resizeWidth}px`,
          height: `${state.resizeHeight}px`,
        }
      : hasPresetOverride
        ? omitSizeStyle((modal.props as any).style)
        : (modal.props as any).style

    const config = this.getDialogResizeConfig()
    const modalClassName = appendClassName(
      (modal.props as any).modalClassName,
      config.resizable ? 'OuroborosDialog-resizable' : '',
      config.sizeSwitchable ? 'OuroborosDialog-sizeSwitchable' : ''
    )

    const nextProps: Record<string, any> = {
      ...(modal.props as any),
      modalClassName,
      size: activeSize,
      style: runtimeStyle,
    }

    if (hasPresetOverride || hasRuntimeResize) {
      nextProps.width = undefined
      nextProps.height = undefined
    }

    return React.cloneElement(
      modal,
      nextProps,
      this.enhanceModalChildren((modal.props as any).children, activeSize)
    )
  }
}
