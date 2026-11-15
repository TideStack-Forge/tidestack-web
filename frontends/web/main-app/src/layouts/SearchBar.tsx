import type { CSSProperties } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { openMenuItem } from '@/common/menus'
import { i18nService } from '@/common/i18n'

import { Icon } from './Icon'
import { MenuBadge } from './menu/MenuBadge'
import type { MenuItem } from './menu/menuTypes'
import { resolveMenuItemIcon } from './menu/menuIcon'
import { ScrollBar } from './ScrollBar'

interface SearchBarProps {
  menu?: any
  theme?: string
  onJump?: () => void
  collapsed?: boolean
}

interface SearchResultMenuItem extends MenuItem {
  path: string
  title: string
  icon?: any
  level: number
  parentId?: string
  hasChildren: boolean
}

interface FloatingSearchPanelPosition {
  left: number
  top: number
  width: number
}

function fuzzyQuery(arr: any[] = [], val: string): any[] {
  return arr.flatMap((item) => {
    if (item.children && item.children.length) {
      const children = fuzzyQuery(item.children, val)
      if (children && children.length) {
        return [{ ...item, children }]
      }
      return item.title.includes(val) ? [{ ...item }] : []
    }
    return item.title.includes(val) ? [item] : []
  })
}

function flatArray(arr: any[] = [], level = 1): SearchResultMenuItem[] {
  return arr.flatMap((item) => {
    const entry = {
      ...item,
      key: item.key,
      parent: item.parent,
      url: item.url,
      fullPath: item.fullPath,
      showMode: item.showMode,
      path: item.path || item.url || item.fullPath || '',
      title: item.title || '',
      icon: item.icon || '',
      level,
      hasChildren: Boolean(item.children && item.children.length > 0),
      parentId: item.parentId,
    }
    const children = item.children && item.children.length > 0
      ? flatArray(item.children, level + 1)
      : []
    return [entry, ...children]
  })
}

export function SearchBar({ menu = {}, theme = '', onJump, collapsed = false }: SearchBarProps) {
  const [input, setInput] = useState('')
  const [showResult, setShowResult] = useState(false)
  const [floatingPanelPosition, setFloatingPanelPosition] = useState<FloatingSearchPanelPosition | null>(null)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const plainButtonStyle = {
    appearance: 'none' as const,
    WebkitAppearance: 'none' as const,
    background: 'transparent',
    border: 'none',
    padding: 0,
    margin: 0,
    color: 'inherit',
    font: 'inherit',
    lineHeight: 'inherit',
    textAlign: 'inherit' as const,
    boxSizing: 'border-box' as const,
    cursor: 'pointer',
  }

  const floatingPanelStyle = useMemo(() => {
    if (!collapsed || !floatingPanelPosition) {
      return undefined
    }

    return {
      ['--search-floating-left' as const]: `${floatingPanelPosition.left}px`,
      ['--search-floating-top' as const]: `${floatingPanelPosition.top}px`,
      ['--search-floating-width' as const]: `${floatingPanelPosition.width}px`,
    } as CSSProperties
  }, [collapsed, floatingPanelPosition])

  function getResultKey(item: SearchResultMenuItem, index: number) {
    return item.key || item.path || `${item.parentId || 'root'}:${item.title}:${item.level}:${index}`
  }

  function tCommon(key: string, defaultText: string) {
    return i18nService.getManager().tCommon(key, defaultText)
  }

  function updateFloatingPanelPosition() {
    const rect = wrapperRef.current?.getBoundingClientRect()
    if (!rect || !window) return
    const panelWidth = Math.min(320, window.innerWidth - 16)
    const panelPadding = 8
    const inputIconLeft = 14
    const iconSize = 16
    const iconCenterX = rect.left + rect.width / 2
    const activeIconCenterOffset = panelPadding + inputIconLeft + iconSize / 2
    const panelLeft = Math.min(Math.max(8, iconCenterX - activeIconCenterOffset), window.innerWidth - panelWidth - 8)
    setFloatingPanelPosition({
      left: panelLeft,
      top: rect.top,
      width: panelWidth,
    })
  }

  function closePanel() {
    setShowResult(false)
    setFloatingPanelPosition(null)
    inputRef.current?.blur()
  }

  function performSearch(value: string) {
    const keyword = typeof value === 'string' ? value.trim() : ''
    if (!keyword) {
      setShowResult(collapsed)
      return
    }
    setShowResult(true)
  }

  function openPanel() {
    if (collapsed) {
      updateFloatingPanelPosition()
      setShowResult(true)
      const focusInput = () => {
        inputRef.current?.focus()
      }
      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(focusInput)
      } else {
        setTimeout(focusInput, 0)
      }
      return
    }
    performSearch(input)
  }

  function handleInputFocus() {
    if (collapsed && !showResult) {
      openPanel()
      return
    }

    if (input) {
      performSearch(input)
    }
  }

  useEffect(() => {
    if (!collapsed) {
      setFloatingPanelPosition(null)
      if (!input.trim()) {
        setShowResult(false)
      }
    }
  }, [collapsed, input])

  useEffect(() => {
    if (!collapsed || !showResult) {
      return undefined
    }

    const handleViewportChange = () => updateFloatingPanelPosition()
    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('scroll', handleViewportChange, true)
    return () => {
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('scroll', handleViewportChange, true)
    }
  }, [collapsed, showResult])

  const newTreeMenu = useMemo(() => {
    const keyword = input.trim()
    if (!keyword) {
      return []
    }
    const menuData = menu?.globalMenu || []
    return flatArray(fuzzyQuery(menuData, keyword)).filter((item) => item.level <= 3)
  }, [input, menu])

  return (
    <div
      ref={wrapperRef}
      className={['search-wrapper', showResult ? 'is-active' : '', collapsed ? 'is-collapsed' : ''].filter(Boolean).join(' ')}
      style={floatingPanelStyle}
    >
      <div
        className="search-box"
        onClick={() => {
          if (collapsed) {
            openPanel()
          }
        }}
      >
        <div className={`search-input${showResult ? ' search-input--active' : ''}`} style={{ zIndex: showResult ? 9999 : 1 }}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            autoComplete="off"
            placeholder={tCommon('search.placeholder', '请输入菜单名称')}
            className="search-input__field"
            onChange={(event) => {
              const value = event.target.value
              setInput(value)
              performSearch(value)
            }}
            onFocus={handleInputFocus}
          />
        </div>
        <i className="fa-solid fa-magnifying-glass search-icon" style={{ zIndex: showResult ? 9999 : 1 }}></i>
        {showResult ? (
          <div className="search-results" style={{ zIndex: 9998 }} onClick={(event) => event.stopPropagation()}>
            <div className="search-results__content">
              <p className="search-results__count">
                {tCommon('search.results', '结果')}
                <span>{newTreeMenu.length}</span>
              </p>
              {newTreeMenu.length > 0 ? (
                <ScrollBar className="search-results__scrollbar">
                  <ul className="search-results__list">
                    {newTreeMenu.map((item, index) => (
                      <li
                        key={getResultKey(item, index)}
                        className={[
                          item.level === 1 ? 'search-results__item--primary' : 'search-results__item--secondary',
                          item.hasChildren ? 'search-results__item--group' : '',
                        ].join(' ')}
                      >
                        <button
                          type="button"
                          style={{ ...plainButtonStyle, display: 'flex', alignItems: 'center', width: '100%', textAlign: 'left' }}
                          onClick={() => {
                            if (item.hasChildren) return
                            openMenuItem(item)
                            closePanel()
                            onJump?.()
                          }}
                        >
                          {item.icon && item.level === 1 ? (
                            <div className="search-results__icon">
                              <Icon
                                icon={resolveMenuItemIcon(item)}
                                theme={theme}
                                className="search-results__menu-icon"
                                iconWidth="16px"
                              />
                            </div>
                          ) : null}
                          <span>{item.title}</span>
                          <MenuBadge item={item} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </ScrollBar>
              ) : (
                <div className="search-results__empty">
                  <div className="search-results__empty-icon">
                    <Icon icon="icon-search-empty" theme={theme} className="search-empty" iconWidth="110px" />
                  </div>
                  <p className="search-results__empty-text">{tCommon('search.noResults', '未检索到匹配功能')}</p>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
      {showResult ? (
        <button
          type="button"
          className="search-overlay hidden-xs"
          style={plainButtonStyle}
          onClick={closePanel}
        ></button>
      ) : null}
    </div>
  )
}
