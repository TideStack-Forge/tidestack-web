import { describe, expect, test, vi } from 'vitest'

vi.mock('amis', () => ({ registerFilter: vi.fn() }))
const { rpcModelGroups } =
  await import('../../../../../../src/components/amis/filters/rpcModelGroups.ts')
const models = [
  { name: 'member', title: '读取成员', group: '钉钉/通讯录' },
  { name: 'message', title: '发送消息', group: '钉钉/消息' },
  { name: 'parent', title: '企业查询', group: '钉钉' },
  { name: 'similar', title: '其他接口', group: '钉钉其他' },
  { name: 'legacy', title: '旧接口', group: null },
]
describe('RPC group navigation', () => {
  test('derives distinct ancestors, direct parent models and ungrouped navigation from full paths', () => {
    const tree = rpcModelGroups([...models, models[0]])
    expect(tree[0]).toEqual({ label: '全部模型', value: 'all' })
    expect(tree.find((item) => item.value === 'group:钉钉').children).toEqual(
      expect.arrayContaining([
        { label: '通讯录', value: 'group:钉钉/通讯录' },
        { label: '消息', value: 'group:钉钉/消息' },
      ])
    )
    expect(tree.find((item) => item.value === 'group:钉钉').children).toHaveLength(2)
    expect(tree.at(-1)).toEqual({ label: '未分组', value: 'group:' })
  })

  test('keeps empty collections navigable and separates explicit labels from missing groups', () => {
    expect(rpcModelGroups(null)).toEqual(rpcModelGroups([]))
    expect(rpcModelGroups([])).toHaveLength(2)
    const tree = rpcModelGroups([{ group: '未分组' }, {}, { group: ' ' }])
    expect(
      tree.filter((item) => item.label === '未分组').map((item) => item.value)
    ).toEqual(['group:未分组', 'group:'])
  })

  test('new collection data rebuilds navigation without mutating model declarations', () => {
    const input = Object.freeze([Object.freeze({ name: 'one', group: '平台/通讯录' })])
    expect(rpcModelGroups(input)[1].children[0].value).toBe('group:平台/通讯录')
    expect(
      rpcModelGroups([{ group: '业务' }]).some((item) => item.value === 'group:平台')
    ).toBe(false)
    expect(input[0].group).toBe('平台/通讯录')
  })
})
