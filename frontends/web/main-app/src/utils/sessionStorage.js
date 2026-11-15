const keyPrefix = 'Ouroboros_'
// key值加前缀
const addPrefix = (key) => {
  return `${keyPrefix}${key}`
}
export function getItemFromSession(key) {
  const tokenStr = window.sessionStorage.getItem(addPrefix(key))
  if (!tokenStr) return null
  try {
    return JSON.parse(tokenStr)
  } catch {
    return null
  }
}

export function setItemToSession(key, token) {
  window.sessionStorage.setItem(addPrefix(key), JSON.stringify(token))
}

export function removeItemToSession(key) {
  window.sessionStorage.removeItem(addPrefix(key))
}
