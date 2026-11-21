import React from 'react'
import type {
  BusinessModelCanvas,
  BusinessModelGraphData,
  BusinessModelGraphNode,
  BusinessModelGraphEdge,
  ModelModule,
} from './business-model-graph'

type Props = {
  canvas: BusinessModelCanvas
  graph: BusinessModelGraphData
  models: BusinessModelGraphNode[]
  edges: BusinessModelGraphEdge[]
  modules: ModelModule[]
  selected: string | null
  selectedEdge: BusinessModelGraphEdge | null
  userIdentity: string
  editing: boolean
  readOnly: boolean
  onClose: () => void
  onEdge: (edge: BusinessModelGraphEdge) => void
  onRemove: (id: string) => void
  onEdit: (node: BusinessModelGraphNode) => void
}
const relationLabels: Record<string, string> = {
  reference: '引用',
  child: '子表 1∶N',
  master: '主表 N∶1',
}
export function BusinessModelGraphDetails({
  canvas,
  graph,
  models,
  edges,
  modules,
  selected,
  selectedEdge,
  userIdentity,
  editing,
  readOnly,
  onClose,
  onEdge,
  onRemove,
  onEdit,
}: Props) {
  const node = models.find((model) => model.fullName === selected)
  const edge = selectedEdge
  if (!node && !edge) return null
  const relations = node
    ? graph.edges.filter(
        (relation) =>
          relation.source === node.fullName || relation.target === node.fullName
      )
    : []
  const visibleRelations = node
    ? edges.filter(
        (relation) =>
          relation.source === node.fullName || relation.target === node.fullName
      )
    : []
  const locked = !!node?.lockUser && node.lockUser !== userIdentity
  return (
    <aside className="business-model-graph__detail" aria-label="模型或关系详情">
      <header>
        <span>{node ? '模型详情' : '关系详情'}</span>
        <button
          type="button"
          className="business-model-graph__close"
          aria-label="关闭详情"
          onClick={() => onClose()}>
          ×
        </button>
      </header>
      <div className="business-model-graph__detail-body">
        <h3>{node ? node.title || node.fullName : edge?.title || edge?.name}</h3>
        {node ? (
          <>
            <small>{node.fullName}</small>
            <p>{node.description}</p>
            <dl>
              <dt>所属模块</dt>
              <dd>{modelNamespaceTitle(node, modules)}</dd>
              <dt>业务属性</dt>
              <dd>{node.fieldsCount ?? 0} 个</dd>
              <dt>编辑状态</dt>
              <dd>
                {node.lockUser
                  ? `${node.lockUserName || node.lockUser} 正在编辑`
                  : '可编辑'}
              </dd>
            </dl>
            <p>
              画布内 {visibleRelations.length} 条关联，模型共 {relations.length} 条关联
            </p>
            {!canvas.allModels && !readOnly && (
              <button
                type="button"
                className="cxd-Button cxd-Button--link"
                onClick={() => onRemove(node.fullName)}>
                从此画布移除
              </button>
            )}
            {relations.map((relation, index) => {
              const other =
                relation.source === node.fullName ? relation.target : relation.source
              const present = models.some((model) => model.fullName === other)
              return (
                <button
                  type="button"
                  key={index}
                  className="business-model-graph__relation"
                  disabled={!present}
                  onClick={() => onEdge(relation)}>
                  {relation.title || relation.name}
                  <small>
                    {relation.source === node.fullName ? '→' : '←'} {other} ·{' '}
                    {relationLabels[relation.type || ''] || relation.type}
                    {!present && ' · 当前画布外或目标不可用'}
                  </small>
                </button>
              )
            })}
          </>
        ) : (
          edge && (
            <dl>
              <dt>来源模型</dt>
              <dd>{edge.source}</dd>
              <dt>目标模型</dt>
              <dd>{edge.target}</dd>
              <dt>关系类型</dt>
              <dd>{relationLabels[edge.type || ''] || edge.type}</dd>
            </dl>
          )
        )}
      </div>
      {node && !readOnly && (
        <footer>
          <button
            type="button"
            className="cxd-Button cxd-Button--primary cxd-Button--size-default"
            disabled={locked || editing}
            onClick={() => onEdit(node)}>
            {locked ? '模型正在被其他人编辑' : editing ? '正在获取模型锁…' : '编辑模型'}
          </button>
        </footer>
      )}
    </aside>
  )
}
function modelNamespaceTitle(
  node: BusinessModelGraphNode,
  modules: ModelModule[]
): string {
  for (const module of modules) {
    if (module.fullName === node.namespace) return module.title || module.fullName
    const child = modelNamespaceTitle(node, module.children || [])
    if (child) return child
  }
  return ''
}
