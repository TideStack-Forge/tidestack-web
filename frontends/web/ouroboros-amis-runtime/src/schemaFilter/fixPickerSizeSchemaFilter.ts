import { addSchemaFilter } from 'amis'
import type { Schema, RendererConfig } from 'amis'

addSchemaFilter((schema: Schema, renderer: RendererConfig, props?: any) => {
  if (schema.type !== 'picker') {
    return schema
  }
  const {size, modalSize} = schema
  if (!modalSize && size) {
    return {
      ...schema,
      modalSize: size
    }
  }
  return schema
})
