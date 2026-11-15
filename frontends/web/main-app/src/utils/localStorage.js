const keyPrefix = 'Ouroboros_'
// key值加前缀
const addPrefix = (key) => {
  return `${keyPrefix}${key}`
}
export function getItemFromLocal(key) {
  const tokenStr = window.localStorage.getItem(addPrefix(key))
  if (!tokenStr) return null
  try {
    return JSON.parse(tokenStr)
  } catch {
    return null
  }
}

export function setItemToLocal(key, token) {
  window.localStorage.setItem(addPrefix(key), JSON.stringify(token))
}

export function removeItemToLocal(key) {
  window.localStorage.removeItem(addPrefix(key))
}
