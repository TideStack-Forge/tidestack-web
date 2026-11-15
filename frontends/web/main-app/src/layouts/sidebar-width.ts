import type { CSSProperties } from 'react'

export const DEFAULT_SIDEBAR_WIDTH = 200
export const DEFAULT_SIDEBAR_MIN_WIDTH = 160
export const DEFAULT_SIDEBAR_MAX_WIDTH = 360
export const SIDEBAR_WIDTH_SETTING_NAME = 'sidebar-width'

const LAYOUT_SIDEBAR_WIDTH_OPEN_VAR = '--layout-sidebar-width-open'
const SIDEBAR_WIDTH_OPEN_VAR = '--sidebar-width-open'

export interface SidebarWidthConfig {
  width: number
  minWidth: number
  maxWidth: number
  resizable: boolean
}

function parseNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return undefined
}

function parseBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'string') {
    if (value === 'true') {
      return true
    }
    if (value === 'false') {
      return false
    }
  }

  return undefined
}

function readConfigValue(config: any, flatKey: string, nestedValue: unknown): unknown {
  if (!config || typeof config !== 'object') {
    return nestedValue
  }

  if (config[flatKey] !== undefined) {
    return config[flatKey]
  }

  return nestedValue
}

export function clampSidebarWidth(
  width: number,
  minWidth: number,
  maxWidth: number
): number {
  const lowerBound = Math.min(minWidth, maxWidth)
  const upperBound = Math.max(minWidth, maxWidth)
  return Math.round(Math.min(Math.max(width, lowerBound), upperBound))
}

export function resolveSidebarWidthConfig(appConfig: any): SidebarWidthConfig {
  const sidebarConfig = appConfig?.sidebar
  const rawWidth = readConfigValue(appConfig, 'sidebar.width', sidebarConfig?.width)
  const rawMinWidth = readConfigValue(
    appConfig,
    'sidebar.minWidth',
    sidebarConfig?.minWidth
  )
  const rawMaxWidth = readConfigValue(
    appConfig,
    'sidebar.maxWidth',
    sidebarConfig?.maxWidth
  )
  const rawResizable = readConfigValue(
    appConfig,
    'sidebar.resizable',
    sidebarConfig?.resizable
  )

  const minWidth = parseNumber(rawMinWidth) ?? DEFAULT_SIDEBAR_MIN_WIDTH
  const maxWidth = parseNumber(rawMaxWidth) ?? DEFAULT_SIDEBAR_MAX_WIDTH
  const width = clampSidebarWidth(
    parseNumber(rawWidth) ?? DEFAULT_SIDEBAR_WIDTH,
    minWidth,
    maxWidth
  )

  return {
    width,
    minWidth: Math.min(minWidth, maxWidth),
    maxWidth: Math.max(minWidth, maxWidth),
    resizable: parseBoolean(rawResizable) ?? true,
  }
}

export function readUserWidthPreference(
  storage: Pick<Storage, 'getItem'> | null | undefined,
  settingName = SIDEBAR_WIDTH_SETTING_NAME
): number | undefined {
  if (!storage) {
    return undefined
  }

  return parseNumber(storage.getItem(settingName))
}

export function resolveSidebarWidth(
  config: SidebarWidthConfig,
  userPreference?: number
): number {
  if (!config.resizable) {
    return clampSidebarWidth(config.width, config.minWidth, config.maxWidth)
  }

  if (typeof userPreference === 'number' && Number.isFinite(userPreference)) {
    return clampSidebarWidth(userPreference, config.minWidth, config.maxWidth)
  }

  return clampSidebarWidth(config.width, config.minWidth, config.maxWidth)
}

export function createSidebarWidthStyle(
  width: number | null | undefined
): CSSProperties | undefined {
  if (typeof width !== 'number' || !Number.isFinite(width)) {
    return undefined
  }

  const normalizedWidth = `${Math.round(width)}px`
  return {
    [LAYOUT_SIDEBAR_WIDTH_OPEN_VAR]: normalizedWidth,
    [SIDEBAR_WIDTH_OPEN_VAR]: normalizedWidth,
  } as CSSProperties
}

export function applySidebarWidthStyle(
  target: HTMLElement | null | undefined,
  width: number | null | undefined
) {
  if (!target) {
    return
  }

  if (typeof width !== 'number' || !Number.isFinite(width)) {
    target.style.removeProperty(LAYOUT_SIDEBAR_WIDTH_OPEN_VAR)
    target.style.removeProperty(SIDEBAR_WIDTH_OPEN_VAR)
    return
  }

  const normalizedWidth = `${Math.round(width)}px`
  target.style.setProperty(LAYOUT_SIDEBAR_WIDTH_OPEN_VAR, normalizedWidth)
  target.style.setProperty(SIDEBAR_WIDTH_OPEN_VAR, normalizedWidth)
}
