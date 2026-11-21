import { registerFilter } from 'amis'

type GroupOption = { label: string; value: string; children?: GroupOption[] }

/** Derive navigation from the complete model collection, before search or pagination. */
export function rpcModelGroups(models: unknown): GroupOption[] {
  const roots: GroupOption[] = []
  const groups = new Map<string, GroupOption>()
  for (const model of Array.isArray(models) ? models : []) {
    if (typeof model?.group !== 'string' || !model.group.trim()) continue
    let parent: GroupOption | undefined
    let path = ''
    for (const segment of model.group.split('/')) {
      path = path ? `${path}/${segment}` : segment
      let group = groups.get(path)
      if (!group) {
        group = { label: segment, value: `group:${path}`, children: [] }
        groups.set(path, group)
        if (parent) parent.children?.push(group)
        else roots.push(group)
      }
      parent = group
    }
  }
  const sort = (options: GroupOption[]) => {
    options.sort((left, right) => left.label.localeCompare(right.label))
    for (const option of options) {
      if (option.children?.length) sort(option.children)
      else delete option.children
    }
  }
  sort(roots)
  return [
    { label: '全部模型', value: 'all' },
    ...roots,
    { label: '未分组', value: 'group:' },
  ]
}

registerFilter('rpcModelGroups', rpcModelGroups)
