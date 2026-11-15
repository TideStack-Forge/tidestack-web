import type {
  StableDragGeometryCache,
  StableDragTabGeometry,
  TabItem,
} from './tabsDragMath'
import { tagAndTagSpacing } from './tabsDragMath'

type CreateTabDragGeometryOptions = {
  tabsList: TabItem[]
  tabElements: Array<HTMLDivElement | null>
  scrollWrapper: HTMLDivElement | null
  draggingTabId: string
}

export function createTabDragGeometry({
  tabsList,
  tabElements,
  scrollWrapper,
  draggingTabId,
}: CreateTabDragGeometryOptions): StableDragGeometryCache | null {
  if (!scrollWrapper) {
    return null
  }

  const wrapperRect = scrollWrapper.getBoundingClientRect()
  if (!wrapperRect.width) {
    return null
  }

  let draggingBounds: { left: number; right: number } | null = null
  let draggingWidth = 0
  const stableTabs: StableDragTabGeometry[] = []

  tabsList.forEach((tab, index) => {
    const tabElement = tabElements[index]
    if (!tabElement) {
      return
    }

    const tabRect = tabElement.getBoundingClientRect()
    const left = tabRect.left - wrapperRect.left + scrollWrapper.scrollLeft
    const geometry: StableDragTabGeometry = {
      tabId: tab.id,
      left,
      right: left + tabRect.width,
      width: tabRect.width,
      midpoint: left + tabRect.width / 2,
    }

    if (tab.id === draggingTabId) {
      draggingBounds = { left: geometry.left, right: geometry.right }
      draggingWidth = tabElement.offsetWidth + tagAndTagSpacing
      return
    }

    stableTabs.push(geometry)
  })

  if (stableTabs.length === 0) {
    return null
  }

  return {
    draggingTabId,
    draggingWidth,
    stripLeft: wrapperRect.left,
    scrollLeft: scrollWrapper.scrollLeft,
    draggingBounds,
    stableTabs,
  }
}

function readTranslateXFromComputedStyle(element: HTMLElement) {
  const transform = window.getComputedStyle(element).transform
  if (!transform || transform === 'none') {
    return 0
  }

  const matrix3dMatch = transform.match(/^matrix3d\((.+)\)$/)
  if (matrix3dMatch) {
    const values = matrix3dMatch[1].split(',').map((value) => Number(value.trim()))
    return Number.isFinite(values[12]) ? values[12] : 0
  }

  const matrixMatch = transform.match(/^matrix\((.+)\)$/)
  if (matrixMatch) {
    const values = matrixMatch[1].split(',').map((value) => Number(value.trim()))
    return Number.isFinite(values[4]) ? values[4] : 0
  }

  return 0
}

export function measureCommittedTabSettleOffset(
  scrollWrapper: HTMLDivElement | null,
  tabElement: HTMLDivElement | null,
  releaseLeft: number
) {
  if (!scrollWrapper || !tabElement) {
    return 0
  }

  const wrapperRect = scrollWrapper.getBoundingClientRect()
  const tabRect = tabElement.getBoundingClientRect()
  const layoutLeft =
    tabRect.left -
    wrapperRect.left +
    scrollWrapper.scrollLeft -
    readTranslateXFromComputedStyle(tabElement)

  return releaseLeft - layoutLeft
}
