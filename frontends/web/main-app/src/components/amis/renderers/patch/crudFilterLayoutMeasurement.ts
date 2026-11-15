import {
  CRUD_FILTER_GRID_DIVIDER_CLASS,
  CRUD_FILTER_GRID_TOOLBAR_CLASS,
  CRUD_FILTER_LAYOUT_RAIL_STATE,
  CRUD_FILTER_LAYOUT_STACKED_STATE,
  CRUD_FILTER_MOBILE_STACKED_TOOLBAR_CLASS,
  CRUD_FILTER_TOOLBAR_ITEM_CLASS,
  type CrudFilterLayoutState,
} from './crudFilterLayoutConstants'

export type CrudFilterLayoutMeasurementState = {
  layoutState: CrudFilterLayoutState | null
  wideHeadSplit: boolean
  alignLabelWidth: boolean
}

export type CrudFilterLayoutMeasurements = {
  containerWidth: number
  toolbarWidth: number
  toolbarHeight: number
  labelWidth: string | null
  railTop: string | null
}

const FILTER_TOOLBAR_MIN_SIDE_INSET = 4
const FILTER_LABEL_SELECTOR = '.cxd-Form-label'
const FILTER_FORM_SELECTOR = '.cxd-Crud-filter.cxd-Crud-filter--flat .cxd-Form'
const FILTER_TOOLBAR_ITEM_SELECTOR = `.${CRUD_FILTER_GRID_TOOLBAR_CLASS}, .${CRUD_FILTER_TOOLBAR_ITEM_CLASS}, .${CRUD_FILTER_MOBILE_STACKED_TOOLBAR_CLASS}`
const FILTER_RAIL_COMPACT_ITEMS_SELECTOR =
  '.crud-filter-item--field:not(.crud-filter-item--wide-head)'
const OBSERVED_NODE_KEY = '__ouroborosFilterLayoutObserved'

type ElementLike = {
  children?: ArrayLike<any>
  classList?: {
    contains?: (className: string) => boolean
  }
  getBoundingClientRect?: () => {
    width: number
    height: number
    left: number
    right: number
    top: number
  }
  lastElementChild?: any
  querySelector?: (selector: string) => any
  querySelectorAll?: (selector: string) => ArrayLike<any>
  scrollWidth?: number
}

function hasClass(node: any, className: string) {
  return Boolean(node?.classList?.contains?.(className))
}

function isElementLike(node: any): node is ElementLike {
  return Boolean(
    node &&
    typeof node === 'object' &&
    typeof node.querySelector === 'function' &&
    typeof node.getBoundingClientRect === 'function'
  )
}

function toElementArray(nodes: ArrayLike<any> | null | undefined) {
  return Array.from(nodes || []).filter((item) => isElementLike(item))
}

export function findCrudFilterFormElement(root: ElementLike | null) {
  if (!root?.querySelector) {
    return null
  }

  const form = root.querySelector(FILTER_FORM_SELECTOR)

  return isElementLike(form) ? (form as HTMLElement) : null
}

export function findCrudFilterToolbarItem(form: ElementLike | null) {
  if (!form?.querySelector) {
    return null
  }

  const toolbarItem = form.querySelector(FILTER_TOOLBAR_ITEM_SELECTOR)

  return isElementLike(toolbarItem) ? (toolbarItem as HTMLElement) : null
}

export function measureCrudFilterToolbarWidth(toolbarItem: ElementLike) {
  const toolbarRect = toolbarItem.getBoundingClientRect?.()
  const buttonElements = toElementArray(toolbarItem.querySelectorAll?.('.cxd-Button'))

  if (!toolbarRect) {
    return 0
  }

  if (!buttonElements.length) {
    return Math.ceil(toolbarRect.width)
  }

  const buttonRects = buttonElements.map((button) => {
    const rect = button.getBoundingClientRect?.()

    return rect || { width: 0, height: 0, left: 0, right: 0, top: 0 }
  })
  const contentLeft = Math.min(...buttonRects.map((rect) => rect.left))
  const contentRight = Math.max(...buttonRects.map((rect) => rect.right))

  return Math.ceil(contentRight - contentLeft + FILTER_TOOLBAR_MIN_SIDE_INSET * 2)
}

export function measureCrudFilterToolbarHeight(toolbarItem: ElementLike) {
  const buttonElements = toElementArray(toolbarItem.querySelectorAll?.('.cxd-Button'))

  if (!buttonElements.length) {
    return Math.ceil(toolbarItem.getBoundingClientRect?.().height || 0)
  }

  return Math.ceil(
    Math.max(
      ...buttonElements.map((button) => button.getBoundingClientRect?.().height || 0)
    )
  )
}

export function collectCrudFilterFieldItems(form: ElementLike) {
  const row = form.querySelector?.(':scope > .cxd-Form-row')

  if (!isElementLike(row) || !row.children) {
    return []
  }

  return toElementArray(row.children).filter(
    (item) =>
      !hasClass(item, CRUD_FILTER_GRID_TOOLBAR_CLASS) &&
      !hasClass(item, CRUD_FILTER_TOOLBAR_ITEM_CLASS) &&
      !hasClass(item, CRUD_FILTER_GRID_DIVIDER_CLASS)
  ) as HTMLElement[]
}

export function measureCrudFilterLabelWidth(fieldItems: ElementLike[]) {
  const labelWidths = fieldItems
    .map((item) => {
      const label = item.querySelector?.(FILTER_LABEL_SELECTOR)

      if (!isElementLike(label)) {
        return 0
      }

      const tplField = label.querySelector?.('.cxd-TplField')
      const labelContent = isElementLike(tplField)
        ? tplField
        : isElementLike(label.lastElementChild)
          ? label.lastElementChild
          : label
      const labelRect = labelContent.getBoundingClientRect?.()
      const scrollWidth = Number(labelContent.scrollWidth || 0)

      if (!labelRect && !scrollWidth) {
        return 0
      }

      return Math.ceil(Math.max(scrollWidth, labelRect?.width || 0))
    })
    .filter((width) => width > 0)

  if (!labelWidths.length) {
    return null
  }

  return `${Math.max(...labelWidths)}px`
}

export function measureCrudFilterAlignedLabelWidth(
  fieldItems: ElementLike[],
  options: Pick<CrudFilterLayoutMeasurementState, 'alignLabelWidth'>
) {
  if (!options.alignLabelWidth) {
    return null
  }

  return measureCrudFilterLabelWidth(fieldItems)
}

export function measureCrudFilterRailTop(
  form: ElementLike,
  options: Pick<CrudFilterLayoutMeasurementState, 'layoutState' | 'wideHeadSplit'>
) {
  const { layoutState, wideHeadSplit } = options

  if (
    !wideHeadSplit ||
    (layoutState !== CRUD_FILTER_LAYOUT_RAIL_STATE &&
      layoutState !== CRUD_FILTER_LAYOUT_STACKED_STATE)
  ) {
    return null
  }

  const toolbarItem = findCrudFilterToolbarItem(form)

  if (!toolbarItem) {
    return null
  }

  const compactItems = toElementArray(
    form.querySelectorAll?.(FILTER_RAIL_COMPACT_ITEMS_SELECTOR)
  )

  if (!compactItems.length) {
    return '0px'
  }

  const formRect = form.getBoundingClientRect?.()

  if (!formRect) {
    return null
  }

  const compactTop = Math.min(
    ...compactItems.map((item) => item.getBoundingClientRect?.().top || 0)
  )

  return `${Math.max(0, Math.round(compactTop - formRect.top))}px`
}

export function measureCrudFilterLayout(
  form: ElementLike,
  options: CrudFilterLayoutMeasurementState
): CrudFilterLayoutMeasurements | null {
  const toolbarItem = findCrudFilterToolbarItem(form)

  if (!toolbarItem) {
    return null
  }

  const formRect = form.getBoundingClientRect?.()

  if (!formRect) {
    return null
  }

  const fieldItems = collectCrudFilterFieldItems(form)

  return {
    containerWidth: Math.ceil(formRect.width),
    toolbarWidth: measureCrudFilterToolbarWidth(toolbarItem),
    toolbarHeight: measureCrudFilterToolbarHeight(toolbarItem),
    labelWidth: measureCrudFilterAlignedLabelWidth(fieldItems, options),
    railTop: measureCrudFilterRailTop(form, options),
  }
}

export function switchCrudFilterLayoutObserverTarget(
  observer: ResizeObserver,
  nextTarget: HTMLElement | null
) {
  const mutableObserver = observer as any
  const observedNode = mutableObserver[OBSERVED_NODE_KEY] as HTMLElement | undefined

  if (observedNode === nextTarget) {
    return
  }

  if (observedNode) {
    observer.unobserve(observedNode)
  }

  if (nextTarget) {
    observer.observe(nextTarget)
  }

  mutableObserver[OBSERVED_NODE_KEY] = nextTarget || undefined
}

export function clearCrudFilterLayoutObserverTarget(observer: ResizeObserver) {
  const mutableObserver = observer as any
  const observedNode = mutableObserver[OBSERVED_NODE_KEY] as HTMLElement | undefined

  if (!observedNode) {
    return
  }

  observer.unobserve(observedNode)
  mutableObserver[OBSERVED_NODE_KEY] = undefined
}
