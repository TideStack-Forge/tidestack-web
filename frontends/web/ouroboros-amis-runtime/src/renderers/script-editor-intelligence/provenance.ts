import type { CodeCandidateOrigin, ScriptIntelligenceSnapshot } from './types'

export const platformReferenceLabel = '平台参考 · 应用环境未验证'

/** Member candidates inherit their receiver's evidence; application configuration keys are handled separately. */
export function candidateOrigin(
  snapshot: ScriptIntelligenceSnapshot,
  model: { getLineContent(line: number): string },
  position: { lineNumber: number; column: number },
  label: string
): CodeCandidateOrigin | undefined {
  const prefix = model.getLineContent(position.lineNumber).slice(0, position.column - 1)
  const receiver = prefix.match(/([A-Za-z_$][\w$]*(?:\.[\w$]+|\[[^\]]*\]|\([^()]*\))*)\.[\w$]*$/)?.[1]
  const path = receiver?.replace(/^globalThis\./, '')
  const root = path?.match(/^[\w$]+/)?.[0] || label
  const binding = snapshot.globals.find(item => item.name === root)
  if (binding) return binding.origin
  const javaType = snapshot.javaTypes.find(item => item.simpleName === root || item.qualifiedName === label)
  if (javaType) return javaType.origin
  if (snapshot.source === 'dev-platform-fallback' && (root === 'Java' ||
      snapshot.languageProjectionHints?.javascript?.engineGlobals?.some((item: { name: string }) => item.name === root)))
    return 'PLATFORM_REFERENCE'
  return undefined
}

export function presentCandidate<T extends { detail?: string; documentation?: unknown; sortText?: string }>(
  item: T, origin?: CodeCandidateOrigin
): T {
  if (origin !== 'PLATFORM_REFERENCE') return item
  const existing = typeof item.documentation === 'string' ? item.documentation :
    (item.documentation as { value?: string } | undefined)?.value || ''
  return {
    ...item,
    detail: [platformReferenceLabel, item.detail].filter(Boolean).join(' · '),
    documentation: { value: [platformReferenceLabel, existing].filter(Boolean).join('\n\n') },
    sortText: `zz-reference-${item.sortText || ''}`,
  }
}
