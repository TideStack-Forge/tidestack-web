import { describe, expect, test } from 'vitest'

import { getLayoutConfig, mergeLayoutConfig } from '../../../../src/layouts/layout-config.js'

describe('layout config', () => {
  test('fullscreen uses an explicit leaf config instead of header-sidebar fallback semantics', () => {
    expect(getLayoutConfig('fullscreen')).toEqual({
      header: {
        enabled: false,
      },
      sidebar: {
        enabled: false,
      },
      tabs: {
        enabled: false,
      },
    })
  })

  test('fullscreen custom config merges onto the explicit fullscreen base', () => {
    expect(mergeLayoutConfig('fullscreen', {
      tabs: {
        enabled: true,
        position: 'content-top',
      },
    })).toEqual({
      header: {
        enabled: false,
      },
      sidebar: {
        enabled: false,
      },
      tabs: {
        enabled: true,
        position: 'content-top',
      },
    })
  })
})
