export function isExternal(path) {
  return /^(https?:|mailto:|tel:)/.test(path)
}

export function appendQueryParams(url, params) {
  if (!params || !Object.keys(params).length) {
    return url
  }

  const query = Object.keys(params)
    .map((key) => `${key}=${encodeURIComponent(params[key])}`)
    .join('&')

  return `${url}${url.includes('?') ? '&' : '?'}${query}`
}
