import { expect, test, vi } from 'vitest'

const modalMocks = vi.hoisted(() => {
  function createRenderer(renderCalls) {
    return class MockModalRenderer {
      constructor(props = {}, context = {}) {
        this.props = props
        this.context = context
        this.state = {}
        this.setStateCalls = []
      }

      setState(nextState) {
        this.setStateCalls.push(nextState)
        this.state = { ...this.state, ...nextState }
      }

      renderBody(body, key) {
        renderCalls.push({ body, key })
        if (Array.isArray(body)) {
          return body.map((item, index) => this.renderBody(item, index))
        }
        return { body, key }
      }

      buildActions() {
        if (Array.isArray(this.props.actions)) {
          return this.props.actions
        }
        return [{ type: 'button', label: '默认' }]
      }

      renderFooter() {
        renderCalls.push({
          kind: 'footer',
          footerData: this.props.store?.formData,
          footerActions: this.buildActions(),
        })
        return renderCalls[renderCalls.length - 1]
      }

      handleAction() {
        return undefined
      }

      handleEntered() {
        return undefined
      }

      handleExited() {
        return undefined
      }
    }
  }

  return {
    createRenderer,
    dialogRenderCalls: [],
    drawerRenderCalls: [],
  }
})

vi.mock('amis', () => ({
  ActionSchema: {},
  IScopedContext: {},
  IServiceStore: {},
  ModalStore: { name: 'ModalStore' },
  Renderer: () => (component) => component,
  ScopedContext: {},
  buildApi: vi.fn((api) => api),
  dataMapping: vi.fn((value) => value),
  isObjectShallowModified: vi.fn(() => false),
  setThemeClassName: vi.fn(() => ''),
}))

vi.mock('amis-core', () => ({
  str2function: (source, ...argNames) => new Function(...argNames, source),
}))

vi.mock('amis/lib/renderers/Dialog', () => ({
  DialogRenderer: {
    ComposedComponent: modalMocks.createRenderer(modalMocks.dialogRenderCalls),
  },
}))

vi.mock('amis/lib/renderers/Drawer', () => ({
  DrawerRenderer: {
    ComposedComponent: modalMocks.createRenderer(modalMocks.drawerRenderCalls),
  },
}))

vi.mock('amis-ui/lib/components/Spinner', () => ({
  default: () => null,
}))

vi.mock('#ouroboros-host/common/modal', () => ({
  popModalMethods: vi.fn(),
  pushModalMethods: vi.fn(),
}))

vi.mock('#ouroboros-host/store/storeFacade', () => ({
  readGetters: vi.fn(() => ({})),
}))

vi.mock('#ouroboros-host/common/i18n/amis', () => ({
  processAmisSchema: vi.fn((schemaId, schema) => schema),
}))

vi.mock('#ouroboros-host/common/eventBus', () => ({
  EventBus: {
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  },
}))

const {
  normalizeModalSchema,
  resolveModalBodySchema,
  resetModalBodySchema,
  normalizeModalBodyFormForRender,
  normalizeModalBodyFormActions,
  normalizeModalBodyFormActionsForRender,
  suppressModalBodyFormActionsForRender,
  withModalSchemaResolvedHandler,
} = await import('../../../../../../../ouroboros-amis-runtime/src/renderers/modalFormActions.ts')
const { default: OuroborosDialog } =
  await import('../../../../../../../ouroboros-amis-runtime/src/renderers/OuroborosDialog.tsx')
const { default: OuroborosDrawer } =
  await import('../../../../../../../ouroboros-amis-runtime/src/renderers/OuroborosDrawer.tsx')
const { default: AmisSchema } =
  await import('../../../../../../../ouroboros-amis-runtime/src/renderers/AmisSchema.tsx')

const modalRenderers = [
  ['dialog', OuroborosDialog, modalMocks.dialogRenderCalls],
  ['drawer', OuroborosDrawer, modalMocks.drawerRenderCalls],
]

function resetRenderCalls(renderCalls) {
  renderCalls.splice(0)
}

function assertEmptyActions(actions) {
  expect(actions).toEqual([])
}

function createModal(Renderer, props = {}, context = {}) {
  const schema = normalizeModalSchema(props.$schema || props, props)
  const store = props.store || {}
  if (store.schema) store.schema = normalizeModalSchema(store.schema, props)
  store.setSchema = vi.fn(function (next) {
    this.schema = next
  })
  return new Renderer({ ...props, ...schema, $schema: schema, store }, context)
}

test('modal body form normalization hoists title and disables implicit panel wrapping', () => {
  const actions = [{ type: 'submit', label: '保存' }]
  const schema = [{ type: 'form', title: '编辑', actions }]

  const normalized = normalizeModalBodyFormForRender(schema)

  expect(normalized?.actions).toEqual(actions)
  expect(normalized?.title).toBe('编辑')
  expect(normalized?.schema).not.toBe(schema)
  assertEmptyActions(normalized?.schema[0].actions)
  expect(normalized?.schema[0].title).toBeUndefined()
  expect(normalized?.schema[0].wrapWithPanel).toBe(false)
  expect(schema[0].actions).toBe(actions)
  expect(schema[0].title).toBe('编辑')
  expect(schema[0].wrapWithPanel).toBeUndefined()
})

test('modal body form normalization preserves explicit panel wrapping', () => {
  const actions = [{ type: 'submit', label: '保存' }]
  const schema = { type: 'form', title: '编辑', wrapWithPanel: true, actions }

  const normalized = normalizeModalBodyFormForRender(schema)

  expect(normalized?.actions).toEqual(actions)
  expect(normalized?.title).toBeUndefined()
  expect(normalized?.schema).not.toBe(schema)
  assertEmptyActions(normalized?.schema.actions)
  expect(normalized?.schema.title).toBe('编辑')
  expect(normalized?.schema.wrapWithPanel).toBe(true)
  expect(schema.actions).toBe(actions)
  expect(schema.title).toBe('编辑')
  expect(schema.wrapWithPanel).toBe(true)
})

test('modal body action normalization preserves explicit empty form actions', () => {
  const actions = []
  const schema = { type: 'form', actions }

  expect(normalizeModalBodyFormActions(schema)).toBe(actions)
  assertEmptyActions(schema.actions)
  expect(schema.wrapWithPanel).toBe(false)
})

test('modal body action normalization clones read-only form schemas for render', () => {
  const actions = [{ type: 'submit', label: '保存' }]
  const schema = Object.freeze({ type: 'form', actions })

  const normalized = normalizeModalBodyFormActionsForRender(schema)

  expect(normalized?.actions).toEqual(actions)
  expect(normalized?.schema).not.toBe(schema)
  expect(normalized?.schema.actions).toEqual([])
  expect(normalized?.schema.wrapWithPanel).toBe(false)
  expect(schema.actions).toBe(actions)
})

test('modal body action normalization moves direct page body form actions out', () => {
  const actions = [{ type: 'button', label: '提交' }]
  const schema = { type: 'page', body: { type: 'form', actions } }

  expect(normalizeModalBodyFormActions(schema)).toBe(actions)
  assertEmptyActions(schema.body.actions)
  expect(schema.body.wrapWithPanel).toBe(false)
})

test('modal body action normalization moves root page actions out', () => {
  const actions = [{ type: 'button', label: '同意' }]
  const schema = {
    type: 'page',
    body: { type: 'form', id: 'approval-form' },
    actions,
  }

  expect(normalizeModalBodyFormActions(schema)).toBe(actions)
  assertEmptyActions(schema.actions)
  assertEmptyActions(schema.body.actions)
  expect(schema.body.wrapWithPanel).toBe(false)
})

test('modal body action normalization leaves page body forms with siblings unchanged', () => {
  const actions = [{ type: 'button', label: '提交' }]
  const schema = {
    type: 'page',
    body: [
      { type: 'tpl', tpl: '说明' },
      { type: 'form', actions },
    ],
  }

  expect(normalizeModalBodyFormActions(schema)).toBe(null)
  expect(schema.body[1].actions).toBe(actions)
  expect(schema.body[1].wrapWithPanel).toBeUndefined()
})

test('modal body action normalization leaves unmarked nested forms unchanged', () => {
  const actions = [{ type: 'button', label: '提交' }]
  const schema = {
    type: 'page',
    body: { type: 'wrapper', body: { type: 'form', actions } },
  }

  expect(normalizeModalBodyFormActions(schema)).toBe(null)
  expect(schema.body.body.actions).toBe(actions)
  expect(schema.body.body.wrapWithPanel).toBeUndefined()
})

test.each(modalRenderers)(
  '%s renders direct body form without panel actions and exposes footer actions',
  (_name, Renderer, renderCalls) => {
    resetRenderCalls(renderCalls)
    const actions = [{ type: 'submit', label: '保存' }]
    const body = { type: 'form', actions }
    const modal = createModal(Renderer, { body }, {})

    modal.renderBody(modal.props.body ?? body, 'body')

    const renderedBody = renderCalls[0].body
    expect(renderedBody).not.toBe(body)
    assertEmptyActions(renderedBody.actions)
    expect(renderedBody.wrapWithPanel).toBe(false)
    expect(body.actions).toBe(actions)
    expect(body.wrapWithPanel).toBeUndefined()
    expect(modal.state.updatedActions).toBe(null)
    expect(modal.buildActions()).toEqual(actions)
  }
)

test.each(modalRenderers)(
  '%s hoists form actions when modal actions are an empty default array',
  (_name, Renderer, renderCalls) => {
    resetRenderCalls(renderCalls)
    const actions = [{ type: 'submit', label: '保存' }]
    const body = { type: 'form', actions }
    const modal = createModal(Renderer, { body, actions: [], $schema: { body } }, {})

    modal.renderBody(modal.props.body ?? body, 'body')

    const renderedBody = renderCalls[0].body
    assertEmptyActions(renderedBody.actions)
    expect(renderedBody.wrapWithPanel).toBe(false)
    expect(body.actions).toBe(actions)
    expect(body.wrapWithPanel).toBeUndefined()
    expect(modal.state.updatedActions).toBe(null)
    expect(modal.buildActions()).toEqual(actions)
  }
)

test.each(modalRenderers)(
  '%s hoists resolved form actions when modal actions are an empty default array',
  (_name, Renderer, renderCalls) => {
    resetRenderCalls(renderCalls)
    const body = { type: 'ui-schema', schemaId: 'demo-schema' }
    const modal = createModal(Renderer, { actions: [], $schema: {} }, {})

    modal.renderBody(modal.props.body ?? body, 'body')

    const renderedBody = renderCalls[0].body
    const actions = [{ type: 'submit', label: '保存' }]
    const resolvedSchema = { type: 'form', actions }
    const normalizedSchema = renderedBody.onSchemaResolved(resolvedSchema)

    expect(normalizedSchema).not.toBe(resolvedSchema)
    assertEmptyActions(normalizedSchema.actions)
    expect(normalizedSchema.wrapWithPanel).toBe(false)
    expect(resolvedSchema.actions).toBe(actions)
    expect(resolvedSchema.wrapWithPanel).toBeUndefined()
    expect(modal.setStateCalls).toEqual([])
    expect(modal.props.store.schema.actions).toEqual(actions)
    expect(modal.buildActions()).toEqual(actions)
  }
)

test.each(modalRenderers)(
  '%s suppresses direct form actions when modal actions are explicit',
  (_name, Renderer, renderCalls) => {
    resetRenderCalls(renderCalls)
    const modalActions = [{ type: 'confirm', label: '提交' }]
    const actions = [{ type: 'submit', label: '保存' }]
    const body = { type: 'form', actions }
    const modal = createModal(Renderer, { body, actions: modalActions }, {})

    modal.renderBody(modal.props.body ?? body, 'body')

    const renderedBody = renderCalls[0].body
    assertEmptyActions(renderedBody.actions)
    expect(renderedBody.wrapWithPanel).toBe(false)
    expect(body.actions).toBe(actions)
    expect(body.wrapWithPanel).toBeUndefined()
    expect(modal.state.updatedActions).toBe(null)
    expect(modal.buildActions()).toEqual(modalActions)
  }
)

test.each(modalRenderers)(
  '%s moves root page actions to modal state',
  (_name, Renderer, renderCalls) => {
    resetRenderCalls(renderCalls)
    const actions = [{ type: 'button', label: '同意' }]
    const body = {
      type: 'page',
      body: { type: 'form', id: 'approval-form' },
      actions,
    }
    const modal = createModal(Renderer, { body }, {})

    modal.renderBody(modal.props.body ?? body, 'body')

    const renderedBody = renderCalls[0].body
    expect(renderedBody).not.toBe(body)
    assertEmptyActions(renderedBody.actions)
    assertEmptyActions(renderedBody.body.actions)
    expect(renderedBody.body.wrapWithPanel).toBe(false)
    expect(body.actions).toBe(actions)
    expect(body.body.actions).toBeUndefined()
    expect(body.body.wrapWithPanel).toBeUndefined()
    expect(modal.state.updatedActions).toBe(null)
    expect(modal.buildActions()).toEqual(actions)
  }
)

test.each(modalRenderers)(
  '%s uses actions from a loaded dialog url schema',
  (_name, Renderer, renderCalls) => {
    resetRenderCalls(renderCalls)
    const actions = [{ type: 'button', label: '同意' }]
    const store = {
      schema: {
        type: 'page',
        body: { type: 'form', id: 'approval-form' },
        actions,
      },
    }
    const modal = createModal(Renderer, { store }, {})

    expect(modal.buildActions()).toBe(actions)
  }
)

test.each(modalRenderers)(
  '%s hoists loaded schema body form actions before footer builds',
  (_name, Renderer, renderCalls) => {
    resetRenderCalls(renderCalls)
    const actions = [
      { type: 'button', label: '取消', actionType: 'close' },
      { type: 'button', label: '确定', level: 'primary' },
    ]
    const store = {
      schema: {
        title: '切换项目',
        body: {
          type: 'form',
          title: '',
          wrapWithPanel: false,
          actions,
        },
      },
    }
    const modal = createModal(Renderer, { store, actions: [] }, {})

    expect(modal.buildActions()).toEqual(actions)
    expect(store.schema.body.actions).toEqual([])
    expect(store.schema.body.wrapWithPanel).toBe(false)
  }
)

test.each(modalRenderers)(
  '%s hoists loaded schema body default form actions before footer builds',
  (_name, Renderer, renderCalls) => {
    resetRenderCalls(renderCalls)
    const store = {
      schema: {
        title: '默认表单',
        body: { type: 'form', body: [] },
      },
    }
    const modal = createModal(
      Renderer,
      { store, actions: [], translate: (key) => key },
      {}
    )

    expect(modal.buildActions()).toEqual([
      {
        type: 'submit',
        label: 'Form.submit',
        primary: true,
        loadingConfig: undefined,
      },
    ])
    expect(store.schema.body.actions).toEqual([])
    expect(store.schema.body.wrapWithPanel).toBe(false)
  }
)

test.each(modalRenderers)(
  '%s suppresses root page actions when modal actions are explicit',
  (_name, Renderer, renderCalls) => {
    resetRenderCalls(renderCalls)
    const modalActions = [{ type: 'confirm', label: '提交' }]
    const actions = [{ type: 'button', label: '同意' }]
    const body = {
      type: 'page',
      body: { type: 'form', id: 'approval-form' },
      actions,
    }
    const modal = createModal(Renderer, { body, actions: modalActions }, {})

    modal.renderBody(modal.props.body ?? body, 'body')

    const renderedBody = renderCalls[0].body
    assertEmptyActions(renderedBody.actions)
    assertEmptyActions(renderedBody.body.actions)
    expect(renderedBody.body.wrapWithPanel).toBe(false)
    expect(body.actions).toBe(actions)
    expect(body.body.actions).toBeUndefined()
    expect(body.body.wrapWithPanel).toBeUndefined()
    expect(modal.state.updatedActions).toBe(null)
    expect(modal.buildActions()).toEqual(modalActions)
  }
)

test.each(modalRenderers)(
  '%s suppresses resolved form actions when modal actions are explicit',
  (_name, Renderer, renderCalls) => {
    resetRenderCalls(renderCalls)
    const modalActions = [{ type: 'confirm', label: '提交' }]
    const body = { type: 'ui-schema', schemaId: 'demo-schema' }
    const modal = createModal(Renderer, { actions: modalActions }, {})

    modal.renderBody(modal.props.body ?? body, 'body')

    const renderedBody = renderCalls[0].body
    const actions = [{ type: 'submit', label: '保存' }]
    const resolvedSchema = { type: 'form', actions }
    const normalizedSchema = renderedBody.onSchemaResolved(resolvedSchema)

    assertEmptyActions(normalizedSchema.actions)
    expect(normalizedSchema.wrapWithPanel).toBe(false)
    expect(resolvedSchema.actions).toBe(actions)
    expect(resolvedSchema.wrapWithPanel).toBeUndefined()
    expect(modal.setStateCalls).toEqual([])
    expect(modal.buildActions()).toEqual(modalActions)
  }
)

test.each(modalRenderers)(
  '%s keeps explicit empty form actions empty',
  (_name, Renderer, renderCalls) => {
    resetRenderCalls(renderCalls)
    const actions = []
    const body = { type: 'form', actions }
    const modal = createModal(Renderer, { body }, {})

    modal.renderBody(modal.props.body ?? body, 'body')

    const renderedBody = renderCalls[0].body
    assertEmptyActions(renderedBody.actions)
    expect(renderedBody.wrapWithPanel).toBe(false)
    expect(body.actions).toBe(actions)
    expect(body.wrapWithPanel).toBeUndefined()
    expect(modal.state.updatedActions).toBe(null)
    expect(modal.buildActions()).toEqual([])
  }
)

test.each(modalRenderers)(
  '%s hoists default body form actions while disabling implicit form panel',
  (_name, Renderer, renderCalls) => {
    resetRenderCalls(renderCalls)
    const body = { type: 'form', body: [] }
    const modal = createModal(Renderer, { body, translate: (key) => key }, {})

    modal.renderBody(modal.props.body ?? body, 'body')

    const renderedBody = renderCalls[0].body
    assertEmptyActions(renderedBody.actions)
    expect(renderedBody.wrapWithPanel).toBe(false)
    expect(body.actions).toBeUndefined()
    expect(body.wrapWithPanel).toBeUndefined()
    expect(modal.state.updatedActions).toBe(null)
    expect(modal.buildActions()).toEqual([
      {
        type: 'submit',
        label: 'Form.submit',
        primary: true,
        loadingConfig: undefined,
      },
    ])
  }
)

test.each(modalRenderers)(
  '%s treats null body form actions as explicit empty actions',
  (_name, Renderer, renderCalls) => {
    resetRenderCalls(renderCalls)
    const body = { type: 'form', actions: null }
    const modal = createModal(Renderer, { body }, {})

    modal.renderBody(modal.props.body ?? body, 'body')

    const renderedBody = renderCalls[0].body
    assertEmptyActions(renderedBody.actions)
    expect(renderedBody.wrapWithPanel).toBe(false)
    expect(body.actions).toBe(null)
    expect(body.wrapWithPanel).toBeUndefined()
    expect(modal.state.updatedActions).toBe(null)
    expect(modal.buildActions()).toEqual([])
  }
)

test.each(modalRenderers)(
  '%s hoists form title and default form actions',
  (_name, Renderer, renderCalls) => {
    resetRenderCalls(renderCalls)
    const body = { type: 'form', title: '基础信息', body: [] }
    const modal = createModal(Renderer, { body }, {})

    modal.renderBody(modal.props.body ?? body, 'body')

    const renderedBody = renderCalls[0].body
    assertEmptyActions(renderedBody.actions)
    expect(renderedBody.title).toBeUndefined()
    expect(renderedBody.wrapWithPanel).toBe(false)
    expect(body.actions).toBeUndefined()
    expect(body.title).toBe('基础信息')
    expect(body.wrapWithPanel).toBeUndefined()
    expect(modal.state.updatedActions).toBe(null)
    expect(modal.props.title).toBe('基础信息')
    expect(modal.buildActions()).toEqual([
      {
        type: 'submit',
        label: 'Form.submit',
        primary: true,
        loadingConfig: undefined,
      },
    ])
  }
)

test.each(modalRenderers)(
  '%s preserves form title when panel wrapping is explicit',
  (_name, Renderer, renderCalls) => {
    resetRenderCalls(renderCalls)
    const body = { type: 'form', title: '基础信息', wrapWithPanel: true, body: [] }
    const modal = createModal(Renderer, { body }, {})

    modal.renderBody(modal.props.body ?? body, 'body')

    const renderedBody = renderCalls[0].body
    assertEmptyActions(renderedBody.actions)
    expect(renderedBody.title).toBe('基础信息')
    expect(renderedBody.wrapWithPanel).toBe(true)
    expect(body.actions).toBeUndefined()
    expect(body.title).toBe('基础信息')
    expect(body.wrapWithPanel).toBe(true)
    expect(modal.state.updatedActions).toBe(null)
    expect(modal.buildActions()).toEqual([
      {
        type: 'submit',
        label: 'Form.submit',
        primary: true,
        loadingConfig: undefined,
      },
    ])
    expect(modal.state.updatedTitle).toBeUndefined()
  }
)

test.each(modalRenderers)(
  '%s does not override an explicit modal title with form title',
  (_name, Renderer, renderCalls) => {
    resetRenderCalls(renderCalls)
    const body = { type: 'form', title: '基础信息', body: [] }
    const modal = createModal(Renderer, { body, title: '弹窗标题' }, {})

    modal.renderBody(modal.props.body ?? body, 'body')

    const renderedBody = renderCalls[0].body
    assertEmptyActions(renderedBody.actions)
    expect(renderedBody.title).toBeUndefined()
    expect(renderedBody.wrapWithPanel).toBe(false)
    expect(body.actions).toBeUndefined()
    expect(body.title).toBe('基础信息')
    expect(body.wrapWithPanel).toBeUndefined()
    expect(modal.props.title).toBe('弹窗标题')
    expect(modal.state.updatedTitle).toBeUndefined()
  }
)

test.each(modalRenderers)(
  '%s does not hoist sibling form actions',
  (_name, Renderer, renderCalls) => {
    resetRenderCalls(renderCalls)
    const actions = [{ type: 'submit', label: '保存' }]
    const body = [
      { type: 'tpl', tpl: '说明' },
      { type: 'form', actions },
    ]
    const modal = createModal(Renderer, {}, {})

    modal.renderBody(modal.props.body ?? body, 'body')

    expect(body[1].actions).toBe(actions)
    expect(body[1].wrapWithPanel).toBeUndefined()
    expect(modal.state.updatedActions).toBe(null)
  }
)

test.each(modalRenderers)(
  '%s suppresses amis-schema wrapper form actions when modal actions are explicit',
  (_name, Renderer, renderCalls) => {
    resetRenderCalls(renderCalls)
    const modalActions = [{ type: 'confirm', label: '提交' }]
    const actions = [{ type: 'submit', label: '保存' }]
    const body = {
      type: 'amis-schema',
      schemaId: 'vehicle-form',
      actions,
      wrapWithPanel: true,
      rewriteProps: {
        actions,
        wrapWithPanel: true,
      },
    }
    const modal = createModal(Renderer, { actions: modalActions }, {})

    modal.renderBody(modal.props.body ?? body, 'body')

    const renderedBody = renderCalls[0].body
    expect(renderedBody).not.toBe(body)
    assertEmptyActions(renderedBody.actions)
    expect(renderedBody.wrapWithPanel).toBe(false)
    assertEmptyActions(renderedBody.rewriteProps.actions)
    expect(renderedBody.rewriteProps.wrapWithPanel).toBe(false)
    expect(typeof renderedBody.onSchemaResolved).toBe('function')
    expect(modal.state.updatedActions).toBe(null)
    expect(modal.buildActions()).toEqual(modalActions)
  }
)

test('modal schema handler keeps wrapper actions by default', () => {
  const actions = [{ type: 'submit', label: '保存' }]
  const body = {
    type: 'amis-schema',
    schemaId: 'vehicle-form',
    actions,
    wrapWithPanel: true,
  }

  const renderedBody = withModalSchemaResolvedHandler(body, () => undefined)

  expect(renderedBody).not.toBe(body)
  expect(renderedBody.actions).toBe(actions)
  expect(renderedBody.wrapWithPanel).toBe(true)
  expect(typeof renderedBody.onSchemaResolved).toBe('function')
})

test('modal schema handler suppresses wrapper default form actions', () => {
  const actions = [{ type: 'submit', label: '保存' }]
  const body = {
    type: 'amis-schema',
    schemaId: 'vehicle-form',
    defaultProps: {
      actions,
      wrapWithPanel: true,
    },
  }

  const renderedBody = withModalSchemaResolvedHandler(body, () => undefined, true)

  expect(renderedBody).not.toBe(body)
  assertEmptyActions(renderedBody.defaultProps.actions)
  expect(renderedBody.defaultProps.wrapWithPanel).toBe(false)
  expect(renderedBody.wrapWithPanel).toBe(false)
  expect(typeof renderedBody.onSchemaResolved).toBe('function')
})

test('modal schema handler suppresses wrapper $schema form actions', () => {
  const actions = [{ type: 'submit', label: '保存' }]
  const body = {
    type: 'amis-schema',
    schemaId: 'vehicle-form',
    $schema: {
      type: 'amis-schema',
      rewriteProps: {
        actions,
        wrapWithPanel: true,
      },
    },
  }

  const renderedBody = withModalSchemaResolvedHandler(body, () => undefined, true)

  expect(renderedBody).not.toBe(body)
  expect(renderedBody.$schema).not.toBe(body.$schema)
  assertEmptyActions(renderedBody.$schema.rewriteProps.actions)
  expect(renderedBody.$schema.rewriteProps.wrapWithPanel).toBe(false)
  expect(renderedBody.wrapWithPanel).toBe(false)
})

test('form action suppression returns normalized clones for read-only schemas', () => {
  const actions = [{ type: 'submit', label: '保存' }]
  const schema = Object.freeze({ type: 'form', actions })

  const suppressed = suppressModalBodyFormActionsForRender(schema)

  expect(suppressed).not.toBe(schema)
  assertEmptyActions(suppressed.actions)
  expect(suppressed.wrapWithPanel).toBe(false)
  expect(schema.actions).toBe(actions)
})

test.each(modalRenderers)(
  '%s wires referenced schemas back through itself',
  (_name, Renderer, renderCalls) => {
    resetRenderCalls(renderCalls)
    const body = { type: 'amis-schema', schemaId: 'demo-schema' }
    const modal = createModal(Renderer, {}, {})

    modal.renderBody(modal.props.body ?? body, 'body')

    const renderedBody = renderCalls[0].body
    expect(renderedBody).not.toBe(body)
    expect(renderedBody.type).toBe('amis-schema')
    expect(typeof renderedBody.onSchemaResolved).toBe('function')

    const actions = [{ type: 'button', label: '提交' }]
    const resolvedSchema = { type: 'page', body: { type: 'form', actions } }
    const normalizedSchema = renderedBody.onSchemaResolved(resolvedSchema)

    assertEmptyActions(normalizedSchema.body.actions)
    expect(normalizedSchema.body.wrapWithPanel).toBe(false)
    expect(resolvedSchema.body.actions).toBe(actions)
    expect(resolvedSchema.body.wrapWithPanel).toBeUndefined()
    expect(modal.setStateCalls).toEqual([])
    expect(modal.props.store.schema.actions).toEqual(actions)
  }
)

test.each(modalRenderers)(
  '%s wires referenced ui schemas back through itself',
  (_name, Renderer, renderCalls) => {
    resetRenderCalls(renderCalls)
    const body = { type: 'ui-schema', schemaId: 'demo-schema' }
    const modal = createModal(Renderer, {}, {})

    modal.renderBody(modal.props.body ?? body, 'body')

    const renderedBody = renderCalls[0].body
    expect(renderedBody).not.toBe(body)
    expect(renderedBody.type).toBe('ui-schema')
    expect(typeof renderedBody.onSchemaResolved).toBe('function')

    const actions = [{ type: 'button', label: '提交' }]
    const resolvedSchema = { type: 'page', body: { type: 'form', actions } }
    const normalizedSchema = renderedBody.onSchemaResolved(resolvedSchema)

    assertEmptyActions(normalizedSchema.body.actions)
    expect(normalizedSchema.body.wrapWithPanel).toBe(false)
    expect(resolvedSchema.body.actions).toBe(actions)
    expect(resolvedSchema.body.wrapWithPanel).toBeUndefined()
    expect(modal.setStateCalls).toEqual([])
    expect(modal.props.store.schema.actions).toEqual(actions)
  }
)

test.each(modalRenderers)(
  '%s hoists default actions on resolved ui schema forms while disabling implicit panel',
  (_name, Renderer, renderCalls) => {
    resetRenderCalls(renderCalls)
    const body = { type: 'ui-schema', schemaId: 'demo-schema' }
    const modal = createModal(Renderer, {}, {})

    modal.renderBody(modal.props.body ?? body, 'body')

    const renderedBody = renderCalls[0].body
    const resolvedSchema = { type: 'form', body: [] }
    const normalizedSchema = renderedBody.onSchemaResolved(resolvedSchema)

    assertEmptyActions(normalizedSchema.actions)
    expect(normalizedSchema.wrapWithPanel).toBe(false)
    expect(resolvedSchema.actions).toBeUndefined()
    expect(resolvedSchema.wrapWithPanel).toBeUndefined()
    expect(modal.props.store.schema).toMatchObject({
      actions: [
        {
          type: 'submit',
          label: 'Form.submit',
          primary: true,
          loadingConfig: undefined,
        },
      ],
    })
  }
)

test.each(modalRenderers)(
  '%s hoists title on resolved ui schema forms',
  (_name, Renderer, renderCalls) => {
    resetRenderCalls(renderCalls)
    const body = { type: 'ui-schema', schemaId: 'demo-schema' }
    const modal = createModal(Renderer, {}, {})

    modal.renderBody(modal.props.body ?? body, 'body')

    const renderedBody = renderCalls[0].body
    const resolvedSchema = { type: 'form', title: '基础信息', body: [] }
    const normalizedSchema = renderedBody.onSchemaResolved(resolvedSchema)

    assertEmptyActions(normalizedSchema.actions)
    expect(normalizedSchema.title).toBeUndefined()
    expect(normalizedSchema.wrapWithPanel).toBe(false)
    expect(resolvedSchema.actions).toBeUndefined()
    expect(resolvedSchema.title).toBe('基础信息')
    expect(resolvedSchema.wrapWithPanel).toBeUndefined()
    expect(modal.props.store.schema).toMatchObject({
      actions: [
        {
          type: 'submit',
          label: 'Form.submit',
          primary: true,
          loadingConfig: undefined,
        },
      ],
      title: '基础信息',
    })
  }
)

test.each(modalRenderers)(
  '%s normalizes service schemaApi form responses',
  (_name, Renderer, renderCalls) => {
    resetRenderCalls(renderCalls)
    const body = {
      type: 'service',
      schemaApi: {
        method: 'get',
        url: '/api/ui-schema/demo',
        responseAdaptor:
          'return {status: payload.code === 0 ? 0 : payload.code, msg: payload.msg, data: payload.data || {}};',
      },
    }
    const modal = createModal(Renderer, {}, {})

    modal.renderBody(modal.props.body ?? body, 'body')

    const renderedBody = renderCalls[0].body
    expect(renderedBody).not.toBe(body)
    expect(renderedBody.type).toBe('service')
    expect(typeof renderedBody.schemaApi.adaptor).toBe('function')

    const actions = [{ type: 'button', label: '提交' }]
    const form = { type: 'form', actions }
    const adapted = renderedBody.schemaApi.adaptor(
      { code: 0, data: form },
      {},
      renderedBody.schemaApi,
      {}
    )

    expect(adapted.status).toBe(0)
    expect(adapted.data).not.toBe(form)
    assertEmptyActions(adapted.data.actions)
    expect(adapted.data.wrapWithPanel).toBe(false)
    expect(form.actions).toBe(actions)
    expect(form.wrapWithPanel).toBeUndefined()
    expect(modal.setStateCalls).toEqual([])
    expect(modal.props.store.schema.actions).toEqual(actions)
  }
)

test.each(modalRenderers)(
  '%s normalizes async service schemaApi form responses',
  async (_name, Renderer, renderCalls) => {
    resetRenderCalls(renderCalls)
    const body = {
      type: 'service',
      schemaApi: {
        url: '/api/ui-schema/demo',
        adaptor: async (payload) => ({ status: 0, data: payload.data }),
      },
    }
    const modal = createModal(Renderer, {}, {})

    modal.renderBody(modal.props.body ?? body, 'body')

    const renderedBody = renderCalls[0].body
    const actions = [{ type: 'button', label: '提交' }]
    const form = { type: 'form', actions }
    const adapted = await renderedBody.schemaApi.adaptor(
      { data: form },
      {},
      renderedBody.schemaApi,
      {}
    )

    expect(adapted.status).toBe(0)
    expect(adapted.data).not.toBe(form)
    assertEmptyActions(adapted.data.actions)
    expect(adapted.data.wrapWithPanel).toBe(false)
    expect(form.actions).toBe(actions)
    expect(form.wrapWithPanel).toBeUndefined()
    expect(modal.setStateCalls).toEqual([])
    expect(modal.props.store.schema.actions).toEqual(actions)
  }
)

test.each(modalRenderers)(
  '%s renders modal footer actions with merged store and form data',
  (_name, Renderer, renderCalls) => {
    resetRenderCalls(renderCalls)
    const formData = {
      comment: 'approve',
    }
    const store = {
      data: {
        taskInfo: {
          actions: ['PASS'],
        },
        flowKey: 'aa',
      },
    }
    Object.defineProperty(store, 'formData', {
      get: () => formData,
      set: () => {
        throw new Error('renderFooter must not mutate modal store formData')
      },
    })
    const modal = createModal(
      Renderer,
      {
        store,
        env: {},
        show: true,
        classnames: (...classNames) => classNames.filter(Boolean).join(' '),
        render: (region, action, props) => {
          renderCalls.push({
            kind: 'action',
            region,
            action,
            footerData: props.data,
          })
          return null
        },
      },
      {}
    )

    modal.renderFooter()

    expect(renderCalls).toHaveLength(1)
    expect(renderCalls[0].kind).toBe('action')
    expect(renderCalls[0].footerData).toMatchObject({
      taskInfo: {
        actions: ['PASS'],
      },
      flowKey: 'aa',
      comment: 'approve',
    })
    expect(store.formData).toBe(formData)
  }
)

test.each(modalRenderers)(
  '%s leaves body untouched when action sync is disabled',
  (_name, Renderer, renderCalls) => {
    resetRenderCalls(renderCalls)
    const actions = [{ type: 'submit', label: '保存' }]
    const body = { type: 'form', actions }
    const modal = createModal(Renderer, { updateActions: false }, {})

    modal.renderBody(modal.props.body ?? body, 'body')

    expect(body.actions).toBe(actions)
    expect(body.wrapWithPanel).toBeUndefined()
    expect(modal.state.updatedActions).toBe(null)
  }
)

test('AmisSchema reports resolved schema through a generic callback', async () => {
  const schema = { type: 'tpl', tpl: '内容' }
  const onSchemaResolved = vi.fn()
  const amisSchema = new AmisSchema(
    {
      env: { fetcher: vi.fn() },
      schema,
      onSchemaResolved,
    },
    {}
  )
  amisSchema.setState = vi.fn((nextState) => {
    amisSchema.state = { ...amisSchema.state, ...nextState }
  })

  amisSchema.refreshSchema()
  amisSchema.refreshSchema.flush()
  await Promise.resolve()

  expect(onSchemaResolved).toHaveBeenCalledWith(schema)
  expect(amisSchema.state.schema).toBe(schema)
})

test('modal schema normalization is pure, repeatable and honors explicit empty metadata', () => {
  const body = Object.freeze({
    type: 'form',
    title: '表单',
    actions: Object.freeze([{ type: 'submit', label: '保存' }]),
  })
  const schema = Object.freeze({ type: 'drawer', body })
  const normalized = normalizeModalSchema(schema)
  expect(normalized.title).toBe('表单')
  expect(normalized.actions).toEqual(body.actions)
  expect(normalized.body.actions).toEqual([])
  expect(normalizeModalSchema(normalized)).toEqual(normalized)
  expect(schema.body).toBe(body)
  expect(body.title).toBe('表单')
  expect(normalizeModalSchema({ ...schema, title: '', actions: [] })).toMatchObject({
    title: '',
    actions: [],
    body: { actions: [] },
  })
  const disabled = { ...schema, updateActions: false }
  expect(normalizeModalSchema(disabled)).toBe(disabled)
})

test('repeated asynchronous normalization updates metadata without replacing the loader or publishing duplicates', () => {
  const loader = { type: 'service', schemaApi: '/schema' }
  const source = { body: loader, size: 'lg' }
  const store = {
    schema: source,
    setSchema: vi.fn(function (schema) {
      this.schema = schema
    }),
  }
  const props = { $schema: { type: 'dialog', body: loader }, store }
  const first = {
    type: 'form',
    title: '第一次',
    actions: [{ type: 'submit', label: '保存' }],
  }
  const second = {
    type: 'form',
    title: '第二次',
    actions: [{ type: 'submit', label: '确认' }],
  }
  expect(resolveModalBodySchema(props, first).actions).toEqual([])
  resolveModalBodySchema(props, first)
  expect(store.setSchema).toHaveBeenCalledTimes(1)
  resolveModalBodySchema(props, second)
  expect(store.schema).toMatchObject({
    title: '第二次',
    actions: second.actions,
    size: 'lg',
  })
  expect(store.schema.body).toBe(loader)
  expect(store.setSchema).toHaveBeenCalledTimes(2)
  resetModalBodySchema(props)
  expect(store.schema).toBe(source)
  resolveModalBodySchema(props, { type: 'tpl', tpl: '无表单' })
  expect(store.schema).toBe(source)
})

test.each(modalRenderers)(
  '%s ignores resolved schemas from a previous opening or an unmounted renderer',
  (_name, Renderer, calls) => {
    resetRenderCalls(calls)
    const body = { type: 'amis-schema', schemaId: 'demo' }
    const modal = createModal(Renderer, { body, show: true })
    modal.renderBody(modal.props.body)
    const oldResolve = calls[0].body.onSchemaResolved
    modal.handleExited()
    modal.renderBody(modal.props.body)
    const currentResolve = calls[1].body.onSchemaResolved
    currentResolve({ type: 'form', title: '当前', actions: [] })
    oldResolve({ type: 'form', title: '迟到', actions: [{ type: 'submit' }] })
    expect(modal.props.store.schema.title).toBe('当前')
    modal.componentWillUnmount()
    currentResolve({ type: 'form', title: '卸载后', actions: [] })
    expect(modal.props.store.schema.title).toBe('当前')
  }
)

test.each(modalRenderers)(
  '%s retains embedded page action registration',
  (_name, Renderer) => {
    const actions = [{ type: 'button', label: '嵌入页面保存' }]
    const modal = createModal(Renderer, { body: { type: 'embed-internal' } })
    modal.setState({ updatedActions: actions })
    expect(modal.buildActions()).toEqual(actions)
  }
)

test('async metadata honors declared empty values and removes obsolete derived metadata', () => {
  const store = {
    setSchema(schema) {
      this.schema = schema
    },
  }
  const props = { $schema: { title: '', actions: [] }, store }
  const body = { type: 'form', title: '表单', body: [] }
  expect(resolveModalBodySchema(props, body).actions).toEqual([])
  expect(store.schema).toEqual({ title: '', actions: [] })
  const implicit = {
    $schema: {},
    store: {
      setSchema(schema) {
        this.schema = schema
      },
    },
  }
  resolveModalBodySchema(implicit, body)
  resolveModalBodySchema(implicit, { type: 'tpl', tpl: '无表单' })
  expect(implicit.store.schema).toEqual({})
  resetModalBodySchema(implicit)
  expect(implicit.store.schema).toBeUndefined()
})

test('AmisSchema uses a normalized copy returned by its resolver', async () => {
  const schema = Object.freeze({ type: 'form', title: '原始标题' })
  const resolved = { type: 'form', actions: [], wrapWithPanel: false }
  const renderer = new AmisSchema(
    { env: { fetcher: () => undefined }, schema, onSchemaResolved: () => resolved },
    {}
  )
  renderer.setState = (next) => {
    renderer.state = { ...renderer.state, ...next }
  }
  renderer.refreshSchema()
  renderer.refreshSchema.flush()
  await Promise.resolve()
  expect(renderer.state.schema).toBe(resolved)
  expect(schema.title).toBe('原始标题')
})

test('AmisSchema reloads when model context arrives or changes and ignores older responses', async () => {
  const responses = []
  const fetcher = vi.fn(() => new Promise(resolve => responses.push(resolve)))
  const renderer = new AmisSchema({
    schemaId: '/dev/{appName}/business-model/editor',
    data: { appName: 'crm', fullName: 'demo.Orders' },
    env: { fetcher },
  }, {})
  renderer.setState = next => { renderer.state = { ...renderer.state, ...next } }
  function refresh(data) {
    renderer.props = { ...renderer.props, data }
    renderer.refreshSchema()
    renderer.refreshSchema.flush()
  }
  refresh(renderer.props.data)
  expect(fetcher).toHaveBeenCalledTimes(1)
  refresh({ ...renderer.props.data, modelType: 'composite-view' })
  expect(fetcher).toHaveBeenCalledTimes(2)
  expect(fetcher.mock.calls[1][0].data).toMatchObject({ modelType: 'composite-view' })
  const composite = { type: 'composite-view-editor' }
  responses[1]({ status: 0, data: composite })
  await vi.waitFor(() => expect(renderer.state.schema).toEqual(composite))
  responses[0]({ status: 0, data: { type: 'default-editor' } })
  await Promise.resolve()
  await Promise.resolve()
  expect(renderer.state.schema).toEqual(composite)
  refresh(renderer.props.data)
  expect(fetcher).toHaveBeenCalledTimes(2)
  refresh({ ...renderer.props.data, fullName: 'demo.PrivateOrders' })
  expect(fetcher).toHaveBeenCalledTimes(3)
  responses[2]({ status: 0, data: composite })
  refresh({ ...renderer.props.data, appName: 'sales' })
  expect(fetcher).toHaveBeenCalledTimes(4)
  responses[3]({ status: 0, data: composite })
  await vi.waitFor(() => expect(renderer.state.schema).toEqual(composite))
  renderer.componentWillUnmount()
})
