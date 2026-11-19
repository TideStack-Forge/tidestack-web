import { addRule } from 'amis'
function notEquals(values: any, value: string, compareValue?: string) {
  if (!value || compareValue == null) {
    return true
  }
  return `${value}` !== `${compareValue}`
}

addRule('notEquals', notEquals, '输入值不能与指定值相同')
