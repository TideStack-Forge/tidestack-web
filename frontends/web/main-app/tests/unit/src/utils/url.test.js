const assert = require('node:assert/strict')
const path = require('node:path')
const { requireMirroredSrcModule } = require(
  path.join(process.cwd(), 'tests/unit/helpers/mainAppTestKit')
)

const { appendQueryParams, isExternal } = requireMirroredSrcModule(__filename, './url')

test('isExternal detects external URL protocols', () => {
  assert.equal(isExternal('https://example.com'), true)
  assert.equal(isExternal('mailto:hello@example.com'), true)
  assert.equal(isExternal('/internal/page'), false)
})

test('appendQueryParams returns the original URL when params are empty', () => {
  assert.equal(appendQueryParams('/dev/demo', undefined), '/dev/demo')
  assert.equal(appendQueryParams('/dev/demo', {}), '/dev/demo')
})

test('appendQueryParams appends encoded values to URLs with or without existing query strings', () => {
  assert.equal(
    appendQueryParams('/dev/demo', {
      definitionId: 'purchase approval',
      returnUrl: '/dev/demo?tab=detail',
    }),
    '/dev/demo?definitionId=purchase%20approval&returnUrl=%2Fdev%2Fdemo%3Ftab%3Ddetail'
  )
  assert.equal(
    appendQueryParams('/dev/demo?from=home', { formKey: 'demo.purchase' }),
    '/dev/demo?from=home&formKey=demo.purchase'
  )
})
