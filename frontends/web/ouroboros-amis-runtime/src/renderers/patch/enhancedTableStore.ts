import {
  TableStore,
  filter,
  guid,
  registerStore,
} from 'amis-core'
import type { IColumn } from 'amis-core'
import { getPageId } from 'amis-core/lib/utils/getPageId'
import type { TableProps } from 'amis/lib/renderers/Table/index'
import { debounce, sortBy } from 'lodash'
import { getEnv, isAlive } from 'mobx-state-tree'

import {
  calculateTableRenderColumnCost,
  DEFAULT_COOPERATIVE_LOADING_MAX_DURATION_MS,
  INFERRED_LAZY_RENDER_WORK_UNIT_BUDGET,
} from './tableRenderPerformance'
import { isTableLazyRenderGloballyDisabled } from './tableLazyRenderSwitch'
import { normalizeTableColumnSizing } from './tableColumnSizing'

import type { SColumn, STableStore } from 'amis-core/lib/store/table'

type FixedColumnSide = 'left' | 'right'
type FixedColumnState = FixedColumnSide | 'none'

type PersistedTableConfig = {
  unToggledColumns?: string[]
  columnOrder?: string[]
  disabledSearchableColumn?: string[]
  columnWidth?: Record<string, number>
  fixedColumns?: Record<string, FixedColumnState>
}

export type EnhancedTableStore = TableProps['store'] & {
  clearPersistSavedConfig?: () => void
  cancelCooperativeRendering?: () => void
  configPersistKey?: string
  page?: number
  persistSaveToggledColumns: () => void
  perPage?: number
  total?: number
  cooperativeRenderingPending?: boolean
  loadingMaxDuration?: number
  cooperativeLoadingVisible?: boolean
  cooperativeLoadingSuppressed?: boolean
  cooperativeMaterializationDisabled?: boolean
  materializationPending?: boolean
  pendingMaterializationCount?: number
  materializationRowCreateCount?: number
  materializationPublishCount?: number
  materializationFailureCount?: number
  materializationLastError?: { name: string; message: string } | null
  lazyRenderAfterExplicit?: boolean
  viewportHydrationPending?: boolean
}

const TABLE_STORE_PATCH_FLAG = '__OUROBOROS_TABLE_STORE_PATCHED__'
const MAX_INFERRED_LAZY_RENDER_AFTER = 100
const MIN_INFERRED_LAZY_RENDER_AFTER = 1
const DISABLED_LAZY_RENDER_AFTER = Number.MAX_SAFE_INTEGER
const MATERIALIZATION_WORK_TARGET_MS = 7
const MATERIALIZATION_START_CUTOFF_MS = 8

function normalizeConfigNumber(value: unknown) {
  return typeof value === 'string' && value.trim() !== ''
    ? Number(value)
    : value
}

function normalizeLazyRenderAfter(value: unknown) {
  const normalized = normalizeConfigNumber(value)

  return typeof normalized === 'number' && Number.isFinite(normalized)
    ? normalized
    : undefined
}

function isLazyRenderDisabledConfig(value: unknown) {
  const normalized = normalizeConfigNumber(value)

  return (
    normalized === null ||
    (typeof normalized === 'number' &&
      Number.isFinite(normalized) &&
      normalized <= 0)
  )
}

function normalizeCooperativeLoadingMaxDuration(value: unknown) {
  const normalized = normalizeConfigNumber(value)

  return typeof normalized === 'number' && Number.isFinite(normalized)
    ? normalized
    : undefined
}

function clampInferredLazyRenderAfter(value: number) {
  return Math.max(
    MIN_INFERRED_LAZY_RENDER_AFTER,
    Math.min(MAX_INFERRED_LAZY_RENDER_AFTER, value)
  )
}

function inferLazyRenderAfter(rowCount: number, columnCost: number) {
  if (rowCount <= 0) {
    return MAX_INFERRED_LAZY_RENDER_AFTER
  }

  const normalizedColumnCost = Math.max(1, columnCost)
  const maxRowsWithinWorkUnitBudget = Math.floor(
    INFERRED_LAZY_RENDER_WORK_UNIT_BUDGET / normalizedColumnCost
  )

  return clampInferredLazyRenderAfter(maxRowsWithinWorkUnitBudget)
}

function inferRenderableColumnCost(self: any, rows: any[]) {
  const columns =
    Array.isArray(self.filteredColumns) && self.filteredColumns.length
      ? self.filteredColumns
      : Array.isArray(self.columns)
        ? self.columns
        : []

  if (columns.length) {
    return calculateTableRenderColumnCost(columns)
  }

  const firstRow = rows[0]
  const firstRowData = firstRow?.data ?? firstRow

  return firstRowData && typeof firstRowData === 'object'
    ? Object.keys(firstRowData).length
    : 1
}

function applyInferredLazyRenderAfter(self: any, rows: any[]) {
  if (self.lazyRenderAfterExplicit) {
    return
  }

  self.lazyRenderAfter = inferLazyRenderAfter(
    rows.length,
    inferRenderableColumnCost(self, rows)
  )
}

function waitForMainThreadPaint() {
  return new Promise<void>((resolve) => {
    let settled = false
    const requestFrame =
      typeof window.requestAnimationFrame === 'function'
        ? window.requestAnimationFrame.bind(window)
        : (callback: FrameRequestCallback) =>
            window.setTimeout(() => callback(performance.now()), 0)
    const fallbackTimer = window.setTimeout(done, 100)
    function done() {
      if (settled) {
        return
      }
      settled = true
      window.clearTimeout(fallbackTimer)
      resolve()
    }
    requestFrame(() => window.setTimeout(done, 0))
  })
}

function hasInputTablePlaceholderRow(item: any): boolean {
  return Boolean(
    item &&
      typeof item === 'object' &&
      (Object.prototype.hasOwnProperty.call(item, '__isPlaceholder') ||
        (Array.isArray(item.children) &&
          item.children.some(hasInputTablePlaceholderRow)))
  )
}

function canMaterializeRowsCooperatively(
  self: any,
  rows: any[],
  getEntryId: ((item: any, index: number) => unknown) | undefined,
  reUseRow: unknown,
  fullSelectedItems: unknown
) {
  const rowThreshold = normalizeLazyRenderAfter(self.lazyRenderAfter)

  return (
    typeof rowThreshold === 'number' &&
    rowThreshold > 0 &&
    rows.length > rowThreshold &&
    !self.cooperativeMaterializationDisabled &&
    !isTableLazyRenderGloballyDisabled() &&
    !self.combineNum &&
    !rows.some(hasInputTablePlaceholderRow) &&
    !canReuseEveryExistingRow(self, rows, getEntryId, reUseRow) &&
    (!Array.isArray(fullSelectedItems) || !fullSelectedItems.length) &&
    !rows.some(
      (item) => Array.isArray(item?.children) && item.children.length > 0
    )
  )
}

function canReuseEveryExistingRow(
  self: any,
  rows: any[],
  getEntryId: ((item: any, index: number) => unknown) | undefined,
  reUseRow: unknown
) {
  if (reUseRow !== 'match' || !rows.length) {
    return false
  }

  const existingRows = Array.isArray(self.falttenedRows)
    ? self.falttenedRows
    : []

  if (existingRows.length < rows.length) {
    return false
  }

  const existingIds = new Set(existingRows.map((row: any) => String(row.id)))

  return rows.every((item, index) => {
    const data = item && typeof item === 'object' ? item : { item }
    const id = String(getEntryId ? getEntryId(data, index) : data.__id ?? '')

    return id !== '' && existingIds.has(id)
  })
}

function toCooperativeRowSnapshot(
  item: any,
  index: number,
  getEntryId?: (item: any, index: number) => unknown
) {
  const data = item && typeof item === 'object' ? item : { item }
  const id = String(getEntryId ? getEntryId(data, index) : data.__id ?? guid())
  return {
    id,
    key: `${index}-1-${index}`,
    depth: 1,
    index,
    newIndex: index,
    pristine: data.__pristine || data,
    path: String(index),
    data,
    rowSpans: {},
    defer: !!data.defer,
    loaded: false,
    loading: false,
    children: [],
  }
}

function buildColumnKey(column: Partial<SColumn>, index: number) {
  return (column as any).uid || column.name || column.label || index
}

function readPersistedTableConfig(
  key: string
): PersistedTableConfig | null {
  const persisted = sessionStorage.getItem(key)
  if (!persisted) {
    return null
  }

  try {
    return JSON.parse(persisted) as PersistedTableConfig
  } catch (error) {
    console.warn(`OuroborosTable: failed to parse persisted table config for "${key}"`, error)
    return null
  }
}

function applyPersistedColumnWidths(
  columns: Array<SColumn>,
  persisted: PersistedTableConfig | null
) {
  const columnWidth = persisted?.columnWidth
  if (!columnWidth || !Object.keys(columnWidth).length) {
    return columns
  }

  return columns.map((column, index) => {
    const savedWidth = columnWidth[buildColumnKey(column, index)]
    if (
      typeof savedWidth !== 'number' ||
      !Number.isFinite(savedWidth) ||
      savedWidth <= 0
    ) {
      return column
    }

    const pristine =
      column.pristine && typeof column.pristine === 'object'
        ? {
            ...column.pristine,
            width: savedWidth,
          }
        : column.pristine

    return {
      ...column,
      pristine,
      width: savedWidth,
    }
  })
}

function applyPersistedColumnModelState(
  columns: Array<IColumn>,
  persisted: PersistedTableConfig | null
) {
  if (!persisted) {
    return
  }

  const columnWidth = persisted.columnWidth
  const fixedColumns = persisted.fixedColumns

  columns.forEach((column, index) => {
    if (columnWidth) {
      const savedWidth = columnWidth[buildColumnKey(column as SColumn, index)]
      if (
        typeof savedWidth === 'number' &&
        Number.isFinite(savedWidth) &&
        savedWidth > 0
      ) {
        column.setWidth(savedWidth)
      }
    }

    if (fixedColumns) {
      const savedFixed = fixedColumns[buildColumnKey(column as SColumn, index)]
      if (savedFixed === 'left' || savedFixed === 'right') {
        column.fixed = savedFixed
      } else if (savedFixed === 'none') {
        column.fixed = ''
      }
    }
  })
}

function getFixedColumnMap(columns: Array<IColumn>) {
  return columns.reduce<Record<string, FixedColumnState>>((acc, column) => {
    acc[column.columnKey] =
      column.fixed === 'left' || column.fixed === 'right'
        ? column.fixed
        : 'none'
    return acc
  }, {})
}

function getColumnWidthMap(columns: Array<IColumn>) {
  return columns.reduce<Record<string, number>>((acc, column) => {
    if (column.width) {
      acc[column.columnKey] = column.width
    }
    return acc
  }, {})
}

function resolveConfigPersistKey(self: any) {
  if (self.persistKey) {
    return filter(self.persistKey, self.data)
  }

  const fn = getEnv(self).getPageId || getPageId
  return `${fn()}${self.path}`
}

export function registerEnhancedTableStore() {
  const globalScope = globalThis as typeof globalThis & {
    [TABLE_STORE_PATCH_FLAG]?: boolean
  }

  if (globalScope[TABLE_STORE_PATCH_FLAG]) {
    return
  }

  registerStore(
    TableStore.volatile(() => ({
      loadingMaxDuration: DEFAULT_COOPERATIVE_LOADING_MAX_DURATION_MS,
      cooperativeLoadingSuppressed: false,
      lazyRenderAfterExplicit: false,
      materializationPending: false,
      pendingMaterializationCount: 0,
      materializationRowCreateCount: 0,
      materializationPublishCount: 0,
      materializationFailureCount: 0,
      materializationLastError: null,
      viewportHydrationPending: false,
      cooperativeMaterializationDisabled: false,
    })).views((self: any) => ({
      get columnsKey() {
        return `${resolveConfigPersistKey(self)}--DISABLED`
      },

      get configPersistKey() {
        return resolveConfigPersistKey(self)
      },

      get cooperativeRenderingPending() {
        return self.materializationPending
      },

      get cooperativeLoadingVisible() {
        return self.materializationPending && !self.cooperativeLoadingSuppressed
      },
    })).actions((self: any) => {
      const superUpdate = self.update
      const superInitRows = self.initRows
      let materializationGeneration = 0
      let cooperativeRows: any[] = []
      let eventContextDisposer: (() => void) | null = null
      let cooperativeLoadingTimerId: number | null = null

      function stopKeepingEventContextAlive() {
        eventContextDisposer?.()
        eventContextDisposer = null
      }

      function clearCooperativeLoadingTimer() {
        if (cooperativeLoadingTimerId !== null) {
          window.clearTimeout(cooperativeLoadingTimerId)
          cooperativeLoadingTimerId = null
        }
      }

      function scheduleCooperativeLoadingSuppression(generation: number) {
        clearCooperativeLoadingTimer()

        const duration = self.loadingMaxDuration
        if (
          typeof duration !== 'number' ||
          !Number.isFinite(duration) ||
          duration < 0
        ) {
          return
        }

        cooperativeLoadingTimerId = window.setTimeout(() => {
          cooperativeLoadingTimerId = null
          self.suppressCooperativeLoading(generation)
        }, duration)
      }

      function suppressCooperativeLoading(generation: number) {
        if (
          generation !== materializationGeneration ||
          !isAlive(self) ||
          !self.materializationPending
        ) {
          return
        }

        self.cooperativeLoadingSuppressed = true
      }

      async function materializeRows(
        generation: number,
        rows: any[],
        getEntryId: ((item: any, index: number) => unknown) | undefined,
        reUseRow: unknown,
        fullItems: any[] | undefined,
        fullSelectedItems: any[] | undefined
      ) {
        let index = 0

        while (index < rows.length) {
          await waitForMainThreadPaint()
          if (
            generation !== materializationGeneration ||
            !isAlive(self) ||
            !self.materializationPending
          ) {
            return
          }

          const sliceStartedAt = performance.now()
          let createdInSlice = 0

          while (index < rows.length) {
            const elapsedBeforeStart = performance.now() - sliceStartedAt
            if (
              createdInSlice > 0 &&
              elapsedBeforeStart >= MATERIALIZATION_START_CUTOFF_MS
            ) {
              break
            }

            self.appendCooperativeRow(
              generation,
              rows[index],
              index,
              getEntryId
            )
            index += 1
            createdInSlice += 1

            if (
              performance.now() - sliceStartedAt >=
              MATERIALIZATION_WORK_TARGET_MS
            ) {
              break
            }
          }
        }

        try {
          self.publishCooperativeRows(generation, fullItems, fullSelectedItems)
        } catch (error) {
          self.failCooperativeMaterialization(
            generation,
            error,
            rows,
            getEntryId,
            reUseRow,
            fullItems,
            fullSelectedItems
          )
        }
      }

      function appendCooperativeRow(
        generation: number,
        item: any,
        index: number,
        getEntryId?: (item: any, index: number) => unknown
      ) {
        if (
          generation !== materializationGeneration ||
          !self.materializationPending
        ) {
          return
        }

        cooperativeRows[index] = toCooperativeRowSnapshot(item, index, getEntryId)
        self.materializationRowCreateCount += 1
        self.pendingMaterializationCount = Math.max(
          0,
          self.pendingMaterializationCount - 1
        )
      }

      function publishCooperativeRows(
        generation: number,
        fullItems: any[] | undefined,
        fullSelectedItems: any[] | undefined
      ) {
        if (
          generation !== materializationGeneration ||
          !isAlive(self) ||
          !self.materializationPending
        ) {
          return
        }

        const rowsToPublish = cooperativeRows.filter(Boolean)

        self.viewportHydrationPending = true
        self.rows.replace(rowsToPublish)
        applyInferredLazyRenderAfter(self, rowsToPublish)
        self.isNested = false
        self.dragging = false
        self.selectedRows.clear()
        if (Array.isArray(fullItems)) {
          self.fullItems.replace(fullItems)
        }
        if (Array.isArray(fullSelectedItems)) {
          self.fullSelectedItems.replace(fullSelectedItems)
        }

        self.materializationPublishCount += 1
        cooperativeRows = []
        self.pendingMaterializationCount = 0
        self.materializationPending = false
        self.viewportHydrationPending = false
        self.cooperativeLoadingSuppressed = false
        stopKeepingEventContextAlive()
        clearCooperativeLoadingTimer()
      }

      function failCooperativeMaterialization(
        generation: number,
        error: unknown,
        rows?: any[],
        getEntryId?: (item: any, index: number) => unknown,
        reUseRow?: unknown,
        fullItems?: any[],
        fullSelectedItems?: any[]
      ) {
        if (generation !== materializationGeneration || !isAlive(self)) {
          return
        }

        self.materializationFailureCount += 1
        self.materializationLastError =
          error instanceof Error
            ? {
                name: error.name,
                message: error.message,
              }
            : {
                name: typeof error,
                message: String(error),
              }
        self.materializationPending = false
        self.viewportHydrationPending = false
        self.cooperativeLoadingSuppressed = false
        self.pendingMaterializationCount = 0
        stopKeepingEventContextAlive()
        clearCooperativeLoadingTimer()
        cooperativeRows = []

        if (Array.isArray(rows)) {
          superInitRows(rows, getEntryId, reUseRow, fullItems, fullSelectedItems)
          return
        }

        getEnv(self).notify?.('error', self.__('fetchFailed'))
      }

      function initRows(
        rows: any[],
        getEntryId?: (item: any, index: number) => unknown,
        reUseRow?: unknown,
        fullItems?: any[],
        fullSelectedItems?: any[]
      ) {
        const normalizedRows = Array.isArray(rows) ? rows : []
        materializationGeneration += 1
        stopKeepingEventContextAlive()
        clearCooperativeLoadingTimer()
        cooperativeRows = []
        applyInferredLazyRenderAfter(self, normalizedRows)

        if (
          !canMaterializeRowsCooperatively(
            self,
            normalizedRows,
            getEntryId,
            reUseRow,
            fullSelectedItems
          )
        ) {
          self.materializationPending = false
          self.viewportHydrationPending = false
          self.cooperativeLoadingSuppressed = false
          self.pendingMaterializationCount = 0
          clearCooperativeLoadingTimer()
          return superInitRows(
            normalizedRows,
            getEntryId,
            reUseRow,
            fullItems,
            fullSelectedItems
          )
        }

        const generation = materializationGeneration
        self.isNested = false
        self.cooperativeLoadingSuppressed = false
        self.materializationPending = true
        self.viewportHydrationPending = false
        self.pendingMaterializationCount = normalizedRows.length
        self.materializationRowCreateCount = 0
        self.materializationPublishCount = 0
        self.materializationFailureCount = 0
        self.materializationLastError = null
        cooperativeRows = new Array(normalizedRows.length)
        scheduleCooperativeLoadingSuppression(generation)

        void materializeRows(
          generation,
          normalizedRows,
          getEntryId,
          reUseRow,
          fullItems,
          fullSelectedItems
        ).catch((error) => {
          self.failCooperativeMaterialization(
            generation,
            error,
            normalizedRows,
            getEntryId,
            reUseRow,
            fullItems,
            fullSelectedItems
          )
        })
      }

      function cancelCooperativeRendering() {
        materializationGeneration += 1
        stopKeepingEventContextAlive()
        clearCooperativeLoadingTimer()
        cooperativeRows = []
        if (isAlive(self)) {
          self.materializationPending = false
          self.viewportHydrationPending = false
          self.cooperativeLoadingSuppressed = false
          self.pendingMaterializationCount = 0
          self.materializationPublishCount = 0
          self.materializationLastError = null
        }
      }

      function beforeDestroy() {
        cancelCooperativeRendering()
      }

      function update(
        config: Partial<STableStore>,
        options?: {
          resolveDefinitions?: (ref: string) => any
        }
      ) {
        const hasLazyRenderAfterConfig =
          Object.prototype.hasOwnProperty.call(config, 'lazyRenderAfter')
        const hasLazyRenderAfterExplicitConfig =
          Object.prototype.hasOwnProperty.call(config, 'lazyRenderAfterExplicit')
        const isLazyRenderDisabled = isLazyRenderDisabledConfig(
          (config as any).lazyRenderAfter
        )
        const configuredLazyRenderAfter = normalizeLazyRenderAfter(
          (config as any).lazyRenderAfter
        )
        const hasLoadingMaxDurationConfig =
          Object.prototype.hasOwnProperty.call(config, 'loadingMaxDuration')
        const hasCooperativeMaterializationDisabledConfig =
          Object.prototype.hasOwnProperty.call(
            config,
            'cooperativeMaterializationDisabled'
          )
        const configuredLoadingMaxDuration =
          normalizeCooperativeLoadingMaxDuration(
            (config as any).loadingMaxDuration
          )
        const { columns, cooperativeMaterializationDisabled, ...rest } =
          config as any
        delete rest.loadingMaxDuration
        delete rest.lazyRenderAfterExplicit

        if (hasLazyRenderAfterConfig) {
          if (isLazyRenderDisabled) {
            rest.lazyRenderAfter = DISABLED_LAZY_RENDER_AFTER
          } else if (typeof configuredLazyRenderAfter === 'number') {
            rest.lazyRenderAfter = configuredLazyRenderAfter
          } else {
            delete rest.lazyRenderAfter
          }
        }

        superUpdate(rest, options)

        if (hasLazyRenderAfterConfig) {
          self.lazyRenderAfterExplicit = hasLazyRenderAfterExplicitConfig
            ? Boolean((config as any).lazyRenderAfterExplicit) &&
              (isLazyRenderDisabled ||
                typeof configuredLazyRenderAfter === 'number')
            : isLazyRenderDisabled ||
              (typeof configuredLazyRenderAfter === 'number' &&
                configuredLazyRenderAfter !== MAX_INFERRED_LAZY_RENDER_AFTER)
        }

        if (hasLoadingMaxDurationConfig) {
          self.loadingMaxDuration =
            typeof configuredLoadingMaxDuration === 'number'
              ? configuredLoadingMaxDuration
              : DEFAULT_COOPERATIVE_LOADING_MAX_DURATION_MS

          if (self.materializationPending && !self.cooperativeLoadingSuppressed) {
            scheduleCooperativeLoadingSuppression(materializationGeneration)
          }
        }

        if (hasCooperativeMaterializationDisabledConfig) {
          self.cooperativeMaterializationDisabled = Boolean(
            cooperativeMaterializationDisabled
          )
        }

        if (
          hasLazyRenderAfterConfig &&
          !self.lazyRenderAfterExplicit &&
          typeof self.rows?.length === 'number' &&
          self.rows.length
        ) {
          applyInferredLazyRenderAfter(self, self.rows)
        }

        if (!Array.isArray(columns)) {
          return
        }

        let nextColumns = columns
          .map((column) => {
            if (
              options?.resolveDefinitions &&
              typeof (column as any)?.$ref === 'string' &&
              (column as any).$ref
            ) {
              return {
                ...options.resolveDefinitions((column as any).$ref),
                ...column,
              }
            }

            return column
          })
          .filter(Boolean)
          .map((column) =>
            normalizeTableColumnSizing(column as Record<string, any>)
          ) as Array<SColumn>

        const persisted = readPersistedTableConfig(self.configPersistKey)
        if (persisted?.columnOrder?.length) {
          nextColumns = sortBy(nextColumns, (column, index) => {
            const persistedIndex = persisted.columnOrder!.indexOf(
              buildColumnKey(column, index)
            )

            return persistedIndex === -1
              ? Number.MAX_SAFE_INTEGER
              : persistedIndex
          })
        }

        if (persisted?.fixedColumns) {
          nextColumns = nextColumns.map((column, index) => {
            const fixed = persisted.fixedColumns?.[buildColumnKey(column, index)]
            if (fixed === 'left' || fixed === 'right') {
              return {
                ...column,
                fixed,
              }
            }

            if (fixed === 'none') {
              return {
                ...column,
                fixed: undefined,
              }
            }

            return column
          })
        }

        nextColumns = applyPersistedColumnWidths(nextColumns, persisted)
        self.updateColumns(nextColumns)
        applyPersistedColumnModelState(self.columnsData, persisted)
        applyInferredLazyRenderAfter(self, self.rows)
      }

      function persistSaveToggledColumns() {
        const key = self.configPersistKey
        const toggledColumns = self.activeToggaleColumns
        const activeSearchableColumns = self.activedSearchableColumns
        const setting: PersistedTableConfig = {
          unToggledColumns: self.columnsData
            .filter((column: IColumn) => !toggledColumns.includes(column))
            .map((column: IColumn) => column.columnKey),
          columnOrder: self.columnsData.map((column: IColumn) => column.columnKey),
          disabledSearchableColumn: self.columnsData
            .filter(
              (column: IColumn) =>
                column.searchable && !activeSearchableColumns.includes(column)
            )
            .map((column: IColumn) => column.columnKey),
          columnWidth: getColumnWidthMap(self.filteredColumns),
          fixedColumns: getFixedColumnMap(self.columnsData),
        }

        try {
          sessionStorage.setItem(key, JSON.stringify(setting))
        } catch (error) {
          console.warn(`OuroborosTable: failed to persist table config to sessionStorage for "${key}"`, error)
        }

        const env = getEnv(self)
        Promise.resolve(
          env?.fetcher?.({
            method: 'patch',
            url: '/api/user-setting',
            data: {
              settingName: key,
              isAutoLoad: true,
              settingValue: setting,
            },
            config: {
              isSilent: true,
            },
          })
        ).catch((error) => {
          console.warn(`OuroborosTable: failed to persist table config remotely for "${key}"`, error)
        })
      }

      function clearPersistSavedConfig() {
        const key = self.configPersistKey

        try {
          sessionStorage.removeItem(key)
        } catch (error) {
          console.warn(`OuroborosTable: failed to clear table config from sessionStorage for "${key}"`, error)
        }

        const env = getEnv(self)
        Promise.resolve(
          env?.fetcher?.({
            method: 'delete',
            url: `/api/user-setting?settingName=${encodeURIComponent(key)}`,
            config: {
              isSilent: true,
            },
          })
        ).catch((error) => {
          console.warn(`OuroborosTable: failed to clear remote table config for "${key}"`, error)
        })
      }

      function afterCreate() {
        setTimeout(() => {
          if (!isAlive(self)) {
            return
          }

          const persisted = readPersistedTableConfig(self.configPersistKey)
          if (!persisted) {
            return
          }

          const unToggledColumns = Array.isArray(persisted.unToggledColumns)
            ? persisted.unToggledColumns
            : []
          const disabledSearchableColumn = Array.isArray(
            persisted.disabledSearchableColumn
          )
            ? persisted.disabledSearchableColumn
            : []

          self.toggableColumns.forEach((column: IColumn) => {
            column.setToggled(!unToggledColumns.includes(column.columnKey))
          })

          self.searchableColumns.forEach((column: IColumn) => {
            column.setEnableSearch(
              !disabledSearchableColumn.includes(column.columnKey),
              true
            )
          })
        }, 200)
      }

      return {
        initRows,
        appendCooperativeRow,
        suppressCooperativeLoading,
        publishCooperativeRows,
        failCooperativeMaterialization,
        cancelCooperativeRendering,
        beforeDestroy,
        update,
        persistSaveToggledColumns: debounce(persistSaveToggledColumns, 300),
        clearPersistSavedConfig,
        afterCreate,
      }
    })
  )

  globalScope[TABLE_STORE_PATCH_FLAG] = true
}
