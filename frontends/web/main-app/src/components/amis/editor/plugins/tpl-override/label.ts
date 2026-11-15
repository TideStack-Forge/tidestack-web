import { setSchemaTpl, getSchemaTpl, DSField } from 'amis-editor'
const oldSchema = getSchemaTpl('label')
setSchemaTpl('label', (patch: any, option: any) => {
  const schema = typeof oldSchema === 'function' ? oldSchema(patch, option) : oldSchema
  if (patch && patch.label === '名称') {
    schema.label = '标题'
  }
  return schema
})
