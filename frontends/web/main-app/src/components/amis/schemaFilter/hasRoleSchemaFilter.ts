import { addSchemaFilter, Schema, RendererConfig } from 'amis'
import { mapSchemaButtons } from './mapSchemaButtons'

addSchemaFilter((schema: Schema, renderer: RendererConfig, props?: any) => {
  const hasRoleFn = props?.SystemContext?.hasRole ?? (() => true)

  return mapSchemaButtons(schema, (currentSchema) => {
    const role = currentSchema['hasRole']
    if (!role) {
      return currentSchema
    }

    return hasRoleFn(role) ? currentSchema : { ...currentSchema, visible: false }
  })
})
