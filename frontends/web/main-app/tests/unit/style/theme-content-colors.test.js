import { describe, expect, test } from 'vitest'

const path = require('node:path')
const sass = require('sass')

const rootDir = path.resolve(__dirname, '../../..')

function compileThemeVars(theme) {
  const result = sass.compileString(
    `@use "../ouroboros-amis-runtime/src/style/themes/${theme}" as theme; .${theme} { @include theme.${theme}-theme-vars; }`,
    { loadPaths: [rootDir] }
  )
  const vars = new Map()

  for (const match of result.css.matchAll(/(--[A-Za-z0-9_-]+):\s*([^;]+);/g)) {
    vars.set(match[1], match[2].trim())
  }

  return vars
}

const contentPrefixes = [
  '--color-primary',
  '--color-success',
  '--color-warning',
  '--color-error',
  '--color-info',
  '--color-text',
  '--color-bg-container',
  '--color-bg-disabled',
  '--color-bg-elevated',
  '--color-bg-hover',
  '--color-bg-inverse',
  '--color-bg-page',
  '--color-bg-selected',
  '--color-border',
  '--color-danger',
  '--color-fill',
  '--color-link',
  '--color-outline',
  '--color-shadow',
  '--button-',
  '--input-',
  '--form-',
  '--modal-',
  '--table-',
  '--select-',
  '--dropdown-',
  '--checkbox-',
  '--radio-',
  '--switch-',
  '--toast-',
]

describe('theme content colors', () => {
  test('dark theme keeps AMIS and content tokens aligned with light theme', () => {
    const lightVars = compileThemeVars('light')
    const darkVars = compileThemeVars('dark')
    const mismatches = [...lightVars.keys()]
      .filter((key) => contentPrefixes.some((prefix) => key.startsWith(prefix)))
      .filter((key) => lightVars.get(key) !== darkVars.get(key))
      .map((key) => `${key}: light=${lightVars.get(key)} dark=${darkVars.get(key)}`)

    expect(mismatches).toEqual([])
  })
})
