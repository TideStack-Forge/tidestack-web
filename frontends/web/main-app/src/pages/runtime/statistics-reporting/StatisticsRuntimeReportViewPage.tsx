import { useEffect, useState } from 'react'
import AmisComponent from '@/components/amis/AmisComponent'
import { readCurrentRoute } from '@/router/routerFacade'
import {
  buildReportDataTableSchema,
  buildReportVisualizationSchema,
} from '@/components/amis/renderers/report-view-runtime'

const LOADING_SCHEMA = {
  type: 'page',
  bodyClassName: 'flex justify-center items-center',
  body: {
    type: 'spinner',
    show: true,
    icon: 'fa fa-spinner',
    size: 'lg',
    tip: '加载中...',
  },
}

function getErrorSchema(message: string) {
  return {
    type: 'page',
    body: {
      type: 'alert',
      level: 'danger',
      showIcon: true,
      title: '加载失败',
      body: message,
    },
  }
}

export function StatisticsRuntimeReportViewPage() {
  const { params } = readCurrentRoute()
  const { viewName } = params
  const [schema, setSchema] = useState<any>(LOADING_SCHEMA)

  useEffect(() => {
    if (!viewName) {
      setSchema(getErrorSchema('缺少 viewName 参数'))
      return
    }

    let cancelled = false

    const loadReportView = async () => {
      try {
        const apiHost = window.sessionStorage.getItem('apiHost') ?? window.location.origin
        const storedToken = window.localStorage.getItem('Ouroboros_token') ?? window.sessionStorage.getItem('Ouroboros_token')
        let accessToken: string | null = null

        if (storedToken) {
          const tokenPayload = JSON.parse(storedToken)
          const tokenValue = tokenPayload?.accessToken ?? tokenPayload?.access_token
          if (typeof tokenValue === 'string') {
            accessToken = tokenValue
          } else if (tokenValue && typeof tokenValue === 'object') {
            accessToken = tokenValue.token ?? tokenValue.access_token ?? tokenValue.value ?? null
          }
        }

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        }
        if (accessToken) {
          headers.Authorization = `Bearer ${accessToken}`
        }

        const response = await fetch(new URL(`/api/runtime/statistics-reporting/report-views/${viewName}/execute`, apiHost).toString(), {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify({}),
        })
        const payload = await response.json()
        if (!response.ok) {
          throw new Error(`report view request failed with HTTP ${response.status}`)
        }
        if (payload?.code !== undefined && payload.code !== 0) {
          throw new Error(payload.message ?? payload.msg ?? 'report view request failed')
        }

        const result = payload?.data ?? payload?.result ?? payload
        const projection = result?.projection ?? {}

        if (!cancelled) {
          setSchema({
            type: 'page',
            title: `图表: ${viewName}`,
            toolbar: [
              {
                type: 'button',
                label: '导出数据',
                actionType: 'ajax',
                api: {
                  method: 'post',
                  url: `/api/runtime/statistics-reporting/report-views/${viewName}/export`,
                },
              },
            ],
            body: {
              type: 'tabs',
              tabs: [
                {
                  title: '图表',
                  body: buildReportVisualizationSchema(projection),
                },
                {
                  title: '数据',
                  body: buildReportDataTableSchema(projection),
                },
              ],
            },
          })
        }
      } catch (error) {
        if (!cancelled) {
          setSchema(getErrorSchema(error instanceof Error ? error.message : String(error)))
        }
      }
    }

    void loadReportView()
    return () => {
      cancelled = true
    }
  }, [viewName])

  return <AmisComponent amisSchema={schema} style={{ height: '100%' }} />
}
