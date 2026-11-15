export type TableLayoutMode = 'auto' | 'fixed'

export interface TableLayoutDecisionInput {
  affixHeader?: boolean
  autoFillHeight?: boolean | Record<string, number>
  tableLayout?: TableLayoutMode
}

export interface TableAffixHeaderPaddingInput {
  affixHeader?: boolean
  autoFillHeight?: boolean | Record<string, number>
}

export interface ScrollbarGutterMeasurement {
  offsetWidth: number
  clientWidth: number
}

export function resolvePatchedTableLayout(
  props: TableLayoutDecisionInput
): TableLayoutMode {
  if (props.tableLayout === 'auto' || props.tableLayout === 'fixed') {
    return props.tableLayout
  }

  return props.affixHeader !== false && !props.autoFillHeight ? 'fixed' : 'auto'
}

export function shouldReserveAffixHeaderScrollbarGutter(
  props: TableAffixHeaderPaddingInput
): boolean {
  return props.affixHeader !== false && !props.autoFillHeight
}

export function resolveScrollbarGutterWidth(
  measurement?: ScrollbarGutterMeasurement | null
): number {
  if (!measurement) {
    return 0
  }

  return Math.max(measurement.offsetWidth - measurement.clientWidth, 0)
}

export function resolveAffixHeaderWrapperPaddingRight(
  props: TableAffixHeaderPaddingInput,
  measurement?: ScrollbarGutterMeasurement | null
): string {
  if (!shouldReserveAffixHeaderScrollbarGutter(props)) {
    return ''
  }

  const scrollbarGutterWidth = resolveScrollbarGutterWidth(measurement)
  return scrollbarGutterWidth > 0 ? `${scrollbarGutterWidth}px` : ''
}
