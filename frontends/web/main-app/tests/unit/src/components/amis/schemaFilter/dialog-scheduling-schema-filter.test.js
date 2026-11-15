import { expect, test, vi } from 'vitest'

const { addSchemaFilter, registeredFilters } = vi.hoisted(() => {
  const registeredFilters = []
  return {
    addSchemaFilter: vi.fn((filter) => registeredFilters.push(filter)),
    registeredFilters,
  }
})

vi.mock('amis', () => ({
  addSchemaFilter,
}))

const { normalizeDialogSchedulingSchema } = await import(
  '../../../../../../src/components/amis/schemaFilter/dialogSchedulingSchemaFilter.ts'
)

test('registers the dialog scheduling schema filter through the AMIS extension point', () => {
  expect(addSchemaFilter).toHaveBeenCalledTimes(1)

  const schema = {
    type: 'dialog',
    body: { type: 'form' },
    ouroborosDialogScheduling: true,
  }

  expect(registeredFilters[0](schema, {})).toEqual({
    ...schema,
    lazyRender: true,
  })
})

test('leaves dialog schemas unchanged unless scheduling is explicitly enabled', () => {
  const schema = {
    type: 'dialog',
    body: { type: 'form' },
  }

  expect(normalizeDialogSchedulingSchema(schema)).toBe(schema)
})

test('sets lazyRender for opt-in inline dialog and drawer bodies', () => {
  const dialog = {
    type: 'dialog',
    body: { type: 'form' },
    ouroborosDialogScheduling: true,
  }
  const drawer = {
    type: 'drawer',
    body: [{ type: 'tpl', tpl: 'body' }],
    ouroborosDialogScheduling: {},
  }

  expect(normalizeDialogSchedulingSchema(dialog)).toEqual({
    ...dialog,
    lazyRender: true,
  })
  expect(normalizeDialogSchedulingSchema(drawer)).toEqual({
    ...drawer,
    lazyRender: true,
  })
})

test('does not override disabled, url, schemaId, or user-provided lazyRender modals', () => {
  const disabled = {
    type: 'dialog',
    body: { type: 'form' },
    ouroborosDialogScheduling: { enabled: false },
  }
  const urlDialog = {
    type: 'dialog',
    url: '/dev/app/page',
    body: {},
    ouroborosDialogScheduling: true,
  }
  const schemaIdDialog = {
    type: 'dialog',
    schemaId: '/dev/app/page',
    body: {},
    ouroborosDialogScheduling: true,
  }
  const alreadyLazy = {
    type: 'dialog',
    body: {},
    lazyRender: false,
    ouroborosDialogScheduling: true,
  }
  const undefinedLazy = {
    type: 'dialog',
    body: {},
    lazyRender: undefined,
    ouroborosDialogScheduling: true,
  }
  const nullLazy = {
    type: 'dialog',
    body: {},
    lazyRender: null,
    ouroborosDialogScheduling: true,
  }

  expect(normalizeDialogSchedulingSchema(disabled)).toBe(disabled)
  expect(normalizeDialogSchedulingSchema(urlDialog)).toBe(urlDialog)
  expect(normalizeDialogSchedulingSchema(schemaIdDialog)).toBe(schemaIdDialog)
  expect(normalizeDialogSchedulingSchema(alreadyLazy)).toBe(alreadyLazy)
  expect(normalizeDialogSchedulingSchema(undefinedLazy)).toBe(undefinedLazy)
  expect(normalizeDialogSchedulingSchema(nullLazy)).toBe(nullLazy)
})

test('ignores non-modal schemas and modals without inline body', () => {
  const crud = {
    type: 'crud',
    body: [],
    ouroborosDialogScheduling: true,
  }
  const emptyDialog = {
    type: 'dialog',
    ouroborosDialogScheduling: true,
  }

  expect(normalizeDialogSchedulingSchema(crud)).toBe(crud)
  expect(normalizeDialogSchedulingSchema(emptyDialog)).toBe(emptyDialog)
})
