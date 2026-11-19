import React, { useEffect, useMemo, useState } from 'react'
import { FormItem } from 'amis'
import type { FormControlProps } from 'amis'

import { loadModelMeta } from './model-meta/model-meta-loader'
import type {
  ModelMetaProviderConfig,
  NormalizedModelMeta,
} from './model-meta/model-meta-types'
import { buildWhereFields } from './where-editor/where-field-adapter'
import {
  canSwitchWhereValueToVisual,
  getWhereEditorRawModeMessage,
  resolveWhereEditorState,
} from './where-editor/where-editor-state'
import type { WhereVisualGroup } from './where-editor/where-visual-codec'
import { serializeVisualTreeToWhere } from './where-editor/where-visual-codec'

export interface WhereEditorProps extends FormControlProps {
  modelMetaProvider: ModelMetaProviderConfig
}

function createEmptyVisualGroup(): WhereVisualGroup {
  return {
    conjunction: 'and',
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

function WhereEditor(props: WhereEditorProps) {
  const {
    data,
    disabled,
    modelMetaProvider,
    onChange,
    render,
    static: isStatic,
    value,
  } = props

  const resolvedState = useMemo(() => resolveWhereEditorState(value), [value])
  const [mode, setMode] = useState<'visual' | 'raw'>(resolvedState.mode)
  const [visualValue, setVisualValue] = useState<WhereVisualGroup>(
    resolvedState.visualValue ?? createEmptyVisualGroup()
  )
  const [meta, setMeta] = useState<NormalizedModelMeta | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

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
    if (resolvedState.mode === 'raw') {
      setMode('raw')
      return
    }
    if (mode === 'visual') {
      setVisualValue(resolvedState.visualValue)
    }
  }, [mode, resolvedState])

  const fields = useMemo(() => buildWhereFields(meta?.fields ?? []), [meta])
  const isReadOnly = Boolean(disabled || isStatic)
  const canSwitchToVisual = canSwitchWhereValueToVisual(value)
  const rawModeMessage =
    mode === 'raw'
      ? getWhereEditorRawModeMessage(
          resolvedState.mode === 'raw' ? resolvedState.reason : 'unsupported-shape'
        )
      : null

  function handleVisualChange(nextVisualValue: WhereVisualGroup) {
    setVisualValue(nextVisualValue)
    onChange?.(serializeVisualTreeToWhere(nextVisualValue))
  }

  function handleSwitchToRaw() {
    setMode('raw')
  }

  function handleSwitchToVisual() {
    if (!canSwitchToVisual || resolvedState.visualValue == null) {
      return
    }
    setVisualValue(resolvedState.visualValue)
    setMode('visual')
  }

  return (
    <div className="WhereEditorControl">
      {mode === 'raw' && rawModeMessage
        ? render('where-editor-raw-hint', {
            type: 'alert',
            level: 'info',
            showIcon: true,
            body: rawModeMessage,
          })
        : null}
      {loadError
        ? render('where-editor-load-error', {
            type: 'alert',
            level: 'danger',
            showIcon: true,
            body: loadError,
          })
        : null}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 8,
          marginBottom: 12,
        }}>
        {mode === 'visual'
          ? render('where-editor-switch-raw', {
              type: 'button',
              label: '原始 JSON',
              level: 'secondary',
              disabled: isReadOnly,
              onClick: handleSwitchToRaw,
            })
          : render('where-editor-switch-visual', {
              type: 'button',
              label: '切换到可视化',
              level: 'secondary',
              disabled: isReadOnly || !canSwitchToVisual || loading || Boolean(loadError),
              onClick: handleSwitchToVisual,
            })}
      </div>
      {mode === 'visual'
        ? render(
            'where-editor-visual',
            {
              type: 'condition-builder',
              label: false,
              embed: true,
              builderMode: 'full',
              fields,
              disabled: isReadOnly || loading || Boolean(loadError),
            },
            {
              value: visualValue,
              onChange: handleVisualChange,
            }
          )
        : render(
            'where-editor-raw',
            {
              type: 'json-data-editor',
              label: false,
              allowValueTypes: 'object,array',
              disabled: isReadOnly,
            },
            {
              value,
              onChange,
            }
          )}
    </div>
  )
}

FormItem({
  type: 'where-editor',
  autoVar: true,
})(WhereEditor as any)

export default WhereEditor
