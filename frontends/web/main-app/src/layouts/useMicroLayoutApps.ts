import { useEffect, useRef } from 'react'
import { loadMicroApp } from 'qiankun'

import { getCommonProps } from '@/common/micro/commonProps'
import {
  createMicroEntryFetch,
  ensureSameOriginMicroEntryIsSafe,
} from '@/common/micro/entryGuard'
import { normalizeMicroEntry } from '@/common/micro/utils'
import {
  createMicroLayoutSlot,
  resetMicroLayoutSlot,
  syncMicroLayoutSlot,
} from './microLayoutController'

interface UseMicroLayoutAppsInput {
  appName?: string
  logo?: string
  menu?: any
  theme?: string
  userInfo?: any
  breadcrumb?: any[]
  currentPath?: string
  headerEntry?: string
  sidebarEntry?: string
}

export function useMicroLayoutApps({
  appName,
  logo,
  menu,
  theme,
  userInfo,
  breadcrumb,
  currentPath,
  headerEntry,
  sidebarEntry,
}: UseMicroLayoutAppsInput) {
  const microTopbarRef = useRef(createMicroLayoutSlot())
  const microSidebarRef = useRef(createMicroLayoutSlot())
  const destroyedRef = useRef(false)

  useEffect(() => {
    destroyedRef.current = false

    return () => {
      destroyedRef.current = true
      void resetMicroLayoutSlot(microTopbarRef.current, (error) => {
        console.warn('头部微应用卸载失败', error)
      })
      void resetMicroLayoutSlot(microSidebarRef.current, (error) => {
        console.warn('侧边栏微应用卸载失败', error)
      })
    }
  }, [])

  useEffect(() => {
    const microProps = {
      appName,
      logo,
      menu,
      theme,
      userInfo,
      breadcrumb,
      currentPath,
      ...getCommonProps(),
    }

    async function syncSlot(options: {
      entry?: string
      name: string
      selector: string
      currentRef: { current: ReturnType<typeof createMicroLayoutSlot> }
      warnMessage: string
    }) {
      await syncMicroLayoutSlot({
        slot: options.currentRef.current,
        entry: options.entry,
        name: options.name,
        selector: options.selector,
        props: microProps,
        destroyedRef,
        ensureEntrySafe: ensureSameOriginMicroEntryIsSafe,
        normalizeEntry: normalizeMicroEntry,
        loadMicroApp: (config) => loadMicroApp(config, { fetch: createMicroEntryFetch() }),
        warn: (error) => {
          if (!(error as any)?.isUnsafeMicroEntry) {
            console.warn(options.warnMessage, error)
          }
        },
      })
    }

    void syncSlot({
      entry: headerEntry,
      name: 'micro-custom-header',
      selector: '#custom-topbar',
      currentRef: microTopbarRef,
      warnMessage: '头部微应用加载失败',
    })

    void syncSlot({
      entry: sidebarEntry,
      name: 'micro-custom-sidebar',
      selector: '#custom-sidebar',
      currentRef: microSidebarRef,
      warnMessage: '侧边栏微应用加载失败',
    })
  }, [appName, breadcrumb, currentPath, headerEntry, logo, menu, sidebarEntry, theme, userInfo])
}
