import { setSchemaTpl, getSchemaTpl, DSField } from 'amis-editor'
const oldSchema = getSchemaTpl('formItemName')
setSchemaTpl('formItemName', (patch: any, option: any) => {
  const schema = typeof oldSchema === 'function' ? oldSchema(patch, option) : oldSchema
  schema.required = false
  return schema
})
