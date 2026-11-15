function getLegalName(entry: string) {
  const reg = new RegExp(/[/?=:]/, 'g')
  const ret = entry.replace(reg, '-')
  if (ret.startsWith('-')) {
    return 'micro' + ret
  }
  return ret
}

function normalizeRoutePath(url: string, isExternal: (url: string) => boolean) {
  if (isExternal(url)) return undefined
  const [routePath] = url.split('?')
  return routePath
}

export function buildEntryRoutesMap(
  routes: any[],
  options: { isExternal?: (url: string) => boolean } = {}
) {
  const { isExternal = () => false } = options
  const microAppRoutes = routes.filter(
    (route) => route.type === 'micro' || route.type === 'quick'
  )

  return microAppRoutes.reduce(
    (prev, curr) => {
      const entry = curr.entry || (curr.config && curr.config.entry) || ''
      let entryRoutes = prev[entry]
      if (!entryRoutes) {
        entryRoutes = []
        prev[entry] = entryRoutes
      }

      const path = normalizeRoutePath(curr.path, isExternal)
      if (path) {
        entryRoutes.push(path)
      }
      return prev
    },
    {} as Record<string, string[]>
  )
}

export function buildMicroEntryArray(
  entryRoutesMap: Record<string, string[]>,
  options: { isExternal: (url: string) => boolean; origin: string }
) {
  const { isExternal, origin } = options
  return Object.keys(entryRoutesMap).map((item) => {
    if (!isExternal(item)) {
      return origin + item
    }
    return item
  })
}

export function buildActiveRuleMatcher(defineRoutes: string[]) {
  return function matches(path: string) {
    return defineRoutes.some((url) => {
      const regexpStr = url.replaceAll(/:([_A-Za-z]+\w*)/g, '[\\w\\-]+')
      const regexp = new RegExp(regexpStr)
      return regexp.test(path)
    })
  }
}

export function buildMicroAppConfigs(
  entryRoutesMap: Record<string, string[]>,
  options: {
    commonProps: any
    normalizeEntry: (entry: string) => string
    registerLoadTarget: (name: string, retryKey: string) => void
    createActiveRule: (args: {
      entry: string
      routes: string[]
      retryKey: string
    }) => (loc: any) => boolean
  }
) {
  const { commonProps, normalizeEntry, registerLoadTarget, createActiveRule } = options

  return Object.entries(entryRoutesMap).map(([entry, routes]) => {
    const name = getLegalName(entry)
    const retryKey = `route:${entry}`
    registerLoadTarget(name, retryKey)

    return {
      entry: normalizeEntry(entry),
      activeRule: createActiveRule({ entry, routes, retryKey }),
      container: '#micro-app',
      name,
      props: commonProps,
    }
  })
}

export function buildExcludeAssetFilter(microEntryArray: string[]) {
  return function excludeAssetFilter(assetUrl: string) {
    return !microEntryArray.some((item) => assetUrl.startsWith(item))
  }
}
