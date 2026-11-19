import React from 'react'
import type { RendererProps, SchemaNode } from 'amis'

const DEFAULT_PLACEHOLDER_IMAGE_SRC =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='170' viewBox='0 0 220 170' fill='none'%3E%3Crect x='26' y='36' width='168' height='104' rx='18' fill='%23F8FAFC' stroke='%23CBD5E1' stroke-width='2'/%3E%3Crect x='46' y='56' width='128' height='16' rx='8' fill='%23DCE7F9'/%3E%3Crect x='46' y='84' width='88' height='12' rx='6' fill='%23E2E8F0'/%3E%3Crect x='46' y='108' width='60' height='12' rx='6' fill='%23E2E8F0'/%3E%3Crect x='146' y='82' width='28' height='28' rx='8' fill='%232468F2' opacity='0.14'/%3E%3Cpath d='M160 88V104' stroke='%232468F2' stroke-width='3.2' stroke-linecap='round'/%3E%3Cpath d='M152 96H168' stroke='%232468F2' stroke-width='3.2' stroke-linecap='round'/%3E%3Ccircle cx='64' cy='24' r='10' fill='%23BFDBFE'/%3E%3Ccircle cx='156' cy='20' r='7' fill='%23DBEAFE'/%3E%3C/svg%3E"

export interface DashboardEmptyStateImageAsset {
  src?: string
  alt?: string
  className?: string
  style?: React.CSSProperties
}

export type DashboardEmptyStateImageConfig = DashboardEmptyStateImageAsset | ''

export interface DashboardEditablePlaceholderIndicator {
  src: string
  alt?: string
  className?: string
  style?: React.CSSProperties
}

export interface DashboardEmptyStateSurfaceProps {
  loading: boolean
  render: RendererProps['render']
  onAction?: RendererProps['onAction']
  placeholderSchema: SchemaNode
  placeholderData?: any
  placeholderImage?: DashboardEmptyStateImageConfig
  indicator?: DashboardEditablePlaceholderIndicator
}

function resolvePlaceholderImage(
  placeholderImage?: DashboardEmptyStateImageConfig
): DashboardEmptyStateImageAsset | null {
  if (placeholderImage === '') {
    return null
  }

  if (!placeholderImage) {
    return {
      src: DEFAULT_PLACEHOLDER_IMAGE_SRC,
      alt: '',
    }
  }

  return {
    ...placeholderImage,
    src: placeholderImage.src || DEFAULT_PLACEHOLDER_IMAGE_SRC,
    alt: placeholderImage.alt ?? '',
  }
}

export function DashboardEmptyStateSurface(props: DashboardEmptyStateSurfaceProps) {
  const { loading, render, onAction, placeholderSchema, placeholderData, placeholderImage, indicator } =
    props

  if (loading) {
    return (
      <div className="empty-placeholder">
        {render('loading', {
          type: 'spinner',
          tip: '正在加载组件定义...',
        })}
      </div>
    )
  }

  const contentRenderProps = {
    ...(placeholderData ? { data: placeholderData } : {}),
    ...(onAction ? { onAction } : {}),
  }
  const content =
    Object.keys(contentRenderProps).length > 0
      ? render('render-component', placeholderSchema, contentRenderProps)
      : render('render-component', placeholderSchema)
  const resolvedPlaceholderImage = resolvePlaceholderImage(placeholderImage)
  const illustration = resolvedPlaceholderImage ? (
    <img
      src={resolvedPlaceholderImage.src}
      alt={resolvedPlaceholderImage.alt ?? ''}
      className={['empty-placeholder-image', resolvedPlaceholderImage.className]
        .filter(Boolean)
        .join(' ')}
      style={resolvedPlaceholderImage.style}
      aria-hidden={resolvedPlaceholderImage.alt ? undefined : true}
    />
  ) : null

  if (!indicator?.src) {
    return (
      <div className="empty-placeholder">
        <div className="empty-placeholder-content">
          <div className="empty-placeholder-stack">
            {illustration}
            {content}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="empty-placeholder">
      <img
        src={indicator.src}
        alt={indicator.alt ?? ''}
        className={['empty-placeholder-indicator', indicator.className].filter(Boolean).join(' ')}
        style={indicator.style}
        aria-hidden={indicator.alt ? undefined : true}
      />
      <div className="empty-placeholder-content">
        <div className="empty-placeholder-stack">
          {illustration}
          {content}
        </div>
      </div>
    </div>
  )
}
