import { parseFrontendResourceReference } from '../editor/resource-browser/reference'
import {
  createDevAppWorkspacePlatformContext,
  getPlatformAdapter,
  resolvePlatformContext,
  type FrontendResourceAdapter,
  type LegacyFrontendResourceRenderContext,
  type PlatformContext,
} from '../platform/context'

export type FrontendResourceRenderContext = LegacyFrontendResourceRenderContext
export type FrontendResourceContextInput =
  | PlatformContext
  | FrontendResourceRenderContext
  | null
  | undefined

function isPlatformContext(context: any): context is PlatformContext {
  return context?.mode === 'runtime-app' || context?.mode === 'dev-app-workspace'
}

function buildFrontendResourceViewUrlForKey(
  key: string,
  platformContext: PlatformContext
): string {
  const encodedKey = encodeURIComponent(key)
  if (platformContext.mode === 'dev-app-workspace') {
    return `/api/dev/${platformContext.appName}/resource/view?key=${encodedKey}`
  }
  return `/api/resource/view?key=${encodedKey}`
}

function createDefaultFrontendResourceAdapter(
  platformContext: PlatformContext
): FrontendResourceAdapter {
  return {
    kind: 'resource',
    resolveReferenceUrl(input: { value?: string | null }) {
      const parsed = parseFrontendResourceReference(input.value)
      if (!parsed) {
        return undefined
      }
      return buildFrontendResourceViewUrlForKey(parsed.key, platformContext)
    },
    getEditorSelectionConfig() {
      return {
        mode: 'resource-or-url',
      }
    },
  }
}

export function getRuntimeAppFrontendResourceRenderContext(): FrontendResourceRenderContext {
  return { mode: 'runtime-app' }
}

export function createDevAppWorkspaceFrontendResourceRenderContext(
  appName?: string | null
): FrontendResourceRenderContext | null {
  const platformContext = createDevAppWorkspacePlatformContext(appName)
  if (!platformContext || platformContext.mode !== 'dev-app-workspace') {
    return null
  }
  return {
    mode: 'dev-app-workspace',
    appName: platformContext.appName,
  }
}

export function resolveFrontendResourcePlatformContext(
  context?: FrontendResourceContextInput
): PlatformContext {
  if (isPlatformContext(context)) {
    return resolvePlatformContext(context)
  }
  return resolvePlatformContext(undefined, {
    frontendResourceRenderContext: context || undefined,
  })
}

export function resolveFrontendResourceRenderContext(
  context?: FrontendResourceContextInput
): FrontendResourceRenderContext {
  const platformContext = resolveFrontendResourcePlatformContext(context)
  if (platformContext.mode === 'dev-app-workspace') {
    return {
      mode: 'dev-app-workspace',
      appName: platformContext.appName,
    }
  }
  return getRuntimeAppFrontendResourceRenderContext()
}

function resolveFrontendResourceAdapter(
  context?: FrontendResourceContextInput
): FrontendResourceAdapter {
  const platformContext = resolveFrontendResourcePlatformContext(context)
  return (
    getPlatformAdapter(platformContext, 'resource') ||
    createDefaultFrontendResourceAdapter(platformContext)
  )
}

export function buildFrontendResourceViewUrl(
  key: string,
  context?: FrontendResourceContextInput
): string {
  return buildFrontendResourceViewUrlForKey(
    key,
    resolveFrontendResourcePlatformContext(context)
  )
}

export function resolveFrontendResourceReferenceUrl(
  value?: string | null,
  context?: FrontendResourceContextInput
): string | undefined {
  return resolveFrontendResourceAdapter(context).resolveReferenceUrl({
    value,
  })
}
