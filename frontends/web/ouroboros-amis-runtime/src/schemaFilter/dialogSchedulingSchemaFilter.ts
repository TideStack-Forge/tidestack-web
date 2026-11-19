import { addSchemaFilter } from 'amis'
import type { RendererConfig, Schema } from 'amis'

type ModalSchema = Record<string, any>

function isDialogSchedulingEnabled(config: any) {
  if (config === true) {
    return true
  }

  return config != null && typeof config === 'object' && config.enabled !== false
}

export function normalizeDialogSchedulingSchema(schema: Schema): Schema {
  const modalSchema = schema as ModalSchema

  if (modalSchema?.type !== 'dialog' && modalSchema?.type !== 'drawer') {
    return schema
  }

  if (
    !isDialogSchedulingEnabled(modalSchema.ouroborosDialogScheduling) ||
    Object.prototype.hasOwnProperty.call(modalSchema, 'lazyRender') ||
    modalSchema.url ||
    modalSchema.schemaId ||
    modalSchema.body == null
  ) {
    return schema
  }

  return {
    lazyRender: true,
    ...modalSchema,
  } as unknown as Schema
}

addSchemaFilter((schema: Schema, _renderer: RendererConfig, _props?: any) =>
  normalizeDialogSchedulingSchema(schema)
)
