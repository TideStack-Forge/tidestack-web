import type { AxiosResponse } from 'axios'
import type { ApiResponse } from '@/utils/http'

export const STARTUP_STAGE_KEYS = {
  NETWORK_LINK: 'network-link',
  BACKEND_LINK: 'backend-link',
  SERVICE_BOOTSTRAP: 'service-bootstrap',
  SERVICE_AVAILABLE: 'service-available',
} as const

export type StartupStageKey = (typeof STARTUP_STAGE_KEYS)[keyof typeof STARTUP_STAGE_KEYS]

export type StartupProbeKind =
  | 'network-link-unreachable'
  | 'backend-link-unavailable'
  | 'service-bootstrap'
  | 'service-bootstrap-failed'
  | 'service-runtime-error'
  | 'service-available'

export interface StartupProbeResult {
  kind: StartupProbeKind
  stage: StartupStageKey
  available: boolean
  retrying: boolean
  failed: boolean
  httpStatus?: number
  code?: number
  message: string
  debugMessage?: string
  serverErrorMessage?: string
  startupState?: string
  startupPhase?: string
  module?: string
  progressMessage?: string
  failureSource?: string
  failureType?: string
  failureMessage?: string
}

type StartupProbeApiResponse = ApiResponse<any> & {
  startupState?: string
  startupPhase?: string
  module?: string
  progressMessage?: string
  failureSource?: string
  failureType?: string
  failureMessage?: string
}

export type StartupProbeResponse =
  AxiosResponse<ApiResponse<any>> | ApiResponse<any> | false | null | undefined

const PROXY_UNAVAILABLE_STATUSES = new Set([502, 504, 521, 522, 523, 524])
const PROXY_ERROR_PATTERN =
  /(bad gateway|gateway timeout|proxy|upstream|nginx|dev-server|econnrefused|socket hang up)/i

function readResponseData(
  response: StartupProbeResponse
): StartupProbeApiResponse | undefined {
  if (!response || response === false) {
    return undefined
  }

  if (
    'data' in response &&
    response.data &&
    typeof response.data === 'object' &&
    'code' in response.data
  ) {
    return response.data as StartupProbeApiResponse
  }

  if ('code' in response) {
    return response as StartupProbeApiResponse
  }

  return undefined
}

function readHttpStatus(
  response: StartupProbeResponse,
  data?: ApiResponse<any>
): number | undefined {
  if (
    response &&
    response !== false &&
    'status' in response &&
    typeof response.status === 'number'
  ) {
    return response.status
  }

  if (data && typeof data.status === 'number') {
    return data.status
  }

  if (data && typeof data.code === 'number' && data.code > 99) {
    return data.code
  }

  return undefined
}

function buildResult(
  kind: StartupProbeKind,
  stage: StartupStageKey,
  message: string,
  options: Partial<
    Pick<
      StartupProbeResult,
      | 'httpStatus'
      | 'code'
      | 'debugMessage'
      | 'serverErrorMessage'
      | 'startupState'
      | 'startupPhase'
      | 'module'
      | 'progressMessage'
      | 'failureSource'
      | 'failureType'
      | 'failureMessage'
    >
  > = {}
): StartupProbeResult {
  return {
    kind,
    stage,
    available: kind === 'service-available',
    retrying: kind !== 'service-available',
    failed: kind === 'service-bootstrap-failed' || kind === 'service-runtime-error',
    message,
    ...options,
  }
}

function normalizeStartupState(startupState?: string) {
  return startupState ? startupState.toUpperCase() : undefined
}

function buildDiagnosticOptions(
  data: StartupProbeApiResponse | undefined,
  httpStatus: number | undefined,
  code: number | undefined,
  debugMessage: string
) {
  return {
    httpStatus,
    code,
    debugMessage,
    startupState: data?.startupState,
    startupPhase: data?.startupPhase,
    module: data?.module,
    progressMessage: data?.progressMessage,
    failureSource: data?.failureSource,
    failureType: data?.failureType,
    failureMessage: data?.failureMessage,
  }
}

export function classifyStartupProbe(response: StartupProbeResponse): StartupProbeResult {
  const data = readResponseData(response)
  const httpStatus = readHttpStatus(response, data)
  const code = data?.code
  const message = data?.msg || ''
  const startupState = normalizeStartupState(data?.startupState)
  const debugMessage = [httpStatus ? `HTTP ${httpStatus}` : '', message]
    .filter(Boolean)
    .join(' · ')
  const diagnosticOptions = buildDiagnosticOptions(data, httpStatus, code, debugMessage)

  if (code === 0 || startupState === 'READY') {
    return buildResult(
      'service-available',
      STARTUP_STAGE_KEYS.SERVICE_AVAILABLE,
      '服务已可用，正在进入系统。',
      diagnosticOptions
    )
  }

  if (startupState === 'BOOTSTRAPPING') {
    return buildResult(
      'service-bootstrap',
      STARTUP_STAGE_KEYS.SERVICE_BOOTSTRAP,
      message || '后端已响应，系统仍在加载，请稍候。',
      {
        ...diagnosticOptions,
        serverErrorMessage: data?.progressMessage || message || debugMessage,
      }
    )
  }

  if (startupState === 'FAILED') {
    return buildResult(
      'service-bootstrap-failed',
      STARTUP_STAGE_KEYS.SERVICE_AVAILABLE,
      message || '服务启动失败，请查看服务器端错误信息。',
      {
        ...diagnosticOptions,
        serverErrorMessage: data?.failureMessage || message || debugMessage,
      }
    )
  }

  if (httpStatus === undefined || httpStatus <= 0 || (!data && response === false)) {
    return buildResult(
      'network-link-unreachable',
      STARTUP_STAGE_KEYS.NETWORK_LINK,
      '正在尝试连接后端 API，当前暂未收到有效响应。',
      diagnosticOptions
    )
  }

  if (PROXY_UNAVAILABLE_STATUSES.has(httpStatus) || PROXY_ERROR_PATTERN.test(message)) {
    return buildResult(
      'backend-link-unavailable',
      STARTUP_STAGE_KEYS.BACKEND_LINK,
      '已收到前端代理层响应，正在等待反向代理连接后端服务。',
      {
        ...diagnosticOptions,
        serverErrorMessage: message || undefined,
      }
    )
  }

  return buildResult(
    'service-runtime-error',
    STARTUP_STAGE_KEYS.SERVICE_AVAILABLE,
    message || '服务已响应，但应用返回错误。',
    {
      ...diagnosticOptions,
      serverErrorMessage: data?.failureMessage || message || debugMessage,
    }
  )
}
