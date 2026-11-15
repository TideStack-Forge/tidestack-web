const assert = require('assert')
const fs = require('fs')
const path = require('path')
const sass = require('sass')

const rootDir = path.resolve(__dirname, '..')
const sourcePath = path.join(rootDir, 'src/style/vendor/amis/patches.scss')
const source = fs.readFileSync(sourcePath, 'utf8')
const css = sass.compileString(source, {
  loadPaths: [rootDir],
}).css

assert.match(
  css,
  /:root fieldset\s*\{[^}]*min-inline-size:\s*unset;[^}]*margin-bottom:\s*var\(--space-md\);/,
  'all fieldsets should use compact bottom spacing'
)

assert.match(
  css,
  /:root fieldset\.cxd-Collapse\s*\{[^}]*margin-bottom:\s*var\(--space-md\);/,
  'collapsed fieldsets should override AMIS defaults with compact bottom spacing'
)

assert.match(
  css,
  /:root fieldset\.cxd-Collapse > legend \.cxd-TplField\s*\{[^}]*color:\s*var\(--color-text\);[^}]*font-size:\s*var\(--font-size-lg\);[^}]*font-weight:\s*var\(--font-weight-semibold\);[^}]*line-height:\s*var\(--line-height-normal\);/,
  'collapsed fieldset legends should render with section title typography'
)

assert.match(
  css,
  /:root \.cxd-Form > fieldset\s*\{[^}]*margin-top:\s*var\(--space-xl\);/,
  'fieldsets should use a consistent section top spacing regardless of preceding element type'
)

assert.match(
  css,
  /:root \.cxd-Form > fieldset:first-child\s*\{[^}]*margin-top:\s*var\(--space-md\);/,
  'first fieldset in a form should use compact top spacing'
)

assert.match(
  css,
  /:root fieldset\.tide-default-fieldset \.cxd-Collapse-content\s*\{[^}]*background-color:\s*rgba\(204,\s*204,\s*204,\s*0\.15\);/,
  'fieldset content tint should remain limited to default generated fieldsets'
)

assert.doesNotMatch(
  css,
  /:root fieldset \.cxd-Collapse-content\s*\{[^}]*background-color:/,
  'plain fieldsets should not receive the default generated fieldset content tint'
)

console.log('fieldsetSpacingStyle tests passed')
