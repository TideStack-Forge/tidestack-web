import type { DocumentCodec } from '../collaboration/YjsWorkspace'
import type { BusinessModelCanvas, GraphLayout } from './business-model-graph'

export const canvasDocumentCodec: DocumentCodec<BusinessModelCanvas> = {
  entries(canvas) {
    const entries: Record<string, unknown> = {
      title: canvas.title,
      allModels: canvas.allModels,
    }
    for (const id of canvas.modelIds) entries[`model:${id}`] = true
    for (const mode of ['freeLayout', 'groupedLayout'] as const) {
      for (const category of ['nodes', 'groups'] as const) {
        for (const [id, value] of Object.entries(canvas[mode][category]))
          entries[`${mode}:${category}:${id}`] = value
      }
    }
    return entries
  },
  value(id, entries, seed) {
    const freeLayout: GraphLayout = { nodes: {}, groups: {} },
      groupedLayout: GraphLayout = { nodes: {}, groups: {} }
    freeLayout.viewport = seed.freeLayout.viewport
    groupedLayout.viewport = seed.groupedLayout.viewport
    const modelIds: string[] = []
    for (const [key, value] of Object.entries(entries)) {
      if (key.startsWith('model:') && value) modelIds.push(key.slice(6))
      for (const mode of ['freeLayout', 'groupedLayout'] as const) {
        const layout = mode === 'freeLayout' ? freeLayout : groupedLayout
        if (key.startsWith(`${mode}:nodes:`))
          layout.nodes[key.slice(mode.length + 7)] = value as GraphLayout['nodes'][string]
        if (key.startsWith(`${mode}:groups:`))
          layout.groups[key.slice(mode.length + 8)] =
            value as GraphLayout['groups'][string]
      }
    }
    return {
      ...seed,
      id,
      title: String(entries.title),
      allModels: !!entries.allModels,
      modelIds: modelIds.sort(),
      freeLayout,
      groupedLayout,
      revision: '',
    }
  },
}
