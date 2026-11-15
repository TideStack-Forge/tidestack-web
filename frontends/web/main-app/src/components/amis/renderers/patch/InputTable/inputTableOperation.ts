export type InputTableAddButtonPosition =
  | 'bottom-left'
  | 'bottom-right'
  | 'top-left'
  | 'top-right'

export type InputTableOperationButtonState = 'default' | 'adding' | 'editing'

export interface ResolveInputTableOperationButtonSchemasOptions {
  state: InputTableOperationButtonState
  operationButtons?: any[]
  addingOperationButtons?: any[]
  editingOperationButtons?: any[]
}

export const DEFAULT_INPUT_TABLE_ADD_BUTTON_POSITION: InputTableAddButtonPosition =
  'bottom-left'
export const INPUT_TABLE_TOP_ADD_ACTION_TYPE = '__ouroborosInputTableTopAdd'
export const INPUT_TABLE_OPERATION_CONTEXT_MARKER =
  '__ouroborosInputTableOperationContext'

const INPUT_TABLE_ADD_BUTTON_POSITIONS: InputTableAddButtonPosition[] = [
  'bottom-left',
  'bottom-right',
  'top-left',
  'top-right',
]

const INPUT_TABLE_OPERATION_ACTION_TYPES = [
  'add',
  'edit',
  'delete',
  'remove',
  'save',
  'confirm',
  'cancel',
  'copy',
  'sub-add',
  'subAdd',
] as const

export interface InputTableOperationActionAvailabilityOptions {
  actionType: unknown
  rowIndexPath?: string
  editIndex?: string
  needConfirm?: boolean
  isStatic?: boolean
  disabled?: boolean
  addable?: boolean
  childrenAddable?: boolean
  copyable?: boolean
  editable?: boolean
  removable?: boolean
  showTableAddBtn?: boolean
  showCopyBtn?: boolean
  canAdd?: boolean
  canRemove?: boolean
  isPlaceholder?: boolean
}

function isPlainObject(value: any) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function cloneButtonSchemas(buttons: any[]) {
  return buttons.map((button) => (isPlainObject(button) ? { ...button } : button))
}

export function normalizeInputTableAddButtonPosition(
  value: unknown
): InputTableAddButtonPosition {
  return INPUT_TABLE_ADD_BUTTON_POSITIONS.includes(
    value as InputTableAddButtonPosition
  )
    ? (value as InputTableAddButtonPosition)
    : DEFAULT_INPUT_TABLE_ADD_BUTTON_POSITION
}

export function isInputTableAddButtonTopPosition(
  position: InputTableAddButtonPosition
) {
  return position.startsWith('top-')
}

export function getInputTableAddButtonJustifyContent(
  position: InputTableAddButtonPosition
) {
  return position.endsWith('-right') ? 'flex-end' : 'flex-start'
}

export function resolveInputTableOperationButtonSchemas(
  options: ResolveInputTableOperationButtonSchemasOptions
) {
  const configured =
    options.state === 'adding'
      ? options.addingOperationButtons
      : options.state === 'editing'
        ? options.editingOperationButtons
        : options.operationButtons

  return Array.isArray(configured) ? cloneButtonSchemas(configured) : undefined
}

export function hasInputTableOperationButtonOverrides(options: {
  operationButtons?: any[]
  addingOperationButtons?: any[]
  editingOperationButtons?: any[]
}) {
  return (
    Array.isArray(options.operationButtons) ||
    Array.isArray(options.addingOperationButtons) ||
    Array.isArray(options.editingOperationButtons)
  )
}

export function normalizeInputTableOperationButtonSchema(button: any) {
  if (!isPlainObject(button) || button.type) {
    return button
  }

  const schema = {
    type: 'button',
    ...button,
  }

  if (button.actionType === 'sub-add') {
    schema.actionType = 'subAdd'
  }

  return schema
}

export function isInputTableOperationActionType(actionType: unknown) {
  return INPUT_TABLE_OPERATION_ACTION_TYPES.includes(
    actionType as (typeof INPUT_TABLE_OPERATION_ACTION_TYPES)[number]
  )
}

function isLockedByConfirmEdit(
  options: InputTableOperationActionAvailabilityOptions
) {
  return !!options.editIndex && options.needConfirm !== false
}

function hasMutableInputTableSurface(
  options: InputTableOperationActionAvailabilityOptions
) {
  return !options.isStatic && !options.disabled
}

export function canRunInputTableOperationAction(
  options: InputTableOperationActionAvailabilityOptions
) {
  const { actionType, rowIndexPath } = options

  if (!isInputTableOperationActionType(actionType)) {
    return false
  }

  if (!hasMutableInputTableSurface(options)) {
    return false
  }

  if (actionType === 'save' || actionType === 'confirm') {
    return !!rowIndexPath && options.editIndex === rowIndexPath
  }

  if (actionType === 'cancel') {
    return !!rowIndexPath && options.editIndex === rowIndexPath
  }

  if (!rowIndexPath || isLockedByConfirmEdit(options)) {
    return false
  }

  if (actionType === 'add') {
    return (
      options.addable === true &&
      options.showTableAddBtn !== false &&
      options.canAdd !== false
    )
  }

  if (actionType === 'sub-add' || actionType === 'subAdd') {
    return (
      options.childrenAddable === true &&
      options.showTableAddBtn !== false
    )
  }

  if (actionType === 'copy') {
    return options.copyable === true && options.showCopyBtn !== false
  }

  if (actionType === 'edit') {
    return options.editable === true && options.isPlaceholder !== true
  }

  if (actionType === 'delete' || actionType === 'remove') {
    return (
      options.removable === true &&
      options.canRemove !== false &&
      options.isPlaceholder !== true
    )
  }

  return false
}
