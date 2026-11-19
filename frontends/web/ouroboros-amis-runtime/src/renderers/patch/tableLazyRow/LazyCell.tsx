import React from 'react'
import { InView } from 'react-intersection-observer'

import { scheduleLazyRowRender } from './LazyRow'

const LAZY_CELL_RENDER_WORK_UNITS = 8

export interface LazyCellProps {
  cellKey: string
  classnames: (...tokens: any[]) => string
  column: any
  deferRender?: boolean
  item: any
  props: any
  renderCell: () => React.ReactNode
}

interface LazyCellState {
  visible: boolean
  renderReady: boolean
}

export class LazyCell extends React.PureComponent<LazyCellProps, LazyCellState> {
  private cancelScheduledRender: (() => void) | null = null
  private mounted = false

  constructor(props: LazyCellProps) {
    super(props)

    this.state = {
      visible: !props.deferRender,
      renderReady: !props.deferRender,
    }
  }

  componentDidMount() {
    this.mounted = true
  }

  componentDidUpdate() {
    if (this.state.visible && !this.state.renderReady) {
      this.revealCell()
    }
  }

  componentWillUnmount() {
    this.mounted = false
    this.cancelPendingRender()
  }

  private cancelPendingRender() {
    if (this.cancelScheduledRender) {
      this.cancelScheduledRender()
      this.cancelScheduledRender = null
    }
  }

  private scheduleRender() {
    if (this.state.renderReady || this.cancelScheduledRender) {
      return
    }

    this.cancelScheduledRender = scheduleLazyRowRender(
      LAZY_CELL_RENDER_WORK_UNITS,
      () => {
        this.cancelScheduledRender = null

        if (this.mounted && !this.state.renderReady) {
          this.setState({ renderReady: true })
        }
      }
    )
  }

  private revealCell() {
    if (this.state.renderReady) {
      return
    }

    if (!this.props.deferRender) {
      this.cancelPendingRender()
      this.setState({ renderReady: true })
      return
    }

    this.scheduleRender()
  }

  private handleVisibleChange = (visible: boolean) => {
    if (!visible || this.state.visible) {
      return
    }

    if (!this.props.deferRender) {
      this.cancelPendingRender()
      this.setState({ visible: true, renderReady: true })
      return
    }

    this.setState({ visible: true }, () => {
      this.revealCell()
    })
  }

  private renderPlaceholderCell(ref: React.Ref<HTMLTableCellElement>) {
    const { classnames: cx, column, item, props } = this.props
    const columnName = column?.name

    if (columnName && item?.rowSpans?.[columnName] === 0) {
      return null
    }

    const rowSpan =
      props?.rowSpan || (columnName ? item?.rowSpans?.[columnName] : undefined)

    return (
      <td
        ref={ref}
        rowSpan={rowSpan > 1 ? rowSpan : undefined}
        style={props?.style}
        className={props?.className}
        data-lazy-cell-placeholder="true">
        <div className={cx('Table-emptyBlock')}>&nbsp;</div>
      </td>
    )
  }

  render() {
    if (this.state.renderReady || !this.props.deferRender) {
      return this.props.renderCell()
    }

    return (
      <InView
        onChange={this.handleVisibleChange}
        fallbackInView={false}
        skip={this.state.visible}>
        {({ ref }) => this.renderPlaceholderCell(ref)}
      </InView>
    )
  }
}
