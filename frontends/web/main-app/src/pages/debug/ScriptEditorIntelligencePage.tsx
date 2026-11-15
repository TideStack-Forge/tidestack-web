import { useCallback, useEffect, useMemo, useState } from 'react'
import type { RenderOptions } from 'amis'
import AmisComponent from '@/components/amis/AmisComponent'
import { Client } from '@/utils/http'
import scriptEditorIntelligenceMock from './script-editor-intelligence.mock'
import scriptEditorIntelligenceTransport from './script-editor-intelligence.transport'

type PlaygroundLanguage = 'javascript' | 'groovy'
type SourceMode = 'mock' | 'api'
type AmisFetcher = NonNullable<RenderOptions['fetcher']>

interface DebugEditorState {
  editor: {
    setValue?: (value: string) => void
    getModel?: () => {
      getLineCount(): number
      getLineMaxColumn(lineNumber: number): number
    } | null
    setPosition?: (position: { lineNumber: number; column: number }) => void
    focus?: () => void
    trigger?: (source: string, action: string, payload: Record<string, never>) => void
  } | null
  applied: boolean
  monaco: {
    languages?: {
      typescript?: {
        javascriptDefaults?: { getExtraLibs?: () => Record<string, { content?: string }> }
      }
    }
  } | null
  props: { language?: PlaygroundLanguage } | null
  snapshot: Record<string, unknown> | null
}

interface DebugMetadataState {
  error: string | null
  loaded: boolean
  snapshot: Record<string, unknown> | null
}

interface PlaygroundDebugState {
  editors: Record<PlaygroundLanguage, DebugEditorState>
  metadata: Record<PlaygroundLanguage, DebugMetadataState>
  requests: Array<{ language?: PlaygroundLanguage }>
  sourceMode: SourceMode
  intelligenceApi: string
}

interface PlaygroundWindow extends Window {
  __SCRIPT_EDITOR_INTELLIGENCE_PLAYGROUND__?: any
  __OUROBOROS_SCRIPT_EDITOR_DEBUG__?: any
}

function isPlaygroundLanguage(value: unknown): value is PlaygroundLanguage {
  return value === 'javascript' || value === 'groovy'
}

const {
  PLAYGROUND_APP_NAME,
  PLAYGROUND_FLOW_MODEL,
  buildPlaygroundMockSnapshot,
} = scriptEditorIntelligenceMock as {
  PLAYGROUND_APP_NAME: string
  PLAYGROUND_FLOW_MODEL: Record<string, unknown>
  buildPlaygroundMockSnapshot: (request?: Record<string, unknown>) => Record<string, unknown>
}
const {
  createPlaygroundFetcher,
  fetchMetadataSnapshot,
} = scriptEditorIntelligenceTransport as {
  createPlaygroundFetcher: (options: Record<string, unknown>) => AmisFetcher
  fetchMetadataSnapshot: (
    fetcher: AmisFetcher,
    appName: string,
    language: PlaygroundLanguage
  ) => Promise<Record<string, unknown> | null>
}

const DEFAULT_SOURCE_MODE: SourceMode = 'mock'
const DEFAULT_APP_NAME = PLAYGROUND_APP_NAME
const MOCK_INTELLIGENCE_API = '/api/mock/script-intelligence'

const pageStyle = {
  minHeight: '100vh',
  padding: '48px',
  background:
    'radial-gradient(circle at top left, rgba(233, 184, 73, 0.16), transparent 32%), linear-gradient(180deg, #f7f3ea 0%, #efe6d6 100%)',
  color: '#1f1c15',
} as const
const headerStyle = { maxWidth: '720px', marginBottom: '32px' } as const
const eyebrowStyle = {
  margin: '0 0 12px',
  fontSize: '12px',
  fontWeight: 700,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: '#7f5d20',
} as const
const titleStyle = { margin: 0, fontSize: '40px', lineHeight: 1.1 } as const
const descriptionStyle = {
  margin: '16px 0 0',
  fontSize: '18px',
  lineHeight: 1.6,
  color: '#4c4335',
} as const
const badgeStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '8px 12px',
  border: '1px solid rgba(95, 67, 21, 0.14)',
  borderRadius: '999px',
  background: 'rgba(255, 250, 241, 0.88)',
  color: '#5e471e',
  fontSize: '13px',
  fontWeight: 600,
} as const
const badgeListStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '12px',
  marginTop: '18px',
} as const
const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '24px',
} as const
const panelStyle = {
  padding: '24px',
  border: '1px solid rgba(78, 57, 23, 0.12)',
  borderRadius: '24px',
  background: 'rgba(255, 252, 247, 0.86)',
  boxShadow: '0 18px 40px rgba(65, 49, 20, 0.08)',
} as const
const panelHeaderStyle = { marginBottom: '16px' } as const
const panelTitleStyle = { margin: 0, fontSize: '28px' } as const
const panelDescriptionStyle = {
  margin: '10px 0 0',
  color: '#5c5242',
  lineHeight: 1.6,
} as const
const panelMetaStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
  marginTop: '14px',
} as const
const editorStyle = { height: '380px' } as const

function readQueryParam(name: string, fallbackValue: string) {
  const query = new URLSearchParams(window.location.search)
  return query.get(name) || fallbackValue
}
function resolveSourceMode(): SourceMode {
  const mode = readQueryParam('source', DEFAULT_SOURCE_MODE).toLowerCase()
  return mode === 'api' ? 'api' : 'mock'
}
function buildIntelligenceApi(sourceMode: SourceMode, appName: string) {
  return sourceMode === 'api'
    ? `/api/dev/${appName}/logicflow/script-intelligence/snapshot`
    : MOCK_INTELLIGENCE_API
}
function createDebugEditorState(): DebugEditorState {
  return { editor: null, applied: false, monaco: null, props: null, snapshot: null }
}
function createDebugMetadataState(): DebugMetadataState {
  return { error: null, loaded: false, snapshot: null }
}
function buildEditorSchema(
  name: string,
  language: PlaygroundLanguage,
  value: string,
  intelligenceApi: string
) {
  return {
    type: 'page',
    body: [
      {
        type: 'form',
        wrapWithPanel: false,
        title: '',
        mode: 'normal',
        body: [
          {
            type: 'script-editor',
            name,
            language,
            intelligenceScene: 'logicflow-script-node',
            intelligenceApi,
            value,
            size: 'full',
            height: 320,
            options: { minimap: { enabled: false } },
          },
        ],
      },
    ],
  }
}
function getSnapshotField(
  snapshot: Record<string, unknown> | null | undefined,
  field: string,
  fallbackValue: string
) {
  const value = snapshot?.[field]
  return value == null || value === '' ? fallbackValue : String(value)
}

export function ScriptEditorIntelligencePage() {
  const [version, setVersion] = useState(0)
  const sourceMode = useMemo(resolveSourceMode, [])
  const appName = useMemo(() => readQueryParam('appName', DEFAULT_APP_NAME), [])
  const intelligenceApi = useMemo(
    () => buildIntelligenceApi(sourceMode, appName),
    [appName, sourceMode]
  )
  const debugState = useMemo<PlaygroundDebugState>(
    () => ({
      editors: { javascript: createDebugEditorState(), groovy: createDebugEditorState() },
      metadata: {
        javascript: createDebugMetadataState(),
        groovy: createDebugMetadataState(),
      },
      requests: [],
      sourceMode,
      intelligenceApi,
    }),
    [intelligenceApi, sourceMode]
  )
  const bumpVersion = useCallback(() => setVersion((current) => current + 1), [])
  const playgroundFetcher: AmisFetcher = useMemo(
    () =>
      createPlaygroundFetcher({
        sourceMode,
        intelligenceApi,
        debugState,
        buildMockSnapshot: buildPlaygroundMockSnapshot,
        client: Client,
      }),
    [debugState, intelligenceApi, sourceMode]
  )
  const javascriptCode = 'LocalDate.'
  const groovyCode = '$input.'
  const javascriptSchema = useMemo(
    () =>
      buildEditorSchema(
        'javascriptScript',
        'javascript',
        javascriptCode,
        intelligenceApi
      ),
    [intelligenceApi]
  )
  const groovySchema = useMemo(
    () => buildEditorSchema('groovyScript', 'groovy', groovyCode, intelligenceApi),
    [intelligenceApi]
  )
  const javascriptProps = useMemo(
    () => ({
      data: {
        javascriptScript: javascriptCode,
        __CURRENT_NODE_NAME: 'script-node-1',
        __CURRENT_NODE_TYPE: 'script',
        __FLOW_MODEL: PLAYGROUND_FLOW_MODEL,
      },
    }),
    []
  )
  const groovyProps = useMemo(
    () => ({
      data: {
        groovyScript: groovyCode,
        __CURRENT_NODE_NAME: 'script-node-1',
        __CURRENT_NODE_TYPE: 'script',
        __FLOW_MODEL: PLAYGROUND_FLOW_MODEL,
      },
    }),
    []
  )

  const loadMetadata = useCallback(
    async (language: PlaygroundLanguage) => {
      const entry = debugState.metadata[language]
      entry.error = null
      entry.loaded = false
      entry.snapshot = null
      bumpVersion()
      try {
        entry.snapshot = await fetchMetadataSnapshot(playgroundFetcher, appName, language)
      } catch (error) {
        entry.error = error instanceof Error ? error.message : '脚本元数据加载失败'
      } finally {
        entry.loaded = true
        bumpVersion()
      }
    },
    [appName, bumpVersion, debugState.metadata, playgroundFetcher]
  )

  useEffect(() => {
    const playgroundWindow = window as PlaygroundWindow
    playgroundWindow.__SCRIPT_EDITOR_INTELLIGENCE_PLAYGROUND__ = {
      ready: false,
      getSourceMode() {
        return debugState.sourceMode
      },
      getIntelligenceApi() {
        return debugState.intelligenceApi
      },
      getAppliedSnapshot(language: PlaygroundLanguage) {
        return debugState.editors[language]?.snapshot || null
      },
      getMetadataSnapshot(language: PlaygroundLanguage) {
        return debugState.metadata[language]?.snapshot || null
      },
      hasApplied(language: PlaygroundLanguage) {
        return Boolean(debugState.editors[language]?.applied)
      },
      getRequestCount(language: PlaygroundLanguage) {
        return debugState.requests.filter((request) => request.language === language)
          .length
      },
      setValue(language: PlaygroundLanguage, value: string) {
        const entry = debugState.editors[language]
        entry.editor?.setValue?.(value)
        const model = entry.editor?.getModel?.()
        if (model && entry.editor?.setPosition) {
          const lineNumber = model.getLineCount()
          entry.editor.setPosition({
            lineNumber,
            column: model.getLineMaxColumn(lineNumber),
          })
        }
        entry.editor?.focus?.()
      },
      triggerSuggest(language: PlaygroundLanguage) {
        const entry = debugState.editors[language]
        entry.editor?.focus?.()
        entry.editor?.trigger?.('playwright', 'editor.action.triggerSuggest', {})
      },
      getJavascriptExtraLibs() {
        const extraLibs =
          debugState.editors.javascript.monaco?.languages?.typescript?.javascriptDefaults?.getExtraLibs?.() ||
          {}
        return Object.values(extraLibs).map((item: any) => item.content || '')
      },
    }

    playgroundWindow.__OUROBOROS_SCRIPT_EDITOR_DEBUG__ = {
      onMounted: ({ editor, monaco, props }: any) => {
        const nextLanguage: unknown = props?.language
        if (!isPlaygroundLanguage(nextLanguage)) return
        const entry = debugState.editors[nextLanguage]
        entry.editor = editor
        entry.applied = false
        entry.monaco = monaco
        entry.props = props
        entry.snapshot = null
        const api = playgroundWindow.__SCRIPT_EDITOR_INTELLIGENCE_PLAYGROUND__
        if (api)
          api.ready = Boolean(
            debugState.editors.javascript.editor && debugState.editors.groovy.editor
          )
        bumpVersion()
      },
      onIntelligenceApplied: ({ language, snapshot }: any) => {
        const nextLanguage: unknown = language
        if (!isPlaygroundLanguage(nextLanguage)) return
        const entry = debugState.editors[nextLanguage]
        if (!entry) return
        entry.applied = true
        entry.snapshot = snapshot || null
        bumpVersion()
      },
    }

    if (sourceMode === 'api') {
      void Promise.all([loadMetadata('javascript'), loadMetadata('groovy')])
    }
    return () => {
      delete playgroundWindow.__OUROBOROS_SCRIPT_EDITOR_DEBUG__
      delete playgroundWindow.__SCRIPT_EDITOR_INTELLIGENCE_PLAYGROUND__
    }
  }, [bumpVersion, debugState, loadMetadata, sourceMode])

  const sourceModeLabel = sourceMode === 'api' ? 'API' : 'Mock'
  const descriptionText =
    sourceMode === 'api'
      ? `Loading raw metadata from metadata endpoints plus live script-intelligence snapshots from ${intelligenceApi}.`
      : 'Loading mocked script editor scenarios for Playwright checks.'
  function getPanelDescription(language: PlaygroundLanguage) {
    return sourceMode === 'api'
      ? language === 'javascript'
        ? 'Uses the logicflow snapshot API and applies returned GraalJS declarations.'
        : 'Uses the logicflow snapshot API and applies returned Groovy completions, hover and signatures.'
      : language === 'javascript'
        ? 'Mocked logicflow globals plus Java.type static members.'
        : 'Mocked imports, flow input globals, hover and signature probes.'
  }

  return (
    <section
      style={pageStyle}
      data-testid="script-editor-intelligence-page"
      data-version={version}>
      <header style={headerStyle}>
        <p style={eyebrowStyle}>Debug Route</p>
        <h1 style={titleStyle}>Script Editor Intelligence Playground</h1>
        <p style={descriptionStyle}>{descriptionText}</p>
        <div style={badgeListStyle}>
          <span style={badgeStyle}>Data Source {sourceModeLabel}</span>
          <span style={badgeStyle}>{intelligenceApi}</span>
          <span style={badgeStyle}>App {appName}</span>
        </div>
      </header>
      <div style={gridStyle}>
        <article style={panelStyle} data-testid="javascript-playground">
          <div style={panelHeaderStyle}>
            <h2 style={panelTitleStyle}>JavaScript (GraalJS)</h2>
            <p style={panelDescriptionStyle}>{getPanelDescription('javascript')}</p>
            <div style={panelMetaStyle}>
              {sourceMode === 'api' ? (
                <>
                  <span style={badgeStyle}>
                    Metadata{' '}
                    {getSnapshotField(
                      debugState.metadata.javascript.snapshot,
                      'source',
                      'pending'
                    )}
                  </span>
                  <span style={badgeStyle}>
                    Metadata Runtime{' '}
                    {getSnapshotField(
                      debugState.metadata.javascript.snapshot,
                      'runtimeProfile',
                      'pending'
                    )}
                  </span>
                </>
              ) : null}
              <span style={badgeStyle}>
                Snapshot{' '}
                {getSnapshotField(
                  debugState.editors.javascript.snapshot,
                  'source',
                  'pending'
                )}
              </span>
              <span style={badgeStyle}>
                Runtime{' '}
                {getSnapshotField(
                  debugState.editors.javascript.snapshot,
                  'runtimeProfile',
                  'pending'
                )}
              </span>
            </div>
          </div>
          <div style={editorStyle}>
            <AmisComponent
              amisSchema={javascriptSchema}
              amisProps={javascriptProps}
              amisEnv={{ fetcher: playgroundFetcher }}
              style={{ height: '100%' }}
            />
          </div>
        </article>
        <article style={panelStyle} data-testid="groovy-playground">
          <div style={panelHeaderStyle}>
            <h2 style={panelTitleStyle}>Groovy</h2>
            <p style={panelDescriptionStyle}>{getPanelDescription('groovy')}</p>
            <div style={panelMetaStyle}>
              {sourceMode === 'api' ? (
                <>
                  <span style={badgeStyle}>
                    Metadata{' '}
                    {getSnapshotField(
                      debugState.metadata.groovy.snapshot,
                      'source',
                      'pending'
                    )}
                  </span>
                  <span style={badgeStyle}>
                    Metadata Runtime{' '}
                    {getSnapshotField(
                      debugState.metadata.groovy.snapshot,
                      'runtimeProfile',
                      'pending'
                    )}
                  </span>
                </>
              ) : null}
              <span style={badgeStyle}>
                Snapshot{' '}
                {getSnapshotField(
                  debugState.editors.groovy.snapshot,
                  'source',
                  'pending'
                )}
              </span>
              <span style={badgeStyle}>
                Runtime{' '}
                {getSnapshotField(
                  debugState.editors.groovy.snapshot,
                  'runtimeProfile',
                  'pending'
                )}
              </span>
            </div>
          </div>
          <div style={editorStyle}>
            <AmisComponent
              amisSchema={groovySchema}
              amisProps={groovyProps}
              amisEnv={{ fetcher: playgroundFetcher }}
              style={{ height: '100%' }}
            />
          </div>
        </article>
      </div>
    </section>
  )
}
