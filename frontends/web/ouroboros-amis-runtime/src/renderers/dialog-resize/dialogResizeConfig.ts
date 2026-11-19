export type DialogPresetSize = '' | 'sm' | 'md' | 'lg' | 'xl' | 'full'

export interface DialogResizeConfigInput {
  resizable?: unknown
  sizeSwitchable?: unknown
  sizeOptions?: unknown
}

export interface ResolvedDialogResizeConfig {
  resizable: boolean
  sizeSwitchable: boolean
  sizeOptions: DialogPresetSize[]
}

export const DEFAULT_DIALOG_SIZE_OPTIONS: DialogPresetSize[] = [
  'sm',
  'md',
  'lg',
  'xl',
  'full',
]

const VALID_DIALOG_SIZE_OPTIONS = new Set<DialogPresetSize>([
  '',
  'sm',
  'md',
  'lg',
  'xl',
  'full',
])

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

function readConfigValue(config: any, key: string): unknown {
  if (!config || typeof config !== 'object') {
    return undefined
  }

  if (config[key] !== undefined) {
    return config[key]
  }

  return key.split('.').reduce((current, segment) => {
    if (!current || typeof current !== 'object') {
      return undefined
    }

    return current[segment]
  }, config)
}

export function normalizeDialogSizeOptions(value: unknown): DialogPresetSize[] {
  const rawOptions = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : []

  const normalizedOptions = rawOptions.reduce<DialogPresetSize[]>((options, item) => {
    const normalizedItem = String(item ?? '').trim() as DialogPresetSize
    if (
      VALID_DIALOG_SIZE_OPTIONS.has(normalizedItem) &&
      !options.includes(normalizedItem)
    ) {
      options.push(normalizedItem)
    }

    return options
  }, [])

  return normalizedOptions.length ? normalizedOptions : [...DEFAULT_DIALOG_SIZE_OPTIONS]
}

export function resolveDialogResizeConfig(
  schema: DialogResizeConfigInput | null | undefined,
  appConfig: any
): ResolvedDialogResizeConfig {
  const defaultEnabled =
    parseBoolean(readConfigValue(appConfig, 'ui.dialog.resize.enabled')) ?? false
  const configResizable = parseBoolean(
    readConfigValue(appConfig, 'ui.dialog.resize.resizable')
  )
  const configSizeSwitchable = parseBoolean(
    readConfigValue(appConfig, 'ui.dialog.resize.sizeSwitchable')
  )
  const configSizeOptions = readConfigValue(appConfig, 'ui.dialog.resize.sizes')

  return {
    resizable: parseBoolean(schema?.resizable) ?? configResizable ?? defaultEnabled,
    sizeSwitchable:
      parseBoolean(schema?.sizeSwitchable) ?? configSizeSwitchable ?? defaultEnabled,
    sizeOptions: normalizeDialogSizeOptions(schema?.sizeOptions ?? configSizeOptions),
  }
}
