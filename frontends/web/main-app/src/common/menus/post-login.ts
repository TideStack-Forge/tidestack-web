export interface MenuStateLike {
  globalMenu?: unknown[] | null
}

export interface PostLoginDecisionInput {
  preferredPath?: string | null
  preferredMenuPath?: string | null
  preferredRoutePath?: string | null
  menu?: MenuStateLike | null
}

export interface PostLoginDecision {
  type: 'menu' | 'route' | 'fallback'
  targetPath: string
}

export function hasConfiguredMenus(menu?: MenuStateLike | null): boolean {
  return Array.isArray(menu?.globalMenu) && menu.globalMenu.length > 0
}

export function resolvePostLoginFallbackPath(menu?: MenuStateLike | null): string {
  return hasConfiguredMenus(menu) ? '/welcome' : '/errorAfterLogin'
}

export function resolvePostLoginDecision({
  preferredPath,
  preferredMenuPath,
  preferredRoutePath,
  menu,
}: PostLoginDecisionInput): PostLoginDecision {
  const hasPreferredPath = Boolean(preferredPath && preferredPath !== '/')

  if (hasPreferredPath && preferredMenuPath) {
    return {
      type: 'menu',
      targetPath: preferredMenuPath,
    }
  }

  if (hasPreferredPath && preferredRoutePath) {
    return {
      type: 'route',
      targetPath: preferredRoutePath,
    }
  }

  return {
    type: 'fallback',
    targetPath: resolvePostLoginFallbackPath(menu),
  }
}
