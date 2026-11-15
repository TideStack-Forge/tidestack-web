import { useEffect, useMemo, useRef, useState } from 'react'
import getSchema from '@/common/api/amis'
import { EventBus } from '@/common/eventBus'
import { readCurrentRoute } from '@/router/routerFacade'
import { store } from '@/store/storeFacade'
import { useHostSnapshot } from '@/layouts/useHostSnapshot'
import AmisComponent from './AmisComponent'
import { processAmisSchema } from '@/common/i18n/amis'

const LOADING_SCHEMA = {
  type: 'page',
  bodyClassName: 'amis-page-placeholder-body h-full',
  body: {
    type: 'wrapper',
    className: 'h-full flex justify-center items-center',
    body: {
      type: 'spinner',
      show: true,
      icon: 'fa fa-spinner',
      size: 'lg',
      tip: '加载中...',
      localeKeys: { tip: 'loading.page' },
    },
  },
}

const viewIdSchemaIdMap: Record<string, string> = {}
const FULL_HEIGHT_STYLE = { height: '100%' } as const
const AMIS_PAGE_STORE_MUTATION_TYPES = new Set([
  'tabs/INIT_TAB_STORAGE',
  'tabs/PUSH_TAB',
  'tabs/CHANGE_TAB',
  'tabs/CHANGE_ACTIVE_TAB',
  'tabs/REMOVE_TAB',
  'tabs/CLOSE_OTHERS_TABS',
  'tabs/CLEAR_TABS',
  'app/SET_AMIS_COMPONENES_REGISTERED',
])

function getFailedSchema(err: any) {
  return {
    type: 'page',
    body: {
      type: 'alert',
      level: 'danger',
      showIcon: true,
      title: '加载页面失败',
      localeKeys: { title: 'page.loadFailed' },
      body: err?.message ||
        err || { type: 'tpl', tpl: '未知错误', localeKeys: { tpl: 'error.unknown' } },
    },
  }
}

function normalizeSchema(schema: any) {
  if (!schema) {
    return null
  }
  if (!Object.prototype.hasOwnProperty.call(schema, 'type')) {
    return {
      type: 'page',
      ...schema,
    }
  }
  if (schema?.type !== 'page') {
    return {
      type: 'page',
      body: schema,
    }
  }
  return schema
}

interface CachedViewState {
  params: Record<string, any>
  query: Record<string, any>
}

export default function createAmisPage(schemaId: string) {
  return function AmisPageRoute({ schemaId: propSchemaId = '' }: { schemaId?: string }) {
    const currentSchemaId = schemaId || propSchemaId
    const [loadedSchema, setLoadedSchema] = useState<any>(null)
    const [placeholderSchema, setPlaceholderSchema] = useState<any>(LOADING_SCHEMA)
    const [, setViewVersion] = useState(0)
    const [localeVersion, setLocaleVersion] = useState(0)
    const componentMapRef = useRef<Record<string, CachedViewState>>({})
    useHostSnapshot({
      shouldNotifyStore: (mutation) => AMIS_PAGE_STORE_MUTATION_TYPES.has(mutation?.type),
    })
    const route = readCurrentRoute()
    const activeTabId = store.getters.activeTabId
    const tabsList = store.getters.tabsList
    const activeTab = tabsList.find((item: any) => item.id === activeTabId)
    const amisComponentsRegistered = store.getters['app/amisComponentsRegistered']

    useEffect(() => {
      let active = true

      async function loadSchema() {
        try {
          const schema = await getSchema(decodeURI(currentSchemaId))
          if (!active) {
            return
          }
          if (!schema) {
            setLoadedSchema(null)
            setPlaceholderSchema(
              getFailedSchema({
                type: 'tpl',
                tpl: '页面不存在',
                localeKeys: { tpl: 'page.notFound.title' },
              })
            )
            return
          }
          setLoadedSchema(schema)
        } catch (error) {
          if (active) {
            setLoadedSchema(null)
            setPlaceholderSchema(getFailedSchema(error))
          }
        }
      }

      setPlaceholderSchema(LOADING_SCHEMA)
      setLoadedSchema(null)
      void loadSchema()

      return () => {
        active = false
      }
    }, [currentSchemaId])

    useEffect(() => {
      const closeTabHandler = (data: any) => {
        const { tabId } = data || {}
        if (!tabId || !componentMapRef.current[tabId]) {
          return
        }

        delete componentMapRef.current[tabId]
        delete viewIdSchemaIdMap[tabId]
        setViewVersion((current) => current + 1)
      }

      const localeChangeHandler = () => {
        setLocaleVersion((current) => current + 1)
      }

      EventBus.subscribe('closeTab', closeTabHandler)
      EventBus.subscribe('locale-changed', localeChangeHandler)

      return () => {
        EventBus.unsubscribe('closeTab', closeTabHandler)
        EventBus.unsubscribe('locale-changed', localeChangeHandler)
      }
    }, [])

    const finalSchema = useMemo(() => {
      if (!loadedSchema) {
        return processAmisSchema('common', placeholderSchema)
      }

      const processedSchema = processAmisSchema(currentSchemaId, loadedSchema)
      return normalizeSchema(processedSchema)
    }, [currentSchemaId, loadedSchema, placeholderSchema, localeVersion])

    const isReady = amisComponentsRegistered && !!finalSchema

    useEffect(() => {
      if (!activeTabId || !isReady) {
        return
      }

      if (!activeTab || activeTab.fullPath !== route.fullPath) {
        return
      }

      if (route.meta?.schemaId !== currentSchemaId) {
        return
      }

      if (viewIdSchemaIdMap[activeTabId] && viewIdSchemaIdMap[activeTabId] !== currentSchemaId) {
        delete viewIdSchemaIdMap[activeTabId]
      }

      if (componentMapRef.current[activeTabId]) {
        return
      }

      viewIdSchemaIdMap[activeTabId] = currentSchemaId
      componentMapRef.current[activeTabId] = {
        params: route.params || {},
        query: route.query || {},
      }
      setViewVersion((current) => current + 1)
    }, [
      activeTabId,
      activeTab,
      currentSchemaId,
      isReady,
      route.fullPath,
      route.meta?.schemaId,
      route.params,
      route.query,
    ])

    if (!activeTabId) {
      return null
    }

    if (!isReady) {
      return (
        <AmisComponent
          // 占位 schema 与真实 schema 必须是不同实例：amis 只在挂载时按当时的 props
          // 绑定页面根节点的 onEvent，复用实例会让真实页面的页面级事件永不生效。
          key="amis-page-placeholder"
          style={FULL_HEIGHT_STYLE}
          amisSchema={finalSchema}
          params={route.params || {}}
          query={route.query || {}}
        />
      )
    }

    const cachedViewIds = Object.keys(componentMapRef.current)

    if (cachedViewIds.length === 0) {
      return null
    }

    return (
      <>
        {cachedViewIds.map((viewId) => {
          const viewState = componentMapRef.current[viewId]
          return (
            <div
              className="tab-cache-slot"
              data-cache-scope="tab"
              data-view-id={viewId}
              key={viewId}
              style={{
                display: viewId === activeTabId ? 'block' : 'none',
                height: '100%',
              }}>
              <AmisComponent
                // 同上：占位页与真实页面（以及不同 schema 之间）必须重新挂载，
                // 否则页面根节点的 onEvent 会停留在首次挂载时的 props 上。
                key={
                  loadedSchema ? `amis-page:${currentSchemaId}` : 'amis-page-placeholder'
                }
                style={FULL_HEIGHT_STYLE}
                amisSchema={finalSchema}
                params={viewState.params}
                query={viewState.query}
                tabId={viewId}
              />
            </div>
          )
        })}
      </>
    )
  }
}
