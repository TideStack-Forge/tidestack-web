import { addSchemaFilter } from 'amis'
import type { Schema } from 'amis'

const TABLE_STATIC_COLUMN_TYPES = new Set(['static-text', 'static'])

type SchemaWithColumns = Schema & {
  columns?: Array<Record<string, any>>
  mode?: unknown
}

export function normalizeTableStaticColumnTypes(schema: Schema): Schema {
  const tableSchema = schema as SchemaWithColumns

  if (!isTableColumnSchema(tableSchema) || !Array.isArray(tableSchema.columns)) {
    return schema
  }

  let changed = false
  const columns = tableSchema.columns.map((column) => {
    if (!column || !TABLE_STATIC_COLUMN_TYPES.has(column.type)) {
      return column
    }

    const nextColumn = { ...column }
    delete nextColumn.type
    changed = true
    return nextColumn
  })

  return changed
    ? ({
        ...tableSchema,
        columns,
      } as Schema)
    : schema
}

function isTableColumnSchema(schema: SchemaWithColumns) {
  return (
    schema.type === 'table' ||
    schema.type === 'table2' ||
    (schema.type === 'crud' && (schema.mode === undefined || schema.mode === 'table'))
  )
}

addSchemaFilter((schema: Schema) => normalizeTableStaticColumnTypes(schema))
