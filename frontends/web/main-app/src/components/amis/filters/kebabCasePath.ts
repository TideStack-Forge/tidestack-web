import { registerFilter } from 'amis'

registerFilter('kebabCasePath', (value: string, leadingSlash: boolean = true) => {
  if (typeof value !== 'string') return value
  // 大驼峰转kebab
  return (
    (leadingSlash ? '/' : '') +
    value
      .split('.')
      .map((str) => str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase())
      .join('/')
  )
})
