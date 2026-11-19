export interface TypeShape {
  schema: Record<string, any>
}

export interface ScriptIntelligenceMember {
  shape?: TypeShape
  name: string
  memberKind?: string | null
  returnTypeDisplayName?: string | null
  declaringTypeName?: string | null
  isStatic?: boolean | null
  parameterTypeDisplayNames?: string[]
}

export interface ScriptIntelligenceGlobal {
  origin?: CodeCandidateOrigin
  shape?: TypeShape
  name: string
  kind?: string | null
  typeDisplayName?: string | null
  qualifiedTypeName?: string | null
  documentation?: string | null
  sourceTag?: string | null
  members?: ScriptIntelligenceMember[]
}

export interface ScriptIntelligenceJavaType {
  origin?: CodeCandidateOrigin
  qualifiedName: string
  simpleName: string
  packageName?: string | null
  constructors?: ScriptIntelligenceMember[]
  staticMethods?: ScriptIntelligenceMember[]
  staticFields?: ScriptIntelligenceMember[]
  instanceMethods?: ScriptIntelligenceMember[]
}

export interface ScriptIntelligenceSnapshot {
  diagnostics?: Array<{
    source?: string
    message: string
    severity?: number
    path?: Array<string | number>
    range?: {
      start: { line: number; character: number }
      end: { line: number; character: number }
    }
  }>
  source?: string | null
  runtimeProfile: string
  globals: ScriptIntelligenceGlobal[]
  javaImports: string[]
  javaTypes: ScriptIntelligenceJavaType[]
  languageProjectionHints?: Record<string, any>
  versionToken: string
}

export type CodeCandidateOrigin = 'APPLICATION_SNAPSHOT' | 'DRAFT_INFERENCE' | 'PLATFORM_REFERENCE'

export interface ScriptEditorEnvLike {
  fetcher?: (api: any, data?: any, options?: { ignoreData: boolean }) => Promise<any>
}

export interface ScriptEditorPropsLike {
  validateCode?: boolean
  codeEmbedding?: 'json'
  codeSite?: string
  codePointer?: string
  codeResourceType?: string
  index?: number
  formStore?: { data?: Record<string, any> }
  intelligenceApi?: string
  language?: string
  value?: any
  data?: Record<string, any>
  env?: ScriptEditorEnvLike
}

export interface ScriptEditorAdapter {
  readonly diagnosticOwner?: string
  apply(snapshot: ScriptIntelligenceSnapshot): Promise<void> | void
  validate?(): Promise<void>
  dispose(): void
}

export interface ScriptEditorIntelligenceBridge {
  readonly diagnosticOwner?: string
  refresh(props: ScriptEditorPropsLike): Promise<void>
  validate(props: ScriptEditorPropsLike): Promise<void>
  dispose(): void
}

export interface ScriptEditorAdapterContext {
  editor: any
  monaco: any
  subscribeEnvironment?: (appName: string, invalidate: () => void) => () => void
}
