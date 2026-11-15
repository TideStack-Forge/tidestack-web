import type {
  TypeShape,
  ScriptIntelligenceSnapshot,
  ScriptIntelligenceMember,
} from './types'

export function shapeToTypescript(shape?: TypeShape, depth = 0): string {
  const schema = shape?.schema
  if (!schema || depth > 16 || schema['x-unknownReason']) return 'any'
  if (schema.anyOf || schema.oneOf) {
    return (
      (schema.anyOf || schema.oneOf)
        .map((branch: any) => shapeToTypescript({ schema: branch }, depth + 1))
        .join(' | ') || 'any'
    )
  }
  if (Array.isArray(schema.type))
    return schema.type
      .map((type: string) =>
        shapeToTypescript({ schema: { ...schema, type } }, depth + 1)
      )
      .join(' | ')
  switch (schema.type) {
    case 'null':
      return 'null'
    case 'integer':
    case 'number':
      return 'number'
    case 'string':
    case 'boolean':
      return schema.type
    case 'array':
      return `Array<${shapeToTypescript({ schema: schema.items || {} }, depth + 1)}>`
    case 'object': {
      const required = new Set(schema.required || [])
      const properties = Object.entries(schema.properties || {}).map(
        ([name, value]) =>
          `${JSON.stringify(name)}${required.has(name) ? '' : '?'}: ${shapeToTypescript({ schema: value as any }, depth + 1)}`
      )
      for (const method of schema['x-javaMethods'] || []) {
        properties.push(
          `${JSON.stringify(method.name)}(${(method.parameterTypeDisplayNames || []).map((_: string, index: number) => `arg${index}: any`).join(', ')}): ${shapeToTypescript(method.shape, depth + 1)}`
        )
      }
      if (schema.additionalProperties !== false)
        properties.push(
          `[key: string]: ${typeof schema.additionalProperties === 'object' ? shapeToTypescript({ schema: schema.additionalProperties }, depth + 1) : 'any'}`
        )
      return `{ ${properties.join('; ')} }`
    }
    default:
      return 'any'
  }
}

/** Resolves only described properties, literal indexes and declared method results. */
export function resolveShapeMembers(
  snapshot: ScriptIntelligenceSnapshot,
  path: string
): ScriptIntelligenceMember[] {
  const tokens = path.match(/[$\w]+|\[(?:\d+|'[^']*'|"[^"]*")\]|\([^()]*\)/g) || []
  if (!tokens.length || tokens.join('').replace(/\./g, '') !== path.replace(/\./g, ''))
    return []
  const binding = snapshot.globals.find((item) => item.name === tokens[0])
  let shape = concreteShape(binding?.shape)
  let members = binding?.members || []
  for (let index = 1; index < tokens.length; index++) {
    const token = tokens[index]
    if (token.startsWith('(')) continue
    const key = token.startsWith('[')
      ? token.slice(1, -1).replace(/^['"]|['"]$/g, '')
      : token
    if (tokens[index + 1]?.startsWith('(')) {
      const method = [...members, ...(shape?.schema['x-javaMethods'] || [])].find(
        (item) => item.name === key
      )
      shape = method?.shape
    } else if (token.startsWith('[') && /^\d+$/.test(key))
      shape = shape?.schema.items ? { schema: shape.schema.items } : undefined
    else
      shape = shape?.schema.properties?.[key]
        ? { schema: shape.schema.properties[key] }
        : typeof shape?.schema.additionalProperties === 'object'
          ? { schema: shape.schema.additionalProperties }
          : undefined
    shape = concreteShape(shape)
    members = []
  }
  const properties = Object.entries(shape?.schema.properties || {}).map(
    ([name, schema]) => ({
      name,
      memberKind: 'field',
      shape: { schema: schema as any },
      returnTypeDisplayName: shapeToTypescript({ schema: schema as any }),
    })
  )
  const all = [...members, ...properties, ...(shape?.schema['x-javaMethods'] || [])]
  return all.filter(
    (item, index) =>
      all.findIndex(
        (candidate) =>
          candidate.name === item.name && candidate.memberKind === item.memberKind
      ) === index
  )
}

/** Null branches do not hide members; incompatible branches keep optional member candidates. */
function concreteShape(shape?: TypeShape): TypeShape | undefined {
  const schema = shape?.schema
  if (!schema) return undefined
  const branches = schema.anyOf || schema.oneOf
  if (!branches) return shape
  const candidates = branches
    .filter((branch: any) => branch.type !== 'null')
    .map((branch: any) => concreteShape({ schema: branch })?.schema)
    .filter(Boolean)
  if (candidates.length === 1) return { schema: candidates[0] }
  if (candidates.every((branch: any) => branch.type === 'object')) {
    const properties: Record<string, any> = {}
    for (const branch of candidates)
      for (const [key, value] of Object.entries(branch.properties || {})) {
        properties[key] = properties[key] ? { anyOf: [properties[key], value] } : value
      }
    return { schema: { type: 'object', properties } }
  }
  return shape
}
