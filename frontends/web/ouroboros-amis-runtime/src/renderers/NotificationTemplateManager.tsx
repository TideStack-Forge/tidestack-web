import React from 'react'
import { FormItem, type FormControlProps } from 'amis'
import { themeable, type ThemeProps } from 'amis-core'
import Modal from 'amis-ui/lib/components/Modal'
import { cloneDeep } from 'lodash'
import { Client } from '#ouroboros-host/utils/http'
import { getRouter, readCurrentRoute, subscribeRouteChanges } from '#ouroboros-host/router/routerFacade'
import Tabs from '#ouroboros-host/common/tabs'
import { readGetters } from '#ouroboros-host/store/storeFacade'
import JsonDataEditor from './JsonDataEditor'
import {
  NotificationTemplateManagementState,
  differences,
  impact,
  sourceLabel,
  type JsonSchema,
  type Difference,
} from './notificationTemplateManagement'
import './NotificationTemplateManager.scss'

type Props = FormControlProps & { initialMode?: 'view' | 'edit' }
type State = {
  tab: string
  selectedChannel: string
  prompt: '' | 'save' | 'restore' | 'cancel' | 'remove'
  removeChannel: string
}

// AMIS 6's disabled button becomes a div; keep native semantics with its theme.
const Button = themeable(function TemplateAction({
  classnames,
  classPrefix: _prefix,
  theme: _theme,
  mobileUI: _mobile,
  level = 'default',
  className,
  children,
  ...props
}: ThemeProps & React.ButtonHTMLAttributes<HTMLButtonElement> & { level?: string }) {
  return (
    <button
      {...props}
      className={classnames(
        'Button',
        `Button--${level}`,
        'Button--size-default',
        { 'is-disabled': props.disabled },
        className
      )}
    >
      {children}
    </button>
  )
})
const valueText = (value: unknown) =>
  value === undefined
    ? '（不存在）'
    : value === null
      ? '（空值）'
      : typeof value === 'string'
        ? value || '（空文本）'
        : JSON.stringify(value, null, 2)

function Comparison({ items }: { items: Difference[] }) {
  return items.length ? (
    <div className="NotificationTemplateManager-comparison">
      <table>
        <thead>
          <tr>
            <th>字段</th>
            <th>原值</th>
            <th>当前值 · 已修改</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.path}>
              <th scope="row">{item.path}</th>
              <td data-label="原值">
                <pre>{valueText(item.before)}</pre>
              </td>
              <td data-label="当前值 · 已修改">
                <pre>{valueText(item.after)}</pre>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <p>内容一致</p>
  )
}

/** One original AMIS page owns the read/edit lifecycle and concurrency tokens. */
export class NotificationTemplateManager extends React.Component<Props, State> {
  state: State = { tab: 'current', selectedChannel: '', prompt: '', removeChannel: '' }
  model: NotificationTemplateManagementState
  private removeRouteGuard?: () => void
  private removeCloseGuard?: () => void
  private removeArrivalListener?: () => void
  private root = React.createRef<HTMLElement>()
  private leaveApproved = false

  constructor(props: Props) {
    super(props)
    this.model = this.createModel(props)
  }
  private createModel(props: Props) {
    return new NotificationTemplateManagementState(
      props.data?.name || '',
      async (method, url, data) => {
        const response = await Client.request(
          method as 'get' | 'put' | 'post',
          url,
          data,
          { isSilent: true, throwOnError: false, authRefreshRetry: true }
        )
        return response.data
      },
      () => {
        this.leaveApproved = false
        this.forceUpdate()
      }
    )
  }
  async componentDidMount() {
    window.addEventListener('beforeunload', this.beforeUnload)
    this.installGuards()
    await this.loadModel()
  }
  private installGuards() {
    this.removeRouteGuard?.()
    this.removeCloseGuard?.()
    this.removeArrivalListener?.()
    const tabId = this.props.data?.SystemContext?.activeTabId
    if (tabId) this.removeCloseGuard = Tabs.beforeLeave(tabId, () => this.allowLeave())
    const pagePath = readCurrentRoute().fullPath
    this.removeArrivalListener = subscribeRouteChanges((to) => {
      if (to.fullPath === pagePath) this.leaveApproved = false
    })
    this.removeRouteGuard = getRouter().beforeEach(
      (_to: unknown, from: { fullPath: string }, next: (value?: boolean) => void) => {
        const active = from.fullPath === pagePath
        if (active && !this.allowLeave()) next(false)
        else next()
      }
    )
  }
  private async loadModel() {
    const model = this.model
    await Promise.allSettled([model.load(), model.loadChannels()])
    if (!model.disposed && this.props.initialMode === 'edit') model.beginEdit()
  }
  componentDidUpdate(previous: Props) {
    if (
      previous.data?.name === this.props.data?.name &&
      previous.initialMode === this.props.initialMode
    )
      return
    this.model.disposed = true
    this.model = this.createModel(this.props)
    this.leaveApproved = false
    this.setState({ tab: 'current', selectedChannel: '', prompt: '', removeChannel: '' })
    this.installGuards()
    void this.loadModel()
  }
  componentWillUnmount() {
    this.model.disposed = true
    this.removeRouteGuard?.()
    this.removeCloseGuard?.()
    this.removeArrivalListener?.()
    window.removeEventListener('beforeunload', this.beforeUnload)
  }
  private beforeUnload = (event: BeforeUnloadEvent) => {
    if (!this.model.dirty && !this.model.busy && !this.model.pendingCommit) return
    event.preventDefault()
    event.returnValue = ''
  }
  private allowLeave() {
    if (this.model.busy) return false
    if (this.leaveApproved || (!this.model.dirty && !this.model.pendingCommit))
      return true
    if (
      !window.confirm(
        this.model.pendingCommit
          ? '提交结果仍待核对，确认离开此页面？'
          : '有未保存修改，确认离开？本次修改不会提交。'
      )
    )
      return false
    this.leaveApproved = true
    return true
  }
  private navigate(url: string) {
    if (!this.allowLeave()) return
    const existing = readGetters().tabsList?.find(
      (tab: { path: string }) => tab.path === url
    )
    if (existing) {
      void Tabs.switchTab(existing.id)
      return
    }
    if (this.allowLeave())
      this.props.onAction(
        null,
        { actionType: 'openOrSwitchTab', args: { url, replaceCurrentTab: true } },
        this.props.data
      )
  }
  private selected() {
    const channels = Object.keys(this.model.draft?.channel || {})
    return channels.includes(this.state.selectedChannel)
      ? this.state.selectedChannel
      : channels[0] || ''
  }
  private readOnlyJson(value: unknown, label: string) {
    return (
      <>
        <Button
          type="button"
          disabled={!this.props.env.copy}
          onClick={() => this.props.env.copy?.(JSON.stringify(value ?? null, null, 2))}
        >
          {label}
        </Button>
        <pre>{valueText(value)}</pre>
      </>
    )
  }
  private updateField(
    channel: string,
    section: 'schema' | 'options',
    field: string,
    value: unknown
  ) {
    const channels = cloneDeep(this.model.draft!.channel)
    channels[channel] = {
      ...channels[channel],
      [section]: { ...channels[channel][section], [field]: value },
    }
    this.model.change({ channel: channels })
  }
  private fields(channel: string, section: 'schema' | 'options', schema: JsonSchema) {
    const values = this.model.draft!.channel[channel][section] || {}
    return Object.entries(schema.properties || {}).map(([field, definition]) => {
      const path = `channel.${channel}.${section}.${field}`
      const type = Array.isArray(definition.type)
        ? definition.type.find((value) => value !== 'null')
        : definition.type
      const label = definition.title || field
      const value = values[field]
      const disabled = this.model.busy || !!this.model.pendingCommit
      const errors =
        this.model.validation?.errors.filter((error) => error.path === path) || []
      return (
        <div
          className="NotificationTemplateManager-field"
          key={path}
          data-field-path={path}
        >
          <label htmlFor={path}>
            {label}
            {schema.required?.includes(field) ? ' *' : ''}
          </label>
          {type === 'object' || type === 'array' || !type ? (
            <JsonDataEditor
              {...this.props}
              key={path}
              static={disabled}
              value={value === undefined ? (type === 'array' ? [] : {}) : value}
              jsonSchema={definition}
              allowValueTypes={type === 'array' ? 'array,null' : 'object,null'}
              onInputStateChange={(error) => this.model.inputState(path, error)}
              onChange={(next) => this.updateField(channel, section, field, next)}
            />
          ) : type === 'boolean' || definition.enum ? (
            <select
              id={path}
              disabled={disabled}
              value={value == null ? '' : String(value)}
              onChange={(event) =>
                this.updateField(
                  channel,
                  section,
                  field,
                  event.target.value === ''
                    ? null
                    : type === 'boolean'
                      ? event.target.value === 'true'
                      : event.target.value
                )
              }
            >
              <option value="">未设置</option>
              {(definition.enum || [true, false]).map((option) => (
                <option key={String(option)} value={String(option)}>
                  {String(option)}
                </option>
              ))}
            </select>
          ) : (
            <textarea
              id={path}
              rows={type === 'string' ? 3 : 1}
              disabled={disabled}
              value={value == null ? '' : String(value)}
              aria-invalid={errors.length > 0}
              aria-describedby={errors.length ? `${path}-errors` : undefined}
              onChange={(event) => {
                const text = event.target.value
                this.updateField(
                  channel,
                  section,
                  field,
                  text === ''
                    ? null
                    : (type === 'integer' || type === 'number') &&
                        Number.isFinite(Number(text))
                      ? Number(text)
                      : text
                )
              }}
            />
          )}
          <small>
            {field}
            {definition.minimum !== undefined ? ` · 最小 ${definition.minimum}` : ''}
            {definition.maximum !== undefined ? ` · 最大 ${definition.maximum}` : ''}
          </small>
          {errors.length ? (
            <div id={`${path}-errors`} role="alert">
              {errors.map((error) => error.message).join('；')}
            </div>
          ) : null}
        </div>
      )
    })
  }
  private focusProblem(path: string, channel?: string) {
    this.setState({ selectedChannel: channel || this.selected(), tab: 'current' }, () => {
      const field = [
        ...(this.root.current?.querySelectorAll<HTMLElement>('[data-field-path]') || []),
      ].find((node) => node.dataset.fieldPath === path)
      field?.scrollIntoView({ block: 'center' })
      field?.querySelector<HTMLElement>('textarea, input, select, button')?.focus()
    })
  }
  private async prepareSave() {
    if (await this.model.check()) this.setState({ prompt: 'save' })
    else if (this.model.validation?.errors[0]) {
      const problem = this.model.validation.errors[0]
      this.focusProblem(problem.path, problem.channel)
    }
  }
  private async confirm() {
    const prompt = this.state.prompt
    this.setState({ prompt: '' })
    if (prompt === 'save' || prompt === 'restore')
      await this.model.write(prompt === 'restore')
    if (prompt === 'cancel') this.model.cancel()
    if (prompt === 'remove') {
      const channel = cloneDeep(this.model.draft!.channel)
      delete channel[this.state.removeChannel]
      Object.keys(this.model.inputErrors)
        .filter((path) => path.startsWith(`channel.${this.state.removeChannel}.`))
        .forEach((path) => delete this.model.inputErrors[path])
      this.model.change({ channel })
    }
  }
  private channels(editing: boolean) {
    const model = this.model,
      channels = model.draft!.channel || {},
      selected = this.selected()
    return (
      <section aria-label="渠道内容" className="NotificationTemplateManager-channels">
        <div className="NotificationTemplateManager-toolbar">
          <h3>渠道内容</h3>
          {editing ? (
            <label>
              添加渠道{' '}
              <select
                aria-label="添加渠道"
                value=""
                disabled={model.busy || !!model.pendingCommit}
                onChange={(event) => {
                  const id = event.target.value
                  if (!id) return
                  model.change({
                    channel: { ...channels, [id]: { schema: {}, options: {} } },
                  })
                  this.setState({ selectedChannel: id }, () =>
                    this.root.current
                      ?.querySelector<HTMLElement>(
                        '[data-active-channel="true"] textarea, [data-active-channel="true"] select'
                      )
                      ?.focus()
                  )
                }}
              >
                <option value="">选择已安装渠道</option>
                {model.channels
                  .filter((channel) => channel.manageable && !channels[channel.id])
                  .map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      {channel.title}
                    </option>
                  ))}
              </select>
            </label>
          ) : null}
        </div>
        {!Object.keys(channels).length ? <p>未选用发送渠道</p> : null}
        <div className="NotificationTemplateManager-channel-layout">
          <nav aria-label="模板渠道">
            {Object.keys(channels).map((id) => (
              <Button
                key={id}
                type="button"
                aria-pressed={id === selected}
                level={id === selected ? 'primary' : 'default'}
                onClick={() => this.setState({ selectedChannel: id })}
              >
                {model.channels.find((channel) => channel.id === id)?.title || id}
                {model.validation?.errors.filter((error) => error.channel === id).length
                  ? ' · 有错误'
                  : ''}
              </Button>
            ))}
          </nav>
          <div>
            {Object.entries(channels).map(([id, content]) => {
              const channel = model.channels.find((item) => item.id === id)
              return (
                <section
                  key={id}
                  hidden={id !== selected}
                  data-active-channel={id === selected}
                  aria-label={channel?.title || id}
                >
                  {editing && channel?.manageable ? (
                    <>
                      <h4>消息内容模板</h4>
                      {this.fields(id, 'schema', channel.schema!)}
                      <details>
                        <summary>渠道选项</summary>
                        {this.fields(id, 'options', channel.options!)}
                      </details>
                      <details>
                        <summary>可用变量（只读）</summary>
                        {this.readOnlyJson(model.draft!.payloadSchema, '复制可用变量')}
                      </details>
                    </>
                  ) : (
                    <>
                      <p>
                        {channel?.manageable
                          ? '原始模板内容（不会执行）'
                          : '缺少渠道实现或管理描述；保留原内容，可停用模板或移除此渠道。'}
                      </p>
                      {this.readOnlyJson(content.schema, '复制渠道内容')}
                      <details>
                        <summary>渠道选项</summary>
                        {this.readOnlyJson(content.options || {}, '复制渠道选项')}
                      </details>
                    </>
                  )}
                  {editing ? (
                    <Button
                      type="button"
                      disabled={model.busy || !!model.pendingCommit}
                      onClick={() =>
                        this.setState({ prompt: 'remove', removeChannel: id })
                      }
                    >
                      移除此渠道
                    </Button>
                  ) : null}
                  <p>连接参数在配置管理中独立保存。</p>
                  {channel?.configurationGroups.length ? (
                    <>
                      <small>配置分组：{channel.configurationGroups.join('、')}</small>
                      <Button
                        type="button"
                        disabled={
                          model.busy ||
                          !!model.pendingCommit ||
                          !this.props.data?.SystemContext?.hasAuth?.(
                            'systemSetting.configurationManagement'
                          )
                        }
                        onClick={() =>
                          this.navigate('/system-setting/configuration-management')
                        }
                      >
                        管理连接参数
                      </Button>
                    </>
                  ) : null}
                </section>
              )
            })}
          </div>
        </div>
      </section>
    )
  }
  render() {
    const model = this.model,
      definition = model.definition,
      draft = model.draft
    const locked = model.busy || !!model.pendingCommit
    return (
      <section
        ref={this.root}
        className="NotificationTemplateManager"
        aria-label="通知模板配置"
        aria-busy={model.busy}
      >
        <header className="NotificationTemplateManager-toolbar">
          <div>
            <h2>{definition?.effectiveTemplate.title || model.name || '通知模板'}</h2>
            <code>{model.name}</code>
          </div>
          <div className="NotificationTemplateManager-actions">
            <Button
              type="button"
              disabled={model.busy}
              onClick={() => this.navigate('/system-setting/notification-templates')}
            >
              返回模板列表
            </Button>
            {definition && !model.editing ? (
              <>
                <Button type="button" disabled={locked} onClick={() => void model.load()}>
                  刷新
                </Button>
                {definition.availableActions.edit ? (
                  <Button
                    type="button"
                    level="primary"
                    disabled={locked}
                    onClick={() => model.beginEdit()}
                  >
                    编辑配置
                  </Button>
                ) : null}
                {definition.availableActions.restore ? (
                  <Button
                    type="button"
                    disabled={locked}
                    onClick={() => this.setState({ prompt: 'restore' })}
                  >
                    撤销覆盖
                  </Button>
                ) : null}
              </>
            ) : null}
          </div>
        </header>
        {model.busy ? <p role="status">正在处理，请稍候…</p> : null}
        {model.error ? (
          <div role="alert">
            {model.error}
            {!definition ? (
              <Button
                type="button"
                disabled={model.busy}
                onClick={() => void model.load()}
              >
                重新加载
              </Button>
            ) : null}
          </div>
        ) : null}
        {model.message ? <p role="status">{model.message}</p> : null}
        {model.pendingCommit ? (
          <section aria-label="提交结果待核对">
            <p>
              {model.pendingCommit.committed
                ? '服务器已确认保存，请核对当前生效配置。'
                : '未收到明确的提交结果，请先核对当前生效配置。'}
            </p>
            <Button
              type="button"
              disabled={model.busy}
              onClick={() => void model.load(true)}
            >
              读取最新状态并核对
            </Button>
            {model.latest ? (
              <>
                <Comparison
                  items={differences(model.draft, model.latest.effectiveTemplate)}
                />
                <Button
                  type="button"
                  disabled={model.busy}
                  onClick={() => void model.load()}
                >
                  已核对，加载最新配置并结束本次编辑
                </Button>
              </>
            ) : null}
          </section>
        ) : null}
        {definition && draft ? (
          <>
            <p>
              {sourceLabel[definition.effectiveSource] || definition.effectiveSource} ·{' '}
              {draft.isEnabled ? '已启用' : '已停用'} · 最后修改：
              {definition.modifiedBy || '—'} {definition.modifiedAt || ''}
            </p>
            {definition.baseChanged === true ? (
              <p role="alert">
                应用默认模板已变化，当前仍使用运行时覆盖，请比较最新默认配置后确认。
              </p>
            ) : definition.hasOverride && definition.baseChanged === null ? (
              <p role="status">覆盖基线未知，请核对当前部署默认配置。</p>
            ) : null}
            {definition.diagnostics.map((problem) => (
              <p key={`${problem.path}-${problem.code}`} role="alert">
                {problem.path}：{problem.message}
              </p>
            ))}
            {model.channelError ? (
              <p role="alert">
                {model.channelError}{' '}
                <Button type="button" onClick={() => void model.loadChannels()}>
                  重试渠道目录
                </Button>
              </p>
            ) : null}
            {model.conflict ? (
              <section aria-label="版本冲突">
                <h3>配置已变化，本次输入已保留</h3>
                <Button
                  type="button"
                  disabled={model.busy}
                  onClick={() => void model.load(true)}
                >
                  读取最新配置，保留本次编辑
                </Button>
                {model.latest ? (
                  <>
                    <h4>打开时 → 最新生效</h4>
                    <Comparison
                      items={differences(
                        definition.effectiveTemplate,
                        model.latest.effectiveTemplate
                      )}
                    />
                    <h4>最新生效 → 本次编辑</h4>
                    <Comparison
                      items={differences(model.latest.effectiveTemplate, draft)}
                    />
                    <Button
                      type="button"
                      disabled={model.busy}
                      onClick={() => {
                        if (
                          window.confirm('已核对差异，使用最新版本重新检查本次完整覆盖？')
                        )
                          model.acceptLatest()
                      }}
                    >
                      保留本次输入，采用最新版本重新检查
                    </Button>
                    <Button
                      type="button"
                      disabled={model.busy}
                      onClick={() => {
                        if (window.confirm('放弃本次输入并加载最新配置？'))
                          void model.load()
                      }}
                    >
                      放弃本次编辑，加载最新配置
                    </Button>
                  </>
                ) : null}
              </section>
            ) : null}
            {model.validation ? (
              <section aria-label="检查结果" role="status">
                <h3>{model.validation.valid ? '检查配置通过' : '配置检查发现问题'}</h3>
                <p>检查不发送消息，也不证明供应商可达。</p>
                {[...model.validation.errors, ...model.validation.warnings].map(
                  (problem, index) => (
                    <p key={index}>
                      <Button
                        type="button"
                        level="link"
                        onClick={() => this.focusProblem(problem.path, problem.channel)}
                      >
                        {problem.path}：{problem.message}
                      </Button>
                    </p>
                  )
                )}
              </section>
            ) : null}
            <nav className="NotificationTemplateManager-actions" aria-label="配置页签">
              {Object.entries({
                current: model.editing ? '编辑配置' : '当前生效配置',
                compare: '与默认对比',
                payload: '载荷契约（只读）',
              }).map(([id, title]) => (
                <Button
                  key={id}
                  type="button"
                  level={this.state.tab === id ? 'primary' : 'default'}
                  aria-pressed={this.state.tab === id}
                  onClick={() => this.setState({ tab: id })}
                >
                  {title}
                </Button>
              ))}
            </nav>
            <div
              className={model.editing ? 'NotificationTemplateManager-editor-layout' : ''}
            >
              <main>
                <section hidden={this.state.tab !== 'current'}>
                  {model.editing ? (
                    <section
                      className="NotificationTemplateManager-basics"
                      aria-label="基本信息"
                    >
                      <label>
                        模板标题
                        <input
                          value={draft.title || ''}
                          disabled={locked}
                          onChange={(event) =>
                            model.change({ title: event.target.value })
                          }
                        />
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={draft.isEnabled}
                          disabled={locked}
                          onChange={(event) =>
                            model.change({ isEnabled: event.target.checked })
                          }
                        />
                        {draft.isEnabled ? '已启用' : '已停用'}（保存后生效）
                      </label>
                    </section>
                  ) : null}
                  {this.channels(model.editing)}
                </section>
                <section
                  hidden={this.state.tab !== 'compare'}
                  aria-label="与默认配置对比"
                >
                  {!definition.defaultExists ? (
                    <p>无默认定义，历史数据库模板保持只读。</p>
                  ) : (
                    <>
                      {definition.hasOverride && !definition.differences.length ? (
                        <p>与当前默认配置一致；覆盖记录仍存在。</p>
                      ) : null}
                      <Comparison
                        items={differences(
                          definition.defaultTemplate,
                          model.editing ? draft : definition.effectiveTemplate
                        )}
                      />
                      <details>
                        <summary>完整默认配置</summary>
                        {this.readOnlyJson(definition.defaultTemplate, '复制默认配置')}
                      </details>
                    </>
                  )}
                </section>
                <section hidden={this.state.tab !== 'payload'} aria-label="载荷契约">
                  <h3>当前有效载荷契约（只读）</h3>
                  {this.readOnlyJson(draft.payloadSchema, '复制当前载荷契约')}
                  {differences(
                    draft.payloadSchema,
                    definition.defaultTemplate?.payloadSchema
                  ).length && definition.hasOverride ? (
                    <>
                      <p role="alert">
                        当前覆盖与部署默认的载荷契约不同。普通保存保留原契约；采用新契约需先撤销覆盖，再重新编辑，两步之间默认配置会生效。
                      </p>
                      <h4>当前部署默认载荷契约</h4>
                      {this.readOnlyJson(
                        definition.defaultTemplate?.payloadSchema,
                        '复制默认载荷契约'
                      )}
                    </>
                  ) : null}
                </section>
              </main>
              {model.editing ? (
                <aside aria-label="本次变更摘要">
                  <h3>本次变更 · {model.changes.length}</h3>
                  <p>{definition.hasOverride ? '更新运行时覆盖' : '建立运行时覆盖'}</p>
                  {model.changes.map((item) => (
                    <details key={item.path}>
                      <summary>{item.path} · 已修改</summary>
                      <Comparison items={[item]} />
                    </details>
                  ))}
                  <p>
                    相对部署默认：{differences(definition.defaultTemplate, draft).length}{' '}
                    处差异
                  </p>
                  <p>{impact}</p>
                </aside>
              ) : null}
            </div>
            <footer
              className={`NotificationTemplateManager-footer${model.editing ? ' is-editing' : ''}`}
            >
              <p>{impact}</p>
              {model.editing ? (
                <div className="NotificationTemplateManager-actions">
                  <Button
                    type="button"
                    disabled={locked}
                    onClick={() =>
                      model.dirty ? this.setState({ prompt: 'cancel' }) : model.cancel()
                    }
                  >
                    取消
                  </Button>
                  <Button
                    type="button"
                    disabled={!model.canWrite}
                    onClick={() => void model.check()}
                  >
                    检查配置
                  </Button>
                  <Button
                    type="button"
                    level="primary"
                    disabled={!model.canWrite}
                    onClick={() => void this.prepareSave()}
                  >
                    保存并生效
                  </Button>
                </div>
              ) : null}
            </footer>
          </>
        ) : null}
        <Modal
          show={!!this.state.prompt}
          onHide={() => this.setState({ prompt: '' })}
          size="lg"
        >
          <Modal.Header onClose={() => this.setState({ prompt: '' })}>
            {this.state.prompt &&
              {
                save: '确认保存并生效',
                restore: '确认撤销覆盖',
                cancel: '放弃未保存修改',
                remove: '移除此渠道',
              }[this.state.prompt]}
          </Modal.Header>
          <Modal.Body>
            {this.state.prompt === 'restore' ? (
              <>
                <p>将删除当前覆盖，恢复并跟随部署默认。</p>
                <p>
                  恢复后：{definition?.defaultTemplate?.isEnabled ? '已启用' : '已停用'}
                  ；渠道：
                  {Object.keys(definition?.defaultTemplate?.channel || {}).join('、') ||
                    '无'}
                </p>
                <Comparison
                  items={differences(
                    definition?.effectiveTemplate,
                    definition?.defaultTemplate
                  )}
                />
              </>
            ) : this.state.prompt === 'save' ? (
              <>
                <Comparison items={model.changes} />
                <p>{impact}</p>
              </>
            ) : this.state.prompt === 'remove' ? (
              <p>只移除模板选用关系，保存后生效。适配器、连接凭据和历史计划会保留。</p>
            ) : (
              <p>放弃本次修改并返回查看配置。</p>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button type="button" onClick={() => this.setState({ prompt: '' })}>
              继续{this.state.prompt === 'cancel' ? '编辑' : '查看'}
            </Button>
            <Button type="button" level="primary" onClick={() => void this.confirm()}>
              {this.state.prompt === 'restore'
                ? '确认撤销覆盖'
                : this.state.prompt === 'save'
                  ? '确认保存并生效'
                  : '确认放弃'}
            </Button>
          </Modal.Footer>
        </Modal>
      </section>
    )
  }
}

FormItem({ type: 'notification-template-manager', autoVar: true, strictMode: false })(
  NotificationTemplateManager
)
export default NotificationTemplateManager
