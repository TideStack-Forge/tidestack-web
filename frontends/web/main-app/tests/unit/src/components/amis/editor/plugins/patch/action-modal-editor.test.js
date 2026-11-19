import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('amis-editor', () => ({
  ActionPlugin: class {
    constructor(manager) {
      this.manager = manager
      this.panelBodyCreator = () => [
        {
          name: 'dialog',
          children: (props) =>
            React.createElement('button', { onClick: props.onChange }, 'Edit popup'),
        },
      ]
    }
  },
  registerEditorPlugin: vi.fn(),
  unRegisterEditorPlugin: vi.fn(),
}))
vi.mock('amis-editor-core', () => ({
  diff: (before, after) => ({ before, after }),
  modalsToDefinitions: vi.fn(() => ({
    candidate: { type: 'dialog', title: 'Other popup' },
  })),
  mergeDefinitions: vi.fn((schema) => schema),
}))

import { mergeDefinitions, modalsToDefinitions } from 'amis-editor-core'
import { OuroborosActionPlugin } from '@/components/amis/editor/plugins/patch/Action'

function createEditor(action = { dialog: { $$id: 'inline', title: 'Popup' } }) {
  const store = {
    schema: { $$id: 'page', definitions: { authored: { type: 'tpl', tpl: 'Keep' } } },
    modals: [{ ...action?.dialog }, { $$id: 'other', title: 'Other popup' }],
    getSchema: vi.fn(() => action),
    getNodeById: vi.fn(() => ({})),
    updateModal: vi.fn(),
    traceableSetSchema: vi.fn(),
  }
  const manager = { store, openSubEditor: vi.fn(), panelChangeValue: vi.fn() }
  return { store, manager, plugin: new OuroborosActionPlugin(manager) }
}

function confirm(manager, schema = { title: 'Edited popup' }) {
  const config = manager.openSubEditor.mock.lastCall[0]
  expect(config.onDefinitionsChange(config.value.definitions, {}, schema)).toBe(false)
  expect(config.onChange).toBeUndefined()
  return config
}

describe('action popup editor lifecycle', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates the original inline popup through the modal store instead of copying its catalogue', () => {
    const { plugin, manager, store } = createEditor()
    plugin.editDetail('button')
    const config = confirm(manager)
    expect(config.value.title).toBe('Popup')
    expect(modalsToDefinitions).toHaveBeenCalledWith(
      store.modals,
      {},
      expect.objectContaining({ $$id: 'inline' })
    )
    expect(store.updateModal).toHaveBeenCalledWith(
      'inline',
      { $$id: 'inline', title: 'Edited popup' },
      config.value.definitions
    )
    expect(manager.panelChangeValue).not.toHaveBeenCalled()
    expect(store.schema.definitions).toEqual({ authored: { type: 'tpl', tpl: 'Keep' } })
  })

  it('resolves a shared popup without replacing the action reference', () => {
    const action = { dialog: { $ref: 'shared' } }
    const { plugin, manager, store } = createEditor(action)
    store.modals.push({ $$id: 'shared-id', $$ref: 'shared', title: 'Shared popup' })
    plugin.editDetail('button')
    const config = confirm(manager)
    expect(config.value.title).toBe('Shared popup')
    expect(store.updateModal).toHaveBeenCalledWith(
      'shared-id',
      expect.objectContaining({ title: 'Edited popup' }),
      config.value.definitions
    )
    expect(action.dialog).toEqual({ $ref: 'shared' })
  })

  it('can author content for an action that does not yet contain a popup', () => {
    const { plugin, manager } = createEditor({ type: 'button', actionType: 'dialog' })
    plugin.editDetail('button')
    confirm(manager)
    expect(manager.panelChangeValue).toHaveBeenCalledWith(
      expect.objectContaining({
        dialog: expect.objectContaining({ title: 'Edited popup' }),
      }),
      expect.any(Object),
      undefined,
      'button'
    )
  })

  it('does not open an editor for an absent action or editor node', () => {
    const { plugin, manager, store } = createEditor(null)
    plugin.editDetail('missing')
    store.getSchema.mockReturnValue({ dialog: {} })
    store.getNodeById.mockReturnValue(null)
    plugin.editDetail('missing-node')
    expect(manager.openSubEditor).not.toHaveBeenCalled()
  })

  for (const name of ['dialog', 'drawer', 'feedback']) {
    it(`keeps ${name} property editing and the surrounding controls`, () => {
      const { plugin, manager, store } = createEditor()
      const onChange = vi.fn(),
        clear = vi.fn()
      const control = {
        name,
        children: () =>
          React.createElement(
            'div',
            {},
            React.createElement('button', { onClick: () => {} }, 'Edit'),
            React.createElement('button', { onClick: clear }, 'Clear')
          ),
      }
      let panel
      plugin.afterBuildPanelBody({
        context: {
          plugin: {},
          context: { id: 'button' },
          data: [{ body: [control, { name: 'unrelated', value: true }] }],
        },
        setData: (value) => {
          panel = value
        },
      })
      const [edit, remove] = panel[0].body[0].children({
        value: { title: 'Draft' },
        onChange,
      }).props.children
      edit.props.onClick()
      const config = confirm(manager)
      expect(config.value.type).toBe(name === 'drawer' ? 'drawer' : 'dialog')
      expect(config.value.title).toBe('Draft')
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Edited popup' })
      )
      expect(mergeDefinitions).toHaveBeenCalledWith(
        store.schema,
        config.value.definitions,
        expect.objectContaining({ title: 'Edited popup' })
      )
      remove.props.onClick()
      expect(clear).toHaveBeenCalledOnce()
      expect(panel[0].body[1]).toEqual({ name: 'unrelated', value: true })
    })
  }

  it('repairs its inherited legacy action panel through the same editor lifecycle', () => {
    const { plugin, manager } = createEditor()
    const onChange = vi.fn()
    const [control] = plugin.panelBodyCreator({ id: 'button' })
    control.children({ value: { title: 'Panel draft' }, onChange }).props.onClick()
    confirm(manager)
    expect(onChange).toHaveBeenCalledWith({ $$id: 'inline', title: 'Edited popup' })
  })

  it('leaves shared property references intact when updating their definition', () => {
    const { plugin, manager, store } = createEditor({ dialog: { $ref: 'shared' } })
    store.modals.push({ $$id: 'shared-id', $$ref: 'shared', title: 'Shared popup' })
    const onChange = vi.fn()
    const [control] = plugin.panelBodyCreator({ id: 'button' })
    control.children({ value: { $ref: 'shared' }, onChange }).props.onClick()
    confirm(manager)
    expect(store.updateModal).toHaveBeenCalledOnce()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('does not decorate its own panel twice', () => {
    const { plugin } = createEditor()
    const setData = vi.fn()
    plugin.afterBuildPanelBody({ context: { plugin }, setData })
    expect(setData).not.toHaveBeenCalled()
  })
})
