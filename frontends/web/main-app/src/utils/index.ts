/**
 * 获取启动模式
 * @param {String} url
 * @returns
 */
export function getBootstrapMode(url: string | URL) {
  let mode: 'host' | 'legacyIframe' = 'host'
  url = new URL(url)
  const searchParams = url.searchParams
  if (searchParams.get('legacyIframe') === 'true') {
    mode = 'legacyIframe'
  }
  return mode
}

export function getQueryParam(key: string, url: string) {
  url = url || window.location.href
  try {
    return new URL(url).searchParams.get(key)
  }
  catch (e) {
    return ""
  }
}
