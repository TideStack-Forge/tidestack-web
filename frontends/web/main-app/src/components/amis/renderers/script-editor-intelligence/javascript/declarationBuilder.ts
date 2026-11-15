import { shapeToTypescript } from '../shape'
import type {
  ScriptIntelligenceGlobal,
  ScriptIntelligenceJavaType,
  ScriptIntelligenceMember,
  ScriptIntelligenceSnapshot,
} from '../types'

const primitiveTypeMap: Record<string, string> = {
  any: 'any',
  Object: 'any',
  void: 'void',
  boolean: 'boolean',
  Boolean: 'boolean',
  byte: 'number',
  Byte: 'number',
  short: 'number',
  Short: 'number',
  int: 'number',
  Integer: 'number',
  long: 'number',
  Long: 'number',
  float: 'number',
  Float: 'number',
  double: 'number',
  Double: 'number',
  Number: 'number',
  BigDecimal: 'number',
  BigInteger: 'number',
  String: 'string',
  CharSequence: 'string',
  Date: 'string',
  Map: 'Record<string, any>',
  List: 'any[]',
  Collection: 'any[]',
  Iterable: 'Iterable<any>',
}

export function buildJavascriptDeclarations(
  snapshot: ScriptIntelligenceSnapshot
): string {
  const lines: string[] = ['declare namespace __OuroborosLogicflowScriptIntelligence {']
  const javaTypeNameMap = buildJavaTypeNameMap(snapshot.javaTypes || [])

  ;(snapshot.javaTypes || []).forEach((javaType) => {
    lines.push(...buildJavaTypeDeclarations(javaType, javaTypeNameMap))
  })
  ;(snapshot.globals || []).forEach((global) => {
    lines.push(...buildGlobalInterfaceDeclarations(global, javaTypeNameMap))
  })

  lines.push('}')
  lines.push('')
  lines.push('// GraalJS Java.type(...) interop')
  lines.push('declare const Java: {')
  ;(snapshot.javaTypes || []).forEach((javaType) => {
    const constructorType = javaTypeNameMap[javaType.qualifiedName]?.constructorType
    if (!constructorType) {
      return
    }
    lines.push(
      `  type(name: '${escapeStringLiteral(javaType.qualifiedName)}'): __OuroborosLogicflowScriptIntelligence.${constructorType};`
    )
  })
  lines.push('  type(name: string): any;')
  const engineGlobals: Array<{ name: string; kind: string; members: Array<{ name: string; kind: string }> }> =
    snapshot.languageProjectionHints?.javascript?.engineGlobals || []
  for (const member of engineGlobals.find(item => item.name === 'Java')?.members || []) {
    if (member.name !== 'type' && isValidIdentifier(member.name))
      lines.push(`  ${member.name}: ${member.kind === 'function' ? '(...args: any[]) => any' : 'unknown'};`)
  }
  lines.push('}')
  lines.push('')
  ;(snapshot.globals || []).forEach((global) => {
    if (!isValidIdentifier(global.name)) {
      return
    }
    lines.push(...buildGlobalValueDeclarations(global, javaTypeNameMap))
  })

  const ecmaGlobals = new Set('Array ArrayBuffer Atomics BigInt BigInt64Array BigUint64Array Boolean DataView Date Error EvalError Float32Array Float64Array Function Infinity Int8Array Int16Array Int32Array Intl JSON Map Math NaN Number Object Promise Proxy RangeError ReferenceError Reflect RegExp Set SharedArrayBuffer String Symbol SyntaxError TypeError Uint8Array Uint8ClampedArray Uint16Array Uint32Array URIError WeakMap WeakSet decodeURI decodeURIComponent encodeURI encodeURIComponent escape eval isFinite isNaN parseFloat parseInt undefined unescape'.split(' '))
  const bindings = new Set(snapshot.globals.map(item => item.name))
  for (const global of engineGlobals) {
    if (!isValidIdentifier(global.name) || ecmaGlobals.has(global.name) || bindings.has(global.name) || ['Java', 'globalThis'].includes(global.name)) continue
    let type = 'unknown'
    if (global.kind === 'function') type = '(...args: any[]) => any'
    else if (['number', 'string', 'boolean'].includes(global.kind)) type = global.kind
    else if (global.members.length) type = `{ ${global.members.filter(m => isValidIdentifier(m.name)).map(m => `${m.name}: ${m.kind === 'function' ? '(...args: any[]) => any' : 'unknown'}`).join('; ')} }`
    lines.push(`declare const ${global.name}: ${type};`)
  }
  // A module-local global object keeps app bindings out of other editor documents.
  lines.push('interface __OuroborosGraalGlobal {')
  for (const name of new Set([...engineGlobals.map(item => item.name), ...bindings, 'Java'])) {
    if (name !== 'globalThis' && isValidIdentifier(name)) lines.push(`  ${name}: typeof ${name};`)
  }
  lines.push('  readonly globalThis: __OuroborosGraalGlobal;', '}', 'declare const globalThis: __OuroborosGraalGlobal;')

  return lines.join('\n')
}

function buildJavaTypeNameMap(javaTypes: ScriptIntelligenceJavaType[]) {
  return javaTypes.reduce(
    (result, javaType) => {
      const suffix = sanitizeIdentifier(javaType.qualifiedName)
      result[javaType.qualifiedName] = {
        constructorType: `JavaType_${suffix}`,
        instanceType: `JavaInstance_${suffix}`,
      }
      return result
    },
    {} as Record<string, { constructorType: string; instanceType: string }>
  )
}

function buildJavaTypeDeclarations(
  javaType: ScriptIntelligenceJavaType,
  javaTypeNameMap: Record<string, { constructorType: string; instanceType: string }>
): string[] {
  const typeNames = javaTypeNameMap[javaType.qualifiedName]
  const lines: string[] = []
  if (!typeNames) {
    return lines
  }

  lines.push(`  interface ${typeNames.instanceType} {`)
  if ((javaType.instanceMethods || []).length === 0) {
    lines.push('    [key: string]: any')
  } else {
    for (const member of javaType.instanceMethods || []) {
      lines.push(...buildMethodLines(member, javaTypeNameMap, '    '))
    }
  }
  lines.push('  }')
  lines.push(`  interface ${typeNames.constructorType} {`)
  for (const member of javaType.constructors || []) {
    lines.push(
      `    new (${buildParameterList(
        member.parameterTypeDisplayNames || [],
        javaTypeNameMap
      )}): ${typeNames.instanceType}`
    )
  }
  for (const member of javaType.staticMethods || []) {
    lines.push(...buildMethodLines(member, javaTypeNameMap, '    '))
  }
  for (const member of javaType.staticFields || []) {
    lines.push(
      `    readonly ${sanitizeMemberName(member.name)}: ${toTypescriptType(
        member.returnTypeDisplayName,
        javaTypeNameMap
      )}`
    )
  }
  if (
    (javaType.constructors || []).length === 0 &&
    (javaType.staticMethods || []).length === 0 &&
    (javaType.staticFields || []).length === 0
  ) {
    lines.push('    [key: string]: any')
  }
  lines.push('  }')
  return lines
}

function buildGlobalInterfaceDeclarations(
  global: ScriptIntelligenceGlobal,
  javaTypeNameMap: Record<string, { constructorType: string; instanceType: string }>
): string[] {
  if (!global.members || global.members.length === 0) {
    return []
  }
  const interfaceName = getGlobalInterfaceName(global.name)
  const lines = [`  interface ${interfaceName} {`]
  global.members.forEach((member) => {
    if (member.memberKind === 'field') {
      lines.push(
        `    ${sanitizeMemberName(member.name)}: ${toTypescriptType(
          member.returnTypeDisplayName,
          javaTypeNameMap
        )}`
      )
      return
    }
    lines.push(...buildMethodLines(member, javaTypeNameMap, '    '))
  })
  lines.push('  }')
  return lines
}

function buildGlobalValueDeclarations(
  global: ScriptIntelligenceGlobal,
  javaTypeNameMap: Record<string, { constructorType: string; instanceType: string }>
): string[] {
  const lines: string[] = []
  if (global.documentation) {
    lines.push(...toDocComment(global.documentation))
  }
  const javaTypeNames = global.qualifiedTypeName
    ? javaTypeNameMap[global.qualifiedTypeName]
    : null
  if (global.kind === 'class' && javaTypeNames) {
    lines.push(
      `declare const ${global.name}: __OuroborosLogicflowScriptIntelligence.${javaTypeNames.constructorType}`
    )
    return lines
  }
  if (global.members && global.members.length > 0) {
    lines.push(
      `declare const ${global.name}: __OuroborosLogicflowScriptIntelligence.${getGlobalInterfaceName(
        global.name
      )}`
    )
    return lines
  }
  const typeName = global.shape
    ? shapeToTypescript(global.shape)
    : javaTypeNames
      ? `__OuroborosLogicflowScriptIntelligence.${javaTypeNames.instanceType}`
      : toTypescriptType(global.typeDisplayName, javaTypeNameMap)
  lines.push(`declare const ${global.name}: ${typeName}`)
  return lines
}

function buildMethodLines(
  member: ScriptIntelligenceMember,
  javaTypeNameMap: Record<string, { constructorType: string; instanceType: string }>,
  indent: string
): string[] {
  return [
    `${indent}${sanitizeMemberName(member.name)}(${buildParameterList(
      member.parameterTypeDisplayNames || [],
      javaTypeNameMap
    )}): ${member.shape ? shapeToTypescript(member.shape) : toTypescriptType(member.returnTypeDisplayName, javaTypeNameMap)}`,
  ]
}

function buildParameterList(
  parameterTypeDisplayNames: string[],
  javaTypeNameMap: Record<string, { constructorType: string; instanceType: string }>
): string {
  return parameterTypeDisplayNames
    .map((parameterTypeDisplayName, index) => {
      return `arg${index}: ${toTypescriptType(parameterTypeDisplayName, javaTypeNameMap)}`
    })
    .join(', ')
}

function toTypescriptType(
  typeDisplayName: string | null | undefined,
  javaTypeNameMap: Record<string, { constructorType: string; instanceType: string }>
): string {
  const normalizedTypeName = (typeDisplayName || '').trim()
  if (!normalizedTypeName) {
    return 'any'
  }
  if (primitiveTypeMap[normalizedTypeName]) {
    return primitiveTypeMap[normalizedTypeName]
  }
  if (normalizedTypeName.endsWith('[]')) {
    return `${toTypescriptType(normalizedTypeName.slice(0, -2), javaTypeNameMap)}[]`
  }
  const javaTypeEntry = Object.values(javaTypeNameMap).find((typeNames, index) => {
    return Object.keys(javaTypeNameMap)[index].endsWith(`.${normalizedTypeName}`)
  })
  if (javaTypeEntry) {
    return `__OuroborosLogicflowScriptIntelligence.${javaTypeEntry.instanceType}`
  }
  return 'any'
}

function toDocComment(documentation: string): string[] {
  return [
    '/**',
    ...documentation
      .replace(/\*\//g, '* /')
      .split('\n')
      .map((line) => ` * ${line}`),
    ' */',
  ]
}

function escapeStringLiteral(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

function isValidIdentifier(value: string): boolean {
  return /^[$A-Z_][0-9A-Z_$]*$/i.test(value)
}

function sanitizeIdentifier(value: string): string {
  return value.replace(/[^a-zA-Z0-9_$]/g, '_')
}

function sanitizeMemberName(value: string): string {
  return isValidIdentifier(value) ? value : `'${escapeStringLiteral(value)}'`
}

function getGlobalInterfaceName(globalName: string): string {
  return `Global_${sanitizeIdentifier(globalName)}`
}
