import { IScopedContext, Renderer, RendererProps, ScopedContext, dataMapping } from 'amis'
import React from 'react'

class EmbedInternal extends React.Component<RendererProps> {
  static contextType = ScopedContext

  constructor(props: any, context: IScopedContext) {
    super(props)
    this.context = context
  }

  registerActions(actions: any[]) {
    const scoped = this.context as IScopedContext
    if (['drawer', 'dialog'].includes(scoped.component?.props.type))
      scoped.component?.setState({ updatedActions: actions })
  }

  render(): any {
    const { reactComponent: InternalComponent, data = {} } = this.props?.$schema || {}
    const onAction = this.props.onAction
    const props = dataMapping(data, this.props.data || {})
    if (!InternalComponent) {
      return null
    }
    const callbacks = {
      onConfirm: (data: any, reload: boolean = true) =>
        onAction?.(
          undefined,
          { actionType: 'confirm', from: 'embed-micro', reload },
          data
        ),
      onClose: () => onAction?.(undefined, { actionType: 'cancel' }),
      registerActions: this.registerActions.bind(this),
    }

    return <InternalComponent {...props} {...callbacks} />
  }
}

Renderer({ type: 'embed-internal' })(EmbedInternal as any)
