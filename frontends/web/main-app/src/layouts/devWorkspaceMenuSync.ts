import { useEffect, useRef } from 'react'

import { EventBus, ReplayScope } from '@/common/eventBus'
import { normalizeTabPath } from '@/common/tabs/tabNavigation'
import { Client } from '@/utils/http'

import { dispatch, readGetters } from '../store/storeFacade'

type DispatchLike = (action: string, payload?: any) => Promise<unknown> | unknown

interface WorkspaceMenuItem {
  url?: string
  path?: string
  fullPath?: string
  icon?: string
  children?: WorkspaceMenuItem[]
}

interface WorkspaceMenuData {
  main?: WorkspaceMenuItem[]
  secondary?: WorkspaceMenuItem[]
}

export function resolveDevWorkspaceAppName(fullPath = '') {
  const match = `${fullPath || ''}`.match(/^\/dev\/([^/?#]+)/)
  if (!match) {
    return null
  }

  const appName = decodeURIComponent(match[1] || '').trim()
  if (!appName || appName === 'apps') {
    return null
  }

  return appName
}

function normalizeMenuPath(path = '') {
  return `${path || ''}`.split(/[?#]/)[0]
}

function findMenuItemByPath(menuItems: WorkspaceMenuItem[] = [], fullPath = '') {
  const normalizedPath = normalizeMenuPath(normalizeTabPath(fullPath))
  for (const item of menuItems) {
    if (!item || typeof item !== 'object') {
      continue
    }

    const itemPath = normalizeMenuPath(item.url || item.path || item.fullPath || '')
    if (itemPath && itemPath === normalizedPath) {
      return item
    }

    const childMatch = findMenuItemByPath(item.children || [], normalizedPath)
    if (childMatch) {
      return childMatch
    }
  }

  return null
}

async function syncCurrentWorkspaceTabIcon(
  fullPath: string,
  menuData: WorkspaceMenuData,
  runDispatch: DispatchLike
) {
  const menuItem = findMenuItemByPath(
    [...(menuData?.main || []), ...(menuData?.secondary || [])],
    fullPath
  )
  if (!menuItem?.icon) {
    return false
  }

  const currentPath = normalizeMenuPath(normalizeTabPath(fullPath))
  const tabsList = readGetters().tabsList || []
  const currentTab = tabsList.find((item) => normalizeMenuPath(item?.fullPath || item?.path || '') === currentPath)
  if (!currentTab || currentTab.icon === menuItem.icon) {
    return false
  }

  await runDispatch('tabs/changeTab', {
    ...currentTab,
    icon: menuItem.icon,
  })
  return true
}

export async function syncDevWorkspaceMenuForRoute(
  fullPath = '',
  runDispatch: DispatchLike = dispatch
) {
  const appName = resolveDevWorkspaceAppName(fullPath)
  if (!appName) {
    return false
  }

  const response = await Client.get(
    `/api/dev/${appName}/dev-workspace-menu`,
    {},
    { isSilent: true }
  )
  const result = response?.data
  if (result?.code !== 0 || !result?.data) {
    return false
  }

  await runDispatch('user/updateMenu', result.data)
  await syncCurrentWorkspaceTabIcon(fullPath, result.data, runDispatch)
  EventBus.removeReplayEvent('updateMenu', ReplayScope.SESSION)
  return true
}

export function useDevWorkspaceMenuSync(fullPath = '') {
  const syncedAppNameRef = useRef<string | null>(null)

  useEffect(() => {
    const appName = resolveDevWorkspaceAppName(fullPath)

    if (!appName) {
      syncedAppNameRef.current = null
      return
    }

    if (syncedAppNameRef.current === appName) {
      return
    }

    syncedAppNameRef.current = appName
    void syncDevWorkspaceMenuForRoute(fullPath).then((synced) => {
      if (!synced) {
        syncedAppNameRef.current = null
      }
    }).catch(() => {
      syncedAppNameRef.current = null
    })
  }, [fullPath])
}
