import { addRule } from 'amis'
function notEqualsField(values: any, value: string, field?: string) {
  if (!value || field == null) {
    return true
  }
  return `${value}` !== `${values[field]}`
}

addRule('notEqualsField', notEqualsField, '输入值不能与指定字段相同')
