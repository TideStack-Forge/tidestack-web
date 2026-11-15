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
    datasourceName: 'reporting-main',
    datasourceTags: ['warehouse', 'analytics'],
    genericSql:
      'select order_date, region_code, sum(total_amount) as total_amount\n' +
      'from sales_order_fact\n' +
      'where order_date >= :startDate\n' +
      'group by order_date, region_code',
    variants: [
      {
        variantName: 'mysql-reporting',
        dialect: 'mysql',
        dialectVersionRange: '8.x',
        datasourceTags: ['warehouse'],
        priority: 100,
        sqlText:
          'select date(order_time) as order_date, region_code, sum(total_amount) as total_amount\n' +
          'from sales_order_fact\n' +
          'where order_time >= :startDate\n' +
          'group by date(order_time), region_code',
      },
      {
        variantName: 'postgres-warehouse',
        dialect: 'postgresql',
        dialectVersionRange: '14-16',
        datasourceTags: ['analytics'],
        priority: 90,
        sqlText:
          'select order_date::date as order_date, region_code, sum(total_amount) as total_amount\n' +
          'from sales_order_fact\n' +
          'where order_date >= :startDate\n' +
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
          type: 'statistics-sql-editor',
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
  background:
    'radial-gradient(circle at top left, rgba(20, 184, 166, 0.12), transparent 28%), radial-gradient(circle at top right, rgba(59, 130, 246, 0.12), transparent 24%), linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)',
} as const
const headerStyle = { maxWidth: '1120px', margin: '0 auto 20px' } as const
const eyebrowStyle = {
  margin: '0 0 8px',
  fontSize: '12px',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: '#0f766e',
  fontWeight: 700,
} as const
const titleStyle = { margin: 0, fontSize: '34px', lineHeight: 1.1, color: '#0f172a' } as const
const descriptionStyle = {
  margin: '12px 0 0',
  maxWidth: '780px',
  color: '#475569',
  fontSize: '15px',
  lineHeight: 1.7,
} as const
const badgeListStyle = { display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '18px' } as const
const badgeStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '8px 12px',
  borderRadius: '999px',
  background: 'rgba(255, 255, 255, 0.86)',
  border: '1px solid rgba(14, 116, 144, 0.12)',
  color: '#0f172a',
  fontSize: '13px',
  fontWeight: 600,
} as const
const surfaceStyle = {
  maxWidth: '1120px',
  margin: '0 auto',
  padding: '24px',
  borderRadius: '24px',
  background: 'rgba(255, 255, 255, 0.82)',
  boxShadow: '0 24px 48px rgba(15, 23, 42, 0.08)',
  border: '1px solid rgba(148, 163, 184, 0.18)',
} as const

export function StatisticsSqlEditorPage() {
  useEffect(() => {
    const debugState = {
      genericSqlEditor: null as any,
    }

    ;(window as any).__STATISTICS_SQL_EDITOR_PLAYGROUND__ = {
      ready: false,
      setGenericSqlValue(value: string) {
        debugState.genericSqlEditor?.setValue?.(value)
        debugState.genericSqlEditor?.focus?.()
      },
      publishSavedEvent() {
        EventBus.publish('statisticsReporting.datasetStudio.saved', {
          datasetName: dataset.name,
        })
      },
    }
    ;(window as any).__OUROBOROS_SCRIPT_EDITOR_DEBUG__ = {
      onMounted: ({ editor, props }: any) => {
        if (props?.name !== 'statisticsSqlEditorGenericSql') {
          return
        }
        debugState.genericSqlEditor = editor
        ;(window as any).__STATISTICS_SQL_EDITOR_PLAYGROUND__.ready = true
      },
    }

    return () => {
      delete (window as any).__OUROBOROS_SCRIPT_EDITOR_DEBUG__
      delete (window as any).__STATISTICS_SQL_EDITOR_PLAYGROUND__
    }
  }, [])

  return (
    <section style={pageStyle} data-testid="statistics-sql-editor-page">
      <header style={headerStyle}>
        <p style={eyebrowStyle}>Debug Route</p>
        <h1 style={titleStyle}>Statistics SQL Editor Playground</h1>
        <p style={descriptionStyle}>
          Dedicated SQL Dataset authoring slot for datasource selection, generic SQL, and
          dialect-aware variants.
        </p>
        <div style={badgeListStyle}>
          <span style={badgeStyle}>Datasources {datasourceOptions.length}</span>
          <span style={badgeStyle}>Parameters {dataset.parameters.length}</span>
          <span style={badgeStyle}>Variants {dataset.queryDefinition.variants.length}</span>
        </div>
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
