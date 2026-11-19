import { addSchemaFilter, Schema, RendererConfig } from 'amis'
import { mapSchemaButtons } from './mapSchemaButtons'

addSchemaFilter((schema: Schema, renderer: RendererConfig, props?: any) => {
  return mapSchemaButtons(schema, (currentSchema) => {
    if (currentSchema.type !== 'button' && currentSchema.type !== 'action') {
      return currentSchema
    }
    if (currentSchema.disabledOnAction != null) {
      return currentSchema
    }

    return {
      ...currentSchema,
      disabledOnAction: true,
    }
  })
})
