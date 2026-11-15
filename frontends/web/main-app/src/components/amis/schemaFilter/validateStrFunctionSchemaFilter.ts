import { addSchemaFilter,str2function } from 'amis'
import type { Schema, RendererConfig } from 'amis'

addSchemaFilter((schema: Schema, renderer: RendererConfig, props?: any) => {
  const validate = schema['validate']
  if (!validate || typeof validate !== 'string') return schema

  const validateFn = str2function(validate, 'data', 'value', 'name')
  if (!validateFn) return schema
  return {
    ...schema,
    validate: validateFn,
  }
})
