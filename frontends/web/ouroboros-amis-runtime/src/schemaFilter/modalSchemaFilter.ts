import { addSchemaFilter, dataMapping } from 'amis'
import type { Schema, RendererConfig } from 'amis'

import { getRouteInfo } from '#ouroboros-host/router/utils'
import { normalizeModalSchema } from '../renderers/modalFormActions'

addSchemaFilter((schema: Schema, renderer: RendererConfig, props?: any) => {
  if (schema.type !== 'dialog' && schema.type !== 'drawer') return schema
  const options = { translate: props?.translate, loadingConfig: schema.loadingConfig }
  const source = resolveBody(schema, renderer, props)
  const resolved = normalizeModalSchema(source, options)
  if (typeof resolved.lazySchema !== 'function') return resolved
  const lazySchema = resolved.lazySchema
  return {
    ...resolved,
    lazySchema: (modalProps: any) => {
      const result = lazySchema(modalProps)
      const normalize = (value: any) =>
        value &&
        normalizeModalSchema(
          { ...source, ...value },
          {
            ...options,
            translate: modalProps.translate,
          }
        )
      return result?.then ? result.then(normalize) : normalize(result)
    },
  }
})

function resolveBody(schema: Schema, renderer: RendererConfig, props?: any) {
  const { url, body = {}, schemaId, rewriteProps = {}, updateActions = true } = schema
  const data = props?.data ?? {}
  const rootData = props?.env?.rootData
  const routeContextData = {
    ...(rootData?.params ?? {}),
    ...(rootData?.query ?? {}),
    ...(rootData?.queryParams ?? {}),
    ...(rootData?.pathVariables ?? {}),
  }
  if (!url && !schemaId) return schema
  let title = schema.title
  let finalBody = body
  let addtionalData = data

  // 如果有 schemaId，直接返回 amis-schema
  if (url) {
    const finalUrl = dataMapping(url, { ...routeContextData, ...data })
    const routeInfo = getRouteInfo(finalUrl)

    const keepData = {
      params: rootData?.params,
      query: rootData?.query,
      queryParams: rootData?.queryParams,
      pathVariables: rootData?.pathVariables,
      SystemConfig: rootData?.SystemConfig,
      SystemContext: rootData?.SystemContext,
    }
    addtionalData = { ...data, ...routeInfo.params, ...routeInfo.query, ...keepData }
    title = title === undefined ? routeInfo.title || routeInfo.name : title
    const commonProps = {
      ...(typeof body === 'object' && !Array.isArray(body) ? body : {}),
      ...rewriteProps,
      rewriteProps,
    }
    if (routeInfo.type === 'amis') {
      finalBody = {
        ...commonProps,
        type: 'amis-schema',
        schemaId: routeInfo.schemaId || routeInfo.path,
        updateActions,
      }
    } else if (routeInfo.type === 'internal') {
      finalBody = {
        ...commonProps,
        type: 'embed-internal',
        reactComponent: routeInfo.lastMatched?.pageComponent,
        updateActions,
      }
    } else if (routeInfo.type === 'micro') {
      finalBody = {
        ...commonProps,
        type: 'embed-micro-app',
        entry: routeInfo.entry,
        routeInfo,
        url,
        updateActions,
      }
    }

    return {
      ...schema,
      title,
      body: finalBody,
      routeInfo,
      $$modal_addtional_data: addtionalData,
      data: addtionalData
    }
  }
  finalBody = {
    ...rewriteProps,
    rewriteProps,
    type: 'amis-schema',
    schemaId,
    updateActions,
  }
  return {
    ...schema,
    title,
    body: finalBody,
    $$modal_addtional_data: addtionalData,
    data: addtionalData
  }
}
