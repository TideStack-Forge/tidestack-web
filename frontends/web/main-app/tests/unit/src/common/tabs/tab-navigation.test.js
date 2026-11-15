import { describe, expect, test } from 'vitest'

import {
  findBestMatchingTabId,
  getUrlMatchScore,
  normalizeTabPath,
} from '../../../../../src/common/tabs/tabNavigation.ts'

describe('tabNavigation pure helpers', () => {
  test('normalizeTabPath trims, encodes, and prefixes leading slash', () => {
    expect(normalizeTabPath(' dev/应用列表 ')).toBe('/dev/%E5%BA%94%E7%94%A8%E5%88%97%E8%A1%A8')
    expect(normalizeTabPath('/dev/%E5%BA%94%E7%94%A8%E5%88%97%E8%A1%A8')).toBe(
      '/dev/%E5%BA%94%E7%94%A8%E5%88%97%E8%A1%A8'
    )
  })

  test('getUrlMatchScore prefers exact matches, then compatible query/hash matches', () => {
    expect(getUrlMatchScore('/dev/app-list?tab=todo#a', '/dev/app-list?tab=todo#a')).toBe(
      Number.MAX_VALUE
    )
    expect(getUrlMatchScore('/dev/app-list?tab=todo#a', '/dev/app-list?tab=todo#b')).toBe(10000)
    expect(getUrlMatchScore('/dev/app-list?tab=todo', '/dev/app-list?tab=done')).toBeLessThan(0)
    expect(getUrlMatchScore('/dev/app-list?tab=todo&view=list', '/dev/app-list?tab=todo')).toBe(3)
    expect(getUrlMatchScore('/dev/app-list', '/dev/other')).toBe(Number.MIN_VALUE)
  })

  test('findBestMatchingTabId chooses the highest-scoring existing tab for the same path', () => {
    expect(
      findBestMatchingTabId('/dev/app-list?tab=todo&view=list', [
        { id: 'tab-1', path: '/dev/app-list', fullPath: '/dev/app-list?tab=done' },
        { id: 'tab-2', path: '/dev/app-list', fullPath: '/dev/app-list?tab=todo' },
        { id: 'tab-3', path: '/dev/other', fullPath: '/dev/other' },
      ])
    ).toBe('tab-2')
  })
})
