import { afterEach, beforeEach, expect, test, vi } from 'vitest'

const {
  send,
  subscribe,
  unsubscribe,
  isConnected,
  onStompConnected,
  offConnected,
  dataMapping,
  listeners,
} = vi.hoisted(() => {
  const listeners = []
  return {
    send: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
    unsubscribe: vi.fn(),
    isConnected: vi.fn(() => false),
    onStompConnected: vi.fn((handler) => {
      listeners.push(handler)
      return () => {
        const index = listeners.indexOf(handler)
        if (index >= 0) {
          listeners.splice(index, 1)
        }
      }
    }),
    offConnected: () => listeners.splice(0, listeners.length),
    dataMapping: vi.fn((value) => value),
    listeners,
  }
})

vi.mock('#ouroboros-host/utils/Stomp', () => ({
  send,
  subscribe,
  unsubscribe,
  isConnected,
  onStompConnected,
  isStompInitDestination: vi.fn((value) =>
    /^\/app\/app\/[^/\\.\s]+\/((?:[^/\\.\s]+\/)*[^/\\.\s]+)\/init$/.test(value)
  ),
}))

vi.mock('amis', () => ({
  Renderer: () => (target) => target,
  isApiOutdated: vi.fn(),
  isEffectiveApi: vi.fn(() => false),
  resolveVariableAndFilter: vi.fn((value) => value),
  dataMapping,
  VirtualList: vi.fn(),
  Icon: vi.fn(),
  SearchBox: vi.fn(),
}))

vi.mock('amis/lib/renderers/Log', () => {
  class MockLog {
    constructor(props) {
      this.props = props
      this.autoScroll = false
      this.logRef = { current: null }
      this.logs = []
      this.lastLine = ''
      this.state = {}
    }

    setState(partial, callback) {
      this.state = { ...this.state, ...partial }
      callback?.()
    }

    addLines(lines = []) {
      if (!lines.length) {
        return undefined
      }

      const nextLines = [...lines]
      if (this.lastLine) {
        nextLines[0] = `${this.lastLine}${nextLines[0]}`
      }

      const nextLastLine = nextLines.pop() ?? ''
      const nextLogs = this.logs.concat(nextLines)

      this.logs = nextLogs
      this.lastLine = nextLastLine
      this.setState({
        logs: nextLogs,
        lastLine: nextLastLine,
        originLogs: nextLogs,
        originLastLine: nextLastLine,
      })
      return undefined
    }
    loadLogs() {
      return undefined
    }
    clear() {
      return undefined
    }
    componentWillUnmount() {
      return undefined
    }
  }

  return {
    Log: MockLog,
  }
})

const logModule = await import(
  '../../../../../../../ouroboros-amis-runtime/src/renderers/patch/Log.tsx'
)
const OuroborosLog = logModule.default

const advanceLogBatchWindow = () => vi.advanceTimersByTimeAsync(20)

const createScrollContainer = () => ({
  addEventListener: vi.fn(),
  scrollTo: vi.fn(),
  scrollTop: 0,
  scrollHeight: 480,
})

const createAutoScrollLog = (props = {}) => {
  const log = new OuroborosLog(props)
  const logRef = createScrollContainer()

  log.autoScroll = true
  log.pauseOrResumeScrolling = vi.fn()
  log.logRef.current = logRef

  return { log, logRef }
}

const collectTitles = (node, titles = []) => {
  if (!node) {
    return titles
  }

  if (Array.isArray(node)) {
    node.forEach((child) => collectTitles(child, titles))
    return titles
  }

  if (typeof node !== 'object') {
    return titles
  }

  if (node.props?.title) {
    titles.push(node.props.title)
  }

  if (node.props?.children) {
    collectTitles(node.props.children, titles)
  }

  return titles
}

beforeEach(() => {
  send.mockReset()
  subscribe.mockReset()
  unsubscribe.mockReset()
  isConnected.mockReset()
  onStompConnected.mockReset()
  dataMapping.mockReset()
  offConnected()

  subscribe.mockReturnValue(vi.fn())
  isConnected.mockReturnValue(false)
  dataMapping.mockImplementation((value) => value)
})

afterEach(() => {
  vi.useRealTimers()
})

test('app logs use subscribe with initial options for live topic and init queue', () => {
  const log = new OuroborosLog({ keepSingleListener: true })

  log.subscribeStomp('/user/queue/app/crm/logs')

  expect(subscribe).toHaveBeenCalledTimes(1)
  expect(subscribe).toHaveBeenCalledWith(
    '/user/queue/app/crm/logs',
    log.stompListener,
    expect.objectContaining({
      keepSingleListener: true,
      initialBody: {},
    })
  )
  expect(send).not.toHaveBeenCalled()
  expect(onStompConnected).toHaveBeenCalledTimes(1)
  expect(log.state.subscribedTopic).toBe('/user/queue/app/crm/logs')
  expect(log.subscribedDestination).toBe('/user/queue/app/crm/logs')
})

test('init bootstrap destinations reject malformed values before replacing existing subscriptions', () => {
  const log = new OuroborosLog({ keepSingleListener: true })
  log.unsubscribeStomp = vi.fn()

  expect(() =>
    log.subscribeStomp('/user/queue/app/crm/logs', '/app/app/../logs/init')
  ).toThrow('合法的 init destination')

  expect(log.unsubscribeStomp).not.toHaveBeenCalled()
  expect(subscribe).not.toHaveBeenCalled()
  expect(send).not.toHaveBeenCalled()
})

test('init bootstrap flows clear existing lines before reconnect replay', () => {
  const log = new OuroborosLog({ keepSingleListener: true })
  log.clear = vi.fn()

  log.subscribeStomp('/user/queue/app/crm/logs')

  expect(onStompConnected).toHaveBeenCalledTimes(1)
  listeners[0]({ isReconnect: true })
  expect(log.clear).toHaveBeenCalledTimes(1)

  listeners[0]({ isReconnect: false })
  expect(log.clear).toHaveBeenCalledTimes(1)
})

test('helper logs use subscribe with initial options for helper init queue', () => {
  const log = new OuroborosLog({ keepSingleListener: false })

  log.subscribeStomp('/user/queue/app/crm/helper/logs')

  expect(subscribe).toHaveBeenCalledTimes(1)
  expect(subscribe).toHaveBeenCalledWith(
    '/user/queue/app/crm/helper/logs',
    log.stompListener,
    expect.objectContaining({
      keepSingleListener: false,
      initialBody: {},
    })
  )
  expect(send).not.toHaveBeenCalled()
  expect(onStompConnected).toHaveBeenCalledTimes(1)
  expect(log.state.subscribedTopic).toBe('/user/queue/app/crm/helper/logs')
  expect(log.subscribedDestination).toBe('/user/queue/app/crm/helper/logs')
})

test('log replay still sends immediately when stomp is already connected', () => {
  isConnected.mockReturnValue(true)
  const log = new OuroborosLog({ keepSingleListener: true })

  log.subscribeStomp('/topic/helper/logs', '/app/helper/logs/replay')

  expect(send).toHaveBeenCalledTimes(1)
  expect(send).toHaveBeenCalledWith('/app/helper/logs/replay', {})
  expect(onStompConnected).not.toHaveBeenCalled()
})

test('log renderer subscribes once stomp topic and replay destination become available after mount', () => {
  dataMapping.mockImplementation((value, data) => {
    if (typeof value !== 'string') {
      return value
    }
    if (value.includes('${appName}') && !data?.appName) {
      return ''
    }
    return value.replace('${appName}', data?.appName ?? '')
  })

  const log = new OuroborosLog({
    keepSingleListener: true,
    stomp: '/user/queue/app/${appName}/helper/logs',
    data: {},
  })

  log.componentDidMount()

  expect(subscribe).not.toHaveBeenCalled()
  expect(log.state.subscribedTopic).toBeNull()

  log.props = {
    ...log.props,
    data: {
      appName: 'crm',
    },
  }
  log.componentDidUpdate({
    keepSingleListener: true,
    stomp: '/user/queue/app/${appName}/helper/logs',
    data: {},
  })

  expect(subscribe).toHaveBeenCalledTimes(1)
  expect(subscribe).toHaveBeenCalledWith(
    '/user/queue/app/crm/helper/logs',
    log.stompListener,
    expect.objectContaining({
      keepSingleListener: true,
      initialBody: {},
    })
  )
  expect(onStompConnected).toHaveBeenCalledTimes(1)
  expect(send).not.toHaveBeenCalled()
  expect(log.state.subscribedTopic).toBe('/user/queue/app/crm/helper/logs')
})

test('log renderer does not reset subscribed topic while replacing an active subscription', () => {
  const log = new OuroborosLog({
    keepSingleListener: false,
    stomp: '/user/queue/app/crm/logs',
    data: {},
  })
  const originalSetState = log.setState.bind(log)
  const setStateSpy = vi.fn((partial, callback) => originalSetState(partial, callback))
  log.setState = setStateSpy

  log.componentDidMount()

  expect(log.state.subscribedTopic).toBe('/user/queue/app/crm/logs')
  expect(subscribe).toHaveBeenCalledTimes(1)

  log.componentDidUpdate({
    keepSingleListener: false,
    stomp: '/user/queue/app/crm/logs',
    data: {},
  })

  expect(subscribe).toHaveBeenCalledTimes(1)
  expect(setStateSpy).not.toHaveBeenCalledWith({ subscribedTopic: null })
})

test('log renderer shows connected state once stomp subscription lifecycle has started', () => {
  const log = new OuroborosLog({
    keepSingleListener: true,
    stomp: '/topic/helper/logs',
    subscribeDestination: '/app/helper/logs/replay',
    data: {},
    placeholder: '加载中',
    classnames: (value) => value,
  })

  log.pendingSubscribeDestination = '/app/helper/logs/replay'
  log.subscribedDestination = '/app/helper/logs/replay'

  const rendered = log.render()
  const body = rendered.props.children[1]

  expect(body.props.children.type).toBe('div')
  expect(body.props.children.props.children.type).toBe('span')
  expect(body.props.children.props.children.props.children).toBe('已连接')
})

test('auto-scroll binds a scroll listener on mount and keeps the container pinned on update', () => {
  const { log, logRef } = createAutoScrollLog()

  log.componentDidMount()

  expect(logRef.addEventListener).toHaveBeenCalledTimes(1)
  expect(logRef.addEventListener).toHaveBeenCalledWith('scroll', log.pauseOrResumeScrolling)
  expect(logRef.scrollTop).toBe(0)

  logRef.scrollHeight = 640

  log.componentDidUpdate({ keepSingleListener: true })

  expect(logRef.scrollTop).toBe(640)
})

test('manual scroll away from bottom stops later batch flushes from re-pinning', async () => {
  vi.useFakeTimers()

  const { log, logRef } = createAutoScrollLog()
  logRef.scrollTop = 120
  logRef.scrollHeight = 480

  log.componentDidMount()
  expect(logRef.addEventListener).toHaveBeenCalledWith('scroll', log.pauseOrResumeScrolling)

  log.pauseOrResumeScrolling.mockImplementation(() => {
    log.autoScroll = false
  })

  logRef.addEventListener.mock.calls[0][1]()

  logRef.scrollHeight = 960
  log.stompListener('user-scrolled-away\nnext-chunk')

  await advanceLogBatchWindow()
  log.componentDidUpdate({ keepSingleListener: true })

  expect(log.autoScroll).toBe(false)
  expect(logRef.scrollTop).toBe(120)
})

test('operation gates scrollToBottom visibility', () => {
  const hidden = new OuroborosLog({
    keepSingleListener: true,
    operation: ['stop'],
    data: {},
    classnames: (value) => value,
    translate: (value) => value,
  })

  const hiddenOperationTitles = collectTitles(hidden.render().props.children[0])
  expect(hiddenOperationTitles).not.toContain('滚动到底部')

  const visible = new OuroborosLog({
    keepSingleListener: true,
    operation: ['stop', 'scrollToBottom'],
    data: {},
    classnames: (value) => value,
    translate: (value) => value,
  })

  const visibleOperationTitles = collectTitles(visible.render().props.children[0])
  expect(visibleOperationTitles).toContain('滚动到底部')
})

test('scrollToBottom scrolls the log container to its current bottom', () => {
  const { log, logRef } = createAutoScrollLog()
  logRef.scrollHeight = 960

  log.scrollToBottom()

  expect(logRef.scrollTo).toHaveBeenCalledTimes(1)
  expect(logRef.scrollTo).toHaveBeenCalledWith({
    top: 960,
    behavior: 'smooth',
  })
})

test('stomp listener batches rapid bootstrap and live chunks without breaking order or lastLine semantics', async () => {
  vi.useFakeTimers()
  const log = new OuroborosLog({ keepSingleListener: true })
  const originalSetState = log.setState.bind(log)
  const setStateSpy = vi.fn((partial, callback) => originalSetState(partial, callback))
  log.setState = setStateSpy

  log.stompListener('boot-1\nboot-2\npar')
  log.stompListener('tial\nlive-1')

  expect(setStateSpy).not.toHaveBeenCalled()

  await advanceLogBatchWindow()

  expect(setStateSpy).toHaveBeenCalledTimes(1)
  expect(log.state.logs).toEqual(['boot-1', 'boot-2', 'partial'])
  expect(log.state.lastLine).toBe('live-1')
})

test('stomp listener can flush the first chunk before amis log fields are initialized', async () => {
  vi.useFakeTimers()
  const log = new OuroborosLog({ keepSingleListener: true })

  log.logs = undefined
  log.lastLine = undefined

  log.stompListener('first-line\nsecond-line')

  await advanceLogBatchWindow()

  expect(log.state.logs).toEqual(['first-line'])
  expect(log.state.lastLine).toBe('second-line')
})

test.each([
  ['clear', (log) => log.clear()],
  ['refresh', (log) => log.refresh({ preventDefault: vi.fn() })],
  ['unsubscribeStomp', (log) => log.unsubscribeStomp()],
  ['componentWillUnmount', (log) => log.componentWillUnmount()],
])('%s drops queued log chunks before the scheduled flush', async (_name, invokeBoundary) => {
  vi.useFakeTimers()
  const log = new OuroborosLog({ keepSingleListener: true })

  log.stompListener('stale-buffered-line')
  invokeBoundary(log)

  await advanceLogBatchWindow()

  expect(log.state.logs).toEqual([])
  expect(log.state.lastLine).toBe('')
})

test('reconnect clears queued log chunks before they can reflow', async () => {
  vi.useFakeTimers()
  const log = new OuroborosLog({ keepSingleListener: true })

  log.subscribeStomp('/user/queue/app/crm/logs')
  log.stompListener('stale-buffered-line')
  listeners[0]({ isReconnect: true })

  await advanceLogBatchWindow()

  expect(log.state.logs).toEqual([])
  expect(log.state.lastLine).toBe('')
})

test('stopped logs stay frozen until restart and then resume normally', async () => {
  vi.useFakeTimers()
  const log = new OuroborosLog({ keepSingleListener: true })

  log.refresh({ preventDefault: vi.fn() })
  expect(log.state.refresh).toBe(false)

  log.stompListener('paused-1\npaused-2')
  await advanceLogBatchWindow()

  expect(log.state.logs).toEqual([])
  expect(log.state.lastLine).toBe('')

  log.refresh({ preventDefault: vi.fn() })
  expect(log.state.refresh).toBe(true)

  log.stompListener('resumed-1\nresumed-2')
  await advanceLogBatchWindow()

  expect(log.state.logs).toEqual(['resumed-1'])
  expect(log.state.lastLine).toBe('resumed-2')
})
