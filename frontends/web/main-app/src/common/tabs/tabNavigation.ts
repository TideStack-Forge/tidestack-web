export function normalizeTabPath(path: string) {
  let normalizedPath = path.trim()
  if (normalizedPath.indexOf('%') === -1) {
    normalizedPath = encodeURI(normalizedPath)
  }
  normalizedPath = normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`
  return normalizedPath
}

function getPathParts(fullPath: string) {
  const parts = fullPath.split(/[?#]/)
  const path = parts[0]
  const query = parts[1] ?? ''
  const hash = parts[2] ?? ''
  const queryParams: Record<string, string | undefined> = {}

  if (query) {
    query.split('&').forEach((item) => {
      const [key, value] = item.split('=')
      queryParams[key] = value
    })
  }

  function isQueryConflict(anotherQueryParams: Record<string, string | undefined>) {
    if (!anotherQueryParams || !Object.keys(anotherQueryParams).length) return false
    const keys = Object.keys(anotherQueryParams)
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      if (queryParams[key] && queryParams[key] !== anotherQueryParams[key]) {
        return true
      }
    }
    return false
  }

  function countMatchParams(anotherQueryParams: Record<string, string | undefined>) {
    if (!anotherQueryParams || !Object.keys(anotherQueryParams).length) return 0
    const keys = Object.keys(anotherQueryParams)
    let count = 0
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      if (queryParams[key] === anotherQueryParams[key]) {
        count++
      }
    }
    return count
  }

  return { path, query, hash, isQueryConflict, countMatchParams, queryParams }
}

export function getUrlMatchScore(url: string, anotherUrl: string) {
  if (url === anotherUrl) return Number.MAX_VALUE
  const { path, query, hash, isQueryConflict, countMatchParams } = getPathParts(url)
  const {
    path: anotherPath,
    query: anotherQuery,
    hash: anotherHash,
    queryParams: anotherQueryParams,
  } = getPathParts(anotherUrl)

  if (path !== anotherPath) return Number.MIN_VALUE

  let score = 0
  if (query === anotherQuery) {
    score += 10000
  } else if (isQueryConflict(anotherQueryParams)) {
    score -= 10000
  } else {
    score += countMatchParams(anotherQueryParams) * 2
  }

  if (hash === anotherHash) {
    score += 1
  }
  return score
}

export function findBestMatchingTabId(
  fullPath: string,
  tabsList: Array<{ id: string; path: string; fullPath: string }>
) {
  const normalizedFullPath = normalizeTabPath(fullPath)
  const path = normalizedFullPath.split('?')[0]

  const matchTabs = tabsList
    .filter((item) => item.path === path)
    .map((item) => ({
      tabId: item.id,
      score: getUrlMatchScore(normalizedFullPath, item.fullPath),
    }))
    .filter((item) => item.score > Number.MIN_VALUE)
    .sort((a, b) => b.score - a.score)

  return matchTabs.length ? matchTabs[0].tabId : null
}
