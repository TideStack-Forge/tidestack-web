const TARGET_URL_PART = '/api/amis-main-thread-performance/'
const TARGET_URL_PART_WITHOUT_LEADING_SLASH = TARGET_URL_PART.slice(1)

function normalizeTransformList(transforms) {
  if (!transforms) {
    return []
  }
  return (Array.isArray(transforms) ? transforms : [transforms]).filter(
    (transform) => typeof transform === 'function'
  )
}

function getPayloadByteLength(data) {
  if (data == null) {
    return 0
  }
  if (typeof data === 'string') {
    return new TextEncoder().encode(data).byteLength
  }
  if (data instanceof ArrayBuffer) {
    return data.byteLength
  }
  if (ArrayBuffer.isView(data)) {
    return data.byteLength
  }
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    return data.size
  }
  if (typeof URLSearchParams !== 'undefined' && data instanceof URLSearchParams) {
    return new TextEncoder().encode(data.toString()).byteLength
  }
  return null
}

function emitMark(options, name, detail = {}) {
  options.onMark?.(name, {
    scenarioId: options.scenarioId,
    runId: options.runId,
    ...detail,
  })
}

function runTransforms(transforms, context, data, args) {
  return transforms.reduce(
    (currentData, transform) => transform.call(context, currentData, ...args),
    data
  )
}

export function isAmisMainThreadPerformanceUrl(url) {
  return (
    typeof url === 'string' &&
    (url.includes(TARGET_URL_PART) ||
      url.includes(TARGET_URL_PART_WITHOUT_LEADING_SLASH))
  )
}

export function instrumentAxiosConfig(config, options = {}) {
  if (!isAmisMainThreadPerformanceUrl(config?.url)) {
    return config
  }

  const defaults = options.axiosDefaults || {}
  const requestTransforms = normalizeTransformList(
    config.transformRequest ?? defaults.transformRequest
  )
  const responseTransforms = normalizeTransformList(
    config.transformResponse ?? defaults.transformResponse
  )

  config.transformRequest = [
    function instrumentedTransformRequest(data, ...args) {
      emitMark(options, 'request-transform-start', {
        url: config.url,
      })
      const transformedData = runTransforms(requestTransforms, this, data, args)
      emitMark(options, 'request-body-ready', {
        url: config.url,
        requestBytes: getPayloadByteLength(transformedData),
      })
      return transformedData
    },
  ]

  config.transformResponse = [
    function instrumentedTransformResponse(data, ...args) {
      emitMark(options, 'response-transform-start', {
        url: config.url,
      })
      const transformedData = runTransforms(responseTransforms, this, data, args)
      emitMark(options, 'json-parse-finished', {
        url: config.url,
        responseBytes: getPayloadByteLength(data),
      })
      return transformedData
    },
  ]

  return config
}

export function installAmisMainThreadPerformanceAxiosInstrumentation(
  configAxios,
  options = {}
) {
  let interceptorId = null
  let axiosInstance = null

  configAxios((axios) => {
    axiosInstance = axios
    interceptorId = axios.interceptors.request.use((config) =>
      instrumentAxiosConfig(config, {
        ...options,
        axiosDefaults: axios.defaults,
      })
    )
  })

  return function cleanupAmisMainThreadPerformanceAxiosInstrumentation() {
    if (axiosInstance && interceptorId != null) {
      axiosInstance.interceptors.request.eject(interceptorId)
      interceptorId = null
    }
  }
}

export const AMIS_MAIN_THREAD_PERFORMANCE_TARGET_URL_PART = TARGET_URL_PART
