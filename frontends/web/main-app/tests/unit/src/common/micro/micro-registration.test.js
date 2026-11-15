import { describe, expect, test } from 'vitest'

import {
  buildActiveRuleMatcher,
  buildEntryRoutesMap,
  buildMicroEntryArray,
} from '../../../../../src/common/micro/microRegistration.ts'

describe('microRegistration pure shaping', () => {
  test('buildEntryRoutesMap groups micro and quick routes by entry', () => {
    expect(
      buildEntryRoutesMap([
        { type: 'micro', entry: '/micro-app-a', path: '/dev/apps/:id' },
        {
          type: 'quick',
          config: { entry: '/micro-app-a' },
          path: '/dev/apps/:id/detail',
        },
        { type: 'internal', path: '/welcome' },
        {
          type: 'micro',
          entry: 'https://micro.example.com',
          path: '/ops/dashboard?tab=todo',
        },
      ])
    ).toEqual({
      '/micro-app-a': ['/dev/apps/:id', '/dev/apps/:id/detail'],
      'https://micro.example.com': ['/ops/dashboard'],
    })
  })

  test('buildMicroEntryArray expands local entries against the current origin and keeps external ones', () => {
    expect(
      buildMicroEntryArray(
        {
          '/micro-app-a': ['/dev/apps/:id'],
          'https://micro.example.com': ['/ops/dashboard'],
        },
        {
          isExternal: (value) => value.startsWith('http'),
          origin: 'https://host.example.com',
        }
      )
    ).toEqual(['https://host.example.com/micro-app-a', 'https://micro.example.com'])
  })

  test('buildActiveRuleMatcher matches parameterized micro routes', () => {
    const matches = buildActiveRuleMatcher(['/dev/apps/:id', '/ops/dashboard/:tab'])

    expect(matches('/dev/apps/123')).toBe(true)
    expect(matches('/ops/dashboard/todo')).toBe(true)
    expect(matches('/ops/dashboard')).toBe(false)
    expect(matches('/welcome')).toBe(false)
  })
})
