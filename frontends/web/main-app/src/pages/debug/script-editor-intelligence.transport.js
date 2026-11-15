function buildMetadataApi(appName, language) {
  return `/api/dev/${appName}/metadata/script-intelligence/${language}?mode=raw`
}

function createPlaygroundFetcher(options) {
  const normalized = options || {}
  const sourceMode = normalized.sourceMode || 'mock'
  const intelligenceApi = normalized.intelligenceApi
  const debugState = normalized.debugState || {}
  const buildMockSnapshot =
    typeof normalized.buildMockSnapshot === 'function'
      ? normalized.buildMockSnapshot
      : () => null
  const client = normalized.client

  return async function playgroundFetcher(api, data) {
    const request = api?.data != null ? api.data : data || {}

    if (sourceMode === 'mock' && api?.url === intelligenceApi) {
      if (Array.isArray(debugState.requests)) {
        debugState.requests.push(request)
      }
      return {
        status: 0,
        data: buildMockSnapshot(request),
      }
    }

    return dispatchWithClient(client, api, request)
  }
}

async function fetchMetadataSnapshot(fetcher, appName, language) {
  if (typeof fetcher !== 'function' || !appName || !language) {
    return null
  }

  const result = await fetcher({
    method: 'get',
    url: buildMetadataApi(appName, language),
    data: {},
  })
  const payload = unwrapPayload(result)

  if (!payload) {
    return null
  }
  if (payload.status !== 0) {
    throw new Error(payload.msg || '脚本元数据加载失败')
  }
  return payload.data || null
}

function dispatchWithClient(client, api, request) {
  const method = String(api?.method || 'get').toLowerCase()
  const url = api?.url
  const config = api?.config
  if (!client || typeof client[method] !== 'function') {
    throw new Error(`Unsupported playground fetch method: ${method}`)
  }
  return client[method](url, request, config)
}

function unwrapPayload(result) {
  if (!result) {
    return null
  }
  if (
    typeof result.status === 'number' &&
    result.status !== 0 &&
    result.data &&
    typeof result.data === 'object' &&
    (typeof result.data.status === 'number' || typeof result.data.code === 'number')
  ) {
    if (result.data.status == null && typeof result.data.code === 'number') {
      result.data.status = result.data.code
    }
    return result.data
  }
  return result
}

module.exports = {
  buildMetadataApi,
  createPlaygroundFetcher,
  fetchMetadataSnapshot,
}
