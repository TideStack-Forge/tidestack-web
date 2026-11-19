import { Schema } from 'amis'

const BUTTON_COLLECTION_PROPS = [
  'buttons',
  'bulkActions',
  'itemActions',
  'headerToolbar',
  'footerToolbar',
] as const

export function mapSchemaButtons(
  schema: Schema,
  transform: (schema: Schema) => Schema
): Schema {
  const nextSchema = transform(schema)
  const mappedCollections: Record<string, unknown[]> = {}

  for (const prop of BUTTON_COLLECTION_PROPS) {
    const collection = (nextSchema as any)[prop]
    if (!Array.isArray(collection)) {
      continue
    }

    mappedCollections[prop] = collection.map((item: unknown) => {
      if (!item || typeof item !== 'object') {
        return item
      }

      return mapSchemaButtons(item as Schema, transform)
    })
  }

  const collectionProps = Object.keys(mappedCollections)
  if (!collectionProps.length) {
    return nextSchema
  }

  return {
    ...nextSchema,
    ...mappedCollections,
  }
}
