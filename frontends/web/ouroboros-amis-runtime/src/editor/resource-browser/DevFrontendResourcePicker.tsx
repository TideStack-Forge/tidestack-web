import React, { useDeferredValue, useEffect, useState } from 'react'
import type { PlatformContext } from '../../platform/context'
import {
  buildMissingFrontendResourceItem,
  fetchDevFrontendResourceDirectories,
  fetchDevFrontendResources,
  type FrontendResourceItem,
  type ResourceBrowserDirectoryOption,
} from './resourceApi'
import { buildFrontendResourcePreview } from './preview'
import {
  getDevFrontendResourceApiBase,
  resolveDevFrontendResourceBrowserContext,
  type ResourceBrowserContext,
} from './context'
import {
  buildFrontendResourceReference,
  parseFrontendResourceReference,
} from './reference'

type DevFrontendResourcePickerProps = {
  platformContext?: PlatformContext | null
  resourceBrowserContext?: ResourceBrowserContext | null
  value?: string | null
  onChange?: (value?: string) => void
  disabled?: boolean
  className?: string
  placeholder?: string
}

type FlatDirectoryOption = {
  label: string
  value: string
}

function flattenDirectories(
  directories: ResourceBrowserDirectoryOption[],
  prefix = ''
): FlatDirectoryOption[] {
  return directories.reduce<FlatDirectoryOption[]>((all, directory) => {
    const label = prefix ? `${prefix} / ${directory.label}` : directory.label
    all.push({
      label,
      value: directory.value,
    })
    if (directory.children?.length) {
      all.push(...flattenDirectories(directory.children, label))
    }
    return all
  }, [])
}

function renderMeta(item: FrontendResourceItem) {
  const segments = [item.directory || '<根目录>']
  if (item.contentType) {
    segments.push(item.contentType)
  }
  if (item.size != null) {
    segments.push(`${item.size} B`)
  }
  return segments.join(' · ')
}

export function DevFrontendResourcePicker(props: DevFrontendResourcePickerProps) {
  const {
    platformContext,
    resourceBrowserContext,
    value,
    onChange,
    disabled = false,
    className = '',
    placeholder = '选择前端资源',
  } = props
  const [directories, setDirectories] = useState<ResourceBrowserDirectoryOption[]>([])
  const [resources, setResources] = useState<FrontendResourceItem[]>([])
  const [directory, setDirectory] = useState('')
  const [keyword, setKeyword] = useState('')
  const [loadingDirectories, setLoadingDirectories] = useState(false)
  const [loadingResources, setLoadingResources] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const deferredKeyword = useDeferredValue(keyword)
  const resolvedContext = resolveDevFrontendResourceBrowserContext(
    platformContext,
    resourceBrowserContext
  )
  const apiBase = getDevFrontendResourceApiBase(resolvedContext)
  const appName = resolvedContext?.appName || null
  const directoriesUrl = apiBase ? `${apiBase}/directories?scope=frontend` : null
  const resourcesUrl = apiBase ? `${apiBase}?scope=frontend` : null

  useEffect(() => {
    if (!directoriesUrl) {
      setDirectories([])
      setLoadingDirectories(false)
      return
    }
    let cancelled = false
    setLoadingDirectories(true)
    setError(null)
    fetchDevFrontendResourceDirectories(directoriesUrl)
      .then((items) => {
        if (!cancelled) {
          setDirectories(items)
        }
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : '加载资源目录失败')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingDirectories(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [directoriesUrl])

  useEffect(() => {
    if (!resourcesUrl) {
      setResources([])
      setLoadingResources(false)
      return
    }
    let cancelled = false
    setLoadingResources(true)
    setError(null)
    fetchDevFrontendResources(resourcesUrl, {
      directory,
      keyword: deferredKeyword,
    })
      .then((items) => {
        if (!cancelled) {
          setResources(items)
        }
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : '加载资源列表失败')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingResources(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [directory, deferredKeyword, resourcesUrl])

  const directoryOptions = flattenDirectories(directories)
  const selectedResourceKey = parseFrontendResourceReference(value)?.key
  const selected =
    resources.find((item) => item.key === selectedResourceKey) ||
    (selectedResourceKey ? buildMissingFrontendResourceItem(selectedResourceKey) : null)
  const visibleResources =
    selected?.isMissing && !resources.some((item) => item.key === selected.key)
      ? [selected, ...resources]
      : resources
  const preview =
    selected && apiBase
      ? buildFrontendResourcePreview(
          selected,
          `${apiBase}/content?scope=frontend&key=${encodeURIComponent(selected.key)}`
        )
      : null

  const handleSelect = (selected: FrontendResourceItem) => {
    onChange?.(buildFrontendResourceReference(selected.key))
  }

  if (!appName) {
    return (
      <div className={className}>
        <div className="text-muted">当前编辑器没有启用前端资源浏览上下文。</div>
      </div>
    )
  }

  return (
    <div
      className={className}
      style={{
        border: '1px solid var(--colors-neutral-line-2, #e5e7eb)',
        borderRadius: 8,
        padding: 12,
        background: '#fff',
      }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
          gap: 8,
          marginBottom: 8,
        }}>
        <label style={{ display: 'grid', gap: 4 }}>
          <span className="text-muted">目录</span>
          <select
            disabled={disabled || loadingDirectories}
            value={directory}
            onChange={(event) => setDirectory(event.target.value)}
            style={{ minHeight: 32 }}>
            <option value="">全部目录</option>
            {directoryOptions.map((option) => (
              <option key={option.value || '__root__'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span className="text-muted">关键字</span>
          <input
            disabled={disabled}
            value={keyword}
            placeholder="按资源 Key 或文件名筛选"
            onChange={(event) => setKeyword(event.target.value)}
            style={{ minHeight: 32, padding: '0 8px' }}
          />
        </label>
      </div>

      {selected ? (
        <div
          style={{
            marginBottom: 8,
            padding: 10,
            borderRadius: 6,
            border: selected.isMissing ? '1px solid #f59e0b' : '1px solid #d1d5db',
            background: selected.isMissing ? '#fff7ed' : '#f8fafc',
          }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <strong>{selected.key}</strong>
            {selected.isMissing ? <span style={{ color: '#b45309' }}>未找到</span> : null}
          </div>
          <div className="text-muted" style={{ marginTop: 4 }}>
            {selected.isMissing
              ? '当前资源引用在工作区中不存在，保存时会继续保留原引用。'
              : renderMeta(selected)}
          </div>
        </div>
      ) : (
        <div className="text-muted" style={{ marginBottom: 8 }}>
          {placeholder}
        </div>
      )}

      {error ? <div style={{ marginBottom: 8, color: '#dc2626' }}>{error}</div> : null}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.2fr) minmax(200px, 0.8fr)',
          gap: 12,
          alignItems: 'start',
        }}>
        <div
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 6,
            minHeight: 220,
            maxHeight: 320,
            overflow: 'auto',
          }}>
          {loadingResources ? (
            <div className="text-muted" style={{ padding: 12 }}>
              正在加载资源...
            </div>
          ) : visibleResources.length ? (
            visibleResources.map((item) => (
              <button
                key={`${item.key}:${item.isMissing ? 'missing' : 'present'}`}
                type="button"
                disabled={disabled || item.isMissing}
                onClick={() => handleSelect(item)}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: 12,
                  textAlign: 'left',
                  border: 'none',
                  borderBottom: '1px solid #f1f5f9',
                  background: selectedResourceKey === item.key ? '#eff6ff' : '#fff',
                  cursor: disabled || item.isMissing ? 'not-allowed' : 'pointer',
                  opacity: item.isMissing ? 0.7 : 1,
                }}>
                <div style={{ fontWeight: 600 }}>{item.key}</div>
                <div className="text-muted" style={{ marginTop: 4, fontSize: 12 }}>
                  {item.isMissing ? '当前 key 不存在于资源列表中' : renderMeta(item)}
                </div>
              </button>
            ))
          ) : (
            <div className="text-muted" style={{ padding: 12 }}>
              没有匹配的前端资源。
            </div>
          )}
        </div>

        <div
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 6,
            padding: 12,
            minHeight: 220,
            background: '#f8fafc',
          }}>
          {preview ? (
            <>
              <div style={{ fontWeight: 600 }}>{preview.title}</div>
              <div className="text-muted" style={{ marginTop: 4, marginBottom: 12 }}>
                {preview.subtitle}
              </div>
              {preview.canPreview ? (
                <img
                  alt={preview.title}
                  src={preview.previewUrl}
                  style={{
                    display: 'block',
                    width: '100%',
                    maxHeight: 180,
                    objectFit: 'contain',
                    borderRadius: 6,
                    background: '#fff',
                  }}
                />
              ) : (
                <div className="text-muted">
                  该资源类型不支持图片预览，但可以按 key 选择。
                </div>
              )}
            </>
          ) : (
            <div className="text-muted">选择资源后可在这里预览。</div>
          )}
        </div>
      </div>
    </div>
  )
}

export default DevFrontendResourcePicker
