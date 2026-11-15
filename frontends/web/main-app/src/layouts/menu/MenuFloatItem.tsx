import type { ReactNode } from 'react'

interface MenuFloatItemProps {
  className?: string
  onClick?: () => void
  children?: ReactNode
}

export function MenuFloatItem({ className = '', onClick, children }: MenuFloatItemProps) {
  return (
    <div className={className ? `app-float-menu__item ${className}` : 'app-float-menu__item'} onClick={onClick}>
      {children}
    </div>
  )
}
