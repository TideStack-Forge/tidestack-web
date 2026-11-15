const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { mainAppRoot, readRootFile } = require(
  path.join(process.cwd(), 'tests/unit/helpers/mainAppTestKit')
)

const VAR_RE = /--[A-Za-z0-9][A-Za-z0-9-]*/g
const DEF_RE = /(?:^|[;\s{])(--[A-Za-z0-9][A-Za-z0-9-]*)\s*:/gm
const REF_RE = /var\((--[A-Za-z0-9][A-Za-z0-9-]*)/g

const EXPECTED_PARITY_BASELINE = {
  publicDocWithoutContract: [],
  publicContractWithoutDoc: [
    '--layout-breakpoint-lg',
    '--layout-breakpoint-md',
    '--layout-breakpoint-sm',
    '--tabbar-bg',
    '--tabbar-height',
    '--tabbar-item-bg',
    '--tabbar-item-bg-active',
    '--tabbar-item-bg-hover',
    '--tabbar-item-border',
    '--tabbar-item-height',
    '--tabbar-item-text',
    '--tabbar-item-text-active',
    '--tabbar-padding-t',
    '--tabbar-padding-x',
    '--tabs-font-size',
  ],
  publicContractWithoutDefinition: [
    '--button-height-md',
    '--button-primary-border-active',
    '--button-primary-border-disabled',
    '--button-primary-border-hover',
    '--dropdown-item-selected',
    '--input-border-disabled',
    '--input-text-disabled',
    '--layout-breakpoint-lg',
    '--layout-breakpoint-md',
    '--layout-breakpoint-sm',
    '--menu-icon-secondary',
    '--sidebar-menu-bg',
    '--sidebar-menu-border',
    '--sidebar-menu-icon-secondary',
    '--sidebar-menu-item-bg-active',
    '--sidebar-menu-item-bg-hover',
    '--sidebar-menu-item-text-active',
    '--sidebar-menu-text',
    '--sidebar-menu-text-secondary',
    '--sidebar-nav-item-bg-active',
    '--sidebar-nav-item-text-active',
    '--sidebar-width-tablet',
    '--tabbar-bg',
    '--tabbar-height',
    '--tabbar-item-bg',
    '--tabbar-item-height',
    '--tabbar-padding-t',
    '--tabbar-padding-x',
    '--tabs-font-size',
  ],
  unclassifiedDefined: [],
  trackedStyleReferencesWithoutDefinition: [
    '--button-height-md',
    '--colors-brand-10',
    '--colors-brand-5',
    '--colors-neutral-fill-11',
    '--colors-neutral-fill-7',
    '--colors-neutral-text-4',
    '--colors-neutral-text-6',
    '--dropdown-item-selected',
    '--menu-badge-color',
    '--sidebar-width-tablet',
    '--user-menu-divider-bg',
  ],
}

function stripLineComments(source) {
  return source.replace(/\/\/.*$/gm, '')
}

function extractBetween(source, startMarker, endMarker) {
  const startIndex = source.indexOf(startMarker)
  assert.notStrictEqual(startIndex, -1, `missing section start: ${startMarker}`)

  const fromStart = source.slice(startIndex + startMarker.length)
  if (!endMarker) {
    return fromStart
  }

  const endIndex = fromStart.indexOf(endMarker)
  assert.notStrictEqual(endIndex, -1, `missing section end: ${endMarker}`)
  return fromStart.slice(0, endIndex)
}

function collectVars(source) {
  return [...new Set([...source.matchAll(VAR_RE)].map((match) => match[0]))].sort()
}

function collectDefinitions(source) {
  return [...new Set([...source.matchAll(DEF_RE)].map((match) => match[1]))].sort()
}

function collectReferences(source) {
  return [...new Set([...source.matchAll(REF_RE)].map((match) => match[1]))].sort()
}

function collectDuplicateDefinitions(source) {
  const counts = new Map()
  for (const name of collectDefinitions(source)) {
    counts.set(name, 0)
  }
  for (const match of source.matchAll(DEF_RE)) {
    const name = match[1]
    counts.set(name, (counts.get(name) || 0) + 1)
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([name]) => name)
    .sort()
}

function extractMixinBody(source, mixinName) {
  const signature = `@mixin ${mixinName}`
  const mixinStart = source.indexOf(signature)
  assert.notStrictEqual(mixinStart, -1, `missing mixin: ${mixinName}`)

  const blockStart = source.indexOf('{', mixinStart)
  assert.notStrictEqual(blockStart, -1, `missing mixin block start: ${mixinName}`)

  let depth = 0
  for (let index = blockStart; index < source.length; index += 1) {
    const char = source[index]
    if (char === '{') {
      depth += 1
    } else if (char === '}') {
      depth -= 1
      if (depth === 0) {
        return source.slice(blockStart + 1, index)
      }
    }
  }

  assert.fail(`missing mixin block end: ${mixinName}`)
}

function walkScssFiles(dirPath, files = []) {
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const entryPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      walkScssFiles(entryPath, files)
    } else if (entry.isFile() && entry.name.endsWith('.scss')) {
      files.push(entryPath)
    }
  }

  return files
}

function collectComponentContractVars(source) {
  const vars = new Set()
  const groups = stripLineComments(source).matchAll(
    /\$contract-([a-z-]+)\s*:\s*\(([\s\S]*?)\);/g
  )

  for (const match of groups) {
    const prefix = match[1]
    const items = match[2]
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)

    items.forEach((item) => vars.add(`--${prefix}-${item}`))
  }

  return [...vars].sort()
}

function collectSemanticContractVars(source) {
  const match = stripLineComments(source).match(
    /\$contract-color-semantic\s*:\s*\(([\s\S]*?)\);/
  )
  assert.ok(match, 'expected semantic contract list')

  return match[1]
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => `--color-${item}`)
    .sort()
}

function toSortedDifference(left, rightSet) {
  return left.filter((item) => !rightSet.has(item)).sort()
}

function collectParityReport() {
  const cssContractDocSource = readRootFile('src/style/docs/css-variables-contract.md')
  const primitiveContractSource = readRootFile('src/style/contract/primitives.scss')
  const semanticContractSource = readRootFile('src/style/contract/semantic.scss')
  const componentContractSource = readRootFile('src/style/contract/components.scss')

  const tier1DocSection = extractBetween(
    cssContractDocSource,
    '## Tier 1: 核心契约（Core Contract）',
    '## Tier 2: 组件契约（Component Contract）'
  )
  const tier2DocSection = extractBetween(
    cssContractDocSource,
    '## Tier 2: 组件契约（Component Contract）',
    '## Tier 3: 适配层（Adaptation Layer）'
  )
  const tier3DocSection = extractBetween(
    cssContractDocSource,
    '## Tier 3: 适配层（Adaptation Layer）',
    '## 内部变量（不对外承诺稳定性）'
  )
  const internalDocSection = extractBetween(
    cssContractDocSource,
    '## 内部变量（不对外承诺稳定性）',
    '## 变更日志'
  )

  const publicContractVars = [
    ...collectDefinitions(primitiveContractSource),
    ...collectSemanticContractVars(semanticContractSource),
    ...collectComponentContractVars(componentContractSource),
  ].sort()
  const publicDocVars = [
    ...new Set([...collectVars(tier1DocSection), ...collectVars(tier2DocSection)]),
  ].sort()
  const vendorCompatibilityVars = collectVars(tier3DocSection)
  const documentedInternalVars = collectVars(internalDocSection)

  const definedVars = new Set()
  const referencedVars = new Set()
  for (const scssFile of walkScssFiles(path.join(mainAppRoot, 'src', 'style'))) {
    const source = fs.readFileSync(scssFile, 'utf8')
    collectDefinitions(source).forEach((name) => definedVars.add(name))
    collectReferences(source).forEach((name) => referencedVars.add(name))
  }

  const publicContractVarSet = new Set(publicContractVars)
  const publicDocVarSet = new Set(publicDocVars)
  const vendorCompatibilityVarSet = new Set(vendorCompatibilityVars)
  const documentedInternalVarSet = new Set(documentedInternalVars)
  const definedVarList = [...definedVars].sort()
  const externalStyleReferenceAllowlist = new Set([
    '--Tree-depth',
    '--Tree-indent',
    '--Tree-itemArrowWidth',
    '--borderColor',
    '--built-in-icon-size',
    '--inputTree-base-size-expandMarginRight',
    '--inputTree-base-size-nodeMarginRight',
  ])

  return {
    publicDocWithoutContract: toSortedDifference(publicDocVars, publicContractVarSet),
    publicContractWithoutDoc: toSortedDifference(publicContractVars, publicDocVarSet),
    publicContractWithoutDefinition: publicContractVars
      .filter((name) => !definedVars.has(name))
      .sort(),
    unclassifiedDefined: definedVarList
      .filter(
        (name) =>
          !publicContractVarSet.has(name) &&
          !vendorCompatibilityVarSet.has(name) &&
          !documentedInternalVarSet.has(name)
      )
      .sort(),
    trackedStyleReferencesWithoutDefinition: [...referencedVars]
      .filter(
        (name) => !definedVars.has(name) && !externalStyleReferenceAllowlist.has(name)
      )
      .sort(),
  }
}

test('css variable public contract drift stays explicitly inventoried', () => {
  const report = collectParityReport()

  assert.deepStrictEqual(
    report.publicDocWithoutContract,
    EXPECTED_PARITY_BASELINE.publicDocWithoutContract
  )
  assert.deepStrictEqual(
    report.publicContractWithoutDoc,
    EXPECTED_PARITY_BASELINE.publicContractWithoutDoc
  )
  assert.deepStrictEqual(
    report.publicContractWithoutDefinition,
    EXPECTED_PARITY_BASELINE.publicContractWithoutDefinition
  )
})

test('css variable extra definitions stay classified or explicitly tracked', () => {
  const report = collectParityReport()

  assert.deepStrictEqual(
    report.unclassifiedDefined,
    EXPECTED_PARITY_BASELINE.unclassifiedDefined
  )
})

test('css variable consumers with no in-repo definition stay visible to the guard', () => {
  const report = collectParityReport()

  assert.deepStrictEqual(
    report.trackedStyleReferencesWithoutDefinition,
    EXPECTED_PARITY_BASELINE.trackedStyleReferencesWithoutDefinition
  )
})

test('light and dark theme files avoid repeated same-name CSS variable definitions', () => {
  const lightThemeSource = readRootFile('src/style/themes/light.scss')
  const darkThemeSource = readRootFile('src/style/themes/dark.scss')

  assert.deepStrictEqual(collectDuplicateDefinitions(lightThemeSource), [])
  assert.deepStrictEqual(collectDuplicateDefinitions(darkThemeSource), [])
})

test('theme defaults mixins avoid repeated same-name CSS variable definitions', () => {
  const defaultsSource = readRootFile('src/style/themes/defaults.scss')
  const lightDefaultsBody = extractMixinBody(defaultsSource, 'light-theme-default-vars')
  const darkDefaultsBody = extractMixinBody(defaultsSource, 'dark-theme-default-vars')

  assert.deepStrictEqual(collectDuplicateDefinitions(lightDefaultsBody), [])
  assert.deepStrictEqual(collectDuplicateDefinitions(darkDefaultsBody), [])
})

test('theme selector emission stays centralized in themes/index.scss', () => {
  const indexSource = readRootFile('src/style/themes/index.scss')
  const lightThemeSource = readRootFile('src/style/themes/light.scss')
  const darkThemeSource = readRootFile('src/style/themes/dark.scss')

  assert.match(indexSource, /\[data-theme="light"\],\s*\.theme-default\s*\{/)
  assert.match(indexSource, /\[data-theme="dark"\],\s*\.theme-dark\s*\{/)
  assert.doesNotMatch(lightThemeSource, /\[data-theme="light"\]/)
  assert.doesNotMatch(lightThemeSource, /\.theme-default/)
  assert.doesNotMatch(darkThemeSource, /\[data-theme="dark"\]/)
  assert.doesNotMatch(darkThemeSource, /\.theme-dark/)
})

test('table adaptation keeps theme-emitted header and row backgrounds intact', () => {
  const tableAdaptationSource = readRootFile('src/style/vendor/amis/adaptations/table.scss')
  const definitions = new Set(collectDefinitions(tableAdaptationSource))

  assert.equal(definitions.has('--table-header-bg'), false)
  assert.equal(definitions.has('--table-row-bg'), false)
  assert.equal(definitions.has('--table-row-hover-bg'), true)
  assert.equal(definitions.has('--table-selected-row-bg'), true)
})

test('table and filter surfaces keep consuming theme-emitted table background tokens', () => {
  const defaultsSource = readRootFile('src/style/themes/defaults.scss')
  const lightDefaultsBody = extractMixinBody(defaultsSource, 'light-theme-default-vars')
  const darkDefaultsBody = extractMixinBody(defaultsSource, 'dark-theme-default-vars')
  const crudStyleSource = readRootFile('src/components/amis/renderers/patch/CRUD.scss')
  const tablePatchSource = readRootFile('src/components/amis/renderers/patch/Table.scss')
  const lightDefinitions = new Set(collectDefinitions(lightDefaultsBody))
  const darkDefinitions = new Set(collectDefinitions(darkDefaultsBody))
  const darkReferences = new Set(collectReferences(darkDefaultsBody))
  const crudReferences = new Set(collectReferences(crudStyleSource))
  const tablePatchReferences = new Set(collectReferences(tablePatchSource))

  assert.equal(lightDefinitions.has('--table-header-bg'), true)
  assert.equal(lightDefinitions.has('--table-row-bg'), true)
  assert.equal(darkDefinitions.has('--table-header-bg'), true)
  assert.equal(darkDefinitions.has('--table-row-bg'), true)
  assert.equal(darkReferences.has('--color-bg-body'), true)
  assert.equal(darkReferences.has('--color-text'), true)
  assert.equal(darkReferences.has('--color-bg-container'), true)
  assert.equal(darkReferences.has('--color-border-secondary'), true)
  assert.equal(darkReferences.has('--color-text-tertiary'), true)
  assert.equal(crudReferences.has('--table-header-bg'), true)
  assert.equal(crudReferences.has('--color-bg-elevated'), true)
  assert.equal(tablePatchReferences.has('--table-header-bg'), true)
  assert.equal(tablePatchReferences.has('--table-row-bg'), true)
  assert.equal(tablePatchReferences.has('--color-bg-elevated'), true)
  assert.equal(tablePatchReferences.has('--color-bg-container'), true)
  assert.equal(tablePatchReferences.has('--table-operation-button-gap'), true)
  assert.equal(tablePatchReferences.has('--table-operation-icon-button-gap'), true)
  assert.equal(tablePatchReferences.has('--table-operation-icon-button-size'), true)
  assert.equal(
    collectDefinitions(tablePatchSource).includes('--table-operation-button-gap'),
    true
  )
  assert.equal(
    collectDefinitions(tablePatchSource).includes('--table-operation-icon-button-gap'),
    true
  )
  assert.equal(
    collectDefinitions(tablePatchSource).includes('--table-operation-icon-button-size'),
    true
  )
})
