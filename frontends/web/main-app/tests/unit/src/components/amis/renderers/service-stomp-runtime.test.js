import { beforeEach, expect, test, vi } from 'vitest'

const { subscribe, unsubscribe, dataMapping } = vi.hoisted(() => ({
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  dataMapping: vi.fn((value) => value),
}))

vi.mock('#ouroboros-host/utils/Stomp', () => ({
  subscribe,
  unsubscribe,
}))

vi.mock('amis', () => ({
  Renderer: () => (target) => target,
  dataMapping,
}))

vi.mock('amis-core', () => ({
  ServiceStore: class ServiceStore {},
  autobind: (_target, _key, descriptor) => descriptor,
  filter: vi.fn((value) => value),
  filterTarget: vi.fn((value) => value),
  isVisible: vi.fn(() => false),
}))

vi.mock('amis/lib/renderers/Service', () => {
  class MockServiceRenderer {
    constructor(props) {
      this.props = props
      this.state = {}
    }

    setState(partial) {
      this.state = { ...this.state, ...partial }
    }

    initFetch() {
      return undefined
    }

    componentDidUpdate() {
      return undefined
    }

    componentWillUnmount() {
      return undefined
    }

    afterDataFetch() {
      return undefined
    }

    openFeedback() {
      return Promise.resolve()
    }

    reloadTarget() {
      return undefined
    }
  }

  MockServiceRenderer.ComposedComponent = MockServiceRenderer

  return {
    ServiceRenderer: MockServiceRenderer,
  }
})

const serviceModule = await import(
  '../../../../../../../ouroboros-amis-runtime/src/renderers/patch/Service.tsx'
)
const OuroborosService = serviceModule.default

const createStore = (dataOverrides = {}) => ({
  data: {
    preserve: 'from-store',
    keepField: 'keep-me',
    imageState: {
      reference: 'registry.example.com/helper:1.0.0',
      updateRecommended: true,
    },
    ...dataOverrides,
  },
  updateData: vi.fn(),
  setCurrentAction: vi.fn(),
  saveRemote: vi.fn(() => Promise.resolve({})),
})

const createProps = (overrides = {}) => ({
  data: {
    preserve: 'from-props',
    imageState: {
      reference: 'registry.example.com/helper:0.9.0',
      updateRecommended: true,
    },
  },
  stomp: {
    url: '/topic/dev-helper/demo',
    responseKey: 'runtimeEvent',
  },
  store: createStore(),
  dispatchEvent: vi.fn(async () => ({ prevented: false })),
  onAction: vi.fn(),
  resolveDefinitions: vi.fn(),
  env: {
    jumpTo: vi.fn(),
  },
  translate: vi.fn((value) => value),
  ...overrides,
})

beforeEach(() => {
  subscribe.mockReset()
  unsubscribe.mockReset()
  dataMapping.mockReset()
  dataMapping.mockImplementation((value) => value)
  subscribe.mockReturnValue(undefined)
})

test('stomp object payload merges into current store data', () => {
  const props = createProps()
  const service = new OuroborosService(props)

  service.stompListener({
    status: 'running',
    refreshPending: false,
    imageState: {
      reference: 'registry.example.com/helper:1.1.0',
      updateRecommended: false,
    },
  })

  expect(props.store.updateData).toHaveBeenCalledTimes(1)
  expect(props.store.updateData).toHaveBeenCalledWith({
    preserve: 'from-store',
    keepField: 'keep-me',
    status: 'running',
    refreshPending: false,
    imageState: {
      reference: 'registry.example.com/helper:1.1.0',
      updateRecommended: false,
    },
  })
})

test('stomp json string payload is parsed before updating the store', () => {
  const props = createProps()
  const service = new OuroborosService(props)

  service.stompListener(
    JSON.stringify({
      updateRecommended: false,
      lastLoadTime: '2026-06-05T10:00:00',
      imageState: {
        reference: 'registry.example.com/helper:1.1.0',
        updateRecommended: false,
      },
    })
  )

  expect(props.store.updateData).toHaveBeenCalledTimes(1)
  expect(props.store.updateData).toHaveBeenCalledWith({
    preserve: 'from-store',
    keepField: 'keep-me',
    updateRecommended: false,
    lastLoadTime: '2026-06-05T10:00:00',
    imageState: {
      reference: 'registry.example.com/helper:1.1.0',
      updateRecommended: false,
    },
  })
})

test('later stomp payload overwrites helper status fields in store data', () => {
  const props = createProps({
    store: createStore({
      status: 'launching',
      refreshPending: true,
    }),
  })
  const service = new OuroborosService(props)

  service.stompListener({
    status: 'running',
    refreshPending: false,
    lastLoadTime: '2026-06-07T08:00:00',
  })

  expect(props.store.updateData).toHaveBeenCalledTimes(1)
  expect(props.store.updateData).toHaveBeenCalledWith({
    preserve: 'from-store',
    keepField: 'keep-me',
    status: 'running',
    refreshPending: false,
    lastLoadTime: '2026-06-07T08:00:00',
    imageState: {
      reference: 'registry.example.com/helper:1.0.0',
      updateRecommended: true,
    },
  })
})

test('null-valued stomp payload clears stale helper fields in store data', () => {
  const props = createProps({
    store: createStore({
      lastLoadTime: '2026-06-05T10:00:00',
      runtimeGeneration: 7,
    }),
  })
  const service = new OuroborosService(props)

  service.stompListener({
    status: 'launching',
    lastLoadTime: null,
    runtimeGeneration: null,
  })

  expect(props.store.updateData).toHaveBeenCalledTimes(1)
  expect(props.store.updateData).toHaveBeenCalledWith({
    preserve: 'from-store',
    keepField: 'keep-me',
    status: 'launching',
    lastLoadTime: null,
    runtimeGeneration: null,
    imageState: {
      reference: 'registry.example.com/helper:1.0.0',
      updateRecommended: true,
    },
  })
})

test('stomp primitive payload uses responseKey when payload is not an object', () => {
  const props = createProps({
    store: createStore({
      status: 'running',
    }),
  })
  const service = new OuroborosService(props)

  service.stompListener('helper-recreated')

  expect(props.store.updateData).toHaveBeenCalledTimes(1)
  expect(props.store.updateData).toHaveBeenCalledWith({
    preserve: 'from-store',
    keepField: 'keep-me',
    status: 'running',
    imageState: {
      reference: 'registry.example.com/helper:1.0.0',
      updateRecommended: true,
    },
    runtimeEvent: 'helper-recreated',
  })
})

test('service subscription forwards keepSingleListener and tears down its own listener only', () => {
  const unsubscribeHandle = vi.fn()
  subscribe.mockReturnValue(unsubscribeHandle)
  const props = createProps({
    keepSingleListener: false,
  })
  const service = new OuroborosService(props)

  service.initFetch()

  expect(subscribe).toHaveBeenCalledTimes(1)
  expect(subscribe).toHaveBeenCalledWith(
    '/topic/dev-helper/demo',
    service.stompListener,
    false
  )

  service.componentWillUnmount()

  expect(unsubscribeHandle).toHaveBeenCalledTimes(1)
  expect(unsubscribe).not.toHaveBeenCalled()
})
