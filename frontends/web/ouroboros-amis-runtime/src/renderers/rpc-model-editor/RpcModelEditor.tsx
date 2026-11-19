import React from 'react'
import { Renderer, RendererProps, ScopedContext, IScopedContext } from 'amis'
import Tabs, { Tab } from 'amis-ui/lib/components/Tabs'
import Modal from 'amis-ui/lib/components/Modal'
import Button from 'amis-ui/lib/components/Button'
import { Client } from '#ouroboros-host/utils/http'
import { RpcModelEditorState, TestInput, Model } from './rpcModelEditorState'
import './RpcModelEditor.scss'

/** One local editor inside the ordinary AMIS Drawer scope. */
export class RpcModelEditor extends React.Component<
  RendererProps,
  { prompt: string; ready: boolean }
> {
  static contextType = ScopedContext
  state = { prompt: '', ready: false }
  editor: RpcModelEditorState
  private formData: Model = {}
  private formVersion = 0
  private allowClose = false

  constructor(props: RendererProps, context: IScopedContext) {
    super(props, context)
    context.registerComponent(this)
    this.editor = new RpcModelEditorState(
      props.data.appName,
      async (method, url, data, timeout) => {
        const response = await Client.request(method, url, data, {
          isSilent: true,
          throwOnError: false,
          authRefreshRetry: true,
          ...(timeout ? { timeout } : {}),
        })
        const payload = response.data
        if (
          payload.code !== 0 &&
          payload.status !== 0 &&
          !(url.endsWith('/test') && payload.data?.testId)
        )
          throw new Error(payload.msg || '操作失败，请核对工作区状态后重试')
        return payload.data
      },
      () => this.updated()
    )
  }

  async componentDidMount() {
    this.editor.tab = this.props.initialTab === 'test' ? 'test' : 'config'
    await this.editor.load(this.props.mode === 'add' ? undefined : this.props.data.name)
    this.syncForm()
    if (!this.editor.disposed) this.setState({ ready: true })
  }

  componentWillUnmount() {
    this.editor.dispose()
    this.editor
      .releaseLock()
      .catch((error) =>
        this.props.env.notify(
          'error',
          `RPC 编辑锁释放失败，请在资源锁管理中处理：${String(error)}`
        )
      )
    ;(this.context as IScopedContext).unRegisterComponent(this)
  }

  private drawer(): any {
    let scope = this.context as IScopedContext | undefined
    while (scope) {
      if (scope.component?.props.type === 'drawer') return scope.component
      scope = scope.parent
    }
    return undefined
  }

  private updated() {
    if (this.editor.disposed) return
    const state = this.editor
    const projection = {
      __rpcEditor: {
        busy: state.busy,
        dirty: state.dirty,
        tab: state.tab,
        canTest: state.canTest,
        canEdit: state.canEdit,
        canSubmit:
          state.canEdit && (state.dirty || state.pendingCommit || state.commitConfirmed),
        testDisabledReason: state.testDisabledReason,
        allowClose: this.allowClose,
      },
    }
    const store = this.drawer()?.props.store
    store?.updateData(projection)
    if (store?.form && Object.prototype.hasOwnProperty.call(store.form, '__rpcEditor')) {
      store.setFormData({ ...store.form, ...projection })
    }
    this.forceUpdate()
  }

  private syncForm() {
    this.formData = {
      ...this.editor.draft,
      appName: this.editor.appName,
      add: !this.editor.identity,
    }
    this.formVersion++
  }

  private async validate() {
    const form: any = (this.context as IScopedContext).getComponentById(
      'rpc-model-config'
    )
    await form?.flush()
    if (!form || !(await form.validate())) {
      this.editor.tab = 'config'
      this.editor.error = '请先修正模型配置中的无效输入'
      this.updated()
      return false
    }
    this.editor.change(form.props.store.data)
    return true
  }

  async doAction(action: any) {
    switch (action.actionType) {
      case 'rpc-save':
        return this.save()
      case 'rpc-submit':
        if (!this.editor.busy && this.editor.canEdit) this.setState({ prompt: 'commit' })
        return
      case 'rpc-test': {
        const form: any = (this.context as IScopedContext).getComponentById(
          'rpc-model-config'
        )
        await form?.flush()
        if (form) this.editor.change(form.props.store.data)
        for (const [id, field] of [
          ['rpc-test-variables', 'variables'],
          ['rpc-test-configs', 'configs'],
        ] as const) {
          const inputs: any = (this.context as IScopedContext).getComponentById(id)
          await inputs?.flush()
          if (inputs) {
            if (field === 'configs')
              this.editor.configurationChanged(inputs.props.store.data.items)
            else this.editor.variables = inputs.props.store.data.items
          }
        }
        return this.editor.test()
      }
      case 'rpc-close':
        return this.requestClose()
      default:
        return
    }
  }

  private async save() {
    if (!(await this.validate())) return false
    const success = await this.editor.save()
    if (success) {
      this.syncForm()
      this.updated()
    }
    return success
  }

  private async submit() {
    const messageForm: any = (this.context as IScopedContext).getComponentById(
      'rpc-commit-message'
    )
    await messageForm?.flush()
    if (messageForm)
      this.editor.commitMessage = messageForm.props.store.data.message || ''
    const form: any = (this.context as IScopedContext).getComponentById(
      'rpc-model-config'
    )
    await form?.flush()
    if (form) this.editor.change(form.props.store.data)
    if (this.editor.dirty && !(await this.validate())) return
    const success = await this.editor.commit()
    if (success) await this.finishClose()
    else {
      this.syncForm()
      this.updated()
    }
  }

  private async requestClose() {
    const form: any = (this.context as IScopedContext).getComponentById(
      'rpc-model-config'
    )
    if (form && !this.editor.busy) {
      await form.flush()
      this.editor.change(form.props.store.data)
    }
    if (this.editor.busy && this.editor.phase !== 'testing') return
    if (this.editor.phase === 'testing') {
      this.setState({ prompt: 'testing' })
      return
    }
    if (this.editor.dirty) {
      this.setState({ prompt: 'dirty' })
      return
    }
    await this.finishClose()
  }

  private async finishClose() {
    try {
      await this.editor.releaseLock()
      this.allowClose = true
      this.updated()
      this.setState({ prompt: '' })
      await this.props.onAction(
        undefined,
        { actionType: 'cancel', reload: true },
        this.props.data
      )
      // Refresh the ordinary owner CRUD after saved/committed workspace changes.
      this.drawer()?.context?.parent?.component?.reload?.()
    } catch (error) {
      this.editor.fail(error)
    }
  }

  private inputTable(inputs: TestInput[], configuration = false) {
    return this.props.render(
      configuration ? 'configs' : 'variables',
      {
        type: 'form',
        id: configuration ? 'rpc-test-configs' : 'rpc-test-variables',
        lazyChange: false,
        wrapWithPanel: false,
        actions: [],
        body: [
          {
            type: 'input-table',
            name: 'items',
            label: false,
            needConfirm: false,
            addable: false,
            removable: false,
            editable: true,
            columns: [
              { name: 'name', label: configuration ? '配置项' : '变量', type: 'static' },
              ...(configuration
                ? [{ name: 'override', label: '覆盖默认值', type: 'switch' }]
                : [
                    {
                      name: 'provided',
                      label: '传入',
                      type: 'switch',
                      disabledOn: '${required}',
                    },
                    {
                      name: 'type',
                      label: '类型',
                      type: 'select',
                      clearable: false,
                      options: ['string', 'number', 'boolean', 'object', 'array', 'null'],
                    },
                  ]),
              {
                name: 'value',
                label: '测试值',
                type: configuration ? 'input-password' : 'group',
                ...(configuration
                  ? {
                      disabledOn: '${!override}',
                      placeholder: '本次覆盖值',
                    }
                  : {
                      direction: 'vertical',
                      body: [
                        {
                          name: 'value',
                          type: 'textarea',
                          visibleOn: '${!sensitive}',
                          disabledOn: '${!provided}',
                          placeholder:
                            '${type === "object" || type === "array" ? "输入 JSON" : "输入测试值"}',
                        },
                        {
                          name: 'value',
                          type: 'input-password',
                          visibleOn: '${sensitive}',
                          disabledOn: '${!provided}',
                        },
                      ],
                    }),
              },
              { name: 'references', label: '引用位置', type: 'static', joinValues: true },
            ],
          },
        ],
      },
      {
        data: { items: inputs },
        disabled: this.editor.busy,
        onChange: (data: any) => {
          if (configuration) this.editor.configurationChanged(data.items)
          else {
            this.editor.variables = data.items
            this.editor.inputChanged()
          }
        },
      }
    )
  }

  private json(region: string, value: any) {
    return value == null ? (
      <p className="text-muted">暂无数据</p>
    ) : (
      this.props.render(region, { type: 'json', value, levelExpand: 2 })
    )
  }

  private prompt() {
    const { prompt } = this.state
    const editor = this.editor
    return (
      <Modal
        show={Boolean(prompt)}
        onHide={() => !editor.busy && this.setState({ prompt: '' })}
        closeOnOutside={false}
        closeOnEsc={!editor.busy}
        size="md">
        <Modal.Header>
          <Modal.Title>
            {prompt === 'commit' ? '提交 RPC 模型' : '关闭编辑器'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {prompt === 'commit' ? (
            <>
              <p>保存当前模型并提交至版本库，成功后关闭抽屉。</p>
              {this.props.render(
                'commit-message',
                {
                  type: 'form',
                  id: 'rpc-commit-message',
                  lazyChange: false,
                  actions: [],
                  wrapWithPanel: false,
                  body: [
                    {
                      type: 'textarea',
                      name: 'message',
                      label: '提交信息',
                      required: true,
                      maxLength: 200,
                      placeholder: '说明本次修改内容（1～200 个字符）',
                    },
                  ],
                },
                {
                  data: { message: editor.commitMessage },
                  disabled: editor.busy,
                  onChange: (data: any) => {
                    editor.commitMessage = data.message || ''
                    this.forceUpdate()
                  },
                }
              )}
            </>
          ) : (
            <p>
              {prompt === 'testing'
                ? '测试请求已发出，关闭后目标服务可能继续执行。仍要关闭吗？'
                : '当前有未保存的修改，请选择如何处理。'}
            </p>
          )}
          {editor.error && (
            <div role="alert" className="text-danger">
              {editor.error}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            onClick={() => this.setState({ prompt: '' })}
            disabled={editor.busy && prompt !== 'testing'}>
            继续编辑
          </Button>
          {prompt === 'commit' ? (
            <Button
              level="primary"
              loading={editor.busy}
              disabled={
                editor.busy ||
                !editor.commitMessage.trim() ||
                editor.commitMessage.trim().length > 200
              }
              onClick={() => this.submit()}>
              确认提交
            </Button>
          ) : (
            <>
              <Button level="danger" onClick={() => this.finishClose()}>
                {prompt === 'testing' ? '关闭' : '放弃修改并关闭'}
              </Button>
              {prompt === 'dirty' && (
                <Button
                  level="success"
                  onClick={async () => {
                    if (await this.save()) await this.finishClose()
                  }}>
                  保存并关闭
                </Button>
              )}
            </>
          )}
        </Modal.Footer>
      </Modal>
    )
  }

  render() {
    const editor = this.editor
    if (!this.state.ready) return <p>正在加载模型…</p>
    return (
      <div className="rpc-model-editor">
        {editor.error && (
          <div role="alert" className="alert alert-danger">
            {editor.error}
          </div>
        )}
        <Tabs
          tabsMode="line"
          className="rpc-model-editor__main-tabs"
          activeKey={editor.tab}
          onSelect={(key: string | number) => {
            editor.tab = String(key)
            this.updated()
          }}>
          <Tab
            eventKey="config"
            title="模型配置"
            mountOnEnter={false}
            unmountOnExit={false}>
            {this.props.render('config', this.props.configForm, {
              key: this.formVersion,
              data: this.formData,
              disabled: editor.busy || !editor.canEdit,
              onChange: (data: Model) => editor.change(data),
              onInit: (data: Model) => editor.change(data),
            })}
          </Tab>
          <Tab eventKey="test" title="接口测试" mountOnEnter={true} unmountOnExit={false}>
            {editor.init?.model?.request && (
              <div className="rpc-model-editor__endpoint">
                <span className="rpc-model-editor__method">
                  {editor.init.model.request.method}
                </span>
                <code>{editor.init.model.request.url}</code>
              </div>
            )}
            {(editor.testDisabledReason || editor.phase === 'testing') && (
              <p className="rpc-model-editor__test-state" role="status">
                {editor.phase === 'testing'
                  ? '正在运行测试，配置和测试输入已锁定'
                  : editor.testDisabledReason}
              </p>
            )}
            {!editor.init && !editor.initializing && !editor.dirty && editor.identity && (
              <Button
                size="sm"
                disabled={editor.busy}
                onClick={() => editor.initialize()}>
                重新加载测试参数
              </Button>
            )}
            {editor.resultStale && (
              <div role="status" className="alert alert-warning m-t">
                配置或测试输入已变化，以下结果仅供参考，请重新运行测试。
              </div>
            )}
            <Tabs
              tabsMode="radio"
              className="rpc-model-editor__test-tabs"
              activeKey={editor.testTab}
              onSelect={(key: string | number) => {
                editor.testTab = String(key)
                this.updated()
              }}>
              <Tab
                eventKey="parameters"
                title="测试参数"
                mountOnEnter={false}
                unmountOnExit={false}>
                {editor.variables.length > 0 && (
                  <section className="rpc-model-editor__inputs">
                    <h4>请求变量</h4>
                    {this.inputTable(editor.variables)}
                  </section>
                )}
                {editor.configs.length > 0 && (
                  <section className="rpc-model-editor__inputs">
                    <h4>配置覆盖</h4>
                    {this.inputTable(editor.configs, true)}
                  </section>
                )}
                {editor.init && !editor.variables.length && !editor.configs.length && (
                  <div className="rpc-model-editor__empty">无需填写测试参数</div>
                )}
              </Tab>
              <Tab eventKey="request" title="请求详情">
                {this.json(
                  'requests',
                  editor.result
                    ? {
                        request: editor.result.request,
                        attempts: editor.result.attempts,
                        authenticationCalls: editor.result.authenticationCalls,
                      }
                    : null
                )}
              </Tab>
              <Tab eventKey="response" title="响应结果">
                {editor.result && (
                  <div className="rpc-model-editor__result" role="status">
                    <span
                      className={
                        editor.result.success
                          ? 'rpc-model-editor__result-status is-success'
                          : 'rpc-model-editor__result-status is-error'
                      }>
                      <i
                        className={
                          editor.result.success
                            ? 'fa fa-check-circle'
                            : 'fa fa-circle-xmark'
                        }
                        aria-hidden="true"
                      />
                      {editor.result.success ? '请求成功' : '请求失败'}
                      {editor.result.response?.status &&
                        ` · ${editor.result.response.status}`}
                    </span>
                    <span>{editor.result.durationMs} ms</span>
                    <span>{editor.result.attemptCount} 次请求</span>
                  </div>
                )}
                {editor.result?.error && this.json('error', editor.result.error)}
                {editor.result?.response ? (
                  <>
                    <pre className="rpc-model-editor__body">
                      {editor.result.response.body?.text ??
                        editor.result.response.body?.omittedReason ??
                        '无响应体'}
                    </pre>
                    {editor.result.response.body?.truncated && (
                      <p role="status">响应预览已截断</p>
                    )}
                    <details className="rpc-model-editor__headers">
                      <summary>响应头</summary>
                      {this.json('response-headers', editor.result.response.headers)}
                    </details>
                  </>
                ) : !editor.result ? (
                  <div className="rpc-model-editor__empty">运行测试后查看响应</div>
                ) : null}
              </Tab>
            </Tabs>
          </Tab>
        </Tabs>
        {this.prompt()}
      </div>
    )
  }
}

Renderer({ type: 'rpc-model-editor', autoVar: false })(RpcModelEditor)
