import {
  resolvePlatformContext,
  type LegacyResourceBrowserContext,
  type PlatformContext,
} from '../../platform/context'

export type ResourceBrowserContext = LegacyResourceBrowserContext
export type ResourceBrowserContextInput =
  | PlatformContext
  | ResourceBrowserContext
  | null
  | undefined

export function isDevFrontendResourceContext(
  context?: ResourceBrowserContextInput
): context is ResourceBrowserContext {
  return (
    context?.mode === 'dev-app-frontend-resource' &&
    typeof context.appName === 'string' &&
    context.appName.length > 0
  )
}

function isPlatformContext(context: any): context is PlatformContext {
  return context?.mode === 'runtime-app' || context?.mode === 'dev-app-workspace'
}

function createDevFrontendResourceContext(
  appName?: string | null
): ResourceBrowserContext | null {
  if (!appName || typeof appName !== 'string') {
    return null
  }
  const normalizedAppName = appName.trim()
  if (!normalizedAppName) {
    return null
  }
  return {
    mode: 'dev-app-frontend-resource',
    appName: normalizedAppName,
  }
}

export function resolveDevFrontendResourceBrowserContext(
  context?: ResourceBrowserContextInput,
  legacyContext?: ResourceBrowserContext | null
): ResourceBrowserContext | null {
  if (isDevFrontendResourceContext(context)) {
    return createDevFrontendResourceContext(context.appName)
  }
  const platformContext = isPlatformContext(context)
    ? resolvePlatformContext(context, {
        resourceBrowserContext: legacyContext,
      })
    : resolvePlatformContext(undefined, {
        resourceBrowserContext: context || legacyContext,
      })
  if (platformContext.mode !== 'dev-app-workspace') {
    return null
  }
  return createDevFrontendResourceContext(platformContext.appName)
}

export function getDevFrontendResourceApiBase(
  context?: ResourceBrowserContext | null
): string | null {
  const resolvedContext = resolveDevFrontendResourceBrowserContext(context)
  if (!isDevFrontendResourceContext(resolvedContext)) {
    return null
  }
  return `/api/dev/${resolvedContext.appName}/resource`
}
