import React from 'react'
import { FormItem, type FormControlProps } from 'amis'
import './BusinessBehaviorEditor.scss'
import { BusinessScriptActionCreate } from './BusinessScriptActionCreate'

type Props = FormControlProps & { appName?: string }
type Action = { name: string; title?: string; isEnabled?: boolean }
type Source = {
  memberType: string
  memberName: string
  role: string
  kind: string
  source: { resource: string; fieldPath: string }
}
type State = {
  loading: boolean
  signature: string
  actions: Action[]
  sources: Source[]
  diagnostics: string[]
  error: string
}

/** A function owns its HTTP configuration; the referenced Action stays at its original source. */
export class BusinessActionReference extends React.Component<Props, State> {
  state: State = {
    loading: false,
    signature: '',
    actions: [],
    sources: [],
    diagnostics: [],
    error: '',
  }
  private sequence = 0

  componentWillUnmount() {
    this.sequence += 1
  }

  private modelForm() {
    let modelForm
    for (let store = this.props.formStore; store; store = store.parentStore) {
      if (store.storeType === 'FormStore' && store.data?.modelType === 'default') {
        modelForm = store
      }
    }
    if (!modelForm) throw new Error('未找到业务模型根表单，不能用功能行代替完整草稿。')
    return modelForm
  }

  private signature() {
    return JSON.stringify([this.props.appName, this.modelForm().data])
  }

  async loadActions() {
    const sequence = ++this.sequence
    this.setState({ loading: true, error: '' })
    try {
      const form = this.modelForm()
      const signature = this.signature()
      if (!this.props.appName) throw new Error('缺少当前开发应用，无法预览动作。')
      if (!(await form.validate()))
        throw new Error('表单存在无效输入，请先修正后重新预览。')
      if (sequence !== this.sequence || signature !== this.signature()) return
      const requestId = String(sequence)
      const result = await this.props.env.fetcher({
        method: 'post',
        url: `/api/dev/${encodeURIComponent(this.props.appName)}/business-model/behavior-preview?requestId=${requestId}`,
        data: JSON.parse(JSON.stringify(form.data)),
      })
      if (sequence !== this.sequence || signature !== this.signature()) return
      if (!result.ok) throw new Error(result.msg || '动作预览失败')
      if (result.data.requestId !== requestId)
        throw new Error('预览响应不匹配，请重新预览。')
      this.setState({
        signature,
        loading: false,
        actions: result.data.catalog?.actions || [],
        sources: result.data.catalog?.sources || [],
        diagnostics: result.data.validationSnapshot?.validationErrors || [],
      })
    } catch (error) {
      if (sequence !== this.sequence) return
      this.setState({
        loading: false,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  setMode(mode: string) {
    const api = { ...this.props.value, implementationMode: mode }
    if (mode === 'WEB_API') delete api.action
    this.props.onChange(api, undefined, true)
  }

  setAction(action: string) {
    const api = { ...this.props.value }
    if (action) api.action = action
    else delete api.action
    this.props.onChange(api, undefined, true)
  }

  render() {
    const api = this.props.value || {}
    const disabled = this.props.disabled || this.props.static || this.props.data?.readOnly
    let stale = false
    try {
      stale = !!this.state.signature && this.state.signature !== this.signature()
    } catch {
      stale = true
    }
    const selected = this.state.actions.find((action) => action.name === api.action)
    const sources = this.state.sources.filter(
      (source) =>
        source.memberType === 'action' &&
        source.memberName === api.action &&
        source.role === 'definition'
    )
    return (
      <section className="BusinessBehaviorEditor" aria-label="功能实现方式">
        <label>
          实现方式
          <select
            aria-label="实现方式"
            value={api.implementationMode || ''}
            disabled={disabled}
            onChange={(event) => this.setMode(event.target.value)}>
            <option value="" disabled>
              请选择实现方式
            </option>
            <option value="ACTION">调用业务动作</option>
            <option value="WEB_API">调用普通接口</option>
          </select>
        </label>
        <p>
          调用业务动作：HTTP 与 invoke 共用目标 Action
          的契约、权限和执行过程。调用普通接口：由高代码 Controller 实现 REST 接口。
        </p>
        {api.implementationMode === 'ACTION' ? (
          <>
            <button
              type="button"
              className={this.props.classnames('Button', 'Button--default')}
              onClick={() => void this.loadActions()}>
              {this.state.loading ? '重新请求动作预览' : '读取完整草稿的动作'}
            </button>
            <label>
              引用 Action
              <select
                aria-label="引用 Action"
                value={api.action || ''}
                disabled={disabled || stale}
                onChange={(event) => this.setAction(event.target.value)}>
                <option value="">请选择动作</option>
                {api.action && !selected ? (
                  <option value={api.action}>{api.action}（来源未核验，保留引用）</option>
                ) : null}
                {this.state.actions.map((action) => (
                  <option key={action.name} value={action.name}>
                    {action.title || action.name} · {action.name}
                    {action.isEnabled === false ? '（已停用）' : ''}
                  </option>
                ))}
              </select>
            </label>
            <p>
              目录只覆盖当前开发环境实际加载的贡献；未查到代码动作不会清空已有引用。多个功能可以复用同一动作，关闭此
              API 不会停用目标动作。
            </p>
            {sources.map((source, index) => (
              <p key={index}>
                动作来源：{source.kind} · {source.source.resource} :{' '}
                {source.source.fieldPath}
              </p>
            ))}
            <p>
              新增或编辑动作请到“业务行为契约”的动态动作定义，代码动作在原注解或 Handler
              中维护。
            </p>
            <BusinessScriptActionCreate
              {...this.props}
              functionName={this.props.formStore?.data?.name}
              modelForm={() => this.modelForm()}
              disabled={disabled}
            />
            <button
              type="button"
              onClick={() =>
                this.props.onAction(
                  null,
                  {
                    actionType: 'changeActiveKey',
                    componentId: 'business-model-config-tabs',
                    args: { activeKey: 'behaviors' },
                  },
                  this.props.data
                )
              }>
              打开业务行为契约
            </button>
          </>
        ) : null}
        {stale ? <p role="status">草稿已修改，动作预览已过期，请重新读取。</p> : null}
        {this.state.error ? <p role="alert">{this.state.error}</p> : null}
        {this.state.diagnostics.map((message, index) => (
          <p role="alert" key={index}>
            {message}
          </p>
        ))}
      </section>
    )
  }
}

@FormItem({ type: 'business-action-reference', autoVar: true })
export class BusinessActionReferenceRenderer extends BusinessActionReference {}
