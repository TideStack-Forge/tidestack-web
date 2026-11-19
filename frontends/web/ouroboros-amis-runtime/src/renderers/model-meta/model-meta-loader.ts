import type { ModelMetaProviderConfig, NormalizedModelMeta } from './model-meta-types'

type LoadModelMetaOptions = {
  provider: ModelMetaProviderConfig
  data?: Record<string, any>
  fetchImpl?: typeof fetch
}

const metaCache = new Map<string, Promise<NormalizedModelMeta>>()
const TOKEN_STORAGE_KEY = 'Ouroboros_token'

export function clearModelMetaLoaderCache() {
  metaCache.clear()
}

export async function loadModelMeta(
  options: LoadModelMetaOptions
): Promise<NormalizedModelMeta> {
  const provider = options?.provider
  if (!provider) {
    throw new Error('modelMetaProvider 未配置')
  }

  const data = options.data ?? {}
  const runtimeData = buildRuntimeData(provider, data)
  const modelRef = resolveModelRef(provider, runtimeData)

  if (!modelRef) {
    throw new Error('modelMetaProvider 缺少 modelRef')
  }

  const staticMeta = provider.staticMeta?.[modelRef]
  if (staticMeta) {
    return ensureNormalizedMeta(staticMeta)
  }

  if (!provider.source) {
    throw new Error(`modelMetaProvider 无法解析模型 ${modelRef} 的元数据`)
  }

  const cacheKey = buildCacheKey(provider, modelRef)
  const cached = metaCache.get(cacheKey)
  if (cached) {
    return cached
  }

  const pending = fetchAndNormalizeMeta(provider, runtimeData, modelRef, options).catch(
    (error) => {
      metaCache.delete(cacheKey)
      throw error
    }
  )
  metaCache.set(cacheKey, pending)
  return pending
}

function buildRuntimeData(
  provider: ModelMetaProviderConfig,
  data: Record<string, any>
): Record<string, any> {
  const modelRef = provider.modelRef
    ? mapValue(provider.modelRef, data)
    : resolveKeyValue(provider.modelRefKey, data)

  return {
    ...data,
    modelRef,
  }
}

function resolveModelRef(
  provider: ModelMetaProviderConfig,
  runtimeData: Record<string, any>
): string | undefined {
  const modelRef = provider.modelRef
    ? mapValue(provider.modelRef, runtimeData)
    : resolveKeyValue(provider.modelRefKey, runtimeData)

  if (modelRef == null) {
    return undefined
  }
  const trimmed = String(modelRef).trim()
  return trimmed || undefined
}

async function fetchAndNormalizeMeta(
  provider: ModelMetaProviderConfig,
  runtimeData: Record<string, any>,
  modelRef: string,
  options: LoadModelMetaOptions
) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  if (typeof fetchImpl !== 'function') {
    throw new Error('当前环境不支持 model meta fetch')
  }

  const source = normalizeSource(provider, runtimeData)
  const requestPayload = buildRequestPayload(provider, runtimeData)
  const response = await fetchImpl(
    buildRequestUrl(source.url, source.method, requestPayload),
    buildRequestInit(source.method, source.headers, requestPayload)
  )

  if (!response?.ok) {
    throw new Error(`模型 ${modelRef} 元数据请求失败`)
  }

  const payload = await response.json()
  return normalizeRemoteMeta(payload, provider)
}

function normalizeSource(
  provider: ModelMetaProviderConfig,
  runtimeData: Record<string, any>
) {
  if (typeof provider.source === 'string') {
    return {
      url: String(mapValue(provider.source, runtimeData)),
      method: 'GET',
      headers: {},
    }
  }

  const mappedSource = mapValue(provider.source, runtimeData) ?? {}
  return {
    url: String(mappedSource.url ?? ''),
    method: String(mappedSource.method ?? 'GET').toUpperCase(),
    headers: mappedSource.headers ?? {},
  }
}

function buildRequestPayload(
  provider: ModelMetaProviderConfig,
  runtimeData: Record<string, any>
) {
  const sourceData =
    typeof provider.source === 'object' && provider.source != null
      ? mapValue(provider.source.data, runtimeData)
      : undefined
  const requestData = mapValue(provider.requestData, runtimeData)

  return {
    ...(isObject(sourceData) ? sourceData : {}),
    ...(isObject(requestData) ? requestData : {}),
  }
}

function buildRequestUrl(url: string, method: string, payload: Record<string, any>) {
  if (method !== 'GET' || !Object.keys(payload).length) {
    return url
  }

  const query = new URLSearchParams()
  Object.entries(payload).forEach(([key, value]) => {
    if (value == null) {
      return
    }
    query.set(key, String(value))
  })

  const queryString = query.toString()
  if (!queryString) {
    return url
  }
  return url.includes('?') ? `${url}&${queryString}` : `${url}?${queryString}`
}

function buildRequestInit(
  method: string,
  headers: Record<string, any>,
  payload: Record<string, any>
) {
  const init: RequestInit = {
    method,
    headers: withDefaultAuthHeader(headers),
  }

  if (method !== 'GET' && method !== 'HEAD' && Object.keys(payload).length) {
    init.body = JSON.stringify(payload)
    init.headers = {
      'Content-Type': 'application/json',
      ...withDefaultAuthHeader(headers),
    }
  }

  return init
}

function withDefaultAuthHeader(headers: Record<string, any>) {
  const mergedHeaders = { ...headers }
  if (mergedHeaders.Authorization || mergedHeaders.authorization) {
    return mergedHeaders
  }

  const accessToken = readStoredAccessToken()
  if (accessToken) {
    mergedHeaders.Authorization = `Bearer ${accessToken}`
  }
  return mergedHeaders
}

function readStoredAccessToken() {
  const storages = [globalThis.localStorage, globalThis.sessionStorage].filter(
    Boolean
  ) as Storage[]
  for (const storage of storages) {
    const rawToken = storage.getItem(TOKEN_STORAGE_KEY)
    const accessToken = parseAccessToken(rawToken)
    if (accessToken) {
      return accessToken
    }
  }
  return undefined
}

function parseAccessToken(rawToken: string | null) {
  if (!rawToken) {
    return undefined
  }
  try {
    const tokenPayload = JSON.parse(rawToken)
    const accessToken = tokenPayload?.accessToken
    if (!accessToken?.token) {
      return undefined
    }
    if (accessToken.expiresAt && Number(accessToken.expiresAt) <= Date.now()) {
      return undefined
    }
    return String(accessToken.token)
  } catch {
    return undefined
  }
}

function normalizeRemoteMeta(
  payload: Record<string, any>,
  provider: ModelMetaProviderConfig
) {
  const paths = provider.paths ?? {}
  const rawModel = getByPath(payload, paths.model ?? 'model')
  const rawFields = getByPath(payload, paths.fields ?? 'fields')
  const rawRelations = getByPath(payload, paths.relations ?? 'relations')

  const normalizedMeta: NormalizedModelMeta = {
    model: normalizeModel(rawModel),
    fields: normalizeFields(rawFields, provider.fieldMapping),
    relations: normalizeRelations(rawRelations, provider.relationMapping),
  }

  return ensureNormalizedMeta(normalizedMeta)
}

function normalizeModel(rawModel: any) {
  if (!isObject(rawModel)) {
    return undefined
  }

  const name = readMappedValue(rawModel, 'name')
  if (!name) {
    return undefined
  }

  const label = readMappedValue(rawModel, 'label')
  return label ? { name, label } : { name }
}

function normalizeFields(
  rawFields: any,
  fieldMapping?: ModelMetaProviderConfig['fieldMapping']
): NormalizedModelMeta['fields'] {
  if (!Array.isArray(rawFields)) {
    return []
  }

  return rawFields.reduce<NormalizedModelMeta['fields']>((acc, field) => {
    const name = readMappedValue(field, fieldMapping?.name ?? 'name')
    const label = readMappedValue(field, fieldMapping?.label ?? 'label')

    if (!name || !label) {
      acc.push(
        compactObject({
          name: name as any,
          label: label as any,
          type: readMappedValue(field, fieldMapping?.type ?? 'type'),
          options: readMapped(field, fieldMapping?.options ?? 'options'),
          optionsSource: readMapped(
            field,
            fieldMapping?.optionsSource ?? 'optionsSource'
          ),
        }) as NormalizedModelMeta['fields'][number]
      )
      return acc
    }

    acc.push(
      compactObject({
        name,
        label,
        type: readMappedValue(field, fieldMapping?.type ?? 'type'),
        options: readMapped(field, fieldMapping?.options ?? 'options'),
        optionsSource: readMapped(
          field,
          fieldMapping?.optionsSource ?? 'optionsSource'
        ),
      })
    )
    return acc
  }, [])
}

function normalizeRelations(
  rawRelations: any,
  relationMapping?: ModelMetaProviderConfig['relationMapping']
): NormalizedModelMeta['relations'] {
  if (!Array.isArray(rawRelations)) {
    return []
  }

  return rawRelations.reduce<NormalizedModelMeta['relations']>((acc, relation) => {
    const name = readMappedValue(relation, relationMapping?.name ?? 'name')
    const label = readMappedValue(relation, relationMapping?.label ?? 'label')
    const targetModel = readMappedValue(
      relation,
      relationMapping?.targetModel ?? 'targetModel'
    )
    const normalizedRelation = compactObject({
      name,
      label,
      targetModel,
      targetModelLabel: readMappedValue(
        relation,
        relationMapping?.targetModelLabel ?? 'targetModelLabel'
      ),
      type: readMappedValue(relation, relationMapping?.type ?? 'type'),
    })

    if (!name || !label || !targetModel) {
      acc.push(normalizedRelation as NormalizedModelMeta['relations'][number])
      return acc
    }

    acc.push(
      compactObject({
        name,
        label,
        targetModel,
        targetModelLabel: readMappedValue(
          relation,
          relationMapping?.targetModelLabel ?? 'targetModelLabel'
        ),
        type: readMappedValue(relation, relationMapping?.type ?? 'type'),
      })
    )
    return acc
  }, [])
}

function ensureNormalizedMeta(meta: NormalizedModelMeta) {
  if (!Array.isArray(meta.fields)) {
    throw new Error('模型元数据 fields 必须为数组')
  }
  if (!Array.isArray(meta.relations)) {
    throw new Error('模型元数据 relations 必须为数组')
  }

  meta.fields.forEach((field, index) => {
    if (!field?.name || !field?.label) {
      throw new Error(`模型字段[${index}] 缺少 name 或 label`)
    }
  })
  meta.relations.forEach((relation, index) => {
    if (!relation?.name || !relation?.label || !relation?.targetModel) {
      throw new Error(`模型关系[${index}] 缺少 name、label 或 targetModel`)
    }
  })

  return meta
}

function readMappedValue(source: any, path: string) {
  const value = readMapped(source, path)
  if (value == null) {
    return undefined
  }
  const text = String(value).trim()
  return text || undefined
}

function readMapped(source: any, path: string) {
  if (!path) {
    return undefined
  }
  return getByPath(source, path)
}

function getByPath(source: any, path: string) {
  if (!path) {
    return source
  }

  return String(path)
    .split('.')
    .filter(Boolean)
    .reduce((current, segment) => {
      if (current == null) {
        return undefined
      }
      return current[segment]
    }, source)
}

function mapValue(value: any, data: Record<string, any>): any {
  if (value == null) {
    return value
  }
  if (typeof value === 'string') {
    return interpolateString(value, data)
  }
  if (Array.isArray(value)) {
    return value.map((item) => mapValue(item, data))
  }
  if (isObject(value)) {
    return Object.entries(value).reduce(
      (acc, [key, item]) => {
        acc[key] = mapValue(item, data)
        return acc
      },
      {} as Record<string, any>
    )
  }
  return value
}

function resolveKeyValue(key: string | undefined, data: Record<string, any>) {
  if (!key) {
    return undefined
  }
  return getByPath(data, key)
}

function buildCacheKey(provider: ModelMetaProviderConfig, modelRef: string) {
  return `${stableStringify(provider)}::${modelRef}`
}

function stableStringify(value: any): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`
  }
  if (!isObject(value)) {
    return JSON.stringify(value)
  }

  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`
}

function compactObject<T extends Record<string, any>>(value: T): T {
  return Object.entries(value).reduce((acc, [key, item]) => {
    if (item !== undefined) {
      acc[key as keyof T] = item
    }
    return acc
  }, {} as T)
}

function isObject(value: any): value is Record<string, any> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function interpolateString(template: string, data: Record<string, any>) {
  const exactMatch = template.match(/^\$\{([^}]+)\}$/)
  if (exactMatch) {
    return getByPath(data, exactMatch[1].trim())
  }

  return template.replace(/\$\{([^}]+)\}/g, (_, expression: string) => {
    const resolved = getByPath(data, expression.trim())
    return resolved == null ? '' : String(resolved)
  })
}
