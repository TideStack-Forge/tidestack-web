const assert = require('node:assert/strict')
const path = require('node:path')

const { mainAppRoot, registerTypescriptRequire } = require(
  path.join(process.cwd(), 'tests/unit/helpers/mainAppTestKit')
)

let unregisterTypescript = null

beforeAll(() => {
  unregisterTypescript = registerTypescriptRequire()
})

afterAll(() => {
  unregisterTypescript?.()
})

function loadModule() {
  return require(
    path.join(
      mainAppRoot,
      'src/components/amis/renderers/dialog-resize/dialogResizeConfig.ts'
    )
  )
}

test('dialog resize config keeps both runtime affordances disabled by default', () => {
  const { resolveDialogResizeConfig } = loadModule()

  assert.deepEqual(resolveDialogResizeConfig(undefined, undefined), {
    resizable: false,
    sizeSwitchable: false,
    sizeOptions: ['sm', 'md', 'lg', 'xl', 'full'],
  })
})

test('dialog resize config reads flat and nested backend config values', () => {
  const { resolveDialogResizeConfig } = loadModule()

  assert.deepEqual(
    resolveDialogResizeConfig(undefined, {
      'ui.dialog.resize.enabled': true,
      'ui.dialog.resize.resizable': false,
      ui: {
        dialog: {
          resize: {
            sizeSwitchable: true,
            sizes: 'md,lg,full',
          },
        },
      },
    }),
    {
      resizable: false,
      sizeSwitchable: true,
      sizeOptions: ['md', 'lg', 'full'],
    }
  )
})

test('dialog resize schema props override backend defaults', () => {
  const { resolveDialogResizeConfig } = loadModule()

  assert.deepEqual(
    resolveDialogResizeConfig(
      {
        resizable: true,
        sizeSwitchable: false,
        sizeOptions: ['sm', 'sm', 'xl', 'invalid'],
      },
      {
        'ui.dialog.resize.enabled': true,
        'ui.dialog.resize.resizable': false,
        'ui.dialog.resize.sizeSwitchable': true,
        'ui.dialog.resize.sizes': 'md,lg',
      }
    ),
    {
      resizable: true,
      sizeSwitchable: false,
      sizeOptions: ['sm', 'xl'],
    }
  )
})
