import { isPlainObject } from 'lodash'

import {
  CRUD_FILTER_DEFAULT_GAP_PX,
  CRUD_FILTER_LAYOUT_INLINE_STATE,
  CRUD_FILTER_LAYOUT_RAIL_STATE,
  CRUD_FILTER_LAYOUT_STACKED_STATE,
  type CrudFilterAnalyzedItem,
  type CrudFilterLayoutContext,
  type CrudFilterLayoutModeCode,
  type CrudFilterLayoutState,
  type CrudFilterPackedRow,
  type CrudFilterFieldsPerRowConfig,
} from './crudFilterLayoutConstants'
import {
  extractCrudFilterGridItemIndex,
  isCrudFilterAutoWideCandidateSchema,
  isCrudFilterDividerSchema,
  isCrudFilterToolbarSchema,
  hasCrudFilterWideHeadClassName,
  resolveCrudFilterCompactSpan,
  resolveCrudFilterGridColumnCount,
} from './crudFilterGridSchema'

function buildCrudFilterAnalyzedItems(
  bodyItems: any[],
  columnCount: number
): CrudFilterAnalyzedItem[] {
  const normalizedColumnCount =
    Number.isFinite(columnCount) && columnCount > 0 ? columnCount : 1

  return bodyItems
    .filter((item) => isPlainObject(item))
    .map((item, fallbackIndex) => ({
      index: extractCrudFilterGridItemIndex(item.columnClassName) ?? fallbackIndex,
      span: Math.max(
        1,
        Math.min(
          normalizedColumnCount,
          resolveCrudFilterCompactSpan(item, normalizedColumnCount)
        )
      ),
      isToolbar: isCrudFilterToolbarSchema(item),
      isWideCandidate: isCrudFilterAutoWideCandidateSchema(item),
      isWideHead: hasCrudFilterWideHeadClassName(item.columnClassName),
      isStructural: isCrudFilterDividerSchema(item),
    }))
}

function packCrudFilterRows(
  items: CrudFilterAnalyzedItem[],
  columnCount: number
): CrudFilterPackedRow[] {
  const normalizedColumnCount =
    Number.isFinite(columnCount) && columnCount > 0 ? columnCount : 1
  const rows: CrudFilterPackedRow[] = []
  let currentRow: CrudFilterPackedRow | null = null

  items.forEach((item) => {
    const span = Math.max(1, Math.min(normalizedColumnCount, item.span))

    if (!currentRow) {
      currentRow = {
        items: [],
        span: 0,
      }
      rows.push(currentRow)
    }

    if (currentRow.items.length && currentRow.span + span > normalizedColumnCount) {
      currentRow = {
        items: [],
        span: 0,
      }
      rows.push(currentRow)
    }

    currentRow.items.push({
      ...item,
      span,
    })
    currentRow.span += span
  })

  return rows
}

export function buildCrudFilterLayoutContext(options: {
  bodyItems: any[]
  columnCount: number
  containerWidth: number
  toolbarInlineMinWidth: number
  gapPx: number
}): CrudFilterLayoutContext {
  const { bodyItems, columnCount, containerWidth, toolbarInlineMinWidth, gapPx } = options
  const analyzedItems = buildCrudFilterAnalyzedItems(bodyItems, columnCount)
  const toolbarItem = analyzedItems.find((item) => item.isToolbar)
  const fieldItems = analyzedItems.filter((item) => !item.isToolbar && !item.isStructural)
  const compactItems = fieldItems.filter((item) => !item.isWideCandidate)
  const wideItems = fieldItems.filter((item) => item.isWideCandidate)
  const hasRenderedWideHead = wideItems.some((item) => item.isWideHead)
  const slotWidth = containerWidth / columnCount
  const unsplitRows = packCrudFilterRows(fieldItems, columnCount)
  const unsplitRowCount = unsplitRows.length || 1
  const unsplitLastRow = unsplitRows[unsplitRows.length - 1]
  const shouldSplitWideHead =
    hasRenderedWideHead ||
    (columnCount > 1 && wideItems.length > 0 && unsplitRowCount > 1)
  const tailItems = shouldSplitWideHead ? compactItems : fieldItems
  const inlineBudget = Math.max(0, toolbarInlineMinWidth + (tailItems.length ? gapPx : 0))
  const tailRows = packCrudFilterRows(tailItems, columnCount)
  const tailRowCount = tailRows.length || 1
  const tailLastRow = tailRows[tailRows.length - 1]
  const tailResidualPx = tailLastRow
    ? Math.max(0, columnCount - tailLastRow.span) * slotWidth
    : 0
  const tailFits = tailResidualPx >= inlineBudget
  const topology = shouldSplitWideHead ? 'W' : 'C'
  const tailRowsCode = tailRowCount > 1 ? 'M' : '1'
  const tailFitCode = tailFits ? 'P' : 'E'

  return {
    columnCount,
    analyzedItems,
    toolbarItem,
    fieldItems,
    compactItems,
    wideItems,
    hasRenderedWideHead,
    slotWidth,
    unsplitRows,
    unsplitRowCount,
    unsplitLastRow,
    shouldSplitWideHead,
    tailItems,
    inlineBudget,
    tailRows,
    tailRowCount,
    tailLastRow,
    tailResidualPx,
    tailFits,
    topology,
    tailRowsCode,
    tailFitCode,
  }
}

function canKeepCompactSingleRowInline(context: CrudFilterLayoutContext) {
  return (
    context.topology === 'C' &&
    context.tailRowCount === 1 &&
    context.tailLastRow?.span === context.columnCount &&
    context.wideItems.length > 0 &&
    context.slotWidth >= context.inlineBudget
  )
}

export function resolveCrudFilterLayoutMode(options: {
  bodyItems: any[]
  containerWidth: number
  toolbarInlineMinWidth: number
  gapPx?: number
  fieldsPerRow?: CrudFilterFieldsPerRowConfig
}) {
  const {
    bodyItems,
    containerWidth,
    toolbarInlineMinWidth,
    gapPx = CRUD_FILTER_DEFAULT_GAP_PX,
    fieldsPerRow,
  } = options
  const columnCount = resolveCrudFilterGridColumnCount(containerWidth, fieldsPerRow)
  const context = buildCrudFilterLayoutContext({
    bodyItems,
    columnCount,
    containerWidth,
    toolbarInlineMinWidth,
    gapPx,
  })

  if (!context.toolbarItem || !context.fieldItems.length) {
    return {
      columnCount,
      modeCode: 'C1P' as CrudFilterLayoutModeCode,
      layoutState: CRUD_FILTER_LAYOUT_INLINE_STATE as CrudFilterLayoutState,
      wideHeadSplit: false,
      alignLabelWidth: false,
    }
  }

  const tailFits = context.tailFits || canKeepCompactSingleRowInline(context)
  const tailFitCode = tailFits ? 'P' : 'E'
  const modeCode =
    `${context.topology}${context.tailRowsCode}${tailFitCode}` as CrudFilterLayoutModeCode
  const layoutState: CrudFilterLayoutState = tailFits
    ? CRUD_FILTER_LAYOUT_INLINE_STATE
    : context.tailRowCount > 1
      ? CRUD_FILTER_LAYOUT_STACKED_STATE
      : CRUD_FILTER_LAYOUT_RAIL_STATE
  const alignLabelWidth =
    columnCount > 1 &&
    (context.shouldSplitWideHead || modeCode === 'CMP' || modeCode === 'CME')

  return {
    columnCount,
    modeCode,
    layoutState,
    wideHeadSplit: context.shouldSplitWideHead,
    alignLabelWidth,
  }
}
