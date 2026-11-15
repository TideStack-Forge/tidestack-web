import { useEffect, useState } from 'react'
import AmisComponent from '@/components/amis/AmisComponent'
import { readCurrentRoute } from '@/router/routerFacade'
import { buildReportVisualizationSchema } from '@/components/amis/renderers/report-view-runtime'

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

function createDashboardWidgetSchema(widget: Record<string, any>, widgetData: Record<string, any>) {
  if (widget.type === 'query-view') {
    return {
      type: 'crud',
      syncLocation: false,
      columns: widgetData.columns ?? [],
      data: widgetData.rows ?? [],
    }
  }

  return buildReportVisualizationSchema(widgetData)
}

export function StatisticsRuntimeDashboardPage() {
  const { params } = readCurrentRoute()
  const { dashboardName } = params
  const [schema, setSchema] = useState<any>(LOADING_SCHEMA)

  useEffect(() => {
    if (!dashboardName) {
      setSchema(getErrorSchema('缺少 dashboardName 参数'))
      return
    }

    let cancelled = false

    const loadDashboard = async () => {
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

        const response = await fetch(new URL(`/api/runtime/statistics-reporting/dashboards/${dashboardName}`, apiHost).toString(), {
          method: 'GET',
          headers,
          credentials: 'include',
        })
        const payload = await response.json()
        if (!response.ok) {
          throw new Error(`dashboard request failed with HTTP ${response.status}`)
        }
        if (payload?.code !== undefined && payload.code !== 0) {
          throw new Error(payload.message ?? payload.msg ?? 'dashboard request failed')
        }

        const responseData = payload?.data ?? payload?.result ?? payload
        const dashboard = responseData?.dashboard ?? responseData
        const executionWidgets = Array.isArray(responseData?.widgets) ? responseData.widgets : []
        const widgets = executionWidgets.map((item: Record<string, any>) => {
          const widget = item.widget ?? item
          const widgetData = item.data ?? {}
          return {
            ...widget,
            widgetName: widget.widgetName ?? widget.type,
            config: {
              ...(widget.config ?? {}),
              viewName: widget.config?.viewName ?? widget.viewName,
            },
            schemaTpl: createDashboardWidgetSchema(widget, widgetData),
          }
        })

        if (!cancelled) {
          setSchema({
            type: 'page',
            title: `仪表盘: ${dashboardName}`,
            body: {
              type: 'dashboard',
              editable: false,
              value: {
                ...dashboard,
                widgets,
              },
            },
          })
        }
      } catch (error) {
        if (!cancelled) {
          setSchema(getErrorSchema(error instanceof Error ? error.message : String(error)))
        }
      }
    }

    void loadDashboard()
    return () => {
      cancelled = true
    }
  }, [dashboardName])

  return <AmisComponent amisSchema={schema} style={{ height: '100%' }} />
}
