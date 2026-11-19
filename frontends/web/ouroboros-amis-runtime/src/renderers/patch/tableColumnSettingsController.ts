import type React from 'react'
import type { IColumn } from 'amis-core'

import { normalizeColumnStates, type ColumnState } from './EnhancedColumnToggler'
import { normalizeTableColumnSizing } from './tableColumnSizing'

type TableColumnSettingsDependencies = {
  getSchemaColumns: () => Array<Record<string, any>> | undefined
  getStore: () => any
  requestRender: () => void
}

function getColumnIdentity(column: Partial<IColumn>, index: number) {
  return column.id || column.name || (column as any).columnKey || `col-${index}`
}

export class TableColumnSettingsController {
  private popoverVisible = false
  private togglerTarget: HTMLElement | null = null

  constructor(private readonly dependencies: TableColumnSettingsDependencies) {}

  get isOpen() {
    return this.popoverVisible
  }

  get target() {
    return this.togglerTarget
  }

  captureTarget = (ref: HTMLElement | null) => {
    this.togglerTarget = ref
  }

  close = () => {
    if (!this.popoverVisible) {
      return
    }

    this.popoverVisible = false
    this.dependencies.requestRender()
  }

  toggle = (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()
    this.popoverVisible = !this.popoverVisible
    this.dependencies.requestRender()
  }

  getPopOverContainer = () => {
    return this.togglerTarget?.parentElement || document.body
  }

  getCurrentColumnsState(): ColumnState[] {
    const store = this.dependencies.getStore()
    return normalizeColumnStates(
      store.toggableColumns.map((column: IColumn, index: number) => ({
        id: getColumnIdentity(column, index),
        name: column.name || '',
        label: column.label || '',
        toggled: column.toggled !== false,
        fixed: (column.fixed || 'none') as ColumnState['fixed'],
        originalIndex: column.index ?? index,
        currentIndex: index,
        locked:
          (column.type === 'operation' && ((column as any).locked ?? true)) ||
          (column as any).locked,
      }))
    )
  }

  reset = () => {
    const store = this.dependencies.getStore()
    store.clearPersistSavedConfig?.()

    const schemaColumns = this.dependencies.getSchemaColumns()
    const resetColumns = Array.isArray(schemaColumns)
      ? schemaColumns.map((column, index) => ({
          ...normalizeTableColumnSizing(column),
          index,
        }))
      : []

    if (!resetColumns.length) {
      this.close()
      return
    }

    store.updateColumns(resetColumns)
    this.confirm(this.getCurrentColumnsState(), true)
  }

  confirm = (columns: ColumnState[], skipSave = false) => {
    const store = this.dependencies.getStore()
    const sortedColumns = normalizeColumnStates(columns)
    const nextColumns = sortedColumns
      .map((columnState, newIndex) => {
        const currentColumn = store.columns.find(
          (column: any, currentIndex: number) =>
            getColumnIdentity(column, currentIndex) === columnState.id
        )

        if (!currentColumn) {
          return null
        }

        return {
          ...(currentColumn as any),
          __columnKey: currentColumn.columnKey,
          name: columnState.name,
          toggled: columnState.toggled,
          fixed: columnState.fixed === 'none' ? undefined : columnState.fixed,
          index: newIndex,
        }
      })
      .filter(Boolean)

    store.updateColumns(nextColumns)
    store.initTableWidth()
    store.syncTableWidth()

    nextColumns.forEach((column: any) => {
      if (!column.width) {
        return
      }

      const patchedColumn = store.columns.find(
        (storeColumn: any) => storeColumn.columnKey === column.__columnKey
      )
      if (patchedColumn) {
        patchedColumn.setWidth(column.width)
      }
    })

    if (!skipSave) {
      store.persistSaveToggledColumns()
    }

    this.dependencies.requestRender()
    this.close()
  }

  dispose() {
    this.popoverVisible = false
    this.togglerTarget = null
  }
}
