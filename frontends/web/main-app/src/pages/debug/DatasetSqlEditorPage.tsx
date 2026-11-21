import { useEffect } from 'react'

import { EventBus } from '@/common/eventBus'
import AmisComponent from '@/components/amis/AmisComponent'

const datasourceOptions = [
  {
    label: 'reporting-main',
    value: 'reporting-main',
    platformDataSourceName: 'jdbc-reporting-main',
  },
  {
    label: 'warehouse-read',
    value: 'warehouse-read',
    platformDataSourceName: 'jdbc-warehouse-read',
  },
]

const dataset = {
  name: 'demo.sales',
  title: 'Sales Overview',
  parameters: [
    {
      name: 'startDate',
      title: 'Start Date',
      type: 'date',
      operator: '>=',
      required: true,
      multiValue: false,
      visibleInView: true,
    },
    {
      name: 'regionCodes',
      title: 'Region Codes',
      type: 'string',
      operator: 'in',
      required: false,
      multiValue: true,
      visibleInView: true,
    },
  ],
  queryDefinition: {
    type: 'sql',
    datasource: 'reporting-main',
    sql:
      'select order_date, region_code, sum(total_amount) as total_amount\n' +
      'from sales_order_fact\n' +
      'where order_date >= ${startDate}\n' +
      'group by order_date, region_code',
    dialects: [
      {
        dialectName: 'mysql',
        sql:
          'select date(order_time) as order_date, region_code, sum(total_amount) as total_amount\n' +
          'from sales_order_fact\n' +
          'where order_time >= ${startDate}\n' +
          'group by date(order_time), region_code',
      },
      {
        dialectName: 'postgresql',
        sql:
          'select order_date::date as order_date, region_code, sum(total_amount) as total_amount\n' +
          'from sales_order_fact\n' +
          'where order_date >= ${startDate}\n' +
          'group by order_date::date, region_code',
      },
    ],
  },
}

const amisSchema = {
  type: 'page',
  title: '',
  body: [
    {
      type: 'form',
      wrapWithPanel: false,
      title: '',
      mode: 'normal',
      body: [
        {
          type: 'dataset-sql-editor',
          name: 'dataset.queryDefinition',
          label: false,
          datasourceOptions: '${datasourceOptions}',
        },
      ],
    },
  ],
}

const pageStyle = {
  minHeight: '100vh',
  padding: '32px 24px 48px',
  background: '#f8fafc',
} as const
const headerStyle = { maxWidth: '1120px', margin: '0 auto 20px' } as const
const titleStyle = { margin: 0, fontSize: '24px', lineHeight: 1.2, color: '#0f172a' } as const
const descriptionStyle = {
  margin: '12px 0 0',
  maxWidth: '780px',
  color: '#475569',
  fontSize: '15px',
  lineHeight: 1.7,
} as const
const surfaceStyle = {
  maxWidth: '1120px',
  margin: '0 auto',
  padding: '24px',
  borderRadius: '8px',
  background: '#fff',
  border: '1px solid #e5e7eb',
} as const

export function DatasetSqlEditorPage() {
  useEffect(() => {
    const debugState = {
      sqlEditor: null as any,
    }

    ;(window as any).__DATASET_SQL_EDITOR_PLAYGROUND__ = {
      ready: false,
      setSqlValue(value: string) {
        debugState.sqlEditor?.setValue?.(value)
        debugState.sqlEditor?.focus?.()
      },
      publishSavedEvent() {
        EventBus.publish('statisticsReporting.datasetEditor.saved', {
          datasetName: dataset.name,
        })
      },
    }
    ;(window as any).__OUROBOROS_SCRIPT_EDITOR_DEBUG__ = {
      onMounted: ({ editor, props }: any) => {
        if (props?.name !== 'datasetSqlEditorSql') {
          return
        }
        debugState.sqlEditor = editor
        ;(window as any).__DATASET_SQL_EDITOR_PLAYGROUND__.ready = true
      },
    }

    return () => {
      delete (window as any).__OUROBOROS_SCRIPT_EDITOR_DEBUG__
      delete (window as any).__DATASET_SQL_EDITOR_PLAYGROUND__
    }
  }, [])

  return (
    <section style={pageStyle} data-testid="dataset-sql-editor-page">
      <header style={headerStyle}>
        <h1 style={titleStyle}>数据集 SQL 编辑器调试页</h1>
        <p style={descriptionStyle}>
          用于选择数据源、编写数据集 SQL 和配置方言覆盖。
        </p>
      </header>
      <div style={surfaceStyle}>
        <AmisComponent
          amisSchema={amisSchema}
          amisProps={{
            data: {
              dataset,
              datasourceOptions,
            },
          }}
        />
      </div>
    </section>
  )
}
