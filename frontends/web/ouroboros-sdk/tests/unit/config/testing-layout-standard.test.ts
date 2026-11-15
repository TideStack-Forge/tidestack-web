import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'

const packageRoot = path.resolve(__dirname, '..', '..', '..')
const srcRoot = path.join(packageRoot, 'src')

function walk(dir: string, predicate: (filePath: string) => boolean, result: string[] = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(fullPath, predicate, result)
      continue
    }
    if (predicate(fullPath)) {
      result.push(path.relative(packageRoot, fullPath))
    }
  }
  return result
}

function readJson(relativePath: string) {
  return JSON.parse(fs.readFileSync(path.join(packageRoot, relativePath), 'utf8'))
}

describe('sdk testing layout standard', () => {
  test('uses tests/unit instead of src-local test folders', () => {
    const packageJson = readJson('package.json')
    const vitestConfig = fs.readFileSync(path.join(packageRoot, 'vitest.config.ts'), 'utf8')
    const srcTestFiles = walk(
      srcRoot,
      (filePath) =>
        /(^|\/)__tests__\//.test(filePath) || /\.(test|spec)\.(js|ts|tsx)$/.test(filePath)
    )

    expect(fs.existsSync(path.join(packageRoot, 'tests/README.md'))).toBe(true)
    expect(srcTestFiles).toEqual([])
    expect(packageJson.scripts['test:unit']).toBeTruthy()
    expect(packageJson.scripts['test:vitest']).toBeUndefined()
    expect(vitestConfig).toContain("include: ['tests/unit/**/*.test.ts']")
    expect(fs.existsSync(path.join(packageRoot, 'tests/unit/src/api-contract.test.ts'))).toBe(true)
  })
})
