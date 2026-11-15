import { addSchemaFilter } from 'amis'
import type { RendererConfig, Schema } from 'amis'

import {
  resolveFrontendResourceReferenceUrl,
  type FrontendResourceContextInput,
} from './frontendResourceReference'

function rewriteFieldValue(
  schema: Record<string, any>,
  fieldName: string,
  context?: FrontendResourceContextInput
) {
  const nextValue = resolveFrontendResourceReferenceUrl(schema[fieldName], context)
  if (!nextValue || nextValue === schema[fieldName]) {
    return schema
  }
  return {
    ...schema,
    [fieldName]: nextValue,
  }
}

function rewriteObjectFields(
  target: Record<string, any>,
  fieldNames: string[],
  context?: FrontendResourceContextInput
) {
  return fieldNames.reduce(
    (current, fieldName) => rewriteFieldValue(current, fieldName, context),
    target
  )
}

function rewriteImagesOptions(
  schema: Record<string, any>,
  context?: FrontendResourceContextInput
) {
  if (!Array.isArray(schema.options)) {
    return schema
  }
  let changed = false
  const options = schema.options.map((option: any) => {
    if (!option || typeof option !== 'object') {
      return option
    }
    const nextOption = rewriteObjectFields(option, ['image', 'src'], context)
    if (nextOption !== option) {
      changed = true
    }
    return nextOption
  })
  if (!changed) {
    return schema
  }
  return {
    ...schema,
    options,
  }
}

function rewriteCarouselOptions(
  schema: Record<string, any>,
  context?: FrontendResourceContextInput
) {
  if (!Array.isArray(schema.options)) {
    return schema
  }
  let changed = false
  const options = schema.options.map((option: any) => {
    if (!option || typeof option !== 'object' || option.type !== 'image') {
      return option
    }
    const nextOption = rewriteObjectFields(option, ['content'], context)
    if (nextOption !== option) {
      changed = true
    }
    return nextOption
  })
  if (!changed) {
    return schema
  }
  return {
    ...schema,
    options,
  }
}

function rewriteSchema(
  schema: Record<string, any>,
  context?: FrontendResourceContextInput
) {
  let nextSchema = rewriteFieldValue(schema, 'backgroundImage', context)

  if (schema.type === 'image') {
    nextSchema = rewriteObjectFields(
      nextSchema,
      ['src', 'originalSrc', 'defaultImage'],
      context
    )
  }

  if (schema.type === 'images') {
    nextSchema = rewriteObjectFields(nextSchema, ['defaultImage'], context)
    nextSchema = rewriteImagesOptions(nextSchema, context)
  }

  if (schema.type === 'carousel') {
    nextSchema = rewriteCarouselOptions(nextSchema, context)
  }

  if (
    schema.type === 'audio' ||
    schema.type === 'office-viewer' ||
    schema.type === 'pdf-viewer'
  ) {
    nextSchema = rewriteObjectFields(nextSchema, ['src'], context)
  }

  if (schema.type === 'avatar') {
    nextSchema = rewriteObjectFields(nextSchema, ['src', 'defaultAvatar'], context)
  }

  if (schema.type === 'video') {
    nextSchema = rewriteObjectFields(nextSchema, ['src', 'poster'], context)
  }

  return nextSchema
}

addSchemaFilter((schema: Schema, renderer: RendererConfig, props?: any) => {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    return schema
  }
  const platformContext = props?.env?.platformContext
  const frontendResourceRenderContext = props?.env?.frontendResourceRenderContext
  return rewriteSchema(
    schema as Record<string, any>,
    platformContext || frontendResourceRenderContext
  ) as Schema
})
