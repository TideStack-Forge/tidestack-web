import type { CSSProperties } from 'react'

import type { MenuBadge as MenuBadgeType } from '@/common/menus/registry'

import type { MenuItem } from './menuTypes'
import { useMenuBadge } from './useMenuExtensions'

interface MenuBadgeProps {
  /** 显式徽标；缺省时按 item 从注册中心订阅 */
  badge?: MenuBadgeType
  /** 菜单项对象，用于按引用订阅徽标 */
  item?: MenuItem
}

/**
 * 菜单徽标装饰组件。
 * 形态：dot（红点/彩点）、number（数字，max 溢出显示 99+）、text（短文本）、ribbon（缎带角标）。
 */
export function MenuBadge({ badge: explicitBadge, item }: MenuBadgeProps) {
  const itemBadge = useMenuBadge(item)
  const badge = explicitBadge ?? itemBadge

  if (!badge) {
    return null
  }

  const toneClass = badge.color ? '' : ` menu-badge--tone-${badge.tone || 'danger'}`
  const style = badge.color
    ? ({ '--menu-badge-color': badge.color } as CSSProperties)
    : undefined

  if (badge.type === 'dot') {
    return (
      <span
        className={`menu-badge menu-badge--dot${toneClass}`}
        style={style}
        aria-hidden="true"
      />
    )
  }

  if (badge.type === 'number') {
    if (!badge.showZero && badge.value <= 0) {
      return null
    }
    const max = typeof badge.max === 'number' ? badge.max : 99
    const text = badge.value > max ? `${max}+` : String(badge.value)
    return (
      <span className={`menu-badge menu-badge--number${toneClass}`} style={style}>
        {text}
      </span>
    )
  }

  if (badge.type === 'text') {
    return (
      <span className={`menu-badge menu-badge--text${toneClass}`} style={style}>
        {badge.text}
      </span>
    )
  }

  return (
    <span
      className={`menu-badge menu-badge--ribbon${
        badge.position === 'top-left' ? ' menu-badge--ribbon-left' : ''
      }${toneClass}`}
      style={style}
    >
      {badge.text}
    </span>
  )
}
