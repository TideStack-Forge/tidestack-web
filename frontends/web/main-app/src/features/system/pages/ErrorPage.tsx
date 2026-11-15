import { useEffect, useMemo, useState } from 'react'
import systemApi from '@/common/api/system'
import { STARTUP_STAGE_KEYS } from '@/common/api/startupProbe'
import type { StartupProbeResult, StartupStageKey } from '@/common/api/startupProbe'
import { i18nService } from '@/common/i18n'
import type { CSSProperties } from 'react'

const containerStyle = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxSizing: 'border-box',
  overflow: 'auto',
  padding: '48px 24px',
  background: '#ffffff',
} as const

const innerStyle = {
  width: 'min(980px, 100%)',
  margin: '0 auto',
  padding: 0,
} as const

const titleRowStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
} as const

const titleStyle = {
  margin: 0,
  color: '#1f2937',
  fontSize: '30px',
  fontWeight: 700,
  lineHeight: '40px',
  letterSpacing: 0,
  textAlign: 'center',
} as const

const stageGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
  gap: '22px',
  margin: '36px 0 0',
  padding: 0,
  listStyle: 'none',
} as const

const detailStyle = {
  margin: '28px auto 0',
  maxWidth: '720px',
  padding: 0,
  color: '#374151',
  textAlign: 'center',
} as const

const detailMessageStyle = {
  margin: 0,
  fontSize: '15px',
  fontWeight: 500,
  lineHeight: '24px',
} as const

const detailMetaStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'center',
  gap: '8px 18px',
  margin: '10px 0 0',
  color: '#6b7280',
  fontSize: '13px',
  lineHeight: '20px',
} as const

const detailServerMessageStyle = {
  margin: '6px 0 0',
  color: '#9ca3af',
  fontSize: '12px',
  lineHeight: '18px',
  overflowWrap: 'anywhere',
  whiteSpace: 'pre-wrap',
} as const

const detailServerMessageCollapsedStyle = {
  ...detailServerMessageStyle,
  display: '-webkit-box',
  overflow: 'hidden',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: 2,
} as CSSProperties

const detailToggleButtonStyle = {
  margin: '4px 0 0',
  padding: 0,
  border: 0,
  background: 'transparent',
  color: '#6b7280',
  fontSize: '12px',
  lineHeight: '18px',
  cursor: 'pointer',
} as const

const COLLAPSIBLE_SERVER_MESSAGE_LENGTH = 96

function tCommon(key: string, fallback: string) {
  return i18nService.getManager().tCommon(key, fallback)
}

const STARTUP_STAGE_DEFINITIONS = [
  {
    key: STARTUP_STAGE_KEYS.NETWORK_LINK,
    labelKey: 'startup.stage.networkLink',
    labelFallback: '网络链路',
    descriptionKey: 'startup.stage.networkLink.description',
    descriptionFallback: '正在尝试连接后端 API，当前暂未收到有效响应。',
    illustration: require('@/assets/images/startup/startup-network-link.svg'),
  },
  {
    key: STARTUP_STAGE_KEYS.BACKEND_LINK,
    labelKey: 'startup.stage.backendLink',
    labelFallback: '后端链路',
    descriptionKey: 'startup.stage.backendLink.description',
    descriptionFallback: '已收到前端代理层响应，正在等待反向代理连接后端服务。',
    illustration: require('@/assets/images/startup/startup-backend-link.svg'),
  },
  {
    key: STARTUP_STAGE_KEYS.SERVICE_BOOTSTRAP,
    labelKey: 'startup.stage.serviceBootstrap',
    labelFallback: '服务启动',
    descriptionKey: 'startup.stage.serviceBootstrap.description',
    descriptionFallback: '后端已响应，系统仍在加载，请稍候。',
    illustration: require('@/assets/images/startup/startup-service-bootstrap.svg'),
  },
  {
    key: STARTUP_STAGE_KEYS.SERVICE_AVAILABLE,
    labelKey: 'startup.stage.serviceAvailable',
    labelFallback: '服务可用',
    errorLabelKey: 'startup.stage.serviceError',
    errorLabelFallback: '错误',
    descriptionKey: 'startup.stage.serviceAvailable.description',
    descriptionFallback: '服务已可用，正在进入系统。',
    errorDescriptionKey: 'startup.stage.serviceError.description',
    errorDescriptionFallback: '服务已响应，但应用返回错误。',
    illustration: require('@/assets/images/startup/startup-service-available.svg'),
  },
] as const

const INITIAL_PROBE_RESULT: StartupProbeResult = {
  kind: 'network-link-unreachable',
  stage: STARTUP_STAGE_KEYS.NETWORK_LINK,
  available: false,
  retrying: true,
  failed: false,
  message: '正在尝试连接后端 API，当前暂未收到有效响应。',
}

interface StartupPageState {
  result: StartupProbeResult
  attempts: number
  checkedAt?: Date
}

type StartupStageStatus = 'complete' | 'active' | 'failed' | 'pending'

function getStageCardStyle(status: StartupStageStatus): CSSProperties {
  return {
    position: 'relative',
    minHeight: '198px',
    padding: '0 12px',
    background: 'transparent',
    opacity: status === 'pending' ? 0.58 : 1,
    transition: 'opacity 160ms ease',
  }
}

function getStageStatus(
  stage: StartupStageKey,
  currentStage: StartupStageKey,
  retrying: boolean,
  failed: boolean
): StartupStageStatus {
  const currentIndex = STARTUP_STAGE_DEFINITIONS.findIndex(
    (definition) => definition.key === currentStage
  )
  const stageIndex = STARTUP_STAGE_DEFINITIONS.findIndex(
    (definition) => definition.key === stage
  )
  if (currentStage === STARTUP_STAGE_KEYS.SERVICE_AVAILABLE && !retrying) {
    return 'complete'
  }
  if (stageIndex < currentIndex) {
    return 'complete'
  }
  if (stageIndex === currentIndex && failed) {
    return 'failed'
  }
  if (stageIndex === currentIndex) {
    return 'active'
  }
  return 'pending'
}

function StartupSpinner() {
  return (
    <span style={spinnerStyle} aria-hidden="true" data-testid="startup-stage-spinner" />
  )
}

const spinnerStyle = {
  display: 'inline-block',
  width: '16px',
  height: '16px',
  border: '2px solid #d1d5db',
  borderTopColor: '#2563eb',
  borderRadius: '50%',
  animation: 'startup-spin 0.8s linear infinite',
} as const

function formatCheckedAt(checkedAt?: Date) {
  if (!checkedAt) {
    return tCommon('startup.retry.notYet', '等待首次连接')
  }
  return checkedAt.toLocaleTimeString()
}

function getServerReturnMessage(result: StartupProbeResult) {
  if (result.failureMessage) {
    return result.failureMessage
  }
  if (result.progressMessage) {
    return result.progressMessage
  }
  if (result.serverErrorMessage) {
    return result.serverErrorMessage
  }
  if (result.debugMessage) {
    return result.debugMessage
  }
  return tCommon('startup.serverMessage.empty', '暂未收到服务器端错误信息')
}

function isStartupFailure(result: StartupProbeResult) {
  return result.kind === 'service-bootstrap-failed' || result.failed
}

function isRuntimeError(result: StartupProbeResult) {
  return result.kind === 'service-runtime-error'
}

function isErrorResult(result: StartupProbeResult) {
  return isStartupFailure(result) || isRuntimeError(result)
}

function getServerReturnLabel(result: StartupProbeResult) {
  if (isErrorResult(result)) {
    return tCommon('startup.serverMessage.errorLabel', '服务器端返回错误信息')
  }
  return tCommon('startup.serverMessage.label', '服务器端返回')
}

function shouldCollapseServerMessage(message: string) {
  return message.length > COLLAPSIBLE_SERVER_MESSAGE_LENGTH || message.includes('\n')
}

function getServerMessageStyle(expanded: boolean, collapsible: boolean) {
  return collapsible && !expanded
    ? detailServerMessageCollapsedStyle
    : detailServerMessageStyle
}

function StartupStageBar({
  currentStage,
  retrying,
  failed,
  finalStageError,
}: {
  currentStage: StartupStageKey
  retrying: boolean
  failed: boolean
  finalStageError: boolean
}) {
  return (
    <ol style={stageGridStyle} data-testid="startup-stage-bar">
      {STARTUP_STAGE_DEFINITIONS.map((definition, index) => {
        const status = getStageStatus(definition.key, currentStage, retrying, failed)
        const active = status === 'active' || status === 'failed'
        const complete = status === 'complete'
        const failedStage = status === 'failed'
        return (
          <li key={definition.key} style={stageItemStyle}>
            <div
              style={getStageCardStyle(status)}
              data-stage={definition.key}
              data-status={status}
              aria-current={active ? 'step' : undefined}>
              <div style={getStageNumberStyle(status)}>
                {failedStage
                  ? '!'
                  : active && retrying
                    ? <StartupSpinner />
                    : complete
                      ? '✓'
                      : index + 1}
              </div>
              <img
                src={definition.illustration}
                alt=""
                aria-hidden="true"
                style={stageImageStyle}
                data-testid={`startup-stage-illustration-${definition.key}`}
              />
              <h2 style={getStageTitleStyle(status)}>
                {finalStageError && definition.key === STARTUP_STAGE_KEYS.SERVICE_AVAILABLE
                  ? tCommon(definition.errorLabelKey || definition.labelKey, definition.errorLabelFallback || definition.labelFallback)
                  : tCommon(definition.labelKey, definition.labelFallback)}
              </h2>
            </div>
            {index < STARTUP_STAGE_DEFINITIONS.length - 1 ? (
              <span
                style={getStageArrowStyle(status)}
                aria-hidden="true"
                data-testid="startup-stage-arrow">
                →
              </span>
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

const stageItemStyle = {
  position: 'relative',
} as const

function getStageNumberStyle(status: StartupStageStatus): CSSProperties {
  const complete = status === 'complete'
  const active = status === 'active'
  const failed = status === 'failed'
  return {
    position: 'absolute',
    top: 0,
    left: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    background: failed ? '#fef2f2' : complete ? '#ecfdf3' : active ? '#eff6ff' : '#f3f4f6',
    color: failed ? '#dc2626' : complete ? '#16a34a' : active ? '#2563eb' : '#6b7280',
    fontSize: '14px',
    fontWeight: 700,
  }
}

function getStageArrowStyle(status: StartupStageStatus): CSSProperties {
  return {
    position: 'absolute',
    top: '48px',
    right: '-22px',
    width: '22px',
    color: status === 'failed' ? '#fca5a5' : status === 'pending' ? '#d1d5db' : '#9ca3af',
    fontSize: '28px',
    fontWeight: 500,
    lineHeight: '28px',
    textAlign: 'center',
  }
}

const stageImageStyle = {
  display: 'block',
  width: 'min(132px, 100%)',
  height: '100px',
  margin: '10px auto 16px',
  objectFit: 'contain',
} as const

const stageTitleStyle = {
  margin: 0,
  color: '#1f2937',
  fontSize: '17px',
  fontWeight: 700,
  lineHeight: '24px',
  textAlign: 'center',
} as const

function getStageTitleStyle(status: StartupStageStatus): CSSProperties {
  return {
    ...stageTitleStyle,
    color: status === 'failed' ? '#b91c1c' : stageTitleStyle.color,
  }
}

export function ErrorPage() {
  const [pageState, setPageState] = useState<StartupPageState>({
    result: INITIAL_PROBE_RESULT,
    attempts: 0,
  })
  const [serverMessageExpanded, setServerMessageExpanded] = useState(false)
  const currentStage = useMemo(
    () =>
      STARTUP_STAGE_DEFINITIONS.find(
        (definition) => definition.key === pageState.result.stage
      ),
    [pageState.result.stage]
  )
  const finalStageError =
    isErrorResult(pageState.result) &&
    pageState.result.stage === STARTUP_STAGE_KEYS.SERVICE_AVAILABLE
  const detailMessage =
    isErrorResult(pageState.result)
      ? pageState.result.message
      : currentStage
        ? tCommon(currentStage.descriptionKey, currentStage.descriptionFallback)
        : pageState.result.message
  const serverReturnMessage = getServerReturnMessage(pageState.result)
  const serverReturnMessageCollapsible = shouldCollapseServerMessage(serverReturnMessage)

  useEffect(() => {
    setServerMessageExpanded(false)
  }, [serverReturnMessage])

  useEffect(() => {
    let cancelled = false
    let sequence = 0
    let reloadTimer: number | undefined

    const probe = async () => {
      const currentSequence = ++sequence
      const result = await systemApi.getAppStartupProbe()
      if (cancelled || currentSequence !== sequence) {
        return
      }

      setPageState((previous) => ({
        ...previous,
        result,
        attempts: previous.attempts + 1,
        checkedAt: new Date(),
      }))

      if (result.available) {
        if (pollTimer) {
          window.clearInterval(pollTimer)
        }
        reloadTimer = window.setTimeout(() => {
          if (!cancelled) {
            window.location.reload()
          }
        }, 500)
      }
    }

    const pollTimer = window.setInterval(() => {
      void probe()
    }, 3000)
    void probe()

    return () => {
      cancelled = true
      window.clearInterval(pollTimer)
      if (reloadTimer) {
        window.clearTimeout(reloadTimer)
      }
    }
  }, [])

  return (
    <div style={containerStyle}>
      <style>{'@keyframes startup-spin { to { transform: rotate(360deg); } }'}</style>
      <div style={innerStyle} data-testid="error-page">
        <div style={titleRowStyle}>
          <p style={titleStyle}>{tCommon('error.pleaseWait', '请稍候')}</p>
        </div>
        <StartupStageBar
          currentStage={pageState.result.stage}
          retrying={pageState.result.retrying}
          failed={isErrorResult(pageState.result)}
          finalStageError={finalStageError}
        />
        <div style={detailStyle} data-testid="startup-stage-detail">
          <p style={detailMessageStyle}>{detailMessage}</p>
          <p style={detailMetaStyle}>
            <span>
              {tCommon('startup.retry.attempts', '尝试次数')}：{pageState.attempts}
            </span>
            <span>
              {tCommon('startup.retry.lastChecked', '最近检查')}：
              {formatCheckedAt(pageState.checkedAt)}
            </span>
            {pageState.result.httpStatus ? (
              <span>HTTP：{pageState.result.httpStatus}</span>
            ) : null}
            {pageState.result.code != null ? (
              <span>Code：{pageState.result.code}</span>
            ) : null}
          </p>
          <p
            style={getServerMessageStyle(
              serverMessageExpanded,
              serverReturnMessageCollapsible
            )}
            data-testid="startup-server-message">
            {getServerReturnLabel(pageState.result)}：
            {serverReturnMessage}
          </p>
          {serverReturnMessageCollapsible ? (
            <button
              type="button"
              style={detailToggleButtonStyle}
              data-testid="startup-server-message-toggle"
              onClick={() => setServerMessageExpanded((expanded) => !expanded)}>
              {serverMessageExpanded
                ? tCommon('startup.serverMessage.collapse', '收起')
                : tCommon('startup.serverMessage.expand', '展开完整信息')}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
