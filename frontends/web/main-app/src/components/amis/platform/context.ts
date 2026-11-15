export type FrontendResourceAdapter = {
  kind: 'resource'
  resolveReferenceUrl(input: { value?: string | null }): string | undefined
  getEditorSelectionConfig?(input?: { scope?: 'FRONTEND' }): {
    mode: 'resource-only' | 'resource-or-url'
  }
}

export type FrontendDictAdapter = {
  kind: 'dict'
  resolveOptionsSource(input: {
    dictName: string
    tenantId?: string
    selectorType?: string
  }): any
}

export type FrontendRemoteOptionsAdapter = {
  kind: 'remote-options'
  resolveSource(input: { source: any; schema?: Record<string, any> }): any
}

export type PlatformAdapters = {
  resource?: FrontendResourceAdapter
  dict?: FrontendDictAdapter
  remoteOptions?: FrontendRemoteOptionsAdapter
}

export type PlatformContext =
  | {
      mode: 'runtime-app'
      appName?: string
      tenantId?: string
      adapters?: PlatformAdapters
    }
  | {
      mode: 'dev-app-workspace'
      appName: string
      tenantId?: string
      adapters?: PlatformAdapters
    }

export type LegacyFrontendResourceRenderContext =
  | { mode: 'runtime-app' }
  | { mode: 'dev-app-workspace'; appName: string }

export type LegacyResourceBrowserContext = {
  mode: 'dev-app-frontend-resource'
  appName: string
}

function normalizeAppName(appName?: string | null): string | null {
  if (!appName) {
    return null
  }
  const normalized = appName.trim()
  return normalized || null
}

function inferDevAppWorkspacePlatformContext(): PlatformContext | null {
  if (typeof window === 'undefined') {
    return null
  }
  const pathname = window.location?.pathname || ''
  const matched = pathname.match(/^\/dev\/([^/]+)(?:\/|$)/)
  if (!matched) {
    return null
  }
  return createDevAppWorkspacePlatformContext(decodeURIComponent(matched[1] || ''))
}

export function createRuntimeAppPlatformContext(
  adapters?: PlatformAdapters
): PlatformContext {
  return {
    mode: 'runtime-app',
    adapters,
  }
}

export function createDevAppWorkspacePlatformContext(
  appName?: string | null,
  adapters?: PlatformAdapters
): PlatformContext | null {
  const normalizedAppName = normalizeAppName(appName)
  if (!normalizedAppName) {
    return null
  }
  return {
    mode: 'dev-app-workspace',
    appName: normalizedAppName,
    adapters,
  }
}

function resolveLegacyPlatformContext(legacy?: {
  frontendResourceRenderContext?: LegacyFrontendResourceRenderContext | null
  resourceBrowserContext?: LegacyResourceBrowserContext | null
}): PlatformContext | null {
  if (legacy?.frontendResourceRenderContext?.mode === 'dev-app-workspace') {
    return createDevAppWorkspacePlatformContext(
      legacy.frontendResourceRenderContext.appName
    )
  }
  if (legacy?.frontendResourceRenderContext?.mode === 'runtime-app') {
    return createRuntimeAppPlatformContext()
  }
  if (legacy?.resourceBrowserContext?.mode === 'dev-app-frontend-resource') {
    return createDevAppWorkspacePlatformContext(legacy.resourceBrowserContext.appName)
  }
  return null
}

export function resolvePlatformContext(
  context?: PlatformContext | null,
  legacy?: {
    frontendResourceRenderContext?: LegacyFrontendResourceRenderContext | null
    resourceBrowserContext?: LegacyResourceBrowserContext | null
  }
): PlatformContext {
  if (context?.mode === 'dev-app-workspace') {
    return (
      createDevAppWorkspacePlatformContext(context.appName, context.adapters) ||
      createRuntimeAppPlatformContext(context.adapters)
    )
  }
  if (context?.mode === 'runtime-app') {
    return createRuntimeAppPlatformContext(context.adapters)
  }
  return (
    resolveLegacyPlatformContext(legacy) ||
    inferDevAppWorkspacePlatformContext() ||
    createRuntimeAppPlatformContext()
  )
}

export function getPlatformAdapter<K extends keyof PlatformAdapters>(
  context: PlatformContext | null | undefined,
  key: K
): PlatformAdapters[K] | undefined {
  return context?.adapters?.[key]
}
