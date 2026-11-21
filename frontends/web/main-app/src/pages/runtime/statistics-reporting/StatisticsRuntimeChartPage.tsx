import { useEffect, useState } from 'react'
import AmisComponent from '@/components/amis/AmisComponent'
import { readCurrentRoute } from '@/router/routerFacade'
import { buildChartVisualizationSchema } from 'ouroboros-amis-runtime/renderers/chart-runtime'

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

export function StatisticsRuntimeChartPage() {
  const { params } = readCurrentRoute()
  const { chartName } = params
  const [schema, setSchema] = useState<any>(LOADING_SCHEMA)

  useEffect(() => {
    if (!chartName) {
      setSchema(getErrorSchema('未指定要查看的图表'))
      return
    }

    let cancelled = false

    const loadChart = async () => {
      try {
        const apiHost = window.sessionStorage.getItem('apiHost') ?? window.location.origin
        const storedToken =
          window.localStorage.getItem('Ouroboros_token') ??
          window.sessionStorage.getItem('Ouroboros_token')
        let accessToken: string | null = null

        if (storedToken) {
          const tokenPayload = JSON.parse(storedToken)
          const tokenValue = tokenPayload?.accessToken ?? tokenPayload?.access_token
          if (typeof tokenValue === 'string') {
            accessToken = tokenValue
          } else if (tokenValue && typeof tokenValue === 'object') {
            accessToken =
              tokenValue.token ?? tokenValue.access_token ?? tokenValue.value ?? null
          }
        }

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        }
        if (accessToken) {
          headers.Authorization = `Bearer ${accessToken}`
        }

        const response = await fetch(
          new URL(
            `/api/runtime/statistics-reporting/charts/${chartName}/execute`,
            apiHost
          ).toString(),
          {
            method: 'POST',
            headers,
            credentials: 'include',
            body: JSON.stringify({}),
          }
        )
        const payload = await response.json()
        if (!response.ok) {
          throw new Error(`图表加载失败（HTTP ${response.status}）`)
        }
        if (payload?.code !== undefined && payload.code !== 0) {
          throw new Error(payload.message ?? payload.msg ?? '图表加载失败')
        }

        const result = payload?.data ?? payload?.result ?? payload

        if (!cancelled) {
          setSchema({
            type: 'page',
            title: `图表: ${chartName}`,
            toolbar: [
              {
                type: 'button',
                label: '导出数据',
                actionType: 'download',
                api: {
                  method: 'post',
                  url: `/api/runtime/statistics-reporting/charts/${chartName}/export?format=xlsx`,
                },
              },
            ],
            body: buildChartVisualizationSchema(result),
          })
        }
      } catch (error) {
        if (!cancelled) {
          setSchema(
            getErrorSchema(error instanceof Error ? error.message : String(error))
          )
        }
      }
    }

    void loadChart()
    return () => {
      cancelled = true
    }
  }, [chartName])

  return <AmisComponent amisSchema={schema} style={{ height: '100%' }} />
}
