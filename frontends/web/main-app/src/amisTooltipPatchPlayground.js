import { createElement } from 'react'
import { createRoot } from 'react-dom/client'

import { AmisTooltipPatchPage } from '@/pages/debug/AmisTooltipPatchPage'
import { dispatch, commit } from '@/store/storeFacade'

export const AMIS_TOOLTIP_PATCH_DEBUG_PATH = '/debug/amis-tooltip-patch'

export function isAmisTooltipPatchDebugPath(pathname = '') {
  return pathname === AMIS_TOOLTIP_PATCH_DEBUG_PATH
}

export async function initAmisTooltipPatchPlayground() {
  await dispatch('app/init', {
    appName: 'AMIS Tooltip Patch Playground',
    defaultTheme: 'default',
    currentTheme: 'default',
    routes: [],
    config: {},
  })

  commit('app/SET_AMIS_COMPONENES_REGISTERED', true)
  const container = document.getElementById('mothership-app-root')
  if (!container) {
    throw new Error('Missing #mothership-app-root container')
  }

  createRoot(container).render(createElement(AmisTooltipPatchPage))
}
