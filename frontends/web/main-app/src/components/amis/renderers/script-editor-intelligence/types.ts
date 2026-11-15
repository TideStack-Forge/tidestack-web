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
  qualifiedName: string
  simpleName: string
  packageName?: string | null
  constructors?: ScriptIntelligenceMember[]
  staticMethods?: ScriptIntelligenceMember[]
  staticFields?: ScriptIntelligenceMember[]
  instanceMethods?: ScriptIntelligenceMember[]
}

export interface ScriptIntelligenceSnapshot {
  source?: string | null
  runtimeProfile: string
  globals: ScriptIntelligenceGlobal[]
  javaImports: string[]
  javaTypes: ScriptIntelligenceJavaType[]
  languageProjectionHints?: Record<string, any>
  versionToken: string
}

export interface ScriptIntelligenceSnapshotRequest {
  flowModel: Record<string, any>
  nodeName: string
  language: string
  script?: string
}

export interface ScriptEditorEnvLike {
  fetcher?: (api: any, data?: any, options?: { ignoreData: boolean }) => Promise<any>
}

export interface ScriptEditorPropsLike {
  codeEmbedding?: 'json'
  codeSite?: string
  codePointer?: string
  codeResourceType?: string
  index?: number
  formStore?: { data?: Record<string, any> }
  intelligenceScene?: string
  intelligenceApi?: string
  language?: string
  value?: any
  data?: Record<string, any>
  env?: ScriptEditorEnvLike
}

export interface ScriptEditorAdapter {
  apply(snapshot: ScriptIntelligenceSnapshot): Promise<void> | void
  dispose(): void
}

export interface ScriptEditorIntelligenceBridge {
  refresh(props: ScriptEditorPropsLike): Promise<void>
  dispose(): void
}

export interface ScriptEditorAdapterContext {
  editor: any
  monaco: any
  subscribeEnvironment?: (appName: string, invalidate: () => void) => () => void
}
