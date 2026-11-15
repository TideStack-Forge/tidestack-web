export type NormalizedModelMeta = {
  model?: {
    name: string
    label?: string
  }
  fields: Array<{
    name: string
    label: string
    type?: string
    options?: any[]
    optionsSource?: any
  }>
  relations: Array<{
    name: string
    label: string
    targetModel: string
    targetModelLabel?: string
    type?: string
  }>
}

export type ModelMetaProviderConfig = {
  source?: string | Record<string, any>
  modelRef?: string
  modelRefKey?: string
  requestData?: Record<string, any>
  paths?: {
    model?: string
    fields?: string
    relations?: string
  }
  fieldMapping?: {
    name: string
    label: string
    type?: string
    options?: string
    optionsSource?: string
  }
  relationMapping?: {
    name: string
    label: string
    targetModel: string
    targetModelLabel?: string
    type?: string
  }
  staticMeta?: Record<string, NormalizedModelMeta>
}
