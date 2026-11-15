import { useEffect, useState } from 'react'
import AmisComponent from '@/components/amis/AmisComponent'
import { readCurrentRoute } from '@/router/routerFacade'

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

export function StatisticsRuntimeQueryViewPage() {
  const { params } = readCurrentRoute()
  const { viewName } = params
  const [schema, setSchema] = useState<any>(LOADING_SCHEMA)

  useEffect(() => {
    if (!viewName) {
      setSchema(getErrorSchema('缺少 viewName 参数'))
      return
    }

    const queryViewSchema = {
      type: 'page',
      title: `查询视图: ${viewName}`,
      body: {
        type: 'service',
        api: `/api/runtime/statistics-reporting/query-views/${viewName}/execute`,
        body: [
          {
            type: 'form',
            title: '查询条件',
            mode: 'inline',
            wrapWithPanel: true,
            visibleOn: '${visibleParameters && visibleParameters.length > 0}',
            body: '${visibleParameters}',
            actions: [
              {
                type: 'submit',
                label: '查询',
                level: 'primary',
              },
              {
                type: 'reset',
                label: '重置',
              },
            ],
            onEvent: {
              submitSucc: {
                actions: [
                  {
                    actionType: 'reload',
                    componentId: 'query-result-table',
                  },
                ],
              },
            },
          },
          {
            type: 'crud',
            id: 'query-result-table',
            syncLocation: false,
            columns: '${columns}',
            data: '${rows}',
            headerToolbar: [
              'bulkActions',
              {
                type: 'export-excel',
                label: '导出',
                api: `/api/runtime/statistics-reporting/query-views/${viewName}/export`,
              },
            ],
          },
        ],
      },
    }

    setSchema(queryViewSchema)
  }, [viewName])

  return <AmisComponent amisSchema={schema} style={{ height: '100%' }} />
}
