import React from 'react'
import { FormItem } from 'amis'

import StatisticsSqlEditor from './statistics-sql-editor/StatisticsSqlEditor'
import type { StatisticsSqlEditorProps } from './statistics-sql-editor/types'

type StatisticsQueryDefinitionEditorProps = StatisticsSqlEditorProps

function resolveKernelType(props: StatisticsQueryDefinitionEditorProps): string {
  const kernelType = props.data?.kernelType
  if (typeof kernelType === 'string' && kernelType.trim()) {
    return kernelType.trim().toLowerCase()
  }
  const queryDefinitionType = props.value?.type
  if (typeof queryDefinitionType === 'string' && queryDefinitionType.trim()) {
    return queryDefinitionType.trim().toLowerCase()
  }
  return 'sql'
}

function StatisticsQueryDefinitionEditor(props: StatisticsQueryDefinitionEditorProps) {
  const kernelType = resolveKernelType(props)
  const queryDefinition = props.value || {}

  if (kernelType === 'sql') {
    return <StatisticsSqlEditor {...props} value={queryDefinition} />
  }

  return props.render('unsupported-query-editor', {
    type: 'alert',
    level: 'warning',
    body: `未安装 ${kernelType} 查询编辑器`,
  })
}

FormItem({
  type: 'statistics-query-definition-editor',
  autoVar: true,
})(StatisticsQueryDefinitionEditor as any)

export default StatisticsQueryDefinitionEditor
