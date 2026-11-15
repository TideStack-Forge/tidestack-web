import type React from 'react'
import { isExternal } from '@/utils/url'

interface IconProps {
  icon?: any
  theme?: string
  active?: boolean
  className?: string
  iconWidth?: string
}

function hasExplicitIconWidth(iconWidth?: string) {
  return typeof iconWidth === 'string' && iconWidth.length > 0
}

function resolveIconName(icon: any, theme = 'default', active = false) {
  if (!icon) {
    return null
  }
  if (typeof icon === 'string') {
    return icon
  }
  if (!(typeof icon === 'object' && !Array.isArray(icon))) {
    return null
  }
  const iconSet = icon[theme] || icon
  return iconSet[active ? 'active' : 'default'] || iconSet.default || null
}

function resolveIconType(iconName: string | null) {
  if (!iconName) {
    return null
  }
  const imageRegex = /\.(png|jpe?g|gif|bmp|svg)$/i
  if (imageRegex.test(iconName)) {
    return 'img'
  }
  if ((iconName.startsWith('data:') && iconName.includes('base64')) || iconName.indexOf('.') !== -1) {
    return 'img'
  }
  if (isExternal(iconName)) {
    return 'img'
  }
  if (iconName.startsWith('/')) {
    return 'img'
  }
  if (iconName.startsWith('icon-')) {
    return 'svg'
  }
  return 'class'
}

export function Icon({ icon, theme = '', active = false, className, iconWidth = '24px' }: IconProps) {
  const iconName = resolveIconName(icon, theme || 'default', active)
  const iconType = resolveIconType(iconName)
  const iconStyle = hasExplicitIconWidth(iconWidth) ? ({ '--built-in-icon-size': iconWidth } as React.CSSProperties) : undefined

  if (!iconType || !iconName) {
    return null
  }

  if (iconType === 'img') {
    return (
      <span className={className ? `built-in-icon ${className}` : 'built-in-icon'} style={iconStyle}>
        <img src={iconName} alt="" />
      </span>
    )
  }

  if (iconType === 'svg') {
    return (
      <span className={className ? `built-in-icon ${className}` : 'built-in-icon'} style={iconStyle}>
        <svg aria-hidden="true" className="svg-icon">
          <use xlinkHref={`#${iconName}`} />
        </svg>
      </span>
    )
  }

  return (
    <span className={className ? `built-in-icon ${className}` : 'built-in-icon'} style={iconStyle}>
      <i className={iconName}></i>
    </span>
  )
}
