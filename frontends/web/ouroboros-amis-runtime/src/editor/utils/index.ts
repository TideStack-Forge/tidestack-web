import { actionTreeGetter, customActionGetter } from '../actions'
import {
  resolveDevFrontendResourceBrowserContext,
  type ResourceBrowserContext,
} from '../resource-browser/context'
import { resolvePlatformContext, type PlatformContext } from '../../platform/context'

export function getEditorCommonProps(props: any): any {
  const { platformContext, resourceBrowserContext } = props as {
    platformContext?: PlatformContext
    resourceBrowserContext?: ResourceBrowserContext
  }
  const resolvedPlatformContext = resolvePlatformContext(platformContext, {
    resourceBrowserContext,
  })
  const resolvedResourceBrowserContext = resolveDevFrontendResourceBrowserContext(
    resolvedPlatformContext,
    resourceBrowserContext
  )
  const commonProps: any = {
    actionOptions: {
      actionTreeGetter,
      customActionGetter,
    },
    platformContext: resolvedPlatformContext,
  }
  if (resolvedResourceBrowserContext) {
    commonProps.resourceBrowserContext = resolvedResourceBrowserContext
  }
  return commonProps
}

export { getPureSchema } from './pureSchema'
export { createSchemaChangeSourceTracker } from './schemaChangeSource'
export { reorderSchemaLike } from './schemaKeyOrder'
