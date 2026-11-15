import { isPlainObject } from 'lodash'

import {
  CRUD_FILTER_CONTROL_FILL_WIDTH_CLASS,
  CRUD_FILTER_GRID_DIVIDER_CLASS,
  CRUD_FILTER_GRID_FULL_WIDTH_CLASS,
  CRUD_FILTER_GRID_ITEM_CLASS,
  CRUD_FILTER_GRID_LAST_WIDE_CLASS,
  CRUD_FILTER_MOBILE_STACKED_FIELD_CLASS,
  CRUD_FILTER_MOBILE_STACKED_TOOLBAR_CLASS,
  CRUD_FILTER_TOOLBAR_ITEM_CLASS,
  CRUD_FILTER_GRID_WIDE_HEAD_ITEM_CLASS,
  type CrudFilterFieldAffordanceOptions,
  type CrudFilterLayoutModeCode,
  CRUD_FILTER_WIDE_HEAD_DIVIDER_CLASS,
} from './crudFilterLayoutConstants'
import {
  appendSchemaClassName,
  isCrudFilterAutoWideCandidateSchema,
  isCrudFilterDividerSchema,
  isCrudFilterToolbarSchema,
} from './crudFilterGridSchema'
import {
  applyCrudFilterCompactSingleRowBody,
  applyCrudFilterPlaceholderBody,
  moveCrudFilterInlineClassNameToRoot,
} from './crudFilterAffordance'

export function applyCrudFilterWideHeadSplitBody(
  bodyItems: any[],
  wideHeadSplit: boolean
) {
  if (!wideHeadSplit) {
    return bodyItems
  }

  const wideItems: any[] = []
  const compactItems: any[] = []
  const toolbarItems: any[] = []

  bodyItems.forEach((item) => {
    if (!isPlainObject(item)) {
      compactItems.push(item)
      return
    }

    if (isCrudFilterToolbarSchema(item)) {
      toolbarItems.push(item)
      return
    }

    if (isCrudFilterAutoWideCandidateSchema(item)) {
      wideItems.push(item)
      return
    }

    compactItems.push(item)
  })

  if (!wideItems.length) {
    return bodyItems
  }

  const hasTrailingSection = compactItems.length > 0 || toolbarItems.length > 0
  const markedWideItems = wideItems.map((item, index) => ({
    ...item,
    columnClassName: appendSchemaClassName(
      item.columnClassName,
      CRUD_FILTER_GRID_WIDE_HEAD_ITEM_CLASS,
      index === wideItems.length - 1 &&
        hasTrailingSection &&
        CRUD_FILTER_GRID_LAST_WIDE_CLASS
    ),
  }))

  if (!hasTrailingSection) {
    return markedWideItems
  }

  return [
    ...markedWideItems,
    {
      type: 'divider',
      className: CRUD_FILTER_WIDE_HEAD_DIVIDER_CLASS,
      lineStyle: 'solid',
      label: false,
      columnClassName: appendSchemaClassName(
        undefined,
        CRUD_FILTER_GRID_ITEM_CLASS,
        CRUD_FILTER_GRID_FULL_WIDTH_CLASS,
        CRUD_FILTER_GRID_DIVIDER_CLASS
      ),
    },
    ...compactItems,
    ...toolbarItems,
  ]
}

export function applyCrudFilterCompactInlineBody(
  bodyItems: any[],
  options: CrudFilterFieldAffordanceOptions = {}
) {
  return bodyItems.map((item) => {
    if (
      !isPlainObject(item) ||
      isCrudFilterToolbarSchema(item) ||
      isCrudFilterDividerSchema(item)
    ) {
      return item
    }

    return {
      ...moveCrudFilterInlineClassNameToRoot(item, undefined, options),
      mode: 'inline',
    }
  })
}

export function applyCrudFilterInlineToolbarBody(
  bodyItems: any[],
  options: CrudFilterFieldAffordanceOptions = {}
) {
  return bodyItems.map((item) => {
    if (!isCrudFilterToolbarSchema(item)) {
      return item
    }

    return {
      ...moveCrudFilterInlineClassNameToRoot(
        item,
        CRUD_FILTER_TOOLBAR_ITEM_CLASS,
        options
      ),
      mode: 'inline',
    }
  })
}

function removeCrudFilterInlineRenderHints(schema: any) {
  if (!isPlainObject(schema)) {
    return schema
  }

  const nextSchema = { ...schema }

  if (nextSchema.mode === 'inline') {
    delete nextSchema.mode
  }

  if (nextSchema.inline === true) {
    delete nextSchema.inline
  }

  return nextSchema
}

function appendCrudFilterMobileFieldSemantics(schema: any) {
  return {
    ...schema,
    className: appendSchemaClassName(
      schema.className,
      CRUD_FILTER_MOBILE_STACKED_FIELD_CLASS
    ),
    columnClassName: appendSchemaClassName(
      schema.columnClassName,
      CRUD_FILTER_GRID_FULL_WIDTH_CLASS
    ),
    inputClassName: appendSchemaClassName(
      schema.inputClassName,
      CRUD_FILTER_CONTROL_FILL_WIDTH_CLASS
    ),
  }
}

function normalizeCrudFilterMobileStackedItem(item: any) {
  if (!isPlainObject(item)) {
    return item
  }

  const normalizedItem = removeCrudFilterInlineRenderHints(item)

  if (isCrudFilterDividerSchema(normalizedItem)) {
    return {
      ...normalizedItem,
      className: appendSchemaClassName(
        normalizedItem.className,
        CRUD_FILTER_MOBILE_STACKED_FIELD_CLASS
      ),
      columnClassName: appendSchemaClassName(
        normalizedItem.columnClassName,
        CRUD_FILTER_GRID_FULL_WIDTH_CLASS
      ),
    }
  }

  if (isCrudFilterToolbarSchema(normalizedItem)) {
    return {
      ...normalizedItem,
      className: appendSchemaClassName(
        normalizedItem.className,
        CRUD_FILTER_MOBILE_STACKED_TOOLBAR_CLASS
      ),
      columnClassName: appendSchemaClassName(
        normalizedItem.columnClassName,
        CRUD_FILTER_GRID_FULL_WIDTH_CLASS
      ),
    }
  }

  if (normalizedItem.type === 'tooltip-wrapper' && isPlainObject(normalizedItem.body)) {
    return {
      ...normalizedItem,
      columnClassName: appendSchemaClassName(
        normalizedItem.columnClassName,
        CRUD_FILTER_GRID_FULL_WIDTH_CLASS
      ),
      body: appendCrudFilterMobileFieldSemantics(normalizedItem.body),
    }
  }

  return appendCrudFilterMobileFieldSemantics(normalizedItem)
}

export function applyCrudFilterMobileStackedBody(bodyItems: any[]) {
  return bodyItems.map((item) => normalizeCrudFilterMobileStackedItem(item))
}

type CrudFilterBodyTransformer = (bodyItems: any[]) => any[]

function buildCrudFilterModeTransformers(options: {
  modeCode: CrudFilterLayoutModeCode | null
  wideHeadSplit: boolean
  fieldAffordanceOptions: CrudFilterFieldAffordanceOptions
}): CrudFilterBodyTransformer[] {
  const { modeCode, wideHeadSplit, fieldAffordanceOptions } = options

  switch (modeCode) {
    case 'C1P':
      return [
        (bodyItems) =>
          applyCrudFilterCompactSingleRowBody(bodyItems, {
            ...fieldAffordanceOptions,
            addInlineDefaultWidth: true,
            moveWidthClassToInput: true,
          }),
        (bodyItems) =>
          applyCrudFilterCompactInlineBody(bodyItems, fieldAffordanceOptions),
      ]

    case 'C1E':
      return [
        (bodyItems) =>
          applyCrudFilterCompactSingleRowBody(bodyItems, fieldAffordanceOptions),
      ]

    case 'W1P':
    case 'WMP': {
      const transformers: CrudFilterBodyTransformer[] = []

      if (wideHeadSplit) {
        transformers.push((bodyItems) =>
          applyCrudFilterWideHeadSplitBody(bodyItems, true)
        )
      }

      transformers.push((bodyItems) =>
        applyCrudFilterPlaceholderBody(bodyItems, {
          ...fieldAffordanceOptions,
          addInlineDefaultWidth: true,
        })
      )

      return transformers
    }

    case 'W1E':
    case 'WME': {
      const transformers: CrudFilterBodyTransformer[] = []

      if (wideHeadSplit) {
        transformers.push((bodyItems) =>
          applyCrudFilterWideHeadSplitBody(bodyItems, true)
        )
      }

      transformers.push((bodyItems) =>
        applyCrudFilterPlaceholderBody(bodyItems, {
          ...fieldAffordanceOptions,
          addInlineDefaultWidth: wideHeadSplit,
        })
      )

      return transformers
    }

    case 'CMP':
    case 'CME':
    default:
      return [
        (bodyItems) => applyCrudFilterPlaceholderBody(bodyItems, fieldAffordanceOptions),
      ]
  }
}

function applyCrudFilterBodyTransformers(
  bodyItems: any[],
  transformers: CrudFilterBodyTransformer[]
) {
  return transformers.reduce(
    (currentBodyItems, transformBodyItems) => transformBodyItems(currentBodyItems),
    bodyItems
  )
}

export function applyCrudFilterLayoutBody(options: {
  bodyItems: any[]
  modeCode: CrudFilterLayoutModeCode | null
  wideHeadSplit?: boolean
  mobileStacked?: boolean
  labelStyle?: CrudFilterFieldAffordanceOptions['labelStyle']
}) {
  const { modeCode, wideHeadSplit = false, mobileStacked = false, labelStyle } = options
  const fieldAffordanceOptions = { labelStyle }
  const transformers = [
    ...buildCrudFilterModeTransformers({
      modeCode,
      wideHeadSplit,
      fieldAffordanceOptions,
    }),
    ...(modeCode?.endsWith('P')
      ? [
          (bodyItems: any[]) =>
            applyCrudFilterInlineToolbarBody(bodyItems, fieldAffordanceOptions),
        ]
      : []),
    ...(mobileStacked ? [applyCrudFilterMobileStackedBody] : []),
  ]

  return applyCrudFilterBodyTransformers(options.bodyItems, transformers)
}
