import React from 'react'
import type { BusinessModelGraphNode } from './business-model-graph'

type Props = {
  models: BusinessModelGraphNode[]
  modelIds: string[]
  query: string
  onQuery: (query: string) => void
  onClose: () => void
  onAdd: (id: string) => void
}
export function BusinessModelGraphLibrary({
  models,
  modelIds,
  query,
  onQuery,
  onClose,
  onAdd,
}: Props) {
  return (
    <aside className="business-model-graph__library" aria-label="模型库">
      <header>
        模型库
        <button
          type="button"
          className="business-model-graph__close"
          aria-label="关闭模型库"
          onClick={onClose}>
          ×
        </button>
      </header>
      <input
        aria-label="搜索模型库"
        placeholder="搜索模型"
        value={query}
        onChange={(event) => onQuery(event.target.value)}
      />
      <p>拖入画布，或点击 + 添加</p>
      {models
        .filter((node) =>
          `${node.title || ''} ${node.fullName}`
            .toLowerCase()
            .includes(query.toLowerCase())
        )
        .map((node) => {
          const added = modelIds.includes(node.fullName)
          return (
            <div
              className="business-model-graph__library-model"
              key={node.fullName}
              draggable={!added}
              onDragStart={(event) => {
                event.dataTransfer.setData('application/x-business-model', node.fullName)
                event.dataTransfer.effectAllowed = 'copy'
              }}>
              <span>
                {node.title || node.fullName}
                <small>{node.fullName}</small>
              </span>
              <button
                type="button"
                disabled={added}
                aria-label={`添加${node.title || node.fullName}到画布`}
                onClick={() => onAdd(node.fullName)}>
                {added ? '已添加' : '+'}
              </button>
            </div>
          )
        })}
    </aside>
  )
}
