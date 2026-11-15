type AnyRecord = Record<string, any>

function normalizeDisplayType(projection: AnyRecord) {
  const displayType = projection?.displayType
  if (displayType === 'chart') {
    return projection?.displayConfig?.chartKind || 'line'
  }
  return displayType || 'table'
}

function fieldTitle(projection: AnyRecord, fieldName: string) {
  if (!fieldName) {
    return ''
  }
  const columns = Array.isArray(projection?.columns) ? projection.columns : []
  const matched = columns.find((column: AnyRecord) => column?.name === fieldName)
  return matched?.title || fieldName
}

function toNumber(value: any) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function getRows(projection: AnyRecord) {
  return Array.isArray(projection?.rows) ? projection.rows : []
}

function getDisplayConfig(projection: AnyRecord) {
  return projection?.displayConfig || {}
}

function limitRows(rows: AnyRecord[], limit?: any) {
  const parsed = Number(limit)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return rows
  }
  return rows.slice(0, parsed)
}

function groupByCategory(
  projection: AnyRecord,
  rows: AnyRecord[],
  categoryField: string,
  metricFields: string[],
  seriesField?: string
) {
  const categories: any[] = []
  const categorySet = new Set<any>()
  const seriesNames: string[] = []
  const seriesSet = new Set<string>()
  const seriesDataMap: Record<string, Record<string, number>> = {}
  const categoryMetricTotals: Record<string, Record<string, number>> = {}

  rows.forEach((row) => {
    const categoryValue = row?.[categoryField]
    if (!categorySet.has(categoryValue)) {
      categorySet.add(categoryValue)
      categories.push(categoryValue)
    }

    metricFields.forEach((metricField) => {
      const metricTitle = fieldTitle(projection, metricField)
      const seriesValue = seriesField ? row?.[seriesField] : null
      const numericValue = toNumber(row?.[metricField])
      const seriesName = seriesField
        ? metricFields.length > 1
          ? `${seriesValue || '-'} · ${metricTitle}`
          : String(seriesValue || '-')
        : metricTitle || metricField

      if (!seriesSet.has(seriesName)) {
        seriesSet.add(seriesName)
        seriesNames.push(seriesName)
      }

      if (!seriesDataMap[seriesName]) {
        seriesDataMap[seriesName] = {}
      }
      const currentValue = seriesDataMap[seriesName][String(categoryValue)] || 0
      seriesDataMap[seriesName][String(categoryValue)] = currentValue + numericValue

      if (!categoryMetricTotals[String(categoryValue)]) {
        categoryMetricTotals[String(categoryValue)] = {}
      }
      const currentMetricTotal = categoryMetricTotals[String(categoryValue)][metricField] || 0
      categoryMetricTotals[String(categoryValue)][metricField] = currentMetricTotal + numericValue
    })
  })

  return {
    categories,
    categoryMetricTotals,
    seriesNames,
    seriesDataMap,
  }
}

function orderCategories(
  projection: AnyRecord,
  grouped: AnyRecord,
  categoryField: string,
  metricFields: string[],
  displayConfig: AnyRecord
) {
  const sortField = displayConfig.sortField || projection.timeField || categoryField
  const direction = String(displayConfig.sortOrder || 'asc').toLowerCase() === 'desc' ? -1 : 1
  const categories = [...grouped.categories]

  if (metricFields.includes(sortField)) {
    categories.sort((left, right) => {
      const leftValue = grouped.categoryMetricTotals?.[String(left)]?.[sortField] || 0
      const rightValue = grouped.categoryMetricTotals?.[String(right)]?.[sortField] || 0
      return (leftValue - rightValue) * direction
    })
  } else if (sortField === categoryField || sortField === projection.timeField) {
    categories.sort((left, right) => String(left).localeCompare(String(right)) * direction)
  }

  return limitRows(categories, displayConfig.limit)
}

function buildLegendConfig(displayConfig: AnyRecord) {
  const showLegend = displayConfig.showLegend !== false
  const legendPosition = displayConfig.legendPosition || 'top'
  const legend: AnyRecord = {
    show: showLegend,
  }
  if (!showLegend) {
    return legend
  }
  if (legendPosition === 'left' || legendPosition === 'right') {
    legend.orient = 'vertical'
    legend[legendPosition] = 0
    legend.top = 'middle'
    return legend
  }
  legend.orient = 'horizontal'
  legend.left = 'center'
  legend[legendPosition === 'bottom' ? 'bottom' : 'top'] = 0
  return legend
}

function buildChartTitle(displayConfig: AnyRecord) {
  if (!displayConfig.titleText) {
    return undefined
  }
  const title: AnyRecord = {
    text: displayConfig.titleText,
    left: displayConfig.titleAlign || 'left',
  }
  if (displayConfig.subtitleText) {
    title.subtext = displayConfig.subtitleText
  }
  return title
}

function buildCartesianChartSchema(projection: AnyRecord, chartKind: string) {
  const displayConfig = getDisplayConfig(projection)
  const metricFields = Array.isArray(projection?.metricFields) ? projection.metricFields : []
  const categoryField = projection?.timeField || projection?.dimensionFields?.[0]
  if (!categoryField || metricFields.length === 0) {
    return {
      type: 'alert',
      level: 'warning',
      body: '当前图表至少需要一个分类/时间字段和一个指标字段。',
    }
  }

  const grouped = groupByCategory(
    projection,
    getRows(projection),
    categoryField,
    metricFields,
    projection?.seriesField
  )
  const orderedCategories = orderCategories(
    projection,
    grouped,
    categoryField,
    metricFields,
    displayConfig
  )
  const effectiveChartType = chartKind === 'area' ? 'line' : chartKind
  const series = grouped.seriesNames.map((seriesName) => {
    const item: AnyRecord = {
      name: seriesName,
      type: effectiveChartType,
      data: orderedCategories.map((category) => grouped.seriesDataMap[seriesName]?.[String(category)] || 0),
      label: {
        show: displayConfig.showLabel === true,
      },
    }
    if (chartKind === 'line' || chartKind === 'area') {
      item.smooth = displayConfig.smooth === true
    }
    if (chartKind === 'area') {
      item.areaStyle = {}
    }
    if (displayConfig.stack === true) {
      item.stack = 'total'
    }
    return item
  })

  return {
    type: 'chart',
    config: {
      title: buildChartTitle(displayConfig),
      tooltip: {
        trigger: 'axis',
      },
      legend: buildLegendConfig(displayConfig),
      xAxis: {
        type: 'category',
        data: orderedCategories,
        name: displayConfig.xAxisName || fieldTitle(projection, categoryField),
        boundaryGap: chartKind === 'bar',
      },
      yAxis: {
        type: 'value',
        name: displayConfig.yAxisName || metricFields.map((field: string) => fieldTitle(projection, field)).join(' / '),
      },
      series,
    },
  }
}

function buildPieChartSchema(projection: AnyRecord) {
  const displayConfig = getDisplayConfig(projection)
  const metricField = projection?.metricFields?.[0]
  const categoryField = projection?.dimensionFields?.[0] || projection?.timeField
  if (!categoryField || !metricField) {
    return {
      type: 'alert',
      level: 'warning',
      body: '饼图至少需要一个维度字段和一个指标字段。',
    }
  }

  const values = new Map<string, number>()
  getRows(projection).forEach((row) => {
    const key = String(row?.[categoryField] ?? '-')
    values.set(key, (values.get(key) || 0) + toNumber(row?.[metricField]))
  })
  const entries = Array.from(values.entries())
  const direction = String(displayConfig.sortOrder || 'desc').toLowerCase() === 'desc' ? -1 : 1
  const sortField = displayConfig.sortField || metricField
  if (sortField === categoryField) {
    entries.sort((left, right) => String(left[0]).localeCompare(String(right[0])) * direction)
  } else {
    entries.sort((left, right) => (left[1] - right[1]) * direction)
  }
  const limitedEntries = limitRows(entries, displayConfig.limit)

  return {
    type: 'chart',
    config: {
      title: buildChartTitle(displayConfig),
      tooltip: {
        trigger: 'item',
      },
      legend: buildLegendConfig(displayConfig),
      series: [
        {
          type: 'pie',
          radius: displayConfig.radius || '60%',
          label: {
            show: displayConfig.showLabel !== false,
          },
          data: limitedEntries.map(([name, value]) => ({ name, value })),
        },
      ],
    },
  }
}

function buildScatterChartSchema(projection: AnyRecord) {
  const displayConfig = getDisplayConfig(projection)
  const metricFields = Array.isArray(projection?.metricFields) ? projection.metricFields : []
  if (metricFields.length < 2) {
    return {
      type: 'alert',
      level: 'warning',
      body: '散点图至少需要两个指标字段，分别作为 X 与 Y。',
    }
  }

  const xMetric = metricFields[0]
  const yMetric = metricFields[1]
  const grouped = new Map<string, AnyRecord[]>()
  const seriesField = projection?.seriesField
  getRows(projection).forEach((row) => {
    const key = seriesField ? String(row?.[seriesField] ?? '-') : fieldTitle(projection, yMetric)
    if (!grouped.has(key)) {
      grouped.set(key, [])
    }
    grouped.get(key)?.push(row)
  })

  return {
    type: 'chart',
    config: {
      title: buildChartTitle(displayConfig),
      tooltip: {
        trigger: 'item',
      },
      legend: buildLegendConfig(displayConfig),
      xAxis: {
        type: 'value',
        name: displayConfig.xAxisName || fieldTitle(projection, xMetric),
      },
      yAxis: {
        type: 'value',
        name: displayConfig.yAxisName || fieldTitle(projection, yMetric),
      },
      series: Array.from(grouped.entries()).map(([seriesName, rows]) => ({
        name: seriesName,
        type: 'scatter',
        label: {
          show: displayConfig.showLabel === true,
        },
        data: rows.map((row) => [toNumber(row?.[xMetric]), toNumber(row?.[yMetric])]),
      })),
    },
  }
}

function buildMetricCardSchema(projection: AnyRecord) {
  const cards = Array.isArray(projection?.cards) ? projection.cards : []
  return {
    type: 'grid',
    columns: cards.map((card: AnyRecord) => ({
      md: Math.max(4, Math.floor(12 / Math.max(1, cards.length))),
      body: [
        {
          type: 'panel',
          className: 'h-full',
          body: [
            {
              type: 'static',
              className: 'text-sm text-muted mb-1',
              label: false,
              value: card.title || card.field || '-',
            },
            {
              type: 'static',
              className: 'text-2xl font-bold',
              label: false,
              value: card.value ?? '-',
            },
          ],
        },
      ],
    })),
  }
}

function buildCrosstabSchema(projection: AnyRecord) {
  const rows = Array.isArray(projection?.rows) ? projection.rows : []
  const headers = Array.isArray(projection?.columnHeaders) ? projection.columnHeaders : []
  return {
    type: 'crud',
    syncLocation: false,
    headerToolbar: [],
    footerToolbar: [],
    columns: [
      {
        name: 'rowHeader',
        label: fieldTitle(projection, projection?.rowDimensionField) || '行维度',
      },
      ...headers.map((header, index) => ({
        name: `cells.${index}`,
        label: String(header),
      })),
    ],
    data: rows,
  }
}

export function buildReportDataTableSchema(projection: AnyRecord) {
  if (normalizeDisplayType(projection) === 'crosstab') {
    return buildCrosstabSchema(projection)
  }

  const selectedFields = [
    ...(Array.isArray(projection?.dimensionFields) ? projection.dimensionFields : []),
    ...(Array.isArray(projection?.metricFields) ? projection.metricFields : []),
    ...(projection?.timeField ? [projection.timeField] : []),
    ...(projection?.seriesField ? [projection.seriesField] : []),
  ]
  const uniqueFields = Array.from(new Set(selectedFields)).filter(Boolean)
  const columnsSource = Array.isArray(projection?.columns) ? projection.columns : []
  const columns = (uniqueFields.length > 0 ? uniqueFields : columnsSource.map((column: AnyRecord) => column?.name)).map((fieldName) => {
    const matched = columnsSource.find((column: AnyRecord) => column?.name === fieldName)
    return {
      name: fieldName,
      label: matched?.title || fieldName,
    }
  })
  return {
    type: 'table',
    columns,
    data: getRows(projection),
  }
}

export function buildReportVisualizationSchema(projection: AnyRecord) {
  const displayType = normalizeDisplayType(projection)
  if (displayType === 'metric-card') {
    return buildMetricCardSchema(projection)
  }
  if (displayType === 'crosstab') {
    return buildCrosstabSchema(projection)
  }
  if (displayType === 'pie') {
    return buildPieChartSchema(projection)
  }
  if (displayType === 'scatter') {
    return buildScatterChartSchema(projection)
  }
  if (displayType === 'table') {
    return buildReportDataTableSchema(projection)
  }
  return buildCartesianChartSchema(projection, displayType)
}
