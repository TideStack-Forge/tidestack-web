import React from 'react'
import { uuidv4 } from 'amis'
import {
  activeCanvasLayout,
  canvasGroupsOverlap,
  graphEdgeGeometry,
  moveCanvasGroup,
  moveCanvasNode,
  modelNamespace,
  NODE_HEIGHT,
  NODE_WIDTH,
  updateCanvasLayout,
  type BusinessModelCanvas,
  type BusinessModelGraphEdge,
  type BusinessModelGraphNode,
  type GraphViewport,
  type Point,
} from './business-model-graph'

type Props = {
  canvas: BusinessModelCanvas
  models: BusinessModelGraphNode[]
  edges: BusinessModelGraphEdge[]
  selected: string | null
  highlighted: Set<string>
  onChange: (canvas: BusinessModelCanvas, before?: BusinessModelCanvas) => void
  onViewportChange: (canvas: BusinessModelCanvas) => void
  readOnly: boolean
  onSelect: (id: string) => void
  onEdge: (edge: BusinessModelGraphEdge) => void
  onAdd: (id: string, point: Point) => void
  onMessage: (message: string) => void
  onActivate: () => void
}
type Gesture = {
  kind: 'node' | 'group' | 'pan'
  id: string
  origin: Point
  base: BusinessModelCanvas
  view: GraphViewport
  moved: boolean
}
export class BusinessModelGraphCanvas extends React.Component<
  Props,
  { view: GraphViewport; dropping: boolean; preview?: BusinessModelCanvas }
> {
  state: {
    view: GraphViewport
    dropping: boolean
    preview?: BusinessModelCanvas
  } = {
    view: { zoom: 1, offset: { x: 0, y: 0 } },
    dropping: false,
  }
  private viewport = React.createRef<HTMLDivElement>()
  private observer?: ResizeObserver
  private gesture?: Gesture
  private ignoreClick = false
  private clickTimer?: ReturnType<typeof setTimeout>
  private visible = true
  private readonly graphId = `business-model-graph-${uuidv4()}`
  private selfRelations(id: string) {
    return this.props.edges.filter((edge) => edge.source === id && edge.target === id)
      .length
  }

  componentDidMount() {
    this.restoreViewport()
    if (typeof ResizeObserver !== 'undefined' && this.viewport.current) {
      this.observer = new ResizeObserver(() => {
        const visible = !!this.viewport.current?.clientWidth
        if (visible && !this.visible) this.props.onActivate()
        this.visible = visible
        if (visible && !this.gesture) this.restoreViewport()
      })
      this.observer.observe(this.viewport.current)
    }
  }
  componentDidUpdate(previous: Props) {
    if (
      previous.canvas.id !== this.props.canvas.id ||
      previous.canvas.grouped !== this.props.canvas.grouped ||
      (!previous.readOnly && this.props.readOnly)
    ) {
      this.gesture = undefined
      if (this.state.preview) this.setState({ preview: undefined })
    }
    if (
      previous.canvas.id !== this.props.canvas.id ||
      previous.canvas.grouped !== this.props.canvas.grouped ||
      previous.models.length !== this.props.models.length
    )
      this.restoreViewport()
  }
  componentWillUnmount() {
    this.observer?.disconnect()
    clearTimeout(this.clickTimer)
  }
  restoreViewport() {
    const saved = activeCanvasLayout(this.props.canvas).viewport
    if (saved) this.setState({ view: saved })
    else this.fit()
  }
  fit = () => {
    const viewport = this.viewport.current
    if (!viewport?.clientWidth || !viewport.clientHeight) return
    const layout = activeCanvasLayout(this.props.canvas)
    const boxes = this.props.models.map((node) => ({
      ...layout.nodes[node.fullName],
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    }))
    if (this.props.canvas.grouped) boxes.push(...Object.values(layout.groups))
    if (!boxes.length) {
      this.setState({ view: { zoom: 1, offset: { x: 40, y: 80 } } })
      return
    }
    const minX = Math.min(...boxes.map((box) => box.x)) - 24
    // Group frames already reserve room for self relations and their headings.
    const minY =
      Math.min(...boxes.map((box) => box.y)) - (this.props.canvas.grouped ? 8 : 72)
    const width = Math.max(...boxes.map((box) => box.x + box.width)) - minX + 24
    const height = Math.max(...boxes.map((box) => box.y + box.height)) - minY + 8
    const zoom = Math.max(
      0.1,
      Math.min(1.1, viewport.clientWidth / width, (viewport.clientHeight - 48) / height)
    )
    this.setState(
      {
        view: {
          zoom,
          offset: {
            x: (viewport.clientWidth - width * zoom) / 2 - minX * zoom,
            y: (viewport.clientHeight - 48 - height * zoom) / 2 - minY * zoom,
          },
        },
      },
      () => this.persistViewport()
    )
  }
  persistViewport() {
    this.props.onViewportChange(
      updateCanvasLayout(this.props.canvas, {
        ...activeCanvasLayout(this.props.canvas),
        viewport: this.state.view,
      })
    )
  }
  zoom = (factor: number) => {
    const viewport = this.viewport.current
    if (!viewport) return
    const { zoom, offset } = this.state.view
    const next = Math.max(0.1, Math.min(3, zoom * factor))
    const x = viewport.clientWidth / 2,
      y = viewport.clientHeight / 2
    this.setState(
      {
        view: {
          zoom: next,
          offset: {
            x: x - ((x - offset.x) * next) / zoom,
            y: y - ((y - offset.y) * next) / zoom,
          },
        },
      },
      () => this.persistViewport()
    )
  }
  pointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (
      event.button !== 0 ||
      !(event.target instanceof Element) ||
      event.target.closest('[data-edge],.business-model-graph__zoom')
    )
      return
    const node = event.target.closest<HTMLElement>('[data-model]')
    const group = event.target.closest<HTMLElement>('[data-group]')
    if (this.props.readOnly && (node || group)) return
    this.gesture = {
      kind: node ? 'node' : group ? 'group' : 'pan',
      id: node?.dataset.model || group?.dataset.group || '',
      origin: { x: event.clientX, y: event.clientY },
      base: this.props.canvas,
      view: this.state.view,
      moved: false,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  pointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const gesture = this.gesture
    if (!gesture) return
    const dx = event.clientX - gesture.origin.x,
      dy = event.clientY - gesture.origin.y
    if (!gesture.moved && Math.hypot(dx, dy) < 4) return
    gesture.moved = true
    if (gesture.kind === 'pan') {
      this.setState({
        view: {
          zoom: gesture.view.zoom,
          offset: {
            x: gesture.view.offset.x + dx,
            y: gesture.view.offset.y + dy,
          },
        },
      })
    } else if (gesture.kind === 'group') {
      this.setState({
        preview: moveCanvasGroup(
          gesture.base,
          gesture.id,
          { x: dx / gesture.view.zoom, y: dy / gesture.view.zoom },
          this.props.models
        ),
      })
    } else {
      const node = this.props.models.find((model) => model.fullName === gesture.id)
      const point = activeCanvasLayout(gesture.base).nodes[gesture.id]
      if (node && point)
        this.setState({
          preview: moveCanvasNode(
            gesture.base,
            node,
            {
              x: point.x + dx / gesture.view.zoom,
              y: point.y + dy / gesture.view.zoom,
            },
            this.selfRelations(node.fullName)
          ),
        })
    }
  }
  pointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const gesture = this.gesture
    if (!gesture) return
    if (gesture.moved) {
      if (
        event.type === 'pointercancel' ||
        (gesture.kind === 'group' &&
          this.state.preview &&
          canvasGroupsOverlap(this.state.preview))
      ) {
        this.setState({ view: gesture.view })
        this.props.onMessage('移动已恢复，模块框保持分离')
      } else if (gesture.kind === 'pan') this.persistViewport()
      else if (this.state.preview) this.props.onChange(this.state.preview, gesture.base)
      this.ignoreClick = true
      this.clickTimer = setTimeout(() => {
        this.ignoreClick = false
      }, 0)
    } else if (gesture.kind === 'node') this.props.onSelect(gesture.id)
    this.gesture = undefined
    this.setState({ preview: undefined })
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId)
  }
  keyMove(event: React.KeyboardEvent, id: string, kind: 'node' | 'group') {
    if (this.props.readOnly) return
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
    event.preventDefault()
    const step = event.shiftKey ? 24 : 8
    const delta = {
      x: event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0,
      y: event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0,
    }
    if (kind === 'group') {
      const next = moveCanvasGroup(this.props.canvas, id, delta, this.props.models)
      if (canvasGroupsOverlap(next)) this.props.onMessage('模块框重叠，请选择其他位置')
      else this.props.onChange(next)
    } else {
      const node = this.props.models.find((model) => model.fullName === id)
      const point = activeCanvasLayout(this.props.canvas).nodes[id]
      if (node)
        this.props.onChange(
          moveCanvasNode(
            this.props.canvas,
            node,
            {
              x: point.x + delta.x,
              y: point.y + delta.y,
            },
            this.selfRelations(node.fullName)
          )
        )
    }
  }
  render() {
    const { models, edges, highlighted, selected } = this.props
    const canvas = this.state.preview || this.props.canvas
    const layout = activeCanvasLayout(canvas)
    const { zoom, offset } = this.state.view
    const lanes = new Map<string, number>()
    return (
      <div
        className="business-model-graph__viewport"
        ref={this.viewport}
        aria-label="模型关系画布"
        onPointerDown={this.pointerDown}
        onPointerMove={this.pointerMove}
        onPointerUp={this.pointerUp}
        onPointerCancel={this.pointerUp}
        onClickCapture={(event) => {
          if (this.ignoreClick) {
            event.stopPropagation()
            this.ignoreClick = false
          }
        }}
        onDragOver={(event) => {
          if (this.props.readOnly) return
          if (event.dataTransfer.types.includes('application/x-business-model')) {
            event.preventDefault()
            this.setState({ dropping: true })
          }
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node))
            this.setState({ dropping: false })
        }}
        onDrop={(event) => {
          if (this.props.readOnly) return
          event.preventDefault()
          this.setState({ dropping: false })
          const id = event.dataTransfer.getData('application/x-business-model')
          const rect = event.currentTarget.getBoundingClientRect()
          if (id)
            this.props.onAdd(id, {
              x: (event.clientX - rect.left - offset.x) / zoom - NODE_WIDTH / 2,
              y: (event.clientY - rect.top - offset.y) / zoom - NODE_HEIGHT / 2,
            })
        }}>
        <div
          className="business-model-graph__stage"
          style={{
            transform: `translate(${offset.x}px,${offset.y}px) scale(${zoom})`,
          }}>
          {canvas.grouped &&
            Object.entries(layout.groups).map(([id, group]) => (
              <div
                key={id}
                className="business-model-graph__group"
                style={{
                  left: group.x,
                  top: group.y,
                  width: group.width,
                  height: group.height,
                }}>
                <button
                  type="button"
                  data-group={id}
                  aria-label={`移动${group.title}模块`}
                  className="business-model-graph__group-title"
                  onKeyDown={(event) => this.keyMove(event, id, 'group')}>
                  <i className="fa fa-folder-o" /> {group.title}
                  <small>
                    {
                      models.filter((model) => {
                        const namespace = modelNamespace(model)
                        return namespace === id || namespace.startsWith(`${id}.`)
                      }).length
                    }{' '}
                    个模型
                  </small>
                  <i className="fa fa-arrows" />
                </button>
              </div>
            ))}
          <svg className="business-model-graph__connections" aria-label="模型关系连线">
            <defs>
              {['reference', 'child'].map((type) => (
                <marker
                  key={type}
                  id={`${this.graphId}-${type}`}
                  markerWidth="7"
                  markerHeight="7"
                  color={type === 'child' ? 'var(--graph-primary)' : '#8a96aa'}
                  refX="6"
                  refY="3.5"
                  orient="auto">
                  <path d="M0 0 7 3.5 0 7" fill="none" stroke="currentColor" />
                </marker>
              ))}
            </defs>
            {edges.map((edge, index) => {
              const pair = [edge.source, edge.target].sort().join('|')
              const lane = lanes.get(pair) || 0
              lanes.set(pair, lane + 1)
              const geometry = graphEdgeGeometry(edge, layout, lane)
              if (!geometry) return null
              const dim = !highlighted.has(edge.source) && !highlighted.has(edge.target)
              return (
                <g
                  key={`${edge.source}-${edge.name}-${index}`}
                  data-edge={index}
                  className={`business-model-graph__edge ${edge.type === 'child' ? 'is-child' : ''} ${dim ? 'is-dim' : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`查看${edge.title || edge.name || '模型'}关系`}
                  onClick={() => this.props.onEdge(edge)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      this.props.onEdge(edge)
                    }
                  }}>
                  <path
                    d={geometry.path}
                    markerEnd={`url(#${this.graphId}-${edge.type === 'child' ? 'child' : 'reference'})`}
                  />
                  <path className="business-model-graph__edge-hit" d={geometry.path} />
                  <text x={geometry.x} y={geometry.y}>
                    {edge.title || edge.name || edge.type}
                    {edge.type === 'child' ? ' · 1∶N' : ''}
                  </text>
                </g>
              )
            })}
          </svg>
          {models.map((node) => {
            const point = layout.nodes[node.fullName]
            if (!point) return null
            return (
              <button
                type="button"
                key={node.fullName}
                data-model={node.fullName}
                aria-pressed={selected === node.fullName}
                aria-label={`查看${node.title || node.fullName}`}
                className={`business-model-graph__node ${selected === node.fullName ? 'is-selected' : ''} ${highlighted.has(node.fullName) ? '' : 'is-dim'}`}
                style={{ left: point.x, top: point.y }}
                onClick={() => this.props.onSelect(node.fullName)}
                onKeyDown={(event) => this.keyMove(event, node.fullName, 'node')}>
                <strong>
                  <i className="fa fa-cube" /> {node.title || node.name || node.fullName}
                  {node.lockUser && <i className="fa fa-lock" aria-label="模型已锁定" />}
                </strong>
                <small>{node.fullName}</small>
                <span>
                  {node.fieldsCount ?? 0} 个属性 ·{' '}
                  {
                    this.props.edges.filter(
                      (edge) =>
                        edge.source === node.fullName || edge.target === node.fullName
                    ).length
                  }{' '}
                  条关联
                </span>
              </button>
            )
          })}
        </div>
        {!models.length && (
          <div className="business-model-graph__empty">
            画布为空，从模型库拖入模型或点击 + 添加
          </div>
        )}
        {this.state.dropping && (
          <div className="business-model-graph__drop">松开以添加模型</div>
        )}
        <div className="business-model-graph__legend">
          <span>— 子表 1∶N</span>
          <span>┄ 引用 / 主表</span>
        </div>
        <div className="business-model-graph__zoom">
          <button type="button" aria-label="缩小" onClick={() => this.zoom(1 / 1.2)}>
            −
          </button>
          <output aria-label="缩放比例">{Math.round(zoom * 100)}%</output>
          <button type="button" aria-label="放大" onClick={() => this.zoom(1.2)}>
            +
          </button>
        </div>
      </div>
    )
  }
}
