const he = require('he')

const cache = Object.create(null)

function resolveEntity(name) {
  if (Object.prototype.hasOwnProperty.call(cache, name)) {
    return cache[name]
  }

  try {
    cache[name] = he.decode(`&${name};`, { strict: true })
  } catch (_error) {
    cache[name] = undefined
  }

  return cache[name]
}

module.exports = new Proxy(Object.create(null), {
  get(_target, prop) {
    if (typeof prop !== 'string') {
      return undefined
    }
    return resolveEntity(prop)
  },
  getOwnPropertyDescriptor(_target, prop) {
    if (typeof prop !== 'string') {
      return undefined
    }
    const value = resolveEntity(prop)
    if (value === undefined) {
      return undefined
    }
    return {
      configurable: true,
      enumerable: true,
      writable: false,
      value,
    }
  },
  has(_target, prop) {
    if (typeof prop !== 'string') {
      return false
    }
    return resolveEntity(prop) !== undefined
  },
})
