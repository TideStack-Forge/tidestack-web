import type {
  ScriptEditorPropsLike,
  ScriptIntelligenceSnapshot,
} from './types'

export async function fetchScriptIntelligenceSnapshot(
  props: ScriptEditorPropsLike,
  identity?: { documentId: string; documentVersion: number; draftRevision: number }
): Promise<ScriptIntelligenceSnapshot | null> {
  const fetcher = props.env?.fetcher
  const request = identity ? buildCodeContextRequest(props, identity) : null
  if (!fetcher || !props.intelligenceApi || !request) {
    return null
  }

  const result = await fetcher(
    {
      method: 'post',
      url: props.intelligenceApi,
      data: request,
    },
    request,
    { ignoreData: true }
  )
  const payload = unwrapScriptIntelligencePayload(result)

  if (!payload) {
    return null
  }
  if (payload.status !== 0) {
    throw new Error(payload.msg || '脚本智能上下文加载失败')
  }
  if (identity) {
    const response = payload.data
    if (
      !response ||
      response.documentId !== identity.documentId ||
      response.documentVersion !== identity.documentVersion ||
      response.draftRevision !== identity.draftRevision
    )
      throw new Error('代码上下文响应版本不匹配')
    return response.snapshot
  }
  return (payload.data || null) as ScriptIntelligenceSnapshot | null
}

function unwrapScriptIntelligencePayload(result: any): any {
  if (!result) {
    return null
  }
  if (
    typeof result.status === 'number' &&
    result.status !== 0 &&
    result.data &&
    typeof result.data === 'object' &&
    typeof result.data.status === 'number'
  ) {
    return result.data
  }
  return result
}

export function buildCodeContextRequest(
  props: ScriptEditorPropsLike,
  identity: { documentId: string; documentVersion: number; draftRevision: number }
) {
  const data = props.data || {}
  const original =
    data.__CODE_RESOURCE_DRAFT || data.__FLOW_MODEL || findResourceDraft(props)
  const type = props.codeResourceType || (data.__FLOW_MODEL ? 'logicflow' : undefined)
  let pointer = props.codePointer
  if (pointer?.endsWith('/**')) {
    if (typeof data.key !== 'string' || !data.key) return null
    pointer = pointer.slice(0, -2) + data.key.replace(/~/g, '~0').replace(/\//g, '~1')
  }
  if (pointer?.includes('*')) {
    const index = data._key ?? data.__index ?? data.index ?? props.index
    if ((typeof index !== 'string' || !index) && (!Number.isInteger(index) || index < 0))
      return null
    pointer = pointer.replace('*', String(index).replace(/~/g, '~0').replace(/\//g, '~1'))
  }
  if (!original || !type || !pointer || !props.language || !props.codeSite) return null
  const draft = JSON.parse(JSON.stringify(original))
  const nodeName = data.__CURRENT_NODE_NAME
  const target =
    type === 'logicflow'
      ? draft.nodes?.find((node: any) => node.name === nodeName)
      : draft
  if (!target) return null
  const segments = pointer
    .slice(1)
    .split('/')
    .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'))
  let container = target
  for (const segment of segments.slice(0, -1)) {
    if (['__proto__', 'prototype', 'constructor'].includes(segment)) return null
    if (!container[segment] || typeof container[segment] !== 'object') return null
    container = container[segment]
  }
  const field = segments[segments.length - 1]
  if (['__proto__', 'prototype', 'constructor'].includes(field)) return null
  if (props.value !== undefined) container[field] = props.value
  return {
    ...identity,
    codeSite: props.codeSite,
    language: props.language,
    resource: { type, name: draft.name },
    location: { nodeName, pointer },
    draft,
  }
}

/** AMIS combo rows carry their enclosing form through __super; never send a row as the resource. */
function findResourceDraft(props: ScriptEditorPropsLike) {
  const seen = new Set<any>()
  let candidate = props.data
  let root: any
  while (candidate && !seen.has(candidate)) {
    seen.add(candidate)
    if (
      Object.prototype.hasOwnProperty.call(candidate, 'name') &&
      ((props.codeResourceType === 'business-model' &&
        Object.prototype.hasOwnProperty.call(candidate, 'modelType')) ||
        (props.codeResourceType === 'rpc-model' &&
          Object.prototype.hasOwnProperty.call(candidate, 'request')) ||
        (props.codeResourceType === 'rpc-auth' &&
          Object.prototype.hasOwnProperty.call(candidate, 'type')) ||
        (props.codeResourceType === 'configuration' &&
          Object.prototype.hasOwnProperty.call(candidate, 'key')) ||
        (props.codeResourceType === 'field-type' &&
          Object.prototype.hasOwnProperty.call(candidate, 'schema')) ||
        (props.codeResourceType === 'business-log-template' &&
          Object.prototype.hasOwnProperty.call(candidate, 'summaryTemplate')) ||
        (props.codeResourceType === 'notification' &&
          Object.prototype.hasOwnProperty.call(candidate, 'channel')))
    )
      root = candidate
    candidate = candidate.__super
  }
  return (
    root ||
    props.formStore?.data ||
    (props.codeResourceType === 'business-model' ? props.data : undefined)
  )
}
