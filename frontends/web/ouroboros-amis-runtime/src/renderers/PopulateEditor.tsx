import React, { useEffect, useMemo, useState } from 'react'
import { Button, Drawer, FormItem } from 'amis'
import type { FormControlProps } from 'amis'

import { loadModelMeta } from './model-meta/model-meta-loader'
import type {
  ModelMetaProviderConfig,
  NormalizedModelMeta,
} from './model-meta/model-meta-types'
import { deserializePopulate, serializePopulate } from './populate-editor/populate-codec'
import {
  buildChildPopulateEditorProps,
  summarizePopulateNode,
} from './populate-editor/populate-editor-helpers'
import type { PopulateNode } from './populate-editor/populate-types'

export interface PopulateEditorProps extends FormControlProps {
  modelMetaProvider: ModelMetaProviderConfig
}

function clonePopulateNode(node: PopulateNode): PopulateNode {
  return {
    ...node,
    options: {
      ...(node.options || {}),
      select: node.options?.select ? [...node.options.select] : undefined,
      omit: node.options?.omit ? [...node.options.omit] : undefined,
    },
    children: (node.children || []).map((child) => clonePopulateNode(child)),
    extras: node.extras ? { ...node.extras } : undefined,
  }
}

function createDraftNode(
  relation: NormalizedModelMeta['relations'][number]
): PopulateNode {
  return {
    id: `draft-${relation.name}`,
    relationName: relation.name,
    relationLabel: relation.label,
    targetModel: relation.targetModel,
    targetModelLabel: relation.targetModelLabel,
    relationType: relation.type,
    options: {},
    children: [],
  }
}

function normalizeErrorMessage(error: any): string {
  const message = error?.message
  if (typeof message === 'string' && message.trim()) {
    return message.trim()
  }
  return '模型元数据加载失败'
}

function normalizeStringList(value: any): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
}

function buildChildModelMetaProvider(
  provider: ModelMetaProviderConfig,
  node?: PopulateNode | null
): ModelMetaProviderConfig {
  const childProps = buildChildPopulateEditorProps(node || {})
  if (!childProps.modelRef) {
    return provider
  }
  return {
    ...provider,
    modelRef: childProps.modelRef,
  }
}

function PopulateEditor(props: PopulateEditorProps) {
  const {
    data,
    disabled,
    modelMetaProvider,
    onChange,
    render,
    static: isStatic,
    value,
  } = props

  const [nodes, setNodes] = useState<PopulateNode[]>([])
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [meta, setMeta] = useState<NormalizedModelMeta | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedRelationName, setSelectedRelationName] = useState('')
  const [draftNode, setDraftNode] = useState<PopulateNode | null>(null)
  const [draftMeta, setDraftMeta] = useState<NormalizedModelMeta | null>(null)
  const [draftMetaLoading, setDraftMetaLoading] = useState(false)
  const [draftMetaError, setDraftMetaError] = useState<string | null>(null)

  useEffect(() => {
    const result = deserializePopulate(value)
    setNodes(result.nodes)
    setParseErrors(result.errors.map((item) => `${item.path}: ${item.message}`))
  }, [value])

  useEffect(() => {
    let cancelled = false

    setLoading(true)
    setLoadError(null)

    loadModelMeta({
      provider: modelMetaProvider,
      data,
    })
      .then((nextMeta) => {
        if (cancelled) {
          return
        }
        setMeta(nextMeta)
      })
      .catch((error) => {
        if (cancelled) {
          return
        }
        setMeta(null)
        setLoadError(normalizeErrorMessage(error))
      })
      .finally(() => {
        if (cancelled) {
          return
        }
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [data, modelMetaProvider])

  useEffect(() => {
    if (!draftNode?.targetModel) {
      setDraftMeta(null)
      setDraftMetaError(null)
      setDraftMetaLoading(false)
      return
    }

    let cancelled = false
    const childProvider = buildChildModelMetaProvider(modelMetaProvider, draftNode)

    setDraftMetaLoading(true)
    setDraftMetaError(null)

    loadModelMeta({
      provider: childProvider,
      data,
    })
      .then((nextMeta) => {
        if (cancelled) {
          return
        }
        setDraftMeta(nextMeta)
      })
      .catch((error) => {
        if (cancelled) {
          return
        }
        setDraftMeta(null)
        setDraftMetaError(normalizeErrorMessage(error))
      })
      .finally(() => {
        if (cancelled) {
          return
        }
        setDraftMetaLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [data, draftNode, modelMetaProvider])

  const relationMap = useMemo(() => {
    const result = new Map<string, NormalizedModelMeta['relations'][number]>()
    for (const relation of meta?.relations || []) {
      result.set(relation.name, relation)
    }
    return result
  }, [meta])

  const displayNodes = useMemo(
    () =>
      nodes.map((node) => {
        const relation = relationMap.get(node.relationName)
        if (!relation) {
          return node
        }
        return {
          ...node,
          relationLabel: relation.label || node.relationLabel,
          targetModel: relation.targetModel || node.targetModel,
          targetModelLabel: relation.targetModelLabel || node.targetModelLabel,
          relationType: relation.type || node.relationType,
        }
      }),
    [nodes, relationMap]
  )

  const relationOptions = useMemo(
    () =>
      (meta?.relations || []).map((relation) => ({
        label: relation.label ? `${relation.label} (${relation.name})` : relation.name,
        value: relation.name,
      })),
    [meta]
  )

  const targetFieldOptions = useMemo(
    () =>
      (draftMeta?.fields || []).map((field) => ({
        label: field.label ? `${field.label} (${field.name})` : field.name,
        value: field.name,
      })),
    [draftMeta]
  )

  const isReadOnly = Boolean(disabled || isStatic)

  function emitNodes(nextNodes: PopulateNode[]) {
    setNodes(nextNodes)
    onChange?.(serializePopulate(nextNodes))
  }

  function handleDeleteNode(relationName: string) {
    const nextNodes = displayNodes.filter((node) => node.relationName !== relationName)
    emitNodes(nextNodes)
  }

  function handleOpenNode(node: PopulateNode) {
    setDraftNode(clonePopulateNode(node))
  }

  function handleAddRelation() {
    if (!selectedRelationName) {
      return
    }

    const existingNode = displayNodes.find(
      (node) => node.relationName === selectedRelationName
    )
    if (existingNode) {
      handleOpenNode(existingNode)
      return
    }

    const relation = relationMap.get(selectedRelationName)
    if (!relation) {
      return
    }

    setDraftNode(createDraftNode(relation))
  }

  function handleCloseDrawer() {
    setDraftNode(null)
    setDraftMeta(null)
    setDraftMetaError(null)
  }

  function updateDraftNode(updater: (current: PopulateNode) => PopulateNode) {
    setDraftNode((current) => {
      if (!current) {
        return current
      }
      return updater(current)
    })
  }

  function handleDraftFieldListChange(key: 'select' | 'omit', nextValue: any) {
    const nextList = normalizeStringList(nextValue)
    updateDraftNode((current) => {
      const nextOptions = {
        ...(current.options || {}),
      }

      if (nextList.length > 0) {
        nextOptions[key] = nextList
      } else {
        delete nextOptions[key]
      }

      if (key === 'select' && nextList.length > 0) {
        delete nextOptions.omit
      }
      if (key === 'omit' && nextList.length > 0) {
        delete nextOptions.select
      }

      return {
        ...current,
        options: nextOptions,
      }
    })
  }

  function handleDraftOptionChange(key: 'limit' | 'offset' | 'where', nextValue: any) {
    updateDraftNode((current) => {
      const nextOptions = {
        ...(current.options || {}),
      }

      if (nextValue === '' || nextValue === undefined) {
        delete nextOptions[key]
      } else {
        nextOptions[key] = nextValue
      }

      return {
        ...current,
        options: nextOptions,
      }
    })
  }

  function handleDraftChildrenChange(nextValue: any) {
    const result = deserializePopulate(nextValue)
    updateDraftNode((current) => ({
      ...current,
      children: result.nodes,
    }))
  }

  function handleSaveDraft() {
    if (!draftNode || draftMetaLoading || draftMetaError) {
      return
    }

    const nextNodes = [...displayNodes]
    const index = nextNodes.findIndex(
      (node) => node.relationName === draftNode.relationName
    )
    const nextDraftNode = clonePopulateNode(draftNode)

    if (index >= 0) {
      nextNodes[index] = nextDraftNode
    } else {
      nextNodes.push(nextDraftNode)
    }

    emitNodes(nextNodes)
    handleCloseDrawer()
  }

  return (
    <div className="PopulateEditorControl">
      {parseErrors.length > 0
        ? render('populate-editor-parse-errors', {
            type: 'alert',
            level: 'warning',
            showIcon: true,
            body: parseErrors.join('\n'),
          })
        : null}
      {loadError
        ? render('populate-editor-load-error', {
            type: 'alert',
            level: 'danger',
            showIcon: true,
            body: loadError,
          })
        : null}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 16,
        }}>
        {render(
          'populate-editor-add-relation',
          {
            type: 'select',
            clearable: true,
            searchable: true,
            placeholder: '选择要填充的关联',
            options: relationOptions,
            disabled: isReadOnly || loading || Boolean(loadError),
          },
          {
            value: selectedRelationName,
            onChange: (nextValue: any) => setSelectedRelationName(nextValue || ''),
          }
        )}
        <Button
          level="primary"
          onClick={handleAddRelation}
          disabled={isReadOnly || !selectedRelationName}>
          添加关联
        </Button>
      </div>
      <div style={{ display: 'grid', gap: 12 }}>
        {displayNodes.length === 0 ? (
          <div
            style={{
              padding: 16,
              border: '1px dashed #d0d7de',
              borderRadius: 8,
              color: '#57606a',
            }}>
            暂无填充配置
          </div>
        ) : (
          displayNodes.map((node) => (
            <div
              key={node.id}
              data-populate-node={node.relationName}
              style={{
                border: '1px solid #d0d7de',
                borderRadius: 12,
                padding: 16,
                background: '#fff',
              }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 600, color: '#1f2328' }}>
                    {node.relationLabel || node.relationName}
                  </div>
                  <div style={{ marginTop: 4, color: '#57606a', fontSize: 12 }}>
                    {node.relationName}
                    {node.targetModel ? ` -> ${node.targetModel}` : ''}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 6,
                      marginTop: 10,
                    }}>
                    {summarizePopulateNode(node).map((item) => (
                      <span
                        key={item}
                        style={{
                          padding: '2px 8px',
                          borderRadius: 999,
                          background: '#f6f8fa',
                          color: '#57606a',
                          fontSize: 12,
                        }}>
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <Button
                    level="enhance"
                    onClick={() => handleOpenNode(node)}
                    disabled={isReadOnly}>
                    编辑
                  </Button>
                  <Button
                    level="danger"
                    onClick={() => handleDeleteNode(node.relationName)}
                    disabled={isReadOnly}>
                    删除
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      <Drawer
        showCloseButton
        closeOnOutside
        size="lg"
        position="right"
        show={Boolean(draftNode)}
        onHide={handleCloseDrawer}>
        <div
          data-populate-drawer-relation={draftNode?.relationName || ''}
          style={{ padding: '20px 24px' }}>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
            编辑填充节点
          </div>
          {draftNode ? (
            <>
              <div style={{ marginBottom: 16, color: '#57606a', fontSize: 13 }}>
                <div>relation: {draftNode.relationName}</div>
                <div>label: {draftNode.relationLabel || draftNode.relationName}</div>
                <div>target model: {draftNode.targetModel || '-'}</div>
              </div>
              {draftMetaError
                ? render('populate-editor-draft-error', {
                    type: 'alert',
                    level: 'danger',
                    showIcon: true,
                    body: draftMetaError,
                  })
                : null}
              <div style={{ display: 'grid', gap: 16 }}>
                {render(
                  'populate-editor-draft-select',
                  {
                    type: 'select',
                    label: 'Select',
                    multiple: true,
                    clearable: true,
                    searchable: true,
                    options: targetFieldOptions,
                    disabled: isReadOnly || draftMetaLoading || Boolean(draftMetaError),
                  },
                  {
                    value: draftNode.options.select || [],
                    onChange: (nextValue: any) =>
                      handleDraftFieldListChange('select', nextValue),
                  }
                )}
                {render(
                  'populate-editor-draft-omit',
                  {
                    type: 'select',
                    label: 'Omit',
                    multiple: true,
                    clearable: true,
                    searchable: true,
                    options: targetFieldOptions,
                    disabled:
                      isReadOnly ||
                      draftMetaLoading ||
                      Boolean(draftMetaError) ||
                      Boolean(draftNode.options.select?.length),
                  },
                  {
                    value: draftNode.options.omit || [],
                    onChange: (nextValue: any) =>
                      handleDraftFieldListChange('omit', nextValue),
                  }
                )}
                {render(
                  'populate-editor-draft-where',
                  {
                    type: 'where-editor',
                    label: 'Where',
                    modelMetaProvider: buildChildModelMetaProvider(
                      modelMetaProvider,
                      draftNode
                    ),
                    disabled: isReadOnly || draftMetaLoading || Boolean(draftMetaError),
                  },
                  {
                    data: {
                      ...(data || {}),
                    },
                    value: draftNode.options.where,
                    onChange: (nextValue: any) =>
                      handleDraftOptionChange('where', nextValue),
                  }
                )}
                {render(
                  'populate-editor-draft-limit',
                  {
                    type: 'input-number',
                    label: 'Limit',
                    clearable: true,
                    disabled: isReadOnly,
                  },
                  {
                    value: draftNode.options.limit,
                    onChange: (nextValue: any) =>
                      handleDraftOptionChange('limit', nextValue),
                  }
                )}
                {render(
                  'populate-editor-draft-offset',
                  {
                    type: 'input-number',
                    label: 'Offset',
                    clearable: true,
                    disabled: isReadOnly,
                  },
                  {
                    value: draftNode.options.offset,
                    onChange: (nextValue: any) =>
                      handleDraftOptionChange('offset', nextValue),
                  }
                )}
                {render(
                  'populate-editor-draft-children',
                  {
                    type: 'populate-editor',
                    label: 'Child Populate',
                    modelMetaProvider: buildChildModelMetaProvider(
                      modelMetaProvider,
                      draftNode
                    ),
                    disabled: isReadOnly || draftMetaLoading || Boolean(draftMetaError),
                  },
                  {
                    data: {
                      ...(data || {}),
                    },
                    value: serializePopulate(draftNode.children),
                    onChange: handleDraftChildrenChange,
                  }
                )}
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 8,
                  marginTop: 20,
                }}>
                <Button onClick={handleCloseDrawer}>取消</Button>
                <Button
                  level="primary"
                  onClick={handleSaveDraft}
                  disabled={isReadOnly || draftMetaLoading || Boolean(draftMetaError)}>
                  保存
                </Button>
              </div>
            </>
          ) : null}
        </div>
      </Drawer>
    </div>
  )
}

FormItem({
  type: 'populate-editor',
  autoVar: true,
})(PopulateEditor as any)

export default PopulateEditor
