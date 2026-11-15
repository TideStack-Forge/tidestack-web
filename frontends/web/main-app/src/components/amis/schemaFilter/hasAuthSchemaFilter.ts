import { addSchemaFilter, Schema, RendererConfig } from 'amis'
import { mapSchemaButtons } from './mapSchemaButtons'

addSchemaFilter((schema: Schema, renderer: RendererConfig, props?: any) => {
  const hasAuthFn = props?.SystemContext?.hasAuth ?? (() => true)

  return mapSchemaButtons(schema, (currentSchema) => {
    const authKey = currentSchema['hasAuth']
    if (!authKey) {
      return currentSchema
    }

    return hasAuthFn(authKey) ? currentSchema : { ...currentSchema, visible: false }
  })
})
