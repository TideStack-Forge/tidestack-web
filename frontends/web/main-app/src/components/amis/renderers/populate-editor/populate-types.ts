export type PopulateNodeOptions = {
  select?: string[]
  omit?: string[]
  where?: any
  limit?: any
  offset?: any
}

export interface PopulateNode {
  id: string
  relationName: string
  relationLabel?: string
  targetModel?: string
  targetModelLabel?: string
  relationType?: string
  options: PopulateNodeOptions
  children: PopulateNode[]
  extras?: Record<string, any>
}

export type PopulateParseError = {
  path: string
  message: string
}

export type DeserializePopulateResult = {
  nodes: PopulateNode[]
  errors: PopulateParseError[]
}
