export type CrudFilterSchema = Record<string, any>

export const CRUD_FILTER_SINGLE_SPAN_TYPES = [
  'input-text',
  'select',
  'data-dict-picker',
  'radios',
  'input-date',
]

export const CRUD_FILTER_WIDE_CANDIDATE_TYPES = [
  'input-date-range',
  'input-datetime-range',
]

export const CRUD_FILTER_GRID_ITEM_CLASS = 'crud-filter-item'
export const CRUD_FILTER_GRID_FIELD_CLASS = 'crud-filter-item--field'
export const CRUD_FILTER_GRID_FIRST_COMPACT_CLASS = 'crud-filter-item--first-compact'
export const CRUD_FILTER_GRID_LAST_WIDE_CLASS = 'crud-filter-item--last-wide'
export const CRUD_FILTER_GRID_WIDE_CANDIDATE_CLASS = 'crud-filter-item--wide-candidate'
export const CRUD_FILTER_GRID_WIDE_HEAD_ITEM_CLASS = 'crud-filter-item--wide-head'
export const CRUD_FILTER_WIDE_TOOLTIP_CLASS = 'crud-filter-wide-tooltip'
export const CRUD_FILTER_WIDE_TOOLTIP_AUTO_WIDTH_CLASS =
  'crud-filter-wide-tooltip--auto-width'
export const CRUD_FILTER_CONTROL_FILL_WIDTH_CLASS = 'crud-filter-control--fill-width'
export const CRUD_FILTER_MOBILE_STACKED_FORM_CLASS =
  'crud-filter-form--mobile-stacked'
export const CRUD_FILTER_MOBILE_STACKED_FIELD_CLASS =
  'crud-filter-item--mobile-stacked'
export const CRUD_FILTER_MOBILE_STACKED_TOOLBAR_CLASS =
  'crud-filter-toolbar--mobile-stacked'
export const CRUD_FILTER_GRID_TOOLBAR_CLASS = 'crud-filter-item--toolbar'
export const CRUD_FILTER_TOOLBAR_ITEM_CLASS = 'crud-filter-toolbar-item'
export const CRUD_FILTER_GRID_DIVIDER_CLASS = 'crud-filter-item--divider'
export const CRUD_FILTER_GRID_SPAN_CLASS_PREFIX = 'crud-filter-item--span-'
export const CRUD_FILTER_GRID_FULL_WIDTH_CLASS = 'crud-filter-item--span-full'
export const CRUD_FILTER_GRID_INDEX_CLASS_PREFIX = 'crud-filter-item--index-'
export const CRUD_FILTER_LAYOUT_TOPOLOGY_CLASS_PREFIX = 'crud-filter-layout-topology--'
export const CRUD_FILTER_LAYOUT_WIDE_HEAD_CLASS = `${CRUD_FILTER_LAYOUT_TOPOLOGY_CLASS_PREFIX}wide-head`
export const CRUD_FILTER_LAYOUT_COMPACT_CLASS = `${CRUD_FILTER_LAYOUT_TOPOLOGY_CLASS_PREFIX}compact`
export const CRUD_FILTER_WIDE_HEAD_DIVIDER_CLASS = 'crud-filter-divider'
export const CRUD_FILTER_DESKTOP_WIDE_BREAKPOINT = 1760
export const CRUD_FILTER_MOBILE_BREAKPOINT = 768
export const CRUD_FILTER_DEFAULT_GAP_PX = 16
export const CRUD_FILTER_DATE_RANGE_MIN_WIDTH_CLASS_UNITS = 64
export const CRUD_FILTER_DATETIME_RANGE_MIN_WIDTH_CLASS_UNITS = 96
export const CRUD_FILTER_LAYOUT_INLINE_STATE = 'inline'
export const CRUD_FILTER_LAYOUT_RAIL_STATE = 'rail'
export const CRUD_FILTER_LAYOUT_STACKED_STATE = 'stacked'
export const CRUD_FILTER_FIELD_AFFORDANCE_PRESERVE = 'preserve'
export const CRUD_FILTER_FIELD_AFFORDANCE_COMPACT = 'compact'
export const CRUD_FILTER_LABEL_STYLE_LABEL = 'label'
export const CRUD_FILTER_LABEL_STYLE_PLACEHOLDER = 'placeholder'

export type CrudFilterLayoutState =
  | typeof CRUD_FILTER_LAYOUT_INLINE_STATE
  | typeof CRUD_FILTER_LAYOUT_RAIL_STATE
  | typeof CRUD_FILTER_LAYOUT_STACKED_STATE

export type CrudFilterLayoutModeCode =
  'C1P' | 'CMP' | 'C1E' | 'CME' | 'W1P' | 'WMP' | 'W1E' | 'WME'

export type CrudFilterFieldAffordanceMode =
  | typeof CRUD_FILTER_FIELD_AFFORDANCE_PRESERVE
  | typeof CRUD_FILTER_FIELD_AFFORDANCE_COMPACT

export type CrudFilterLabelStyle =
  typeof CRUD_FILTER_LABEL_STYLE_LABEL | typeof CRUD_FILTER_LABEL_STYLE_PLACEHOLDER

export type CrudFilterFieldsPerRowConfig = {
  desktop: number
  narrow: number
  mobile: number
}

export type CrudFilterFieldAffordanceOptions = {
  labelStyle?: CrudFilterLabelStyle
  fieldAffordance?: CrudFilterFieldAffordanceMode
  addInlineDefaultWidth?: boolean
  moveWidthClassToInput?: boolean
}

export type CrudFilterSmartLayoutOptions = {
  enabled: boolean
  labelStyle: CrudFilterLabelStyle
  fieldsPerRow: CrudFilterFieldsPerRowConfig
}

export type CrudFilterAnalyzedItem = {
  index: number
  span: number
  isToolbar: boolean
  isWideCandidate: boolean
  isWideHead: boolean
  isStructural: boolean
}

export type CrudFilterPackedRow = {
  items: CrudFilterAnalyzedItem[]
  span: number
}

export type CrudFilterLayoutContext = {
  columnCount: number
  analyzedItems: CrudFilterAnalyzedItem[]
  toolbarItem: CrudFilterAnalyzedItem | undefined
  fieldItems: CrudFilterAnalyzedItem[]
  compactItems: CrudFilterAnalyzedItem[]
  wideItems: CrudFilterAnalyzedItem[]
  hasRenderedWideHead: boolean
  slotWidth: number
  unsplitRows: CrudFilterPackedRow[]
  unsplitRowCount: number
  unsplitLastRow: CrudFilterPackedRow | undefined
  shouldSplitWideHead: boolean
  tailItems: CrudFilterAnalyzedItem[]
  inlineBudget: number
  tailRows: CrudFilterPackedRow[]
  tailRowCount: number
  tailLastRow: CrudFilterPackedRow | undefined
  tailResidualPx: number
  tailFits: boolean
  topology: 'C' | 'W'
  tailRowsCode: '1' | 'M'
  tailFitCode: 'P' | 'E'
}
