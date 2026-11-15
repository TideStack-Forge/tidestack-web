import { Renderer, render as renderAmis, type RenderOptions } from 'amis'
import React from 'react'

import type { PlatformContext } from '../platform/context'
import {
  resolveFrontendResourcePlatformContext,
  resolveFrontendResourceRenderContext,
  type FrontendResourceRenderContext,
} from '../schemaFilter/frontendResourceReference'

type FrontendAwareRenderOptions = RenderOptions & {
  platformContext?: PlatformContext | null
  frontendResourceRenderContext?: FrontendResourceRenderContext | null
}

class AmisSchemaPreview extends React.Component<any, any> {
  fetcher: any
  constructor(props: any) {
    super(props)
    this.fetcher = props.env.fetcher
    this.state = { schema: null }
  }

  componentDidMount() {
    this.getSchema()
  }

  componentDidUpdate() {
    this.getSchema()
  }

  shouldComponentUpdate(nextProps: any, nextState: any) {
    return (
      this.state.schema === null ||
      this.state.schema !== nextState.schema ||
      this.props.platformContext !== nextProps.platformContext ||
      this.props.frontendResourceRenderContext !== nextProps.frontendResourceRenderContext
    )
  }

  getSchema() {
    const { schemaId, source } = this.props
    if (source && (source.type || Array.isArray(source))) {
      this.setState({ schema: source })
      return
    }
    if (source && (typeof source === 'string' || source.url)) {
      this.fetchSchemaByApi(source).then((schema) => {
        this.setState({ schema })
      })
      return
    }
    if (schemaId) {
      this.fetchSchemaById(schemaId).then((schema) => {
        this.setState({ schema })
      })
    }
  }

  render() {
    const {
      notify,
      alert,
      confirm,
      theme,
      placeholder,
      platformContext,
      frontendResourceRenderContext,
    } = this.props
    const { schema } = this.state
    const emptyFetcher = async () => ({ status: 0, data: { items: [], total: 0 } })
    const resolvedPlatformContext = resolveFrontendResourcePlatformContext(
      platformContext || frontendResourceRenderContext
    )
    const ele = renderAmis(
      schema || {
        type: 'alert',
        level: 'warning',
        body: placeholder ?? 'schema为空',
      },
      { data: {} },
      {
        fetcher: emptyFetcher as any,
        notify,
        alert,
        confirm,
        theme,
        platformContext: resolvedPlatformContext,
        frontendResourceRenderContext: resolveFrontendResourceRenderContext(
          resolvedPlatformContext
        ),
        // eslint-disable-next-line
        jumpTo() {},
        // eslint-disable-next-line
        updateLocation() {},
      } as FrontendAwareRenderOptions
    )
    return ele
  }

  async fetchSchemaById(schemaId: string) {
    return await this.fetchSchemaByApi({
      method: 'get',
      url: '/api/ui-schema',
      data: { path: schemaId },
    })
  }

  async fetchSchemaByApi(schemaApi: any) {
    const fetcher = this.fetcher
    const data = schemaApi.data || {}
    const result = await fetcher(schemaApi, data)
    if (result.status !== 0) {
      return null
    }
    return result.data
  }
}

Renderer({
  type: 'amis-schema-preview',
  autoVar: true,
})(AmisSchemaPreview)

Renderer({
  type: 'ui-schema-preview',
  autoVar: true,
})(AmisSchemaPreview)

export default AmisSchemaPreview
