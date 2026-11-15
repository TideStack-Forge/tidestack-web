import { configurationArgumentItems } from '../configuration'
import { resolveShapeMembers } from '../shape'
import type {
  ScriptEditorAdapter,
  ScriptEditorAdapterContext,
  ScriptIntelligenceMember,
  ScriptIntelligenceSnapshot,
} from '../types'

class GroovyScriptEditorAdapter implements ScriptEditorAdapter {
  private readonly monaco: any
  private readonly modelUri: string | null
  private readonly disposables: Array<{ dispose: () => void }> = []

  constructor(
    context: ScriptEditorAdapterContext,
    private readonly language = 'groovy'
  ) {
    this.monaco = context.monaco
    this.modelUri = context.editor?.getModel?.()?.uri?.toString?.() || null
  }

  apply(snapshot: ScriptIntelligenceSnapshot) {
    const languages = this.monaco?.languages
    if (!languages || !this.modelUri) {
      return
    }

    this.disposables.push(
      languages.registerCompletionItemProvider(this.language, {
        triggerCharacters: ['.', ' ', '('],
        provideCompletionItems: (model: any, position: any) => {
          if (!this.isActiveModel(model)) {
            return { suggestions: [] }
          }
          return {
            suggestions: buildGroovyCompletionItems(
              this.monaco,
              snapshot,
              model,
              position
            ),
          }
        },
      })
    )

    this.disposables.push(
      languages.registerHoverProvider(this.language, {
        provideHover: (model: any, position: any) => {
          if (!this.isActiveModel(model)) {
            return null
          }
          return buildGroovyHover(this.monaco, snapshot, model, position)
        },
      })
    )

    this.disposables.push(
      languages.registerSignatureHelpProvider(this.language, {
        signatureHelpTriggerCharacters: ['(', ','],
        provideSignatureHelp: (model: any, position: any) => {
          if (!this.isActiveModel(model)) {
            return null
          }
          const value = buildGroovySignatureHelp(snapshot, model, position)
          if (!value) {
            return null
          }
          return {
            value,
            dispose: () => {},
          }
        },
      })
    )
  }

  dispose() {
    while (this.disposables.length > 0) {
      this.disposables.pop()?.dispose()
    }
  }

  private isActiveModel(model: any) {
    return this.modelUri != null && model?.uri?.toString?.() === this.modelUri
  }
}

export function createGroovyScriptEditorAdapter(
  context: ScriptEditorAdapterContext,
  language = 'groovy'
): ScriptEditorAdapter {
  return new GroovyScriptEditorAdapter(context, language)
}

export function buildGroovyCompletionItems(
  monaco: any,
  snapshot: ScriptIntelligenceSnapshot,
  model: any,
  position: any
) {
  const configuration = configurationArgumentItems(monaco, snapshot, model, position)
  if (configuration) return configuration
  const linePrefix = getLinePrefix(model, position)
  const importMatch = linePrefix.match(/^\s*import\s+[\w.]*$/)
  if (importMatch) {
    return (snapshot.javaImports || []).map((qualifiedName) => {
      return {
        label: qualifiedName,
        kind: monaco.languages.CompletionItemKind.Class,
        insertText: qualifiedName,
        detail: 'Java import',
        range: getCurrentWordRange(model, position),
      }
    })
  }

  const memberMatch = linePrefix.match(/([A-Za-z_$][\w$.[\]'"()]*)\.([A-Za-z_$\w]*)$/)
  if (memberMatch) {
    return buildMemberCompletionItems(monaco, snapshot, memberMatch[1], model, position)
  }

  const constructorMatch = linePrefix.match(/new\s+([A-Za-z_$][\w$]*)$/)
  if (constructorMatch) {
    return (snapshot.javaTypes || []).map((javaType) => {
      return {
        label: javaType.simpleName,
        kind: monaco.languages.CompletionItemKind.Class,
        insertText: javaType.simpleName,
        detail: javaType.qualifiedName,
        range: getCurrentWordRange(model, position),
      }
    })
  }

  return (snapshot.globals || []).map((globalItem) => {
    return {
      label: globalItem.name,
      kind:
        globalItem.kind === 'class'
          ? monaco.languages.CompletionItemKind.Class
          : monaco.languages.CompletionItemKind.Variable,
      insertText: globalItem.name,
      detail: globalItem.typeDisplayName || 'any',
      documentation: globalItem.documentation,
      range: getCurrentWordRange(model, position),
    }
  })
}

function buildMemberCompletionItems(
  monaco: any,
  snapshot: ScriptIntelligenceSnapshot,
  receiverName: string,
  model: any,
  position: any
) {
  const described = resolveShapeMembers(snapshot, receiverName)
  if (described.length)
    return described.map((member) =>
      toMemberCompletionItem(monaco, member, model, position, receiverName)
    )

  const matchedJavaType = findJavaType(snapshot, receiverName)
  if (!matchedJavaType) {
    return []
  }

  return [
    ...(matchedJavaType.staticMethods || []).map((member) =>
      toMemberCompletionItem(monaco, member, model, position, matchedJavaType.simpleName)
    ),
    ...(matchedJavaType.staticFields || []).map((member) =>
      toMemberCompletionItem(monaco, member, model, position, matchedJavaType.simpleName)
    ),
  ]
}

function buildGroovyHover(
  monaco: any,
  snapshot: ScriptIntelligenceSnapshot,
  model: any,
  position: any
) {
  const word = model.getWordAtPosition(position)
  if (!word?.word) {
    return null
  }
  const linePrefix = getLinePrefix(model, position)
  const memberMatch = linePrefix.match(/([A-Za-z_$][\w$.]*)\.([A-Za-z_$][\w$]*)$/)
  if (memberMatch && memberMatch[2] === word.word) {
    const member = findMember(snapshot, memberMatch[1], memberMatch[2])
    if (!member) {
      return null
    }
    return {
      range: new monaco.Range(
        position.lineNumber,
        word.startColumn,
        position.lineNumber,
        word.endColumn
      ),
      contents: [{ value: buildMemberMarkdown(member, memberMatch[1]) }],
    }
  }

  const matchedGlobal = (snapshot.globals || []).find((globalItem) => {
    return globalItem.name === word.word
  })
  if (matchedGlobal) {
    return {
      range: new monaco.Range(
        position.lineNumber,
        word.startColumn,
        position.lineNumber,
        word.endColumn
      ),
      contents: [
        {
          value: [
            `**${matchedGlobal.name}**`,
            '',
            matchedGlobal.typeDisplayName || 'any',
            '',
            matchedGlobal.documentation || '',
          ].join('\n'),
        },
      ],
    }
  }

  const matchedJavaType = findJavaType(snapshot, word.word)
  if (!matchedJavaType) {
    return null
  }
  return {
    range: new monaco.Range(
      position.lineNumber,
      word.startColumn,
      position.lineNumber,
      word.endColumn
    ),
    contents: [
      {
        value: [
          `**${matchedJavaType.simpleName}**`,
          '',
          matchedJavaType.qualifiedName,
        ].join('\n'),
      },
    ],
  }
}

function buildGroovySignatureHelp(
  snapshot: ScriptIntelligenceSnapshot,
  model: any,
  position: any
) {
  const linePrefix = getLinePrefix(model, position)
  const constructorMatch = linePrefix.match(/new\s+([A-Za-z_$][\w$]*)\(([^()]*)$/)
  if (constructorMatch) {
    const matchedJavaType = findJavaType(snapshot, constructorMatch[1])
    if (!matchedJavaType) {
      return null
    }
    const signatures = (matchedJavaType.constructors || []).map((member) => {
      return toSignatureInformation(member, matchedJavaType.simpleName)
    })
    if (signatures.length === 0) {
      return null
    }
    return {
      signatures,
      activeSignature: 0,
      activeParameter: countParameters(constructorMatch[2]),
    }
  }

  const memberMatch = linePrefix.match(
    /([A-Za-z_$][\w$.]*)\.([A-Za-z_$][\w$]*)\(([^()]*)$/
  )
  if (!memberMatch) {
    return null
  }
  const member = findMember(snapshot, memberMatch[1], memberMatch[2])
  if (!member || member.memberKind !== 'method') {
    return null
  }
  return {
    signatures: [toSignatureInformation(member, `${memberMatch[1]}.${member.name}`)],
    activeSignature: 0,
    activeParameter: countParameters(memberMatch[3]),
  }
}

function toMemberCompletionItem(
  monaco: any,
  member: ScriptIntelligenceMember,
  model: any,
  position: any,
  ownerName: string
) {
  const isMethod = member.memberKind === 'method'
  return {
    label: member.name,
    kind: isMethod
      ? monaco.languages.CompletionItemKind.Method
      : monaco.languages.CompletionItemKind.Field,
    insertText: isMethod ? `${member.name}($0)` : member.name,
    insertTextRules: isMethod
      ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
      : undefined,
    detail: ownerName,
    documentation: buildMemberMarkdown(member, ownerName),
    range: getCurrentWordRange(model, position),
  }
}

function toSignatureInformation(member: ScriptIntelligenceMember, ownerName: string) {
  const parameterLabels = member.parameterTypeDisplayNames || []
  const parameters = parameterLabels.map((parameterTypeDisplayName, index) => {
    return {
      label: `arg${index}: ${parameterTypeDisplayName}`,
    }
  })
  return {
    label: `${ownerName}(${parameters.map((parameter) => parameter.label).join(', ')})`,
    parameters,
  }
}

function buildMemberMarkdown(member: ScriptIntelligenceMember, ownerName: string) {
  const parameterText = (member.parameterTypeDisplayNames || [])
    .map((parameterTypeDisplayName, index) => {
      return `arg${index}: ${parameterTypeDisplayName}`
    })
    .join(', ')
  if (member.memberKind === 'field') {
    return [
      `**${ownerName}.${member.name}**`,
      '',
      member.returnTypeDisplayName || 'any',
    ].join('\n')
  }
  return [
    `**${ownerName}.${member.name}**`,
    '',
    `(${parameterText}) => ${member.returnTypeDisplayName || 'any'}`,
  ].join('\n')
}

function findJavaType(snapshot: ScriptIntelligenceSnapshot, receiverName: string) {
  return (snapshot.javaTypes || []).find((javaType) => {
    return javaType.simpleName === receiverName || javaType.qualifiedName === receiverName
  })
}

function findMember(
  snapshot: ScriptIntelligenceSnapshot,
  receiverName: string,
  memberName: string
) {
  const described = resolveShapeMembers(snapshot, receiverName).find(
    (member) => member.name === memberName
  )
  if (described) return described

  const matchedJavaType = findJavaType(snapshot, receiverName)
  if (!matchedJavaType) {
    return null
  }
  return [
    ...(matchedJavaType.staticMethods || []),
    ...(matchedJavaType.staticFields || []),
  ].find((member) => member.name === memberName)
}

function getLinePrefix(model: any, position: any) {
  const lineContent = model.getLineContent(position.lineNumber) || ''
  return lineContent.slice(0, position.column - 1)
}

function getCurrentWordRange(model: any, position: any) {
  const word = model.getWordUntilPosition(position)
  return {
    startLineNumber: position.lineNumber,
    endLineNumber: position.lineNumber,
    startColumn: word.startColumn,
    endColumn: word.endColumn,
  }
}

function countParameters(argumentText: string) {
  if (!argumentText.trim()) {
    return 0
  }
  return argumentText.split(',').length - 1
}
