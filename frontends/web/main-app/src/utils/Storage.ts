class Storage {
  private storage: any
  private prefix: string
  private prefixSeparator: string
  constructor(
    config: {
      prefix: string
      type: 'localStorage' | 'sessionStorage'
      prefixSeparator?: string
    } = {
      prefix: '',
      type: 'localStorage',
      prefixSeparator: '_',
    }
  ) {
    const { prefix, type, prefixSeparator } = config
    this.prefix = prefix ?? ''
    this.prefixSeparator = !prefix ? '' : prefixSeparator ?? '_'
    switch (type) {
      case 'localStorage':
        this.storage = window.localStorage
        break
      case 'sessionStorage':
        this.storage = window.sessionStorage
        break
      default:
        console.warn('Storage type is not supported, falling back to local storage')
        this.storage = window.localStorage
    }
  }

  setItem(key: string, value: any) {
    this.storage.setItem(
      `${this.prefix}${this.prefixSeparator}${key}`,
      JSON.stringify(value)
    )
  }

  getItem(key: string) {
    const value = this.storage.getItem(`${this.prefix}${this.prefixSeparator}${key}`)
    if (value === undefined) return null
    if (typeof value === 'string' && value) {
      return JSON.parse(value)
    }
    return value
  }

  removeItem(key: string) {
    this.storage.removeItem(`${this.prefix}${this.prefixSeparator}${key}`)
  }

  clear() {
    const finalPrefix = `${this.prefix}${this.prefixSeparator}`
    if (!this.prefix) {
      this.storage.clear()
      return
    }
    const keys = Object.keys(this.storage)
    for (const key of keys) {
      if (key.startsWith(finalPrefix)) {
        this.storage.removeItem(key)
      }
    }
  }
}

export default Storage
