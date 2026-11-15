import { addRule } from 'amis'
function notIn(
  values: any,
  value: string,
  list: string | string[],
  separator: string = ','
) {
  if (!value || !list) {
    return true
  }
  if (!Array.isArray(list)) {
    list = list
      .split(separator)
      .map((item) => item.trim())
      .filter((item) => item)
  }
  return list.indexOf(value) === -1
}

addRule('notIn', notIn, '输入内容不允许包含在特定列表中')
