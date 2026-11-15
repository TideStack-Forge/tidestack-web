import { addSchemaFilter,str2function } from 'amis'
import type { Schema, RendererConfig } from 'amis'

addSchemaFilter((schema: Schema, renderer: RendererConfig, props?: any) => {
  const { pipeIn, pipeOut } = schema
  if (!pipeIn && !pipeOut) {
    return schema
  }
  const pipeInFn =
    typeof pipeIn === 'string' ? str2function(pipeIn, 'value', 'props', 'data') : pipeIn
  const pipeOutFn =
    typeof pipeOut === 'string'
      ? str2function(pipeOut, 'value', 'oldValue', 'data')
      : pipeOut
  if (!pipeInFn && !pipeOutFn) return schema

  const patch = {} as any
  if (pipeInFn) patch.pipeIn = pipeInFn
  if (pipeOutFn) patch.pipeOut = pipeOutFn

  return {
    ...schema,
    ...patch,
  }
})
