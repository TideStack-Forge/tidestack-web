import { registerFilter } from 'amis'

function arrayToObject(rawValue: any, key: string, value?: string) {
  if (!Array.isArray(rawValue)) return rawValue
  return rawValue.reduce((acc, item) => {
    acc[item[key]] = !value ? item : item[value]
    return acc
  }, {})
}

registerFilter('arrayToObject', arrayToObject)