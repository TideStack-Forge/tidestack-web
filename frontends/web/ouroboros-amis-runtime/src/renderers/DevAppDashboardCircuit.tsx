import React, { useEffect, useId, useRef, useState } from 'react'
import { Icon } from 'amis'
import {
  boardNodes,
  capabilities,
  capabilityRelations,
  capabilityTitle,
  circuitCoordinates,
  relationTypes,
  type BoardPoint,
  type Capability,
} from './dev-app-dashboard'

export type DashboardSelection = { kind: 'node' | 'relationship'; id: string } | null

type Props = {
  selection: DashboardSelection
  query: string
  motion: boolean
  onSelect(selection: DashboardSelection): void
  onOpen(capability: Capability): void
}

export function matchesCapability(capability: Capability, query: string) {
  return `${capability.title} ${capability.subtitle || ''} ${capability.description} ${capability.id}`
    .toLowerCase()
    .includes(query)
}

function TerminalPad({ point, neighbor }: { point: BoardPoint; neighbor: BoardPoint }) {
  const dx = Math.sign(neighbor[0] - point[0])
  const dy = Math.sign(neighbor[1] - point[1])
  const width = dx === 0 ? 5 : 10
  const height = dy === 0 ? 5 : 10
  return (
    <rect
      className="board-pad"
      x={point[0] + dx * 4 - width / 2}
      y={point[1] + dy * 4 - height / 2}
      width={width}
      height={height}
      rx="1"
    />
  )
}

export function DevAppDashboardCircuit({
  selection,
  query,
  motion,
  onSelect,
  onOpen,
}: Props) {
  const board = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(860)
  const id = useId().replace(/:/g, '')
  useEffect(() => {
    const element = board.current
    if (!element) return
    const measure = () => {
      if (element.clientWidth) setWidth(element.clientWidth)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  const selectedNode = selection?.kind === 'node' ? selection.id : null
  const selectedEdge = selection?.kind === 'relationship' ? selection.id : null
  const incident = capabilityRelations.filter(
    (edge) =>
      edge.from === selectedNode || edge.to === selectedNode || edge.id === selectedEdge
  )
  const related = new Set(incident.flatMap((edge) => [edge.from, edge.to]))
  const byId = new Map(capabilities.map((item) => [item.id, item]))
  return (
    <div className="board-scroll">
      <div ref={board} className="circuit-board">
        <svg
          className={`board-connections ${motion ? '' : 'is-paused'}`}
          aria-label="有方向的能力关系"
          role="group">
          {capabilityRelations.map((edge, index) => {
            const points = circuitCoordinates(edge.points, width / 860)
            const path = points
              .map((point, i) => `${i ? 'L' : 'M'}${point.join(' ')}`)
              .join(' ')
            const length = points
              .slice(1)
              .reduce(
                (sum, point, i) =>
                  sum + Math.hypot(point[0] - points[i][0], point[1] - points[i][1]),
                0
              )
            const duration = Math.max(2, length / relationTypes[edge.type].speed)
            const pathId = `${id}-${edge.id}`
            const highlighted = incident.includes(edge)
            const filtered =
              !matchesCapability(byId.get(edge.from)!, query) &&
              !matchesCapability(byId.get(edge.to)!, query)
            return (
              <g
                key={edge.id}
                className={`board-net board-net--${edge.type} ${highlighted ? 'is-highlighted' : ''} ${filtered ? 'is-filtered' : ''}`}
                role="button"
                tabIndex={0}
                aria-label={`${capabilityTitle(byId.get(edge.from)!)} → ${capabilityTitle(byId.get(edge.to)!)}，${relationTypes[edge.type].title}`}
                aria-pressed={edge.id === selectedEdge}
                onClick={() => onSelect({ kind: 'relationship', id: edge.id })}
                onKeyDown={(event) => {
                  if (['Enter', ' '].includes(event.key)) {
                    event.preventDefault()
                    onSelect({ kind: 'relationship', id: edge.id })
                  }
                }}>
                <title>{edge.description}</title>
                <path id={pathId} className="board-trace" d={path} />
                <use href={`#${pathId}`} className="board-hit" />
                <TerminalPad point={points[0]} neighbor={points[1]} />
                <TerminalPad
                  point={points[points.length - 1]}
                  neighbor={points[points.length - 2]}
                />
                {motion && (
                  <circle className="flow-particle" r="2" aria-hidden="true">
                    <animateMotion
                      repeatCount="indefinite"
                      calcMode="paced"
                      dur={`${duration}s`}
                      begin={`${(-(index % 5) * duration) / 5}s`}>
                      <mpath href={`#${pathId}`} />
                    </animateMotion>
                  </circle>
                )}
              </g>
            )
          })}
        </svg>
        <div className="board-layer-labels">
          <h3 className="board-layer-label--presentation">界面与导航</h3>
          <h3 className="board-layer-label--service">业务与服务</h3>
          <h3 className="board-layer-label--backend">数据与权限</h3>
        </div>
        {boardNodes.map((position) => {
          const item = byId.get(position.id)!
          const match = matchesCapability(item, query)
          const caption = position.caption || item.subtitle
          return (
            <div
              className="chip-package"
              key={item.id}
              style={{
                left: `${(position.x / 860) * 100}%`,
                top: position.y,
                width: `${(position.width / 860) * 100}%`,
                height: position.height,
              }}>
              <button
                type="button"
                className={`board-node board-node--${position.tone} ${position.main ? 'board-node--main' : ''} ${selectedNode === item.id ? 'is-selected' : ''} ${related.has(item.id) ? 'is-related' : ''} ${query && match ? 'is-match' : ''} ${match ? '' : 'is-filtered'}`}
                aria-pressed={selectedNode === item.id}
                onClick={() => onSelect({ kind: 'node', id: item.id })}
                onDoubleClick={() => onOpen(item)}>
                <Icon icon={`fa ${item.icon}`} vendor="" className="capability-icon" />
                <span>
                  {item.title}
                  {caption && <small>{caption}</small>}
                </span>
              </button>
            </div>
          )
        })}
        {query && !capabilities.some((item) => matchesCapability(item, query)) && (
          <div className="board-empty" role="status">
            没有匹配的开发能力
          </div>
        )}
      </div>
    </div>
  )
}
