import type { MenuStateLike, PostLoginDecisionInput, PostLoginDecision } from './post-login'
import { resolvePostLoginDecision } from './post-login'

export interface PostLoginNavigationInput extends PostLoginDecisionInput {
  onMenuTarget?: (targetPath: string) => Promise<unknown> | unknown
  onRouteTarget?: (targetPath: string) => Promise<void> | void
  onFallbackTarget?: (targetPath: string) => Promise<void> | void
}

export interface PostLoginNavigationResult {
  decision: PostLoginDecision
  handled: boolean
}

export async function performPostLoginNavigation({
  preferredPath,
  preferredMenuPath,
  preferredRoutePath,
  menu,
  onMenuTarget,
  onRouteTarget,
  onFallbackTarget,
}: PostLoginNavigationInput): Promise<PostLoginNavigationResult> {
  const decision = resolvePostLoginDecision({
    preferredPath,
    preferredMenuPath,
    preferredRoutePath,
    menu: menu as MenuStateLike | null | undefined,
  })

  if (decision.type === 'menu') {
    const handled = await onMenuTarget?.(decision.targetPath)
    if (!handled && preferredRoutePath) {
      await onRouteTarget?.(preferredRoutePath)
      return {
        decision: {
          type: 'route',
          targetPath: preferredRoutePath,
        },
        handled: true,
      }
    }

    return {
      decision,
      handled: Boolean(handled),
    }
  }

  if (decision.type === 'route') {
    await onRouteTarget?.(decision.targetPath)
    return {
      decision,
      handled: true,
    }
  }

  if (onFallbackTarget) {
    await onFallbackTarget(decision.targetPath)
    return {
      decision,
      handled: true,
    }
  }

  return {
    decision,
    handled: false,
  }
}
