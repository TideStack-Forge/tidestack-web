import { registerFilter } from 'amis'

registerFilter('upperCamelCase', (value: string) => {
  if (typeof value !== 'string') return value
  // anycase转大驼峰
  return value
    .split('/')
    .filter((item) => item)
    .map((item) =>
      item
        .split(/[-_]/)
        .filter((item) => item)
        .map((item) => item[0].toUpperCase() + item.slice(1))
        .join('')
    )
    .join('.')
})
