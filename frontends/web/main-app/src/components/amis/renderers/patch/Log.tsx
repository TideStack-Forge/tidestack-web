import {
  isConnected,
  onStompConnected,
  send,
  isStompInitDestination,
  subscribe,
  unsubscribe,
} from '@/utils/Stomp'
import {
  Renderer,
  isApiOutdated,
  isEffectiveApi,
  resolveVariableAndFilter,
  dataMapping,
  VirtualList,
  Icon,
  SearchBox,
} from 'amis'
import { LogProps, Log, LogState } from 'amis/lib/renderers/Log'

const LOG_BATCH_WINDOW_MS = 16

interface OuroborosLogState extends LogState {
  subscribedTopic: string | null
  initialLogs: string[]
}

@Renderer({ type: 'log', name: 'OuroborosLog', weight: -200, override: true })
export default class OuroborosLog extends Log {
  unsubscribeFunc = function () {} // 声明 unsubscribeFunc 方法
  unsubscribeConnectedFunc = function () {}
  pendingSubscribeDestination = ''
  subscribedDestination = ''
  logLineBuffer: string[][] = []
  flushLogLineBufferTimer: ReturnType<typeof setTimeout> | null = null

  constructor(props: any) {
    super(props)

    this.unsubscribeFunc = function () {}
    this.unsubscribeConnectedFunc = function () {}
  }

  state: OuroborosLogState = {
    lastLine: '',
    logs: [],
    originLastLine: '',
    originLogs: [],
    refresh: true,
    showLineNumber: false,
    filterWord: '',
    subscribedTopic: null,
    initialLogs: [],
  }

  componentDidMount() {
    if (this.autoScroll && this.logRef && this.logRef.current) {
      this.logRef.current.addEventListener('scroll', this.pauseOrResumeScrolling)
    }

    if (this.props.source) {
      this.setState({
        initialLogs: dataMapping(this.props.source, this.props.data) || [],
      } as any)
    }
    // 如果是stomp，则订阅，并不处理source
    const stomp = this.props.stomp
    if (stomp) {
      const stompTopic = dataMapping(stomp, this.props.data)
      this.subscribeStomp(stompTopic, this.getSubscribeDestination())
      return
    }

    const source = this.props.source
    if (source) {
      const ret =
        typeof source === 'string'
          ? resolveVariableAndFilter(source, this.props.data, '| raw')
          : source
      if (ret && isEffectiveApi(ret)) {
        this.loadLogs()
      } else if (
        typeof ret === 'string' ||
        (Array.isArray(ret) && ret.every((item) => typeof item === 'string'))
      ) {
        this.clear()
        this.addLines(Array.isArray(ret) ? ret : [ret])
      }
    }
  }

  componentDidUpdate(prevProps: LogProps) {
    if (this.autoScroll && this.logRef && this.logRef.current) {
      this.logRef.current.scrollTop = this.logRef.current.scrollHeight
    }

    // 如果是stomp，且stomp配置发生变化，则重新订阅，并不处理source
    if (this.props.stomp) {
      const stompTopic = dataMapping(this.props.stomp, this.props.data)
      const subscribeDestination = this.getSubscribeDestination()
      const nextSubscribedDestination =
        !subscribeDestination && this.usesInferredInitBootstrap(stompTopic)
          ? stompTopic
          : subscribeDestination
      if (
        stompTopic &&
        (stompTopic !== this.state.subscribedTopic ||
          nextSubscribedDestination !== this.subscribedDestination)
      ) {
        this.subscribeStomp(stompTopic, subscribeDestination)
      }
      return
    }

    const source = this.props.source
    if (!source) {
      return
    }

    const ret =
      typeof source === 'string'
        ? resolveVariableAndFilter(source, this.props.data, '| raw')
        : source

    if (ret && isEffectiveApi(ret)) {
      // todo 如果原来的请求还在，应该先取消
      isApiOutdated(
        prevProps.source,
        this.props.source,
        prevProps.data,
        this.props.data
      ) && this.loadLogs()
    } else if (
      typeof ret === 'string' ||
      (Array.isArray(ret) && ret.every((item) => typeof item === 'string'))
    ) {
      const prevRet = resolveVariableAndFilter(prevProps.source, prevProps.data, '| raw')
      if (prevRet !== ret && ret) {
        this.clear()
        this.addLines(Array.isArray(ret) ? ret : [ret])
      }
    }
  }

  componentWillUnmount(): void {
    this.resetBufferedLines()
    this.unsubscribeStomp()
    super.componentWillUnmount()
  }

  getSubscribeDestination(
    subscribeDestination = this.props.initDestination ?? this.props.subscribeDestination,
    data = this.props.data
  ) {
    if (!subscribeDestination) {
      return ''
    }
    return dataMapping(subscribeDestination, data)
  }

  subscribeStomp(topic: string, subscribeDestination: string = '') {
    if (!topic) {
      return
    }

    const { keepSingleListener = true } = this.props
    const useExplicitInitBootstrap = this.usesInitBootstrap(subscribeDestination)
    const useInferredInitBootstrap = !subscribeDestination && this.usesInferredInitBootstrap(topic)

    if (
      this.looksLikeInitBootstrapDestination(subscribeDestination) &&
      !useExplicitInitBootstrap
    ) {
      throw new Error(`init 需要合法的 init destination: ${subscribeDestination}`)
    }

    this.unsubscribeStomp(false)
    if (useExplicitInitBootstrap || useInferredInitBootstrap) {
      const unsubscribe = subscribe(topic, this.stompListener, {
        keepSingleListener,
        ...(useExplicitInitBootstrap ? { initialDestination: subscribeDestination } : {}),
        initialBody: {},
      })
      this.unsubscribeFunc = unsubscribe
      this.unsubscribeConnectedFunc = onStompConnected(({ isReconnect }) => {
        if (isReconnect) {
          this.clear()
        }
      })
      this.setState({ subscribedTopic: topic } as any)
      this.subscribedDestination = subscribeDestination || topic
      return
    }

    this.unsubscribeFunc =
      subscribe(topic, this.stompListener, keepSingleListener) || function () {}
    this.setState({ subscribedTopic: topic } as any)
    this.subscribedDestination = subscribeDestination
    this.triggerSubscribeReplay(subscribeDestination)
  }

  usesInitBootstrap(subscribeDestination: string) {
    return !!subscribeDestination && isStompInitDestination(subscribeDestination)
  }

  usesInferredInitBootstrap(topic: string) {
    return /^\/user\/queue\/app\/[^/]+(?:\/[^/]+)*\/logs$/.test(topic)
  }

  looksLikeInitBootstrapDestination(subscribeDestination: string) {
    return (
      !!subscribeDestination &&
      subscribeDestination.startsWith('/app/') &&
      subscribeDestination.endsWith('/init')
    )
  }

  triggerSubscribeReplay(subscribeDestination: string) {
    if (!subscribeDestination) {
      return
    }

    if (isConnected()) {
      this.pendingSubscribeDestination = ''
      send(subscribeDestination, {})
      return
    }

    this.pendingSubscribeDestination = subscribeDestination
    this.unsubscribeConnectedFunc = onStompConnected(() => {
      const destination = this.pendingSubscribeDestination
      this.pendingSubscribeDestination = ''
      this.unsubscribeConnectedFunc()
      this.unsubscribeConnectedFunc = function () {}
      if (destination) {
        send(destination, {})
      }
    })
  }

  stompListener = (message: string) => {
    this.enqueueBufferedLines(message.split('\n'))
  }

  unsubscribeStomp(resetSubscribedState = true) {
    this.resetBufferedLines()
    this.unsubscribeFunc?.()
    this.unsubscribeConnectedFunc?.()
    this.unsubscribeConnectedFunc = function () {}
    this.pendingSubscribeDestination = ''
    this.subscribedDestination = ''
    if (resetSubscribedState) {
      this.setState({ subscribedTopic: null } as any)
    }
  }

  clear = (e?: React.MouseEvent<HTMLElement>) => {
    this.resetBufferedLines()
    this.setState({
      logs: (this.logs = []),
      lastLine: (this.lastLine = ''),
      originLogs: [],
      originLastLine: '',
      initialLogs: [],
    } as any)
    e?.preventDefault()
  }

  refresh = (e: React.MouseEvent<HTMLElement>) => {
    this.resetBufferedLines()
    const origin = this.state.refresh
    this.setState({
      refresh: !origin,
    })
    if (!origin) {
      this.clear(e)
      this.state.subscribedTopic || this.loadLogs()
    }
    e.preventDefault()
  }

  enqueueBufferedLines(lines: string[]) {
    if (!lines.length) {
      return
    }

    if (!this.state.refresh) {
      return
    }

    this.logLineBuffer.push(lines)
    if (this.flushLogLineBufferTimer !== null) {
      return
    }

    this.flushLogLineBufferTimer = setTimeout(() => {
      this.flushLogLineBufferTimer = null
      this.flushBufferedLines()
    }, LOG_BATCH_WINDOW_MS)
  }

  flushBufferedLines() {
    if (!this.state.refresh) {
      this.logLineBuffer = []
      return
    }

    const bufferedLines = this.logLineBuffer
    if (!bufferedLines.length) {
      return
    }

    this.logLineBuffer = []

    let nextLogs = this.logs || this.state.logs || []
    let nextLastLine = this.lastLine || this.state.lastLine || ''

    bufferedLines.forEach((lines) => {
      if (!lines.length) {
        return
      }

      const nextLines = [...lines]
      if (nextLastLine) {
        nextLines[0] = `${nextLastLine}${nextLines[0]}`
      }

      nextLastLine = nextLines.pop() ?? ''
      nextLogs = nextLogs.concat(nextLines)
    })

    this.logs = nextLogs
    this.lastLine = nextLastLine
    this.setState({
      logs: nextLogs,
      lastLine: nextLastLine,
      originLogs: nextLogs,
      originLastLine: nextLastLine,
    } as any)
  }

  resetBufferedLines() {
    this.logLineBuffer = []
    if (this.flushLogLineBufferTimer !== null) {
      clearTimeout(this.flushLogLineBufferTimer)
      this.flushLogLineBufferTimer = null
    }
  }

  scrollToBottom = () => {
    if (!this.logRef || !this.logRef.current) return
    this.logRef.current.scrollTo({
      top: this.logRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }


  render() {
    const {
      source,
      className,
      style,
      classnames: cx,
      placeholder,
      height,
      rowHeight,
      disableColor,
      translate: __,
      operation,
      autoHeight,
      stomp,
    } = this.props

    const { refresh, showLineNumber, initialLogs } = this.state
    const hasStompSubscription =
      this.state.subscribedTopic || this.subscribedDestination || this.pendingSubscribeDestination

    let loading = hasStompSubscription && initialLogs.length === 0 ? (
        <div className={'cxd-Log-line'}>
          <span style={{ color: 'green' }}>已连接</span>
        </div>
      ) : (
        __(placeholder)
      )

    if (!stomp && !source) {
      loading = __('Log.mustHaveSource')
    }
    let lines: any

    const logs = this.state.lastLine
      ? this.state.logs.concat([this.state.lastLine])
      : initialLogs.concat(this.state.logs)

    // 如果设置 rowHeight 就开启延迟渲染
    const useVirtualRender = rowHeight
    if (useVirtualRender) {
      lines = (
        // @ts-ignore
        <VirtualList
          height={height as number}
          itemCount={logs.length}
          itemSize={rowHeight}
          renderItem={({ index, style }) => (
            <div
              className={cx('Log-line')}
              key={index}
              style={{ ...style, whiteSpace: 'nowrap' }}>
              {showLineNumber && (
                <span className={cx('Log-line-number')}>{index + 1} </span>
              )}
              {this.renderHighlightWord(logs[index])}
            </div>
          )}
        />
      )
    } else {
      lines = logs.map((line, index) => {
        return this.renderLine(index, line, showLineNumber)
      })
    }

    const additionalClass = autoHeight ? 'flex flex-col' : ''
    const opAdditionalClass = autoHeight ? 'flex-grow-0' : ''
    const bodyAdditionalClass = autoHeight ? 'flex-grow' : ''
    // @ts-ignore
    return (
      <div className={cx('Log', additionalClass, className)} style={style}>
        <div className={cx('Log-operation', opAdditionalClass)}>
          {operation && operation?.length > 0 && (
            <>
              {operation.includes('stop') && (
                <a
                  title={__('stop')}
                  className={!refresh ? 'is-disabled' : ''}
                  onClick={this.refresh}>
                  <Icon icon="pause" />
                </a>
              )}

              {operation.includes('restart') && (
                <a
                  title={__('reload')}
                  className={refresh ? 'is-disabled' : ''}
                  onClick={this.refresh}>
                  <Icon icon="refresh" />
                </a>
              )}

              {operation.includes('showLineNumber') && (
                <a
                  title={
                    showLineNumber
                      ? __('Log.notShowLineNumber')
                      : __('Log.showLineNumber')
                  }
                  onClick={(e) => {
                    this.setState({ showLineNumber: !showLineNumber })
                    e.preventDefault()
                  }}>
                  <Icon icon={showLineNumber ? 'invisible' : 'view'} />
                </a>
              )}

              {operation.includes('clear') && (
                <a onClick={this.clear} title={__('clear')}>
                  <Icon icon="remove" />
                </a>
              )}

              {operation && operation.includes('filter') && (
                <SearchBox
                  className={cx('Log-filter-box')}
                  placeholder="过滤词"
                  onChange={(value: any) =>
                    this.filterWord(this.state.originLogs, this.state.lastLine, value)
                  }
                  value={this.state.filterWord}
                />
              )}

              {operation && (operation as string[]).includes('scrollToBottom') && (
                <a onClick={this.scrollToBottom} title="滚动到底部">
                  <Icon icon="fa fa-arrow-down" style={{ marginRight: '8px' }} />
                </a>
              )}
            </>
          )}
        </div>
        <div
          ref={this.logRef}
          className={cx('Log-body', bodyAdditionalClass)}
          style={{ height: useVirtualRender ? 'auto' : height }}>
          {useVirtualRender ? lines : lines.length ? lines : loading}
        </div>
      </div>
    )
  }
}
