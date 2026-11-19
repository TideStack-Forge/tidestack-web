import type { PopulateNode } from './populate-types'

export function summarizePopulateNode(node: Partial<PopulateNode>): string[] {
  const summary: string[] = []
  const options = node.options || {}
  const childrenCount = node.children?.length || 0

  if (options.select?.length) {
    summary.push(`select: ${options.select.length}`)
  }
  if (options.omit?.length) {
    summary.push(`omit: ${options.omit.length}`)
  }
  if ('where' in options && options.where !== undefined) {
    summary.push('where: configured')
  }
  if ('limit' in options && options.limit !== undefined) {
    summary.push(`limit: ${options.limit}`)
  }
  if ('offset' in options && options.offset !== undefined) {
    summary.push(`offset: ${options.offset}`)
  }
  if (childrenCount > 0) {
    summary.push(`children: ${childrenCount}`)
  }

  if (summary.length === 0) {
    summary.push('default')
  }

  return summary
}

export function buildChildPopulateEditorProps(node: { targetModel?: string }): {
  modelRef?: string
} {
  if (typeof node?.targetModel === 'string' && node.targetModel.trim()) {
    return {
      modelRef: node.targetModel.trim(),
    }
  }
  return {}
}
