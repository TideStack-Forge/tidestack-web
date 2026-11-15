// @ts-ignore
import '@fortawesome/fontawesome-free/css/all.css'
// @ts-ignore
import '@fortawesome/fontawesome-free/css/v4-shims.css'
// @ts-ignore
import 'amis/lib/themes/cxd.css'
// @ts-ignore
import 'amis/lib/helper.css'
// @ts-ignore
import 'amis/sdk/iconfont.css'
import {
  Profiler,
  memo,
  useMemo,
  useRef,
  type CSSProperties,
} from 'react'
import { createRoot, type Root } from 'react-dom/client'
import {
  render as renderAmis,
  ToastComponent,
  AlertComponent,
  type Schema,
  type RenderOptions,
  dataMapping,
  qsstringify,
  extractObjectChain,
  createObjectFromChain,
} from 'amis'
import { type RootRenderProps } from 'amis-core/lib/Root'
import { cloneDeep } from 'lodash'
import axios from 'axios'
import { store } from '@/store/storeFacade'
import { useHostSnapshot } from '@/layouts/useHostSnapshot'
import copy from 'copy-to-clipboard'
import toast from '@/utils/toast'
import { i18nService } from '@/common/i18n'
import { useI18n } from '@/common/i18n/useI18n'
import { processAmisSchema } from '@/common/i18n/amis'
import { alert, confirm } from '@/common/modal'
import { pushLocation, readCurrentRoute } from '@/router/routerFacade'

import './runtimePreset'
import { Client } from '@/utils/http'
import { resolvePlatformContext, type PlatformContext } from './platform/context'
import {
  resolveFrontendResourcePlatformContext,
  resolveFrontendResourceRenderContext,
  type FrontendResourceRenderContext,
} from './schemaFilter/frontendResourceReference'

import type { ToastConf } from 'amis-ui/lib/components/Toast'

type MessageType = 'success' | 'warning' | 'info' | 'error'
type FrontendAwareRenderOptions = RenderOptions & {
  platformContext?: PlatformContext | null
  frontendResourceRenderContext?: FrontendResourceRenderContext | null
  __performanceObserver?: AmisMainThreadPerformanceObserver
}

type AmisMainThreadPerformanceObserver = {
  onFetcherEntered?: (event: {
    api: any
    url: string
    method: string
  }) => void
  onFetcherResolved?: (event: {
    api: any
    url: string
    method: string
    status: 'fulfilled' | 'rejected'
    error?: unknown
  }) => void
  onCommit?: (event: {
    id: string
    phase: 'mount' | 'update' | 'nested-update'
    actualDuration: number
    baseDuration: number
    startTime: number
    commitTime: number
  }) => void
}

const AMIS_COMPONENT_STORE_MUTATION_TYPES = new Set([
  'user/SET_TOKEN',
  'user/SET_USERINFO',
  'user/SET_AUTHORITIES',
  'user/LOGOUT',
  'app/SET_CONFIG',
  'app/SET_THEME',
  'app/SET_LOCALE',
  'app/SET_APP_NAME',
  'app/SET_LOGO_URL',
])

const AMIS_COMPONENT_TAB_MUTATION_TYPES = new Set([
  'tabs/PUSH_TAB',
  'tabs/CHANGE_TAB',
  'tabs/CHANGE_ACTIVE_TAB',
  'tabs/REMOVE_TAB',
  'tabs/CLOSE_OTHERS_TABS',
  'tabs/CLEAR_TABS',
])

function shouldNotifyAmisComponent(mutation: any, tabId?: string) {
  return Boolean(
    mutation?.type &&
    (
      AMIS_COMPONENT_STORE_MUTATION_TYPES.has(mutation.type) ||
      (!tabId && AMIS_COMPONENT_TAB_MUTATION_TYPES.has(mutation.type))
    )
  )
}

export interface AmisComponentProps {
  amisSchema: Schema
  amisProps?: Record<string, any>
  amisEnv?: Record<string, any>
  query?: Record<string, any>
  params?: Record<string, any>
  className?: string
  id?: string
  style?: CSSProperties
  tabId?: string
}

function renderAmisSchemaToElement(
  schema: Schema,
  props: RootRenderProps = {},
  env: FrontendAwareRenderOptions = {}
) {
  const currentLocale = i18nService.getManager().getLocale()
  const performanceObserver = env.__performanceObserver
  const platformContext = resolveFrontendResourcePlatformContext(
    env?.platformContext || env?.frontendResourceRenderContext
  )

  const finalEnv: FrontendAwareRenderOptions = {
    fetcher: async (api: any) => {
      let { url, method } = api
      const { data, responseType, config = {}, headers = {}, context = {} } = api
      method = method || config.method || 'get'
      config.method = method
      config.headers = config.headers = { ...(config.headers || {}), ...headers }
      if (responseType) config.responseType = responseType

      if (url && url.startsWith('internal://mapping')) {
        return {
          data: {
            code: 0,
            data: dataMapping(api.mapping || {}, context),
          },
        }
      }

      if (api.query?.op === 'loadOptions') {
        const keys = Object.keys(api.query).filter(
          (key) => key !== 'op' && key !== 'value'
        )
        const valueField =
          keys.filter((key) => api.query[key] === api.query.value)[0] || 'value'
        const params = keys.reduce((obj, key) => {
          if (key !== valueField) obj[key] = api.query[key]
          return obj
        }, {} as any)
        url =
          url.split('?')[0] +
          '?' +
          qsstringify({ ...params, [valueField]: api.query.value })
      }

      if (config.cancelExecutor) {
        config.cancelToken = new axios.CancelToken(config.cancelExecutor)
      }

      if (data && data instanceof FormData) {
        config.headers['Content-Type'] = 'multipart/form-data'
      } else {
        config.headers['Content-Type'] = 'application/json'
      }

      performanceObserver?.onFetcherEntered?.({ api, url, method })

      // @ts-ignore
      try {
        const response = await Client[method](url, data, config)
        performanceObserver?.onFetcherResolved?.({
          api,
          url,
          method,
          status: 'fulfilled',
        })
        return response
      } catch (error) {
        performanceObserver?.onFetcherResolved?.({
          api,
          url,
          method,
          status: 'rejected',
          error,
        })
        throw error
      }
    },
    isCancel: (value: any) => axios.isCancel(value),
    copy: (content: string) => {
      copy(content)
      toast.success(
        i18nService.getManager().tCommon('copy.success', '内容已复制到粘贴板')
      )
    },
    jumpTo: (to: string, action: any) => {
      if (action && action.actionType === 'url') {
        if (action.blank && action.blank === true) {
          window.open(to)
        } else {
          window.location.href = to
        }
        return
      }
      pushLocation(to)
    },
    updateLocation: (url: string) => {
      history.replaceState({}, '', url)
    },
    notify: (type: MessageType, msg: any, conf?: ToastConf) => {
      if (!msg) {
        return
      }
      if (type === 'error' && msg && msg.code && msg.code === -2) {
        return
      }

      const regex = /^(http:\/\/|\/api).*:\s(.*)$/
      if (regex.test(msg)) {
        const match = msg.match(regex)
        const computedMsg = match ? match[match.length - 1] : msg
        toast[type](computedMsg, conf)
        return
      }
      toast[type](msg, conf)
    },
    alert,
    confirm,
    enableAMISDebug:
      process.env.NODE_ENV === 'development' && process.env.PLAYWRIGHT_HARNESS !== 'true',
    ...(env || {}),
    platformContext,
    frontendResourceRenderContext: resolveFrontendResourceRenderContext(platformContext),
  }

  const finalProps = {
    ...props,
    locale: currentLocale,
  }

  return renderAmis(
    props.localeNamespace ? processAmisSchema(props.localeNamespace, schema) : schema,
    finalProps,
    finalEnv
  )
}

export async function renderAmisSchema(
  containerEl: Element,
  schema: Schema,
  amisProps: Record<string, any> = {},
  amisEnv: Record<string, any> = {}
) {
  return new Promise((resolve) => {
    let root: Root | null = createRoot(containerEl)
    let scopeRef: any = null
    let currentSchema = schema
    let currentAmisProps = amisProps
    let currentAmisEnv = amisEnv
    const currentRoute = readCurrentRoute()
    const params = currentRoute.params || {}
    const query = currentRoute.query || {}
    let settled = false

    const renderHandle = {
      getScopeRef: () => scopeRef,
      destroy: () => {
        root?.unmount()
        root = null
        scopeRef = null
      },
      update: async (
        nextSchema: Schema = currentSchema,
        nextAmisProps: Record<string, any> = currentAmisProps,
        nextAmisEnv: Record<string, any> = currentAmisEnv
      ) => {
        currentSchema = nextSchema
        currentAmisProps = nextAmisProps
        currentAmisEnv = nextAmisEnv
        await renderOnce(nextSchema, nextAmisProps, nextAmisEnv)
      },
    }

    const renderOnce = (
      nextSchema: Schema,
      nextAmisProps: Record<string, any>,
      nextAmisEnv: Record<string, any>
    ) =>
      new Promise<void>((done) => {
        const performanceObserver = nextAmisEnv?.__performanceObserver
        const finalProps = {
          ...(nextAmisProps || {}),
          scopeRef: (ref: any) => {
            scopeRef = ref
            if (!settled) {
              settled = true
              resolve(renderHandle)
            }
            nextAmisProps?.scopeRef?.(ref)
            done()
          },
        }

        const amisElement = (
          <AmisComponent
            amisSchema={nextSchema}
            amisProps={finalProps}
            amisEnv={nextAmisEnv}
            params={params}
            query={query}
          />
        )

        root?.render(
          performanceObserver?.onCommit ? (
            <Profiler
              id="renderAmisSchema"
              onRender={(
                id,
                phase,
                actualDuration,
                baseDuration,
                startTime,
                commitTime
              ) => {
                performanceObserver.onCommit?.({
                  id,
                  phase,
                  actualDuration,
                  baseDuration,
                  startTime,
                  commitTime,
                })
              }}
            >
              {amisElement}
            </Profiler>
          ) : (
            amisElement
          )
        )
      })

    void renderOnce(schema, amisProps, amisEnv)
  })
}

function AmisComponentView({
  amisSchema,
  amisProps = {},
  amisEnv = {},
  params = {},
  query = {},
  className,
  id,
  style,
  tabId,
}: AmisComponentProps) {
  const locale = useI18n().getLocale()
  useHostSnapshot({
    router: false,
    shouldNotifyStore: (mutation) => shouldNotifyAmisComponent(mutation, tabId),
  })
  const sessionRef = useRef(`session-${Date.now()}`)
  const userState = store.state.user || {}
  const appState = store.state.app || {}
  const currentUser = userState.userInfo || {}
  const authorities = userState.authorities || {}
  const activeTabId = tabId || store.getters.activeTabId
  const config = appState.config || {}
  const { disableFeedbackSurface = false, ...runtimeAmisProps } = amisProps || {}

  const renderPayload = useMemo(() => {
    const SystemContext = {
      activeTabId,
      config,
      authorities,
      user: currentUser.user,
      employee: currentUser.employee,
      person: currentUser.employee,
      company: currentUser.organization,
      organization: currentUser.organization,
      department: currentUser.department,
    }

    const SystemContextMethods = {
      hasAuth: store.getters['user/hasAuth'],
      hasRole: store.getters['user/hasRole'],
      getAccessToken: () => store.getters.accessToken.token,
    }

    const dataChain = extractObjectChain(amisProps.data || {})
    const rootData = {
      ...query,
      ...params,
      pathVariables: params,
      params,
      query,
      queryParams: query,
      SystemConfig: config,
      SystemContext,
    }
    dataChain.unshift(rootData)

    return {
      props: {
        locale: 'zh-CN',
        ...runtimeAmisProps,
        data: createObjectFromChain(dataChain),
        SystemContext: {
          ...SystemContext,
          ...SystemContextMethods,
        },
        SystemConfig: config,
      },
      env: {
        session: sessionRef.current,
        rootData: {
          ...rootData,
          SystemContext: {
            ...SystemContext,
            ...SystemContextMethods,
          },
        },
        ...amisEnv,
        platformContext: resolvePlatformContext(amisEnv.platformContext, {
          frontendResourceRenderContext: amisEnv.frontendResourceRenderContext,
        }),
        frontendResourceRenderContext: resolveFrontendResourceRenderContext(
          amisEnv.platformContext || amisEnv.frontendResourceRenderContext
        ),
      },
    }
  }, [activeTabId, amisEnv, authorities, config, currentUser, params, query, runtimeAmisProps])

  const amisElement = useMemo(() => {
    return renderAmisSchemaToElement(
      cloneDeep(amisSchema),
      renderPayload.props,
      renderPayload.env
    )
  }, [amisSchema, renderPayload, locale])

  const containerStyle = {
    height: '100%',
    ...(style || {}),
  }

  return (
    <div className={className} id={id} style={containerStyle}>
      {amisElement}
      {!disableFeedbackSurface ? (
        <>
          <ToastComponent locale={locale} />
          <AlertComponent locale={locale} />
        </>
      ) : null}
    </div>
  )
}

const AmisComponent = memo(AmisComponentView)

export default AmisComponent
