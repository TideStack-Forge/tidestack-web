import { useMemo, useState } from 'react'
import { i18nService } from '@/common/i18n'
import { doJump } from '@/common/menus'
import { resolveReturnUrl } from '@/common/auth/flow'
import { replaceLocation, refreshRouter } from '@/router/routerFacade'
import { store } from '@/store/storeFacade'

const containerStyle = {
  minHeight: '100vh',
  padding: '48px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background:
    'radial-gradient(circle at top left, rgba(83, 159, 245, 0.18), transparent 38%), linear-gradient(180deg, rgba(240, 247, 255, 0.96) 0%, rgba(248, 250, 252, 1) 100%)',
} as const

const panelStyle = {
  width: 'min(640px, 100%)',
  padding: '40px',
  borderRadius: '24px',
  background: 'rgba(255, 255, 255, 0.92)',
  border: '1px solid rgba(83, 159, 245, 0.18)',
  boxShadow: '0 24px 60px rgba(35, 52, 94, 0.12)',
} as const

const badgeStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '6px 12px',
  borderRadius: '999px',
  background: 'rgba(83, 159, 245, 0.12)',
  color: '#2f5fa7',
  fontSize: '13px',
  fontWeight: 600,
} as const

const titleStyle = {
  margin: '20px 0 12px',
  color: '#23345e',
  fontSize: '32px',
  lineHeight: 1.35,
} as const

const descriptionStyle = {
  margin: 0,
  color: 'rgba(35, 52, 94, 0.78)',
  fontSize: '15px',
  lineHeight: 1.75,
} as const

const metaStyle = {
  marginTop: '28px',
  padding: '16px 18px',
  borderRadius: '16px',
  background: 'rgba(35, 52, 94, 0.04)',
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  flexWrap: 'wrap',
} as const

const metaLabelStyle = {
  color: 'rgba(35, 52, 94, 0.58)',
  fontSize: '13px',
} as const

const metaValueStyle = {
  color: '#23345e',
  fontSize: '15px',
  fontWeight: 600,
} as const

const actionsStyle = {
  marginTop: '28px',
  display: 'flex',
  gap: '12px',
  flexWrap: 'wrap',
} as const

const buttonStyle = {
  minWidth: '132px',
  padding: '10px 18px',
  borderRadius: '12px',
  border: '1px solid rgba(35, 52, 94, 0.14)',
  background: '#ffffff',
  color: '#23345e',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'pointer',
} as const

const primaryButtonStyle = {
  ...buttonStyle,
  background: 'linear-gradient(135deg, #3d7cf7 0%, #5aa8ff 100%)',
  borderColor: 'transparent',
  color: '#ffffff',
} as const

function tCommon(key: string, fallback: string) {
  return i18nService.getManager().tCommon(key, fallback)
}

async function logout() {
  await store.dispatch('user/logout')
}

export function ErrorAfterLoginPage() {
  const [retrying, setRetrying] = useState(false)
  const [initializationError, setInitializationError] = useState(
    store.getters['user/initializationError']
  )
  const userInfo = store.getters['user/userInfo'] || store.getters.userInfo || {}
  const userDisplayName = useMemo(() => {
    const employee = userInfo.employee as Record<string, unknown> | undefined
    const displayName =
      typeof userInfo.displayName === 'string' ? userInfo.displayName : ''
    const employeeName = typeof employee?.name === 'string' ? employee.name : ''
    const nickName = typeof userInfo.nickName === 'string' ? userInfo.nickName : ''
    const userIdentity =
      typeof userInfo.userIdentity === 'string' ? userInfo.userIdentity : ''

    return (
      displayName ||
      employeeName ||
      nickName ||
      userIdentity ||
      tCommon('user.unknown', '未知用户')
    )
  }, [userInfo])

  async function retry() {
    if (retrying) return
    setRetrying(true)
    try {
      const result = await store.dispatch('user/init')
      if (!result?.success) {
        setInitializationError(store.getters['user/initializationError'])
        return
      }
      refreshRouter()
      const url = new URL(window.location.href)
      const returnUrl = resolveReturnUrl(url.searchParams.get('redirect'))
      if (returnUrl === '/' || returnUrl.startsWith('/errorAfterLogin')) {
        doJump()
      } else {
        await replaceLocation(returnUrl)
      }
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div style={containerStyle}>
      <section style={panelStyle} data-testid="error-after-login-page">
        <div style={badgeStyle}>
          {initializationError
            ? tCommon('error.initializationTitle', '加载失败')
            : tCommon('error.permissionTitle', '菜单权限未配置')}
        </div>
        <h1 style={titleStyle}>
          {initializationError
            ? tCommon('error.initializationHeading', '暂时无法加载用户信息')
            : tCommon(
                'error.permissionHeading',
                '当前账号已登录，但暂时无法进入后台导航'
              )}
        </h1>
        <p style={descriptionStyle}>
          {initializationError
            ? initializationError.msg
            : tCommon(
                'error.permissionMessage',
                '请联系管理员为该账号分配后台菜单资源后再重试。'
              )}
        </p>
        {!initializationError && (
          <div style={metaStyle}>
            <span style={metaLabelStyle}>{tCommon('error.currentUser', '当前用户')}</span>
            <span style={metaValueStyle}>{userDisplayName}</span>
          </div>
        )}
        <div style={actionsStyle}>
          <button
            style={primaryButtonStyle}
            type="button"
            disabled={retrying}
            onClick={() => void retry()}>
            {retrying
              ? tCommon('error.retrying', '正在加载…')
              : tCommon('error.retry', '重新加载')}
          </button>
          <button style={buttonStyle} type="button" onClick={() => void logout()}>
            {tCommon('userMenu.logout', '退出')}
          </button>
        </div>
      </section>
    </div>
  )
}
