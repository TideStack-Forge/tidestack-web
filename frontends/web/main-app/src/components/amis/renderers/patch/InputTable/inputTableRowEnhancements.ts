export type RowAggregateConfig = {
  valueField: string
  keyPaths: string[]
  sourcesPaths: string[]
  keyProps?: string[]
}

export type ArrowRowNavigationConfig = {
  columns?: string[]
}

const DEFAULT_AGGREGATE_KEY_PROPS = ['itemNo', 'value', 'id', 'no', 'code']

function toAggregateKey(value: any, keyProps: string[]): string {
  if (value && typeof value === 'object') {
    for (const prop of keyProps) {
      const nested = value[prop]

      if (nested == null || nested === value) {
        continue
      }

      const key = toAggregateKey(nested, keyProps)

      if (key) {
        return key
      }
    }

    return ''
  }

  return value == null ? '' : String(value)
}

function readByPath(row: any, path: string): any {
  return path
    .split('.')
    .reduce((host, segment) => (host == null ? host : host[segment]), row)
}

function readFirstByPaths(row: any, paths: string[]): any {
  for (const path of paths) {
    const value = readByPath(row, path)

    if (value != null && value !== '') {
      return value
    }
  }

  return undefined
}

export function computeRowAggregates(items: any[], config: RowAggregateConfig): any[] {
  if (!Array.isArray(items) || !items.length) {
    return items
  }

  const keyProps = config.keyProps?.length ? config.keyProps : DEFAULT_AGGREGATE_KEY_PROPS
  const rowKey = (row: any) =>
    toAggregateKey(readFirstByPaths(row, config.keyPaths), keyProps)
  const rowsByKey: Record<string, any> = {}

  items.forEach((item) => {
    const key = rowKey(item)

    if (key && !(key in rowsByKey)) {
      rowsByKey[key] = item
    }
  })

  let changed = false
  const next = items.map((item) => {
    const selfKey = rowKey(item)
    const sources = readFirstByPaths(item, config.sourcesPaths)
    const sourceKeys = (
      Array.isArray(sources)
        ? sources.map((source) => toAggregateKey(source, keyProps))
        : String(sources ?? '')
            .split(',')
            .map((source) => source.trim())
    ).filter((key) => key && key !== selfKey)

    if (!sourceKeys.length) {
      return item
    }

    const total = sourceKeys.reduce((sum, key) => {
      const num = Number(rowsByKey[key]?.[config.valueField])
      return sum + (Number.isFinite(num) ? num : 0)
    }, 0)
    const value = String(total)

    if (String(item[config.valueField] ?? '') === value) {
      return item
    }

    changed = true
    return { ...item, [config.valueField]: value }
  })

  return changed ? next : items
}
