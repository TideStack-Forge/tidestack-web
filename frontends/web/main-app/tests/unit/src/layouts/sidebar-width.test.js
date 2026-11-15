import { describe, expect, test } from 'vitest'

import {
  createSidebarWidthStyle,
  readUserWidthPreference,
  resolveSidebarWidth,
  resolveSidebarWidthConfig,
} from '../../../../src/layouts/sidebar-width.ts'

describe('sidebar width helpers', () => {
  test('resolveSidebarWidthConfig falls back to the built-in defaults when config is missing', () => {
    expect(resolveSidebarWidthConfig(undefined)).toEqual({
      width: 200,
      minWidth: 160,
      maxWidth: 360,
      resizable: true,
    })
  })

  test('resolveSidebarWidthConfig reads flat and nested config values into one runtime contract', () => {
    expect(
      resolveSidebarWidthConfig({
        'sidebar.width': 240,
        sidebar: {
          minWidth: 180,
          maxWidth: 320,
        },
        'sidebar.resizable': false,
      })
    ).toEqual({
      width: 240,
      minWidth: 180,
      maxWidth: 320,
      resizable: false,
    })
  })

  test('resolveSidebarWidth clamps user preference and falls back to config width when resizing is disabled', () => {
    const config = {
      width: 220,
      minWidth: 160,
      maxWidth: 300,
      resizable: true,
    }

    expect(resolveSidebarWidth(config, 360)).toBe(300)
    expect(resolveSidebarWidth({ ...config, resizable: false }, 280)).toBe(220)
  })

  test('readUserWidthPreference and createSidebarWidthStyle keep the CSS variable projection aligned', () => {
    const storage = {
      getItem(key) {
        return key === 'sidebar-width' ? '286' : null
      },
    }

    expect(readUserWidthPreference(storage)).toBe(286)
    expect(createSidebarWidthStyle(286)).toMatchObject({
      '--layout-sidebar-width-open': '286px',
      '--sidebar-width-open': '286px',
    })
  })
})
