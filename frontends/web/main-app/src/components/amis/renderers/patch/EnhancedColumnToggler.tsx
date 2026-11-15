import { i18nService } from '@/common/i18n'
import React from 'react'
// @ts-ignore
import Sortable from 'sortablejs'
import { Overlay, PopOver, RootClose, noop } from 'amis-core'
import { Button, Checkbox, Icon } from 'amis-ui'

export interface ColumnState {
  id: string
  name: string
  label: string
  toggled: boolean
  fixed?: 'left' | 'right' | 'none'
  originalIndex: number
  currentIndex: number
  locked?: boolean
}

interface EnhancedColumnTogglerProps {
  columns: ColumnState[]
  onReset: () => void
  onCancel: () => void
  onConfirm: (columns: ColumnState[]) => void
  onClose: () => void
  classnames: any
  classPrefix: string
  render: any
  translate: any
  isOpened: boolean
  target?: HTMLElement | null
  popOverContainer?: () => HTMLElement
  env: any
  maxFixedLeft?: number
  maxFixedRight?: number
}

interface EnhancedColumnTogglerState {
  localColumns: ColumnState[]
  sortableInstance?: Sortable
}

function moveColumn(
  columns: ColumnState[],
  oldIndex: number,
  newIndex: number
) {
  const nextColumns = [...columns]

  if (
    oldIndex === newIndex ||
    oldIndex < 0 ||
    newIndex < 0 ||
    oldIndex >= nextColumns.length ||
    newIndex >= nextColumns.length
  ) {
    return nextColumns
  }

  nextColumns.splice(newIndex, 0, nextColumns.splice(oldIndex, 1)[0])
  return nextColumns
}

export function normalizeColumnStates(columns: ColumnState[]) {
  const unlockedColumns = columns.filter((column) => !column.locked)
  const lockedColumns = columns.filter((column) => column.locked)
  const leftFixedColumns = unlockedColumns.filter(
    (column) => column.fixed === 'left'
  )
  const normalColumns = unlockedColumns.filter(
    (column) => !column.fixed || column.fixed === 'none'
  )
  const rightFixedColumns = unlockedColumns.filter(
    (column) => column.fixed === 'right'
  )

  return [
    ...leftFixedColumns,
    ...normalColumns,
    ...rightFixedColumns,
    ...lockedColumns,
  ].map((column, index) => ({
    ...column,
    currentIndex: index,
  }))
}

export class EnhancedColumnToggler extends React.Component<
  EnhancedColumnTogglerProps,
  EnhancedColumnTogglerState
> {
  static defaultProps = {
    maxFixedLeft: 3,
    maxFixedRight: 3,
  }

  private containerRef = React.createRef<HTMLDivElement>()
  private initTimeout?: ReturnType<typeof setTimeout>

  constructor(props: EnhancedColumnTogglerProps) {
    super(props)
    this.state = {
      localColumns: normalizeColumnStates(props.columns),
    }
  }

  componentDidUpdate(prevProps: EnhancedColumnTogglerProps) {
    if (prevProps.columns !== this.props.columns) {
      this.setState({ localColumns: normalizeColumnStates(this.props.columns) })
    }

    if (!prevProps.isOpened && this.props.isOpened) {
      this.initTimeout = setTimeout(() => {
        this.initSortable()
      }, 100)
    }

    if (prevProps.isOpened && !this.props.isOpened) {
      this.destroySortable()
    }
  }

  componentWillUnmount() {
    if (this.initTimeout) {
      clearTimeout(this.initTimeout)
    }
    this.destroySortable()
  }

  destroySortable() {
    if (this.state.sortableInstance) {
      this.state.sortableInstance.destroy()
      this.setState({ sortableInstance: undefined })
    }
  }

  initSortable() {
    this.destroySortable()

    if (!this.containerRef.current) {
      console.warn('EnhancedColumnToggler: containerRef is null')
      return
    }

    try {
      const sortable = new Sortable(this.containerRef.current, {
        animation: 150,
        ghostClass: 'is-dragging',
        chosenClass: 'sortable-chosen',
        dragClass: 'sortable-drag',
        filter: '.drag-handle--disabled',
        handle: '.drag-handle',
        forceFallback: true,
        fallbackClass: 'sortable-fallback',
        fallbackOnBody: true,
        swapThreshold: 0.65,
        onMove: (evt: any) => {
          const { dragged, related, willInsertAfter } = evt

          if (!dragged || !related) {
            return true
          }

          const draggedIndex = parseInt(dragged.dataset?.index || '0', 10)
          const relatedIndex = parseInt(related.dataset?.index || '0', 10)

          const draggedColumn = this.state.localColumns[draggedIndex]
          const relatedColumn = this.state.localColumns[relatedIndex]

          if (!draggedColumn || !relatedColumn) {
            return true
          }

          if (draggedColumn.locked || relatedColumn.locked) {
            return false
          }

          const insertIndex = willInsertAfter ? relatedIndex + 1 : relatedIndex
          return this.isValidInsertPosition(
            draggedColumn.fixed || 'none',
            insertIndex
          )
        },
        onEnd: (evt: any) => {
          if (
            evt.oldIndex === undefined ||
            evt.newIndex === undefined ||
            evt.oldIndex === evt.newIndex
          ) {
            return
          }

          this.setState((prevState) => ({
            localColumns: normalizeColumnStates(
              moveColumn(prevState.localColumns, evt.oldIndex, evt.newIndex)
            ),
          }))
        },
      })

      this.setState({ sortableInstance: sortable })
    } catch (error) {
      console.warn('EnhancedColumnToggler: failed to initialize sortable', error)
    }
  }

  isValidInsertPosition(
    draggedFixed: 'left' | 'right' | 'none',
    insertIndex: number
  ) {
    const { localColumns } = this.state
    const lockedCount = localColumns.filter((column) => column.locked).length
    const maxAllowedIndex =
      lockedCount > 0 ? localColumns.length - lockedCount : localColumns.length

    const leftFixedCount = localColumns.filter(
      (column) => column.fixed === 'left'
    ).length
    const rightFixedColumns = localColumns.filter(
      (column) => column.fixed === 'right' && !column.locked
    )
    const rightFixedStartIndex = maxAllowedIndex - rightFixedColumns.length

    if (draggedFixed === 'left') {
      return (
        insertIndex >= 0 &&
        insertIndex <= leftFixedCount &&
        insertIndex < maxAllowedIndex
      )
    }

    if (draggedFixed === 'right') {
      return (
        insertIndex >= rightFixedStartIndex && insertIndex <= maxAllowedIndex
      )
    }

    return (
      insertIndex >= leftFixedCount && insertIndex <= rightFixedStartIndex
    )
  }

  handleToggleColumn = (columnId: string) => {
    this.setState({
      localColumns: this.state.localColumns.map((column) =>
        column.id === columnId
          ? {
              ...column,
              toggled: !column.toggled,
            }
          : column
      ),
    })
  }

  handleFixedChange = (columnId: string, fixed: 'left' | 'right' | 'none') => {
    const { maxFixedLeft = 3, maxFixedRight = 3 } = this.props
    const { localColumns } = this.state
    const currentLeftCount = localColumns.filter(
      (column) => column.fixed === 'left'
    ).length
    const currentRightCount = localColumns.filter(
      (column) => column.fixed === 'right'
    ).length
    const targetColumn = localColumns.find((column) => column.id === columnId)

    if (!targetColumn) {
      return
    }

    if (
      fixed === 'left' &&
      targetColumn.fixed !== 'left' &&
      currentLeftCount >= maxFixedLeft
    ) {
      this.props.env?.notify?.(
        'warning',
        i18nService
          .getManager()
          .tCommon('table.columns.maxFixedLeft', '最多固定 {{count}} 列到左侧', {
            count: maxFixedLeft,
          })
      )
      return
    }

    if (
      fixed === 'right' &&
      targetColumn.fixed !== 'right' &&
      currentRightCount >= maxFixedRight
    ) {
      this.props.env?.notify?.(
        'warning',
        i18nService
          .getManager()
          .tCommon('table.columns.maxFixedRight', '最多固定 {{count}} 列到右侧', {
            count: maxFixedRight,
          })
      )
      return
    }

    const newColumns = localColumns.map((column) =>
      column.id === columnId
        ? {
            ...column,
            fixed,
          }
        : column
    )

    this.setState({
      localColumns: normalizeColumnStates(newColumns),
    })
  }

  canFixTo(side: 'left' | 'right', currentFixed?: 'left' | 'right' | 'none') {
    const { maxFixedLeft = 3, maxFixedRight = 3 } = this.props
    const { localColumns } = this.state

    if (side === 'left') {
      const currentCount = localColumns.filter(
        (column) => column.fixed === 'left'
      ).length
      return currentFixed === 'left' || currentCount < maxFixedLeft
    }

    const currentCount = localColumns.filter(
      (column) => column.fixed === 'right'
    ).length
    return currentFixed === 'right' || currentCount < maxFixedRight
  }

  handleSelectAll = () => {
    const allToggled = this.state.localColumns.every((column) => column.toggled)
    this.setState({
      localColumns: this.state.localColumns.map((column) => ({
        ...column,
        toggled: !allToggled,
      })),
    })
  }

  handleReset = async () => {
    const confirm = this.props.env?.confirm

    if (confirm) {
      const confirmed = await confirm(
        i18nService
          .getManager()
          .tCommon('table.columns.resetConfirm', '请确认是否恢复成默认列配置？')
      )

      if (!confirmed) {
        return
      }
    }

    this.setState({ localColumns: normalizeColumnStates(this.props.columns) })
    this.props.onReset()
  }

  handleCancel = () => {
    this.setState({ localColumns: normalizeColumnStates(this.props.columns) })
    this.props.onCancel()
  }

  handleConfirm = () => {
    this.props.onConfirm(this.state.localColumns)
  }

  render() {
    const {
      classnames: cx,
      classPrefix: ns,
      translate: __,
      isOpened,
      onClose,
      target,
      popOverContainer,
      maxFixedLeft = 3,
      maxFixedRight = 3,
    } = this.props
    const { localColumns } = this.state

    const allToggled = localColumns.every((column) => column.toggled)
    const someToggled = localColumns.some((column) => column.toggled)

    const content = (
      <div className={cx('EnhancedColumnToggler')}>
        <div className={cx('EnhancedColumnToggler-header')}>
          <h4>{__('Table.columnsVisibility')}</h4>
        </div>

        <div className={cx('EnhancedColumnToggler-selectAll')}>
          <Checkbox
            size="sm"
            classPrefix={ns}
            checked={allToggled}
            partial={someToggled && !allToggled}
            onChange={this.handleSelectAll}>
            {__('Select.checkAll')}
          </Checkbox>
        </div>

        <div ref={this.containerRef} className={cx('EnhancedColumnToggler-list')}>
          {localColumns.map((column, index) => {
            const canFixLeft = this.canFixTo('left', column.fixed)
            const canFixRight = this.canFixTo('right', column.fixed)

            return (
              <div
                key={column.id}
                className={cx('EnhancedColumnToggler-item')}
                data-index={index}>
                <Checkbox
                  size="sm"
                  classPrefix={ns}
                  checked={column.toggled}
                  onChange={() => this.handleToggleColumn(column.id)}
                />

                <div
                  className={cx('drag-handle', {
                    'drag-handle--disabled': column.locked,
                  })}>
                  <Icon icon="vxe-drag-handle" className="icon" />
                </div>

                <div>{column.label}</div>

                <div className={cx('EnhancedColumnToggler-fixed')}>
                  <div
                    className={cx('EnhancedColumnToggler-fixedBtn', {
                      'is-active': column.fixed === 'left',
                      'is-disabled': !canFixLeft,
                    })}
                    onClick={() => {
                      if (!canFixLeft) {
                        return
                      }

                      this.handleFixedChange(
                        column.id,
                        column.fixed === 'left' ? 'none' : 'left'
                      )
                    }}
                    title={
                      !canFixLeft && column.fixed !== 'left'
                        ? i18nService
                            .getManager()
                            .tCommon(
                              'table.columns.maxFixedLeft',
                              '最多固定 {{count}} 列到左侧',
                              { count: maxFixedLeft }
                            )
                        : column.fixed === 'left'
                          ? i18nService
                              .getManager()
                              .tCommon('table.columns.unfreeze', '取消冻结列')
                          : i18nService
                              .getManager()
                              .tCommon('table.columns.freezeLeft', '冻结到左侧')
                    }
                    style={{
                      cursor: canFixLeft ? 'pointer' : 'not-allowed',
                      opacity: canFixLeft ? 1 : 0.5,
                    }}>
                    <Icon
                      icon={
                        column.fixed === 'left' ? 'fixed-left-fill' : 'fixed-left'
                      }
                      className="icon"
                    />
                  </div>

                  <div
                    className={cx('EnhancedColumnToggler-fixedBtn', {
                      'is-active': column.fixed === 'right',
                      'is-disabled': !canFixRight,
                    })}
                    onClick={() => {
                      if (!canFixRight) {
                        return
                      }

                      this.handleFixedChange(
                        column.id,
                        column.fixed === 'right' ? 'none' : 'right'
                      )
                    }}
                    title={
                      !canFixRight && column.fixed !== 'right'
                        ? i18nService
                            .getManager()
                            .tCommon(
                              'table.columns.maxFixedRight',
                              '最多固定 {{count}} 列到右侧',
                              { count: maxFixedRight }
                            )
                        : column.fixed === 'right'
                          ? i18nService
                              .getManager()
                              .tCommon('table.columns.unfreeze', '取消冻结列')
                          : i18nService
                              .getManager()
                              .tCommon('table.columns.freezeRight', '冻结到右侧')
                    }
                    style={{
                      cursor: canFixRight ? 'pointer' : 'not-allowed',
                      opacity: canFixRight ? 1 : 0.5,
                    }}>
                    <Icon
                      icon={
                        column.fixed === 'right' ? 'fixed-left-fill' : 'fixed-left'
                      }
                      className="icon"
                      style={{ transform: 'rotateY(180deg)' }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className={cx('EnhancedColumnToggler-footer')}>
          <Button
            size="sm"
            onClick={this.handleReset}
            className={cx('EnhancedColumnToggler-btn')}>
            {i18nService.getManager().tCommon('table.columns.reset', '恢复默认')}
          </Button>

          <Button
            size="sm"
            onClick={this.handleCancel}
            className={cx('EnhancedColumnToggler-btn')}>
            {__('cancel')}
          </Button>

          <Button
            size="sm"
            level="primary"
            onClick={this.handleConfirm}
            className={cx('EnhancedColumnToggler-btn')}>
            {__('confirm')}
          </Button>
        </div>
      </div>
    )

    const body = (
      <RootClose disabled={!isOpened} onRootClose={onClose || noop}>
        {(ref: any) => (
          <div
            className={cx('EnhancedColumnToggler-wrapper')}
            onClick={(event) => event.stopPropagation()}
            ref={ref}>
            {content}
          </div>
        )}
      </RootClose>
    )

    if (!isOpened) {
      return null
    }

    if (popOverContainer) {
      return (
        <Overlay container={popOverContainer} target={() => target} show>
          <PopOver
            overlay
            onHide={onClose}
            classPrefix={ns}
            className={cx('EnhancedColumnToggler-popover')}
            style={{ minWidth: target?.offsetWidth }}>
            {body}
          </PopOver>
        </Overlay>
      )
    }

    return body
  }
}
