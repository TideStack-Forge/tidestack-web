const microEntryHealthCache = new Map()

function resolveResourceUrl(entry) {
  if (typeof window === 'undefined' || !entry) {
    return null
  }

  try {
    const input = typeof entry === 'object' && entry.url ? entry.url : entry
    return new URL(input, window.location.origin).toString()
  } catch (error) {
    return null
  }
}

function isSameOriginResource(resourceUrl) {
  if (typeof window === 'undefined' || !resourceUrl) {
    return false
  }

  try {
    return new URL(resourceUrl).origin === window.location.origin
  } catch (error) {
    return false
  }
}

function isMothershipLayoutHtml(html) {
  if (!html || typeof html !== 'string') {
    return false
  }

  return (
    /id=(['"])mothership-app-root\1/.test(html) ||
    html.includes('name="app-name" content="ouroboros-mothership-app"') ||
    html.includes('/static/js/mothership')
  )
}

function createUnsafeMicroEntryError(resourceUrl) {
  const error = new Error(`微前端资源 ${resourceUrl} 返回了主应用壳页面，已停止加载`)
  error.isUnsafeMicroEntry = true
  return error
}

async function ensureSameOriginMicroResourceResponseIsSafe(resourceUrl, response) {
  if (!isSameOriginResource(resourceUrl)) {
    return
  }

  const cached = microEntryHealthCache.get(resourceUrl)
  if (cached === true) {
    return
  }
  if (cached instanceof Error) {
    throw cached
  }

  const contentType = response?.headers?.get?.('content-type') || ''
  if (!response?.ok || !contentType.includes('text/html')) {
    microEntryHealthCache.set(resourceUrl, true)
    return
  }

  const readableResponse = typeof response.clone === 'function' ? response.clone() : response
  const html = await readableResponse.text()
  if (!isMothershipLayoutHtml(html)) {
    microEntryHealthCache.set(resourceUrl, true)
    return
  }

  const error = createUnsafeMicroEntryError(resourceUrl)
  microEntryHealthCache.set(resourceUrl, error)
  throw error
}

export async function ensureSameOriginMicroEntryIsSafe(entry) {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') {
    return
  }

  const entryUrl = resolveResourceUrl(entry)
  if (!entryUrl || !isSameOriginResource(entryUrl)) {
    return
  }

  const cached = microEntryHealthCache.get(entryUrl)
  if (cached === true) {
    return
  }
  if (cached instanceof Error) {
    throw cached
  }

  const response = await window.fetch(entryUrl, {
    credentials: 'same-origin',
    headers: {
      Accept: 'text/html,*/*',
    },
  })

  await ensureSameOriginMicroResourceResponseIsSafe(entryUrl, response)
}

export function createMicroEntryFetch(fetcher) {
  return async (input, init) => {
    const baseFetch = fetcher || window.fetch.bind(window)
    const response = await baseFetch(input, init)
    const resourceUrl = resolveResourceUrl(input)
    if (resourceUrl) {
      await ensureSameOriginMicroResourceResponseIsSafe(resourceUrl, response)
    }
    return response
  }
}

export function resetMicroEntryHealthCache() {
  microEntryHealthCache.clear()
}
