import type { CSSProperties, MutableRefObject } from 'react'

import { Icon } from '../Icon'
import { DEFAULT_MENU_ICON } from '../menu/menuIcon'
import type { TabItem, TabsLabels } from './types'
import type { TabsContextMenuController } from './useTabsContextMenu'
import type { TabsDragController } from './useTabsDrag'
import type { TabsOverflowController } from './useTabsOverflow'

const plainButtonStyle: CSSProperties = {
  appearance: 'none',
  WebkitAppearance: 'none',
  background: 'transparent',
  border: 'none',
  padding: 0,
  margin: 0,
  color: 'inherit',
  font: 'inherit',
  lineHeight: 'inherit',
  textAlign: 'inherit',
  boxSizing: 'border-box',
  cursor: 'pointer',
}

type TabsViewProps = {
  tabsList: TabItem[]
  activeTabId: string
  tabsRef: MutableRefObject<Array<HTMLDivElement | null>>
  labels: TabsLabels
  overflow: TabsOverflowController
  drag: TabsDragController
  contextMenu: TabsContextMenuController
}

export function TabsView({
  tabsList,
  activeTabId,
  tabsRef,
  labels,
  overflow,
  drag,
  contextMenu,
}: TabsViewProps) {
  const trackClassName = [
    'app-tabs__track',
    overflow.showLeftArrow ? 'is-left-overhang-hidden' : '',
    overflow.showRightArrow ? 'is-right-overhang-hidden' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={['app-tabs', drag.isReleaseSettleQueued ? 'is-release-prep' : '']
        .filter(Boolean)
        .join(' ')}>
      <button
        type="button"
        aria-label="向左滚动标签"
        className={[
          'app-tabs__arrow',
          'app-tabs__arrow--left',
          overflow.showLeftArrow ? '' : 'is-hidden',
        ]
          .filter(Boolean)
          .join(' ')}
        style={plainButtonStyle}
        onMouseDown={(event) => overflow.handleArrowMouseDown(-1, event)}
        onClick={() => overflow.handleArrowClick(-1)}>
        <Icon icon="icon-tab-arrow-left" iconWidth="12px" />
      </button>

      <div className={trackClassName}>
        <span
          className={[
            'app-tabs__edge-shadow',
            'app-tabs__edge-shadow--left',
            overflow.showLeftArrow ? 'is-visible' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          aria-hidden="true"></span>
        <div
          ref={overflow.scrollWrapperRef}
          className="app-tabs__wrapper app-tabs__scroll"
          onScroll={overflow.refresh}
          onWheel={overflow.handleWheel}>
          {tabsList.map((tab, index) => {
            const presentation = drag.getTabPresentation(tab.id, index)
            return (
              <div
                key={tab.id}
                ref={(node: HTMLDivElement | null) => {
                  tabsRef.current[index] = node
                }}
                className={[
                  'app-tabs__item',
                  tab.id === activeTabId ? 'is-active' : '',
                  tab.isFixed ? 'is-fixed' : '',
                  presentation.isDragging ? 'is-dragging' : '',
                  presentation.settleClassName,
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={presentation.style}
                role="button"
                tabIndex={0}
                aria-label={tab.title ? `切换到标签 ${tab.title}` : '切换标签'}
                onMouseDown={(event) => drag.handleTabMouseDown(event, tab.id)}
                onClick={() => drag.handleTabClick(tab.id)}
                onContextMenu={(event) => contextMenu.open(event, tab.id)}
                onKeyDown={(event) => drag.handleTabKeyDown(event, tab.id)}
                onTransitionEnd={(event) => drag.handleTabTransitionEnd(event, tab.id)}>
                <Icon
                  icon={tab.icon || DEFAULT_MENU_ICON}
                  className="app-tabs__item-icon"
                  iconWidth="14px"
                />
                <span className="app-tabs__item-title" style={{ pointerEvents: 'none' }}>
                  {tab.title}
                </span>
                {tab.isFixed ? (
                  <i
                    className="fa-solid fa-thumbtack app-tabs__item-pin"
                    style={{ pointerEvents: 'none' }}></i>
                ) : (
                  <button
                    type="button"
                    aria-label={tab.title ? `关闭标签 ${tab.title}` : '关闭标签'}
                    className="app-tabs__item-close"
                    data-tab-drag-ignore="true"
                    style={{
                      ...plainButtonStyle,
                      pointerEvents: drag.isTabDragActive ? 'none' : 'auto',
                    }}
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      contextMenu.closeTab(tab.id)
                    }}>
                    <Icon
                      icon="icon-tab-close"
                      className="app-tabs__item-close-icon"
                      iconWidth="12px"
                    />
                  </button>
                )}
              </div>
            )
          })}
        </div>
        <span
          className={[
            'app-tabs__edge-shadow',
            'app-tabs__edge-shadow--right',
            overflow.showRightArrow ? 'is-visible' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          aria-hidden="true"></span>
      </div>

      <button
        type="button"
        aria-label="向右滚动标签"
        className={[
          'app-tabs__arrow',
          'app-tabs__arrow--right',
          overflow.showRightArrow ? '' : 'is-hidden',
        ]
          .filter(Boolean)
          .join(' ')}
        style={plainButtonStyle}
        onMouseDown={(event) => overflow.handleArrowMouseDown(1, event)}
        onClick={() => overflow.handleArrowClick(1)}>
        <Icon icon="icon-tab-arrow-right" iconWidth="12px" />
      </button>

      <ul
        style={{ top: contextMenu.position.top, left: contextMenu.position.left }}
        className="app-tabs__menu"
        hidden={!contextMenu.visible}>
        <li>
          <button
            type="button"
            className="app-tabs__menu-button"
            disabled={Boolean(contextMenu.selectedTab?.isFixed)}
            aria-disabled={Boolean(contextMenu.selectedTab?.isFixed)}
            style={{ opacity: contextMenu.selectedTab?.isFixed ? 0.45 : 1 }}
            onClick={contextMenu.closeSelectedTab}>
            {labels.close}
          </button>
        </li>
        <li>
          <button
            type="button"
            className="app-tabs__menu-button"
            onClick={contextMenu.toggleSelectedTabFixed}>
            {labels.toggleFixed}
          </button>
        </li>
        <li>
          <button
            type="button"
            className="app-tabs__menu-button"
            onClick={contextMenu.closeOtherTabs}>
            {labels.closeOthers}
          </button>
        </li>
        <li>
          <button
            type="button"
            className="app-tabs__menu-button"
            onClick={contextMenu.closeRightTabs}>
            {labels.closeRight}
          </button>
        </li>
      </ul>
      <button
        type="button"
        className="app-tabs__overlay"
        style={plainButtonStyle}
        hidden={!contextMenu.visible}
        onClick={contextMenu.close}></button>
    </div>
  )
}
