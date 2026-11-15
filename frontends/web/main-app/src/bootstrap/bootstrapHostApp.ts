import axios from 'axios'
import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { buildInitializationRecoveryLocation, resolveReturnUrl } from '@/common/auth/flow'

import { AppLayout } from '@/layouts/AppLayout'
import { i18nService } from '@/common/i18n'
import { registerHandler, replyToMessageSource } from '@/common/messageEvent'
import {
  loadComponentLibraries,
  loadPlatformComponentLibrary,
} from '@/loadComponentLibrary'
import { commit, dispatch, readGetters } from '@/store/storeFacade'
import { getRouter, refreshRouter, replaceLocation } from '@/router/routerFacade'

let reactBootstrapRoot: Root | null = null
let legacyIframeParamsRegistered = false

function registerLegacyIframeParamsHandler() {
  if (legacyIframeParamsRegistered) {
    return
  }

  registerHandler('request-legacy-iframe-params', function (_data: any, e: any) {
    const getters = readGetters()
    const routes = getters['app/routes']
    const config = {
      ...getters['app/appInfo'],
      routes,
    }

    replyToMessageSource(e, {
      type: 'init-legacy-iframe',
      payload: {
        config,
        token: getters.token,
      },
    })
  })

  legacyIframeParamsRegistered = true
}

export function mountReactApp() {
  const container = document.getElementById('mothership-app-root')
  if (!container) {
    throw new Error('Missing #mothership-app-root container')
  }

  if (!reactBootstrapRoot) {
    reactBootstrapRoot = createRoot(container)
  }

  getRouter()
  reactBootstrapRoot.render(createElement(AppLayout))
}

export async function bootstrapHostApp() {
  registerLegacyIframeParamsHandler()

  const appConfig = await dispatch('app/init')
  if (appConfig) {
    const { componentLibraries, platformComponentLibraries = [] } = appConfig
    await loadComponentLibraries(componentLibraries)
    await loadPlatformComponentLibrary(platformComponentLibraries)
  }
  commit('app/SET_AMIS_COMPONENES_REGISTERED', true)

  try {
    await i18nService.init()
  } catch (error) {
    console.warn('Failed to initialize I18n:', error)
  }

  try {
    const whiteRouteResponse = await axios.get('/microWhiteRoutes.json')
    const dataMap = whiteRouteResponse.data || {}
    if (typeof dataMap !== 'string') {
      await dispatch('app/pushMicroWhiteRoutes', dataMap)
    }
  } catch (error) {
    console.warn('Failed to load micro white routes:', error)
  }

  const initResult = await dispatch('user/init')
  refreshRouter()
  if (initResult?.success === false && readGetters().token) {
    const url = new URL(window.location.href)
    const returnUrl = resolveReturnUrl(
      url.searchParams.get('redirect') || `${url.pathname}${url.search}${url.hash}`
    )
    await replaceLocation(buildInitializationRecoveryLocation(returnUrl))
  }
  mountReactApp()
}
