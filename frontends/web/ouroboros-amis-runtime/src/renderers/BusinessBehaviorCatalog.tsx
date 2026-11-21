import React from 'react'
import { renderBusinessBehaviorControl } from './BusinessBehaviorControl'
import Button from 'amis-ui/lib/components/Button'
import InputBox from 'amis-ui/lib/components/InputBox'
import { FormItem, type FormControlProps } from 'amis'
import './BusinessBehaviorCatalog.scss'
import { BusinessBehaviorDefinitions } from './BusinessBehaviorDefinitions'

type Definition = Record<string, any>
type Source = {
  memberType: string
  memberName: string
  role: string
  kind: string
  source: { resource: string; fieldPath: string; formatVersion?: string }
  description?: string
}
type Catalog = {
  modelFullName: string
  revision: string
  actions: Definition[]
  events: Definition[]
  subscriptions: Definition[]
  sources: Source[]
  conflicts: string[]
  mutationEventPlans: Record<string, { eventNames: Record<string, string> }>
}
type Preview = {
  requestId: string
  draftFingerprint: string
  codeContributionCoverage: string
  catalog: Catalog | null
  validationSnapshot: { validationErrors: string[] }
}
type Published = {
  view: 'published'
  catalog: Catalog
  consumers: { modelFullName: string; subscription: Definition; sources: Source[] }[]
  externalEvents: {
    modelFullName: string
    eventName: string
    status: string
    definition: Definition | null
  }[]
}
type Props = FormControlProps & {
  appName?: string
  diagnostics?: any[]
  definitionSchemas?: Record<string, object>
}
type State = {
  view: 'draft' | 'published'
  loading: boolean
  error: string
  preview: Preview | null
  requestedDraft: string
  memberType: 'action' | 'event' | 'subscription'
  origin: string
  selected: Definition | null
  formInvalid: boolean
  targetApiBase: string
  targetToken: string
  published: Published | null
  publishedLoading: boolean
  publishedError: string
  publishedSignature: string
  search: string
  rawIndex: number | null
  tool: string
}

const SOURCE_LABELS: Record<string, string> = {
  metadata: '模型动态定义',
  legacy: '旧功能配置',
  generated: '平台生成',
  contribution: '代码 / SPI 贡献',
}
const ROLE_LABELS: Record<string, string> = {
  definition: '定义',
  binding: '实现绑定',
  listenerBinding: '监听器绑定',
  effect: '实际写入时的附加效果',
  producer: '事实生产来源',
  configuration: '通知规则配置',
}

export class BusinessBehaviorCatalog extends React.Component<Props, State> {
  state: State = {
    view: 'draft',
    loading: false,
    error: '',
    preview: null,
    requestedDraft: '',
    memberType: 'event',
    origin: '',
    selected: null,
    formInvalid: false,
    targetApiBase: '',
    targetToken: '',
    published: null,
    publishedLoading: false,
    publishedError: '',
    publishedSignature: '',
    search: '',
    rawIndex: null,
    tool: '',
  }
  private requestSequence = 0
  private publishedSequence = 0
  private timer?: ReturnType<typeof setTimeout>
  private observedSignature = ''
  private editor: BusinessBehaviorDefinitions | null = null

  componentDidMount() {
    this.scheduleCheck()
  }

  componentDidUpdate() {
    if (this.signature() !== this.observedSignature) this.scheduleCheck()
  }

  private scheduleCheck() {
    clearTimeout(this.timer)
    this.observedSignature = this.signature()
    this.requestSequence += 1
    this.timer = setTimeout(() => void this.loadDraft(), 600)
  }

  validate() {
    return this.editor?.validate() || ''
  }

  private navigate(change: Partial<State>) {
    const error = this.validate()
    if (error) {
      this.setState({ error: `请先修正当前输入：${error}` })
      return
    }
    this.setState((previous) => ({ ...previous, ...change, error: '' }))
  }

  private fieldName() {
    return { action: 'actions', event: 'events', subscription: 'eventSubscriptions' }[
      this.state.memberType
    ]
  }

  private originals(): Definition[] {
    const value = (this.props.formStore?.data || this.props.data)?.[this.fieldName()]
    return Array.isArray(value) ? value : []
  }

  private writeOriginals(value: unknown) {
    if (this.props.disabled || this.props.static || this.props.data?.readOnly) return
    if (!this.props.formStore) {
      this.setState({ error: '未找到模型编辑表单，无法写入定义。' })
      return
    }
    this.props.formStore.changeValue(this.fieldName(), value)
  }

  addDefinition() {
    if (this.validate()) {
      this.setState({ error: '请先修正当前未完成的输入。' })
      return
    }
    const data = this.props.formStore?.data || this.props.data || {}
    if (data.formatVersion !== '2.0') {
      this.setState({
        tool: 'compatibility',
        error: '新增行为前请先查看并确认模型升级内容。',
      })
      return
    }
    const originals = this.originals()
    this.writeOriginals([
      ...originals,
      this.state.memberType === 'event'
        ? { name: '', subject: 'model', allowedProducerKinds: ['action'] }
        : this.state.memberType === 'action'
          ? { name: '', isEnabled: true, binding: { kind: 'logicflow' } }
          : { name: '' },
    ])
    this.setState({ rawIndex: originals.length, selected: null })
  }

  componentWillUnmount() {
    clearTimeout(this.timer)
    this.requestSequence += 1
    this.publishedSequence += 1
  }

  private draft() {
    return JSON.stringify(this.props.formStore?.data || this.props.data || {})
  }

  private signature() {
    return JSON.stringify([this.props.appName || this.props.data?.appName, this.draft()])
  }

  private modelFullName() {
    const data = this.props.formStore?.data || this.props.data || {}
    return [data.namespace, data.name].filter(Boolean).join('.')
  }

  private targetSignature() {
    return JSON.stringify([
      this.state.targetApiBase,
      this.state.targetToken,
      this.modelFullName(),
    ])
  }

  private catalog() {
    return this.state.view === 'draft'
      ? this.state.preview?.catalog
      : this.state.published?.catalog
  }

  async loadPublished() {
    const signature = this.targetSignature()
    const sequence = ++this.publishedSequence
    const base = this.state.targetApiBase.trim().replace(/\/+$/, '')
    if (!/^\/api(?:\/|$)/.test(base) || !this.modelFullName()) {
      this.setState({
        publishedError: '请填写现有目标会话的 /api 前缀，并先填写模型名称。',
      })
      return
    }
    this.setState({
      publishedLoading: true,
      publishedError: '',
      publishedSignature: signature,
      selected: null,
      published: null,
    })
    try {
      const result = await this.props.env.fetcher({
        method: 'get',
        url: `${base}/business-model-behaviors/${encodeURIComponent(this.modelFullName())}/catalog`,
        ...(this.state.targetToken
          ? { headers: { Authorization: `Bearer ${this.state.targetToken}` } }
          : {}),
      })
      if (sequence !== this.publishedSequence || signature !== this.targetSignature())
        return
      if (!result.ok) throw new Error(result.msg || '目标应用查询失败')
      const published: Published = result.data
      if (
        published.view !== 'published' ||
        published.catalog?.modelFullName?.toLowerCase() !==
          this.modelFullName().toLowerCase()
      ) {
        throw new Error('目标应用返回了不同的模型或视图，请检查连接。')
      }
      this.setState({ published, publishedLoading: false })
    } catch (error) {
      if (sequence !== this.publishedSequence || signature !== this.targetSignature())
        return
      this.setState({
        publishedLoading: false,
        publishedError: error instanceof Error ? error.message : String(error),
      })
    }
  }

  async loadDraft() {
    const draft = this.draft()
    const signature = this.signature()
    const appName = this.props.appName || this.props.data?.appName
    if (!appName) {
      this.setState({ error: '缺少当前开发应用，无法预览草稿。' })
      return
    }
    clearTimeout(this.timer)
    const sequence = ++this.requestSequence
    const requestId = String(sequence)
    this.setState({
      loading: true,
      error: '',
      requestedDraft: signature,
      formInvalid: false,
    })
    try {
      if (
        this.props.formStore &&
        !(await this.props.onAction(
          null,
          { actionType: 'validate' },
          this.props.formStore.data
        ))
      ) {
        if (sequence === this.requestSequence) {
          this.setState({
            loading: false,
            formInvalid: true,
            error: '表单存在无效输入，请先修正标出的内容；此前目录已过期。',
          })
        }
        return
      }
      if (sequence !== this.requestSequence || signature !== this.signature()) return
      const result = await this.props.env.fetcher({
        method: 'post',
        url: `/api/dev/${encodeURIComponent(appName)}/business-model/behavior-preview?requestId=${requestId}`,
        data: JSON.parse(draft),
      })
      if (sequence !== this.requestSequence || signature !== this.signature()) return
      const response = result
      if (!response.ok) throw new Error(response.msg || '草稿预览失败')
      const preview: Preview = response.data
      if (preview.requestId !== requestId)
        throw new Error('预览响应与当前请求不一致，请重新预览。')
      this.setState({ preview, loading: false })
    } catch (error) {
      if (sequence !== this.requestSequence || signature !== this.signature()) return
      this.setState({
        loading: false,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  private sources(name: string, type = this.state.memberType) {
    return (this.catalog()?.sources || []).filter(
      (source) =>
        source.memberType === type &&
        source.memberName.toLowerCase() === name.toLowerCase()
    )
  }

  private productions(eventName: string) {
    const catalog = this.catalog()
    if (!catalog) return []
    return catalog.actions.flatMap((action) =>
      (action.emits || [])
        .filter(
          (reference: Definition) =>
            reference.modelFullName?.toLowerCase() ===
              catalog.modelFullName.toLowerCase() &&
            reference.eventName?.toLowerCase() === eventName.toLowerCase()
        )
        .map(() => {
          const automatic = Object.values(
            catalog.mutationEventPlans[action.name]?.eventNames || {}
          ).some((name) => name.toLowerCase() === eventName.toLowerCase())
          return `${action.name}：${automatic ? '实际源写入成功后自动产生' : '实现显式 emit'}${action.isEnabled === false ? '（动作已停用，此入口不能产生新事实）' : ''}`
        })
    )
  }

  private sourceTab(source: Source) {
    if (
      this.state.view !== 'draft' ||
      source.source.resource !== this.modelFullName() ||
      !['metadata', 'legacy', 'generated'].includes(source.kind)
    )
      return undefined
    return (
      {
        actions: 'behaviors',
        events: 'behaviors',
        eventSubscriptions: 'behaviors',
        custom: 'custom',
        apis: 'crud-api',
        workflow: 'workflow',
        features: 'features',
        enableArchiveDelete: 'features',
        enableScd2History: 'features',
        plugins: 'features',
        fields: 'fields-n-relations',
        relations: 'fields-n-relations',
      } as Record<string, string>
    )[source.source.fieldPath.split('.')[0]]
  }

  private workflowUrl(source: Source) {
    const prefix = 'approval-workflow-definition:'
    const appName = this.props.appName || this.props.data?.appName
    if (
      this.state.view !== 'draft' ||
      source.kind !== 'generated' ||
      !appName ||
      !source.source.resource.startsWith(prefix)
    )
      return undefined
    const name = source.source.resource.slice(prefix.length)
    return name
      ? `/dev/${encodeURIComponent(appName)}/approval-workflow-definition/${encodeURIComponent(name)}`
      : undefined
  }

  openSource(source: Source) {
    const tab = this.sourceTab(source)
    if (tab)
      return this.props.onAction(
        null,
        {
          actionType: 'changeActiveKey',
          componentId: 'business-model-config-tabs',
          args: { activeKey: tab },
        },
        this.props.data
      )
    const url = this.workflowUrl(source)
    if (url)
      return this.props.onAction(
        null,
        {
          actionType: 'openOrSwitchTab',
          args: { url, title: '审批流程配置' },
        },
        this.props.data
      )
  }

  private renderSource(source: Source, index: number, stale: boolean) {
    return (
      <li key={index}>
        {SOURCE_LABELS[source.kind] || source.kind} ·{' '}
        {ROLE_LABELS[source.role] || source.role} · {source.source.resource} :{' '}
        {source.source.fieldPath}
        {source.description ? <p>{source.description}</p> : null}
        {this.sourceTab(source) || this.workflowUrl(source) ? (
          <Button
            type="button"
            level="link"
            disabled={stale}
            onClick={() => this.openSource(source)}>
            {this.workflowUrl(source) ? '打开流程配置' : '打开原配置'}
          </Button>
        ) : null}
      </li>
    )
  }

  private readOnlyDetail(selected: Definition, stale: boolean) {
    const catalog = this.catalog()
    if (!catalog) return null
    return (
      <article aria-label="行为详情">
        <h4>
          {selected.title || selected.name} <small>{selected.name}</small>
        </h4>
        {selected.description ? <p>{selected.description}</p> : null}
        <p>{this.state.view === 'published' ? '已发布版本 · 只读' : '来源定义 · 只读'}</p>
        {this.state.memberType === 'event' ? (
          <>
            <p>事件主体：{selected.subject === 'instance' ? '对象' : '模型'}</p>
            {this.productions(selected.name).map((production, index) => (
              <p key={index}>{production}</p>
            ))}
            <h5>关联订阅</h5>
            {catalog.subscriptions
              .filter(
                (subscription) =>
                  subscription.sourceEvent?.modelFullName?.toLowerCase() ===
                    catalog.modelFullName.toLowerCase() &&
                  subscription.sourceEvent?.eventName?.toLowerCase() ===
                    selected.name.toLowerCase()
              )
              .map((subscription) => (
                <div key={subscription.name}>
                  <p>
                    {subscription.name} ·{' '}
                    {subscription.listenerName ? '代码订阅' : '动作订阅'} ·{' '}
                    {subscription.isEnabled === false ? '已停用' : '已启用'}
                  </p>
                  <ul>
                    {this.sources(subscription.name, 'subscription').map(
                      (source, index) => this.renderSource(source, index, stale)
                    )}
                  </ul>
                </div>
              ))}
            {this.state.view === 'published' ? (
              this.state.published?.consumers
                .filter(
                  (consumer) =>
                    consumer.subscription.sourceEvent?.eventName?.toLowerCase() ===
                    selected.name.toLowerCase()
                )
                .map((consumer, index) => (
                  <p key={index}>
                    {consumer.modelFullName} · {consumer.subscription.name} ·{' '}
                    {consumer.subscription.isEnabled === false
                      ? '已停用：不新增投递，已有责任阻塞'
                      : '已启用'}
                  </p>
                ))
            ) : (
              <small>外部消费者待核验</small>
            )}
          </>
        ) : null}
        {this.state.memberType === 'action' ? (
          <>
            <h5>允许发出事件</h5>
            {(selected.emits || []).map((reference: Definition, index: number) => (
              <p key={index}>
                {reference.modelFullName}.{reference.eventName} ·{' '}
                {Object.values(
                  catalog.mutationEventPlans?.[selected.name]?.eventNames || {}
                ).some(
                  (name) =>
                    reference.modelFullName?.toLowerCase() ===
                      catalog.modelFullName.toLowerCase() &&
                    name.toLowerCase() === reference.eventName?.toLowerCase()
                )
                  ? '实际源写入成功后自动产生'
                  : '由实现派发'}
              </p>
            ))}
          </>
        ) : null}
        <ul>
          {this.sources(selected.name).map((source, index) =>
            this.renderSource(source, index, stale)
          )}
        </ul>
        <details>
          <summary>完整定义</summary>
          <pre>{JSON.stringify(selected, null, 2)}</pre>
        </details>
      </article>
    )
  }

  render() {
    const { view, loading, preview, error, memberType, selected, rawIndex, tool } =
      this.state
    const catalog = this.catalog()
    const stale =
      view === 'draft'
        ? this.state.formInvalid || this.state.requestedDraft !== this.signature()
        : this.state.publishedSignature !== this.targetSignature()
    const currentCatalog = !stale ? catalog : null
    const definitions: Definition[] =
      catalog?.[
        memberType === 'action'
          ? 'actions'
          : memberType === 'event'
            ? 'events'
            : 'subscriptions'
      ] || []
    const originals = view === 'draft' ? this.originals() : []
    const rows = [
      ...originals.map((definition, index) => ({ definition, index })),
      ...definitions
        .filter(
          (definition) =>
            !originals.some((original) => original?.name === definition.name)
        )
        .map((definition) => ({ definition, index: null })),
    ].filter(
      ({ definition }) =>
        definition &&
        (!this.state.search ||
          `${definition.title || ''} ${definition.name || ''}`
            .toLowerCase()
            .includes(this.state.search.toLowerCase())) &&
        (!this.state.origin ||
          this.sources(definition.name || '').some(
            (source) => source.kind === this.state.origin
          ))
    )
    const errors = preview?.validationSnapshot?.validationErrors || []
    const resolved =
      selected && definitions.find((definition) => definition.name === selected.name)
    const draft = this.props.formStore?.data || this.props.data || {}
    const originalValue = draft[this.fieldName()]
    return (
      <section className="BusinessBehaviorCatalog" aria-label="行为契约工作台">
        <header className="BusinessBehaviorCatalog-toolbar">
          <nav aria-label="行为类型" className={this.props.classnames('ButtonGroup')}>
            {(['action', 'event', 'subscription'] as const).map((type) => (
              <Button
                type="button"
                key={type}
                level={memberType === type ? 'primary' : 'default'}
                aria-pressed={memberType === type}
                onClick={() =>
                  this.navigate({ memberType: type, selected: null, rawIndex: null })
                }>
                {{ action: '动作', event: '事件', subscription: '事件订阅' }[type]}
              </Button>
            ))}
          </nav>
          <span role="status">
            {view === 'draft'
              ? this.state.formInvalid
                ? '输入尚未完成'
                : loading
                  ? '正在检查'
                  : stale
                    ? '配置已修改，待检查'
                    : error
                      ? '检查未完成'
                      : !preview
                        ? '等待检查'
                        : errors.length
                          ? `发现 ${errors.length} 个问题`
                          : '配置检查通过'
              : '已发布版本 · 只读'}
          </span>
          {error && view === 'draft' ? (
            <Button type="button" onClick={() => void this.loadDraft()}>
              重新检查
            </Button>
          ) : null}
          <details>
            <summary>更多</summary>
            <Button
              type="button"
              onClick={() =>
                this.navigate({
                  view: 'published',
                  tool: 'compare',
                  selected: null,
                  rawIndex: null,
                })
              }>
              对照已发布版本
            </Button>
            <Button
              type="button"
              onClick={() =>
                this.navigate({ tool: tool === 'diagnostics' ? '' : 'diagnostics' })
              }>
              运行诊断
            </Button>
            <Button
              type="button"
              onClick={() =>
                this.navigate({ tool: tool === 'compatibility' ? '' : 'compatibility' })
              }>
              兼容设置
            </Button>
          </details>
        </header>
        {view === 'draft' && preview?.codeContributionCoverage ? (
          <small>代码贡献待核验</small>
        ) : null}
        {error ? <p role="alert">{error}</p> : null}
        {view === 'draft' && !stale && errors.length ? (
          <details open>
            <summary>配置问题</summary>
            {errors.map((message, index) => (
              <p role="alert" key={index}>
                {message}
              </p>
            ))}
          </details>
        ) : null}
        {catalog?.conflicts?.map((message, index) => (
          <p role="alert" key={index}>
            {message}
          </p>
        ))}
        {tool === 'compatibility'
          ? this.props.render?.('compatibility', {
              type: 'business-model-format-upgrade',
              name: 'behaviorFormatUpgrade',
              label: false,
              appName: this.props.appName,
            })
          : null}
        {tool === 'diagnostics' ? (
          <section aria-label="运行诊断">
            {this.props.render?.('diagnostics', this.props.diagnostics || [])}
          </section>
        ) : null}
        {view === 'published' ? (
          <section aria-label="已发布版本对照">
            <Button
              type="button"
              onClick={() =>
                this.navigate({ view: 'draft', tool: '', selected: null, rawIndex: null })
              }>
              返回当前配置
            </Button>
            <label>
              <span>目标会话 API 前缀</span>
              <InputBox
                value={this.state.targetApiBase}
                placeholder="/api/tunnel/会话ID/api"
                onChange={(targetApiBase: string) => this.setState({ targetApiBase })}
              />
            </label>
            <label>
              <span>目标访问令牌（可选）</span>
              <InputBox
                type="password"
                autoComplete="off"
                value={this.state.targetToken}
                onChange={(targetToken: string) => this.setState({ targetToken })}
              />
            </label>
            <Button type="button" onClick={() => void this.loadPublished()}>
              连接应用并查询
            </Button>
            {this.state.publishedError ? (
              <p role="alert">{this.state.publishedError}</p>
            ) : null}
            {this.state.publishedLoading ? <p role="status">正在查询目标应用</p> : null}
            {this.state.published ? (
              <p>
                已发布 · {this.state.published.catalog.modelFullName} ·{' '}
                {this.state.published.catalog.revision}；未与当前草稿合并。
              </p>
            ) : (
              <p>目标应用未连接，代码贡献与通知规则未核验。</p>
            )}
          </section>
        ) : null}
        <div className="BusinessBehaviorCatalog-workbench">
          <aside aria-label="行为列表">
            <label>
              <span>搜索</span>
              <InputBox
                type="search"
                value={this.state.search}
                placeholder="搜索名称或标识"
                onChange={(search: string) => this.setState({ search })}
              />
            </label>
            {this.props.render
              ? renderBusinessBehaviorControl(
                  this.props.render,
                  'origin',
                  {
                    type: 'select',
                    label: '来源',
                    options: [
                      { label: '全部', value: '' },
                      ...Object.entries(SOURCE_LABELS).map(([value, label]) => ({
                        value,
                        label,
                      })),
                    ],
                  },
                  {
                    value: this.state.origin,
                    onChange: (origin: string) => this.setState({ origin }),
                  }
                )
              : null}
            {view === 'draft' ? (
              <Button
                type="button"
                disabled={this.props.disabled || this.props.static || draft.readOnly}
                onClick={() => this.addDefinition()}>
                新增{{ action: '动作', event: '事件', subscription: '订阅' }[memberType]}
              </Button>
            ) : null}
            {rows.map(({ definition, index }, position) => (
              <button
                type="button"
                key={index === null ? `resolved-${definition.name}` : `original-${index}`}
                className="BusinessBehaviorCatalog-member"
                aria-pressed={
                  index !== null ? rawIndex === index : selected?.name === definition.name
                }
                onClick={() =>
                  this.navigate({
                    rawIndex: index,
                    selected: index === null ? definition : null,
                  })
                }>
                <strong>
                  {definition.title || definition.name || `未命名 ${position + 1}`}
                </strong>
                <span>{definition.name}</span>
                <small>
                  {index !== null
                    ? '本模型定义'
                    : this.sources(definition.name || '')
                        .filter((source) => source.role === 'definition')
                        .map((source) => SOURCE_LABELS[source.kind] || source.kind)
                        .join(' / ') || '来源待核验'}
                  {definition.isEnabled === false ? ' · 已停用' : ''}
                </small>
              </button>
            ))}
            {!rows.length ? (
              <p>
                {catalog || originals.length ? '没有符合条件的定义' : '尚无可显示的定义'}
              </p>
            ) : null}
            {view === 'draft' &&
            originalValue !== undefined &&
            (!Array.isArray(originalValue) ||
              originalValue.some(
                (item) => !item || typeof item !== 'object' || Array.isArray(item)
              )) ? (
              <Button type="button" onClick={() => this.navigate({ rawIndex: -1 })}>
                修正原始定义
              </Button>
            ) : null}
          </aside>
          <main aria-label="定义详情">
            {view === 'draft' && rawIndex !== null ? (
              <BusinessBehaviorDefinitions
                {...this.props}
                key={memberType}
                ref={(editor) => {
                  this.editor = editor
                }}
                memberType={memberType}
                selectedIndex={rawIndex >= 0 ? rawIndex : undefined}
                value={originalValue}
                catalog={currentCatalog || undefined}
                modelFullName={this.modelFullName()}
                jsonSchema={this.props.definitionSchemas?.[memberType]}
                onInputStateChange={(error: string) => {
                  clearTimeout(this.timer)
                  this.requestSequence += 1
                  this.setState({ formInvalid: !!error, loading: false })
                  if (!error) this.scheduleCheck()
                }}
                onChange={(value) => this.writeOriginals(value)}
              />
            ) : resolved ? (
              this.readOnlyDetail(resolved, stale)
            ) : (
              <p>选择一个成员查看或编辑</p>
            )}
            {view === 'draft' &&
            rawIndex !== null &&
            originals[rawIndex]?.name &&
            currentCatalog ? (
              <details>
                <summary>关联来源与订阅</summary>
                {this.readOnlyDetail(originals[rawIndex], false)}
              </details>
            ) : null}
          </main>
        </div>
        {view === 'published' && this.state.published?.externalEvents?.length ? (
          <details>
            <summary>引用的外部事件</summary>
            {this.state.published.externalEvents.map((event, index) => (
              <p key={index}>
                {event.modelFullName}.{event.eventName} ·{' '}
                {
                  (
                    {
                      available: '已核验',
                      forbidden: '无查看权限',
                      unavailable: '未发布或不存在',
                    } as Record<string, string>
                  )[event.status]
                }
              </p>
            ))}
          </details>
        ) : null}
      </section>
    )
  }
}

FormItem({ type: 'business-behavior-catalog', autoVar: true, strictMode: false })(
  BusinessBehaviorCatalog
)
export default BusinessBehaviorCatalog
