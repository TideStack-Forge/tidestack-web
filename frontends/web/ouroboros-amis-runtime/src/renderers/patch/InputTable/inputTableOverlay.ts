export type InputTableEditMode = 'inline' | 'dialog' | 'drawer'

export type InputTableOverlayAction = 'add' | 'edit'

export type InputTableOverlayFormItemResolver = (column: any) => any

export interface InputTableOverlayFormItemsOptions {
  action: InputTableOverlayAction
  columns?: any[]
  addFormItems?: any[]
  editFormItems?: any[]
  columnToQuickEdit: InputTableOverlayFormItemResolver
}

const VALID_INPUT_TABLE_EDIT_MODES = [
  'inline',
  'dialog',
  'drawer',
] as const

function isPlainObject(value: any) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function cloneFormItems(items: any[]) {
  return items.map((item) => (isPlainObject(item) ? { ...item } : item))
}

function shouldUseConfiguredFormItems(items: any) {
  return Array.isArray(items)
}

function resolveDerivedFormItemLabel(baseFormItem: any, column: any, quickEdit: any) {
  if (isPlainObject(quickEdit) && quickEdit.label !== undefined) {
    return quickEdit.label
  }

  if (baseFormItem.label !== undefined && baseFormItem.label !== '') {
    return baseFormItem.label
  }

  return column.label ?? ''
}

export function normalizeInputTableEditMode(value: unknown): InputTableEditMode {
  return VALID_INPUT_TABLE_EDIT_MODES.includes(value as InputTableEditMode)
    ? (value as InputTableEditMode)
    : 'inline'
}

export function isInputTableOverlayMode(mode: InputTableEditMode) {
  return mode === 'dialog' || mode === 'drawer'
}

export function resolveInputTableOverlayFormItems(
  options: InputTableOverlayFormItemsOptions
) {
  const configuredItems =
    options.action === 'add' ? options.addFormItems : options.editFormItems

  if (shouldUseConfiguredFormItems(configuredItems)) {
    return cloneFormItems(configuredItems)
  }

  return (Array.isArray(options.columns) ? options.columns : []).reduce<any[]>(
    (items, column) => {
      if (!column || column.type === 'operation' || !column.name) {
        return items
      }

      const quickEdit =
        options.action === 'edit' &&
        Object.prototype.hasOwnProperty.call(column, 'quickEditOnUpdate')
          ? column.quickEditOnUpdate
          : column.quickEdit

      if (quickEdit === false) {
        return items
      }

      const baseFormItem = {
        ...options.columnToQuickEdit(column),
        name: column.name,
      }

      const mergedFormItem = {
        ...baseFormItem,
        ...(isPlainObject(quickEdit) ? quickEdit : {}),
        name: column.name,
        label: resolveDerivedFormItemLabel(baseFormItem, column, quickEdit),
      }

      delete mergedFormItem.quickEdit
      delete mergedFormItem.quickEditOnUpdate
      items.push(mergedFormItem)
      return items
    },
    []
  )
}

export function buildInputTableOverlayFormSchema(body: any[], data: any) {
  return {
    type: 'form',
    wrapWithPanel: false,
    canAccessSuperData: false,
    inheritData: false,
    body,
    data,
  }
}

export function buildInputTableOverlayActions(
  mode: Extract<InputTableEditMode, 'dialog' | 'drawer'>,
  translate: (key: string) => string
) {
  return [
    {
      type: 'button',
      actionType: mode === 'drawer' ? 'close' : 'cancel',
      label: translate('cancel'),
    },
    {
      type: 'button',
      actionType: 'confirm',
      label: translate('confirm'),
      primary: true,
    },
  ]
}
