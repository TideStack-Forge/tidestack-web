import { useEffect, useMemo, useState } from 'react'

import AmisComponent from '@/components/amis/AmisComponent'

const tooltipSelector = '.cxd-Tooltip, .amis-Tooltip, .a-Tooltip, [role="tooltip"]'

function getVisibleTooltipCount() {
  if (typeof document === 'undefined') {
    return 0
  }

  return Array.from(document.querySelectorAll(tooltipSelector)).filter((element) => {
    const style = window.getComputedStyle(element)
    const rect = element.getBoundingClientRect()
    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      Number(style.opacity || '1') !== 0 &&
      rect.width > 0 &&
      rect.height > 0
    )
  }).length
}

const pageStyle = {
  minHeight: '100vh',
  padding: '32px 24px 48px',
  background: 'linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%)',
} as const

const headerStyle = { maxWidth: '1040px', margin: '0 auto 20px' } as const
const titleStyle = {
  margin: 0,
  fontSize: '30px',
  lineHeight: 1.2,
  color: '#0f172a',
} as const
const descriptionStyle = {
  margin: '10px 0 0',
  maxWidth: '760px',
  color: '#475569',
  fontSize: '14px',
  lineHeight: 1.7,
} as const

const statusBarStyle = {
  maxWidth: '1040px',
  margin: '0 auto 16px',
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  flexWrap: 'wrap',
} as const

const statusBadgeStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '32px',
  padding: '6px 12px',
  borderRadius: '8px',
  border: '1px solid #cbd5e1',
  background: '#ffffff',
  color: '#0f172a',
  fontSize: '13px',
  fontWeight: 600,
} as const

const surfaceStyle = {
  maxWidth: '1040px',
  minHeight: '420px',
  margin: '0 auto',
  padding: '24px',
  borderRadius: '8px',
  background: '#ffffff',
  boxShadow: '0 18px 44px rgba(15, 23, 42, 0.08)',
  border: '1px solid #e2e8f0',
} as const

export function AmisTooltipPatchPage() {
  const [visibleTooltipCount, setVisibleTooltipCount] = useState(0)

  useEffect(() => {
    const updateTooltipCount = () => {
      const nextCount = getVisibleTooltipCount()
      setVisibleTooltipCount(nextCount)
      ;(window as any).__AMIS_TOOLTIP_PATCH_PLAYGROUND__ = {
        visibleTooltipCount: nextCount,
        tooltipSelector,
      }
    }

    updateTooltipCount()
    const observer = new MutationObserver(updateTooltipCount)
    observer.observe(document.body, {
      attributes: true,
      childList: true,
      subtree: true,
    })
    const interval = window.setInterval(updateTooltipCount, 250)

    return () => {
      observer.disconnect()
      window.clearInterval(interval)
      delete (window as any).__AMIS_TOOLTIP_PATCH_PLAYGROUND__
    }
  }, [])

  const amisSchema = useMemo(
    () => ({
      type: 'page',
      title: '',
      body: [
        {
          type: 'tpl',
          tpl: '<div style="margin-bottom:16px;color:#334155;font-size:14px;line-height:1.7">把鼠标停在按钮上等 tooltip 出现，然后直接点击按钮打开弹窗。修复生效时，弹窗出现后 tooltip 计数会回到 0。</div>',
        },
        {
          type: 'action',
          label: '打开弹窗',
          level: 'primary',
          size: 'lg',
          tooltip: '这是按钮 tooltip，点击打开弹窗后不应该继续悬浮在最上层',
          tooltipPlacement: 'top',
          actionType: 'dialog',
          dialog: {
            title: '基座弹窗层',
            closeOnEsc: true,
            body: [
              {
                type: 'tpl',
                tpl: '<div style="min-width:360px;min-height:120px;color:#334155;font-size:14px;line-height:1.8">这个弹窗来自 AMIS actionType=dialog。验收点：弹窗打开后，按钮 tooltip 不应停留在弹窗之上。</div>',
              },
            ],
            actions: [
              {
                type: 'button',
                label: '关闭',
                actionType: 'close',
              },
            ],
          },
        },
      ],
    }),
    []
  )

  return (
    <section style={pageStyle} data-testid="amis-tooltip-patch-page">
      <header style={headerStyle}>
        <h1 style={titleStyle}>AMIS Tooltip Patch 验证页</h1>
        <p style={descriptionStyle}>
          运行在前端基座 main-app 内，使用基座的 AmisComponent 和当前安装的 amis-ui。
        </p>
      </header>
      <div style={statusBarStyle}>
        <span style={statusBadgeStyle} data-testid="visible-tooltip-count">
          可见 Tooltip：{visibleTooltipCount}
        </span>
      </div>
      <div style={surfaceStyle}>
        <AmisComponent amisSchema={amisSchema} />
      </div>
    </section>
  )
}
