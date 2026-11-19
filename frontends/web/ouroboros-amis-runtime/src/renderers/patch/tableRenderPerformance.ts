export const TABLE_HYDRATION_LOCAL_WORK_UNITS_PER_MS = 1.2
export const TABLE_SYNC_RENDER_LOCAL_WORK_UNITS_PER_MS = 1
export const TABLE_RENDER_PERFORMANCE_SAFETY_FACTOR = 3
export const DEFAULT_COOPERATIVE_LOADING_MAX_DURATION_MS = 2000
export const TABLE_HYDRATION_EFFECTIVE_WORK_UNITS_PER_MS =
  TABLE_HYDRATION_LOCAL_WORK_UNITS_PER_MS / TABLE_RENDER_PERFORMANCE_SAFETY_FACTOR
export const TABLE_SYNC_RENDER_EFFECTIVE_WORK_UNITS_PER_MS =
  TABLE_SYNC_RENDER_LOCAL_WORK_UNITS_PER_MS / TABLE_RENDER_PERFORMANCE_SAFETY_FACTOR
export const INFERRED_LAZY_RENDER_SYNC_BUDGET_MS = 500
export const AMIS_TABLE_TEXT_COLUMN_RENDER_WEIGHT = 1
export const AMIS_TABLE_CONTROL_COLUMN_RENDER_WEIGHT = 2.5
const MIN_TABLE_RENDER_WORK_UNIT_BUDGET = 1
const CONTROL_RENDERER_TYPES = new Set([
  'checkbox',
  'checkboxes',
  'combo',
  'input-array',
  'input-city',
  'input-color',
  'input-date',
  'input-datetime',
  'input-email',
  'input-file',
  'input-group',
  'input-image',
  'input-kv',
  'input-month',
  'input-month-range',
  'input-number',
  'input-password',
  'input-quarter',
  'input-quarter-range',
  'input-range',
  'input-rating',
  'input-rich-text',
  'input-tag',
  'input-table',
  'input-text',
  'input-time',
  'input-tree',
  'input-url',
  'input-year',
  'input-year-range',
  'list-select',
  'matrix-checkboxes',
  'nested-select',
  'picker',
  'radios',
  'select',
  'switch',
  'textarea',
  'tree-select',
])

type TableRenderColumn = {
  fixed?: unknown
  quickEdit?: unknown
  type?: unknown
}

function isControlRendererType(type: unknown) {
  return (
    typeof type === 'string' &&
    (type.startsWith('input-') || CONTROL_RENDERER_TYPES.has(type))
  )
}

function isControlColumn(column: TableRenderColumn) {
  const quickEdit = column.quickEdit

  return (
    (quickEdit !== false && Boolean(quickEdit)) ||
    isControlRendererType(column.type) ||
    (typeof quickEdit === 'object' &&
      quickEdit !== null &&
      isControlRendererType((quickEdit as TableRenderColumn).type))
  )
}

export function calculateTableRenderColumnWeight(column: TableRenderColumn) {
  return isControlColumn(column)
    ? AMIS_TABLE_CONTROL_COLUMN_RENDER_WEIGHT
    : AMIS_TABLE_TEXT_COLUMN_RENDER_WEIGHT
}

export function calculateTableRenderColumnCost(columns: TableRenderColumn[]) {
  if (!columns.length) {
    return AMIS_TABLE_TEXT_COLUMN_RENDER_WEIGHT
  }

  return columns.reduce(
    (sum, column) => sum + calculateTableRenderColumnWeight(column),
    0
  )
}

export function calculateTableRenderWorkUnitBudget(
  budgetMs = INFERRED_LAZY_RENDER_SYNC_BUDGET_MS
) {
  return Math.max(
    MIN_TABLE_RENDER_WORK_UNIT_BUDGET,
    Math.floor(TABLE_SYNC_RENDER_EFFECTIVE_WORK_UNITS_PER_MS * budgetMs)
  )
}

export const INFERRED_LAZY_RENDER_WORK_UNIT_BUDGET = calculateTableRenderWorkUnitBudget()
