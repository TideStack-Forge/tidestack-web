import React, { useEffect, useState } from 'react'
import type { RendererProps } from 'amis-core'
import DevFrontendResourcePicker from './DevFrontendResourcePicker'
import {
  isDevFrontendResourceContext,
  resolveDevFrontendResourceBrowserContext,
} from './context'
import {
  buildFrontendResourceReference,
  parseFrontendResourceReference,
} from './reference'

export type FrontendResourceSelectionMode = 'resource-only' | 'resource-or-url'

type FrontendResourceControlProps = RendererProps & {
  value?: string
  onChange: (value?: string) => void
  manager?: {
    config?: {
      platformContext?: any
      resourceBrowserContext?: any
    }
  }
  render: (region: string, schema: any, props: any) => React.ReactNode
  fallbackSchema: any
  placeholder?: string
  resourceSelectionMode?: FrontendResourceSelectionMode
}

type FrontendResourceControlSchemaOptions = {
  placeholder?: string
  selectionMode?: FrontendResourceSelectionMode
}

type FrontendResourceFieldMatcher = {
  name: string
  label?: string
  selectionMode?: FrontendResourceSelectionMode
}

type ResourceInputMode = 'resource' | 'url'

function resolveInitialMode(
  value: string | undefined,
  selectionMode: FrontendResourceSelectionMode
): ResourceInputMode {
  if (selectionMode === 'resource-only') {
    return 'resource'
  }
  return parseFrontendResourceReference(value) ? 'resource' : 'url'
}

function renderModeButton(
  mode: ResourceInputMode,
  currentMode: ResourceInputMode,
  label: string,
  disabled: boolean,
  onClick: (mode: ResourceInputMode) => void
) {
  const active = mode === currentMode
  return (
    <button
      key={mode}
      type="button"
      disabled={disabled}
      onClick={() => onClick(mode)}
      style={{
        border: '1px solid #d1d5db',
        borderRadius: 6,
        padding: '4px 10px',
        background: active ? '#eff6ff' : '#fff',
        color: active ? '#1d4ed8' : '#374151',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}>
      {label}
    </button>
  )
}

export function FrontendResourceControl(props: FrontendResourceControlProps) {
  const {
    value,
    onChange,
    manager,
    render,
    fallbackSchema,
    className,
    disabled = false,
    placeholder,
    resourceSelectionMode = 'resource-or-url',
  } = props
  const platformContext = manager?.config?.platformContext
  const resourceBrowserContext = resolveDevFrontendResourceBrowserContext(
    platformContext,
    manager?.config?.resourceBrowserContext
  )
  const [mode, setMode] = useState<ResourceInputMode>(
    resolveInitialMode(value, resourceSelectionMode)
  )
  const [resourceDraftKey, setResourceDraftKey] = useState(
    parseFrontendResourceReference(value)?.key || ''
  )
  const [urlDraftValue, setUrlDraftValue] = useState(
    parseFrontendResourceReference(value) ? '' : value || ''
  )

  useEffect(() => {
    const parsed = parseFrontendResourceReference(value)
    if (parsed) {
      setMode('resource')
      setResourceDraftKey(parsed.key)
      return
    }
    if (resourceSelectionMode === 'resource-only') {
      setMode('resource')
      return
    }
    if (typeof value === 'string' && value) {
      setMode('url')
      setUrlDraftValue(value)
    }
  }, [value, resourceSelectionMode])

  if (!isDevFrontendResourceContext(resourceBrowserContext)) {
    return render('inner', fallbackSchema, {
      value,
      onChange,
      disabled,
    })
  }

  const handleModeChange = (nextMode: ResourceInputMode) => {
    if (nextMode === mode) {
      return
    }
    setMode(nextMode)
    if (nextMode === 'resource') {
      onChange(buildFrontendResourceReference(resourceDraftKey))
      return
    }
    onChange(urlDraftValue || undefined)
  }

  const handleResourceChange = (nextValue?: string) => {
    const parsed = parseFrontendResourceReference(nextValue)
    setResourceDraftKey(parsed?.key || '')
    if (mode === 'resource' || resourceSelectionMode === 'resource-only') {
      onChange(nextValue)
    }
  }

  const handleUrlChange = (nextValue?: string) => {
    const normalizedValue = typeof nextValue === 'string' ? nextValue : ''
    setUrlDraftValue(normalizedValue)
    if (mode === 'url') {
      onChange(normalizedValue || undefined)
    }
  }

  const resourceValue = buildFrontendResourceReference(resourceDraftKey)

  if (resourceSelectionMode === 'resource-only') {
    return (
      <DevFrontendResourcePicker
        value={resourceValue}
        onChange={handleResourceChange}
        disabled={disabled}
        className={className}
        placeholder={placeholder}
        platformContext={platformContext}
        resourceBrowserContext={resourceBrowserContext}
      />
    )
  }

  return (
    <div className={className}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        {renderModeButton('resource', mode, '资源', disabled, handleModeChange)}
        {renderModeButton('url', mode, '链接', disabled, handleModeChange)}
        {mode === 'resource' ? (
          <span className="text-muted" style={{ fontSize: 12 }}>
            保存为 resource:&lt;key&gt;
          </span>
        ) : null}
      </div>
      {mode === 'resource' ? (
        <DevFrontendResourcePicker
          value={resourceValue}
          onChange={handleResourceChange}
          disabled={disabled}
          placeholder={placeholder}
          platformContext={platformContext}
          resourceBrowserContext={resourceBrowserContext}
        />
      ) : (
        render('inner', fallbackSchema, {
          value: urlDraftValue,
          onChange: handleUrlChange,
          disabled,
        })
      )}
    </div>
  )
}

export function createFrontendResourceControlSchema(
  fallbackSchema: any,
  options: FrontendResourceControlSchemaOptions = {}
) {
  return {
    ...fallbackSchema,
    type: 'input-text',
    asFormItem: true,
    component: FrontendResourceControl,
    fallbackSchema,
    placeholder: options.placeholder,
    resourceSelectionMode: options.selectionMode || 'resource-or-url',
  }
}

function replaceFrontendResourceFieldsInArray(
  schema: any[],
  matchers: FrontendResourceFieldMatcher[]
): any[] {
  return schema.map((item) => replaceFrontendResourceFields(item, matchers))
}

function matchFrontendResourceField(
  schema: Record<string, any>,
  matchers: FrontendResourceFieldMatcher[]
): FrontendResourceFieldMatcher | null {
  return (
    matchers.find(
      (matcher) =>
        schema.name === matcher.name && (!matcher.label || schema.label === matcher.label)
    ) || null
  )
}

export function replaceFrontendResourceFields(
  schema: any,
  matchers: FrontendResourceFieldMatcher[]
): any {
  if (Array.isArray(schema)) {
    return replaceFrontendResourceFieldsInArray(schema, matchers)
  }
  if (!schema || typeof schema !== 'object') {
    return schema
  }
  if (schema.component === FrontendResourceControl) {
    return schema
  }
  const nextSchema = Object.keys(schema).reduce<Record<string, any>>((all, key) => {
    all[key] = replaceFrontendResourceFields(schema[key], matchers)
    return all
  }, {})
  const matchedField = matchFrontendResourceField(nextSchema, matchers)
  if (!matchedField) {
    return nextSchema
  }
  return createFrontendResourceControlSchema(nextSchema, {
    selectionMode: matchedField.selectionMode || 'resource-or-url',
  })
}
