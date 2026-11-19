import { DrawerRenderer } from 'amis/lib/renderers/Drawer'
import Spinner from 'amis-ui/lib/components/Spinner'
import {
  IScopedContext,
  ModalStore,
  Renderer,
  IServiceStore,
  isObjectShallowModified,
  ActionSchema,
  setThemeClassName,
} from 'amis'
import { popModalMethods, pushModalMethods } from '#ouroboros-host/common/modal'
import type { DrawerProps } from 'amis/lib/renderers/Drawer'
import {
  buildModalFooterActionData,
  resolveModalBodySchema,
  resetModalBodySchema,
  withModalSchemaResolvedHandler,
  getModalActionsFromProps,
} from './modalFormActions'

const DrawerRendererClass = (DrawerRenderer as any)
  .ComposedComponent as typeof DrawerRenderer

@Renderer({
  type: 'drawer',
  name: 'OuroborosDrawer',
  storeType: ModalStore.name,
  storeExtendsData: false,
  weight: -100,
  isolateScope: true,
  override: true,
  shouldSyncSuperStore: (store: IServiceStore, props: any, prevProps: any) => {
    return !!(
      (store.drawerOpen || props.show) &&
      (props.show !== prevProps.show ||
        isObjectShallowModified(prevProps.data, props.data))
    )
  },
})
export default class OuroborosDrawer extends DrawerRendererClass {
  private renderingModalActionBody = false
  private modalSchemaGeneration = 0
  private modalUnmounted = false

  constructor(props: DrawerProps, context: IScopedContext) {
    super(props, context)
    this.state = { updatedActions: null }
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

  buildActions(): Array<ActionSchema> {
    const explicitActions = this.getModalActions()
    if (typeof explicitActions !== 'undefined') {
      return Array.isArray(explicitActions) ? explicitActions : []
    }

    const updatedActions = (this.state as any).updatedActions
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
    const { env, showErrorMsg, footerClassName, id, themeCss, hideActions } = this
      .props as any
    if (!actions || !actions.length || hideActions) {
      return null
    }

    const actionData = buildModalFooterActionData(store)
    return (
      <div
        className={cx(
          'Drawer-footer',
          footerClassName,
          setThemeClassName({
            ...(this.props as any),
            name: 'drawerFooterClassName',
            id,
            themeCss,
          })
        )}>
        {store.loading || store.error ? (
          <div className={cx('Drawer-info')}>
            <Spinner size="sm" key="info" show={store.loading} />
            {!env?.forceSilenceInsideError && showErrorMsg && store.error ? (
              <span className={cx('Drawer-error')}>{store.msg}</span>
            ) : null}
          </div>
        ) : null}
        {actions.map((action, key) =>
          render(`action/${key}`, action, {
            onAction: this.handleAction,
            onActionSensor: undefined,
            btnDisabled: store.loading,
            data: actionData,
            key,
            disabled: action.disabled || store.loading,
          })
        )}
      </div>
    )
  }

  renderBody(body: any, key?: any) {
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
    return getModalActionsFromProps(this.props, 'drawerSchema')
  }

  componentWillUnmount() {
    this.modalUnmounted = true
    super.componentWillUnmount?.()
  }

  handleEntered() {
    pushModalMethods((action: any, ctx: any) => {
      super.handleAction(undefined, action, ctx, false, this.context as any)
    })
    return super.handleEntered()
  }

  handleExited() {
    this.modalSchemaGeneration += 1
    resetModalBodySchema(this.props)
    popModalMethods()
    this.setState({
      updatedActions: null,
    })
    return super.handleExited()
  }
}
