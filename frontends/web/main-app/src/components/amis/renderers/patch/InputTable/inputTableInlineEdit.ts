import {
  isInputTableOverlayMode,
  normalizeInputTableEditMode,
  type InputTableEditMode,
  type InputTableOverlayAction,
} from './inputTableOverlay'

export type InputTableActionEditBehavior =
  'auto-inline' | 'inline-confirm' | 'overlay' | 'native-immediate'

export interface ResolveInputTableActionEditBehaviorOptions {
  action: InputTableOverlayAction
  mode?: InputTableEditMode
  addApi?: unknown
  updateApi?: unknown
  needConfirm?: boolean
}

export interface BuildInputTableCandidateItemsOptions {
  items: any[]
  indexes: number[]
  item: Record<string, any>
  placeholderKey: string
}

export interface ValidateInputTableCandidateItemsOptions {
  items: any[]
  item?: Record<string, any>
  columns?: any[]
  minLength?: number
  maxLength?: number
  translate?: (key: string, data?: Record<string, unknown>) => string
}

export function getInputTableRowRefValues(refs: Record<string, any>, editIndex: string) {
  const entries = Object.keys(refs || {})
    .map((key) => ({
      rowIndex: key.slice(key.indexOf('-') + 1),
      value: refs[key],
    }))
    .filter((entry) => entry.value)
  const exactEntries = entries.filter((entry) => entry.rowIndex === editIndex)

  if (exactEntries.length) {
    return exactEntries.map((entry) => entry.value)
  }

  const fallbackRowIndex = editIndex.split('.').slice(-1)[0]
  return entries
    .filter((entry) => entry.rowIndex === fallbackRowIndex)
    .map((entry) => entry.value)
}

export function hasInputTableActionApiConfig(api: unknown) {
  return api !== undefined && api !== null && api !== false && api !== ''
}

export function resolveInputTableActionEditBehavior(
  options: ResolveInputTableActionEditBehaviorOptions
): InputTableActionEditBehavior {
  const mode = normalizeInputTableEditMode(options.mode)
  const hasActionApi = hasInputTableActionApiConfig(
    options.action === 'add' ? options.addApi : options.updateApi
  )

  if (isInputTableOverlayMode(mode)) {
    return 'overlay'
  }

  if (hasActionApi || options.needConfirm === true) {
    return 'inline-confirm'
  }

  if (options.action === 'add') {
    return 'auto-inline'
  }

  return 'native-immediate'
}

function getInputTableFieldValue(item: any, name: string) {
  return name
    .split('.')
    .reduce((value, key) => (value == null ? value : value[key]), item)
}

function isInputTableEmptyValue(value: any) {
  return (
    value === undefined ||
    value === null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  )
}

function getInputTableQuickEditValidation(column: any) {
  if (!column?.name || column.type === 'operation' || column.quickEdit === false) {
    return undefined
  }

  const quickEdit =
    column.quickEdit && typeof column.quickEdit === 'object' ? column.quickEdit : {}

  return {
    name: column.name,
    required: quickEdit.required === true || column.required === true,
    min:
      typeof quickEdit.min === 'number'
        ? quickEdit.min
        : typeof column.min === 'number'
          ? column.min
          : undefined,
    max:
      typeof quickEdit.max === 'number'
        ? quickEdit.max
        : typeof column.max === 'number'
          ? column.max
          : undefined,
  }
}

function isInputTableRowValidForQuickEditColumns(item: any, columns?: any[]) {
  if (!Array.isArray(columns)) {
    return true
  }

  return columns.every((column) => {
    const validation = getInputTableQuickEditValidation(column)

    if (!validation) {
      return true
    }

    const value = getInputTableFieldValue(item, validation.name)

    if (validation.required && isInputTableEmptyValue(value)) {
      return false
    }

    if (isInputTableEmptyValue(value)) {
      return true
    }

    const numericValue = Number(value)

    if (
      validation.min !== undefined &&
      (!Number.isFinite(numericValue) || numericValue < validation.min)
    ) {
      return false
    }

    if (
      validation.max !== undefined &&
      (!Number.isFinite(numericValue) || numericValue > validation.max)
    ) {
      return false
    }

    return true
  })
}

export function getInputTableTreeItem(items: any[], indexes: number[]) {
  return indexes.reduce((host, index, position) => {
    if (!Array.isArray(host)) {
      return undefined
    }

    const item = host[index]
    return position === indexes.length - 1 ? item : item?.children
  }, items as any)
}

export function spliceInputTableTree(
  items: any[],
  indexes: number[],
  deleteCount: number,
  item?: Record<string, any>
) {
  const nextItems = items.concat()
  let host = nextItems

  indexes.slice(0, -1).forEach((index) => {
    const node = host[index]
    const nextNode = {
      ...(node || {}),
      children: Array.isArray(node?.children) ? node.children.concat() : [],
    }
    host[index] = nextNode
    host = nextNode.children
  })

  const lastIndex = indexes[indexes.length - 1]

  if (item === undefined) {
    host.splice(lastIndex, deleteCount)
  } else {
    host.splice(lastIndex, deleteCount, item)
  }

  return nextItems
}

export function buildInputTableCandidateItems(
  options: BuildInputTableCandidateItemsOptions
) {
  const nextItem = { ...(options.item || {}) }
  Reflect.deleteProperty(nextItem, options.placeholderKey)

  return {
    item: nextItem,
    items: spliceInputTableTree(options.items, options.indexes, 1, nextItem),
  }
}

export function validateInputTableCandidateItems(
  options: ValidateInputTableCandidateItemsOptions
) {
  const __ = options.translate || ((key: string) => key)
  const minLength = options.minLength || 0
  const maxLength = typeof options.maxLength === 'number' ? options.maxLength : Infinity

  if (minLength && (!Array.isArray(options.items) || options.items.length < minLength)) {
    return __('Combo.minLength', { minLength })
  }

  if (
    maxLength &&
    Number.isFinite(maxLength) &&
    Array.isArray(options.items) &&
    options.items.length > maxLength
  ) {
    return __('Combo.maxLength', { maxLength })
  }

  const fieldValidationItems = options.item
    ? [options.item]
    : Array.isArray(options.items)
      ? options.items
      : []

  if (
    fieldValidationItems.some(
      (item) => !isInputTableRowValidForQuickEditColumns(item, options.columns)
    )
  ) {
    return __('Form.validateFailed')
  }

  let uniqueColumn = ''
  const hasDuplicatedUniqueValue =
    Array.isArray(options.columns) &&
    Array.isArray(options.items) &&
    options.columns.some((column) => {
      if (!column?.unique || !column.name) {
        return false
      }

      const exists: any[] = []

      return options.items.some((item) => {
        const value = getInputTableFieldValue(item, column.name)

        if (exists.includes(value)) {
          uniqueColumn = `${column.label || column.name}`
          return true
        }

        exists.push(value)
        return false
      })
    })

  return hasDuplicatedUniqueValue
    ? __('InputTable.uniqueError', { label: uniqueColumn })
    : ''
}
