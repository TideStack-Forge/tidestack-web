import React from 'react'
import type { FormControlProps } from 'amis'

type Props = FormControlProps & {
  appName?: string
  functionName: string
  modelForm: () => any
}
type Preview = {
  requestId: string
  planFingerprint: string
  actionName: string
  flowName: string
  resources: { path: string; before: string | null; after: string }[]
}
type State = {
  open: boolean
  actionName: string
  scriptLanguage: string
  script: string
  readOnly: boolean
  busy: boolean
  applying: boolean
  signature: string
  error: string
  message: string
  preview: Preview | null
}

/** Local preparation UI; only the official resource batch writes the unique Action and Flow. */
export class BusinessScriptActionCreate extends React.Component<Props, State> {
  state: State = {
    open: false,
    actionName: '',
    scriptLanguage: 'javascript',
    script: '',
    readOnly: true,
    busy: false,
    applying: false,
    signature: '',
    error: '',
    message: '',
    preview: null,
  }
  private sequence = 0

  componentWillUnmount() {
    this.sequence += 1
  }

  private request() {
    return {
      businessModel: JSON.parse(JSON.stringify(this.props.modelForm().data)),
      functionName: this.props.functionName,
      actionName: this.state.actionName,
      scriptLanguage: this.state.scriptLanguage,
      script: this.state.script,
      readOnly: this.state.readOnly,
    }
  }

  private signature() {
    return JSON.stringify([this.props.appName, this.request()])
  }

  private url() {
    const model = this.props.modelForm().data
    if (!this.props.appName || !model.name || !this.props.functionName)
      throw new Error('请先保存业务模型，并选择当前自定义功能。')
    const fullName = [model.namespace, model.name].filter(Boolean).join('.')
    return `/api/dev/${encodeURIComponent(this.props.appName)}/business-model/${encodeURIComponent(fullName)}`
  }

  cancel() {
    if (this.state.applying) return
    this.sequence += 1
    this.setState({ open: false, preview: null, busy: false, error: '', signature: '' })
  }

  async preview() {
    const sequence = ++this.sequence
    this.setState({ busy: true, error: '', message: '', preview: null })
    try {
      if (!(await this.props.modelForm().validate()))
        throw new Error('表单存在无效输入，请先修正后重新预览。')
      const signature = this.signature()
      const result = await this.props.env.fetcher({
        method: 'post',
        url: `${this.url()}/script-action-preview?requestId=${sequence}`,
        data: this.request(),
      })
      if (sequence !== this.sequence || signature !== this.signature()) return
      if (!result.ok) throw new Error(result.msg || '脚本动作预览失败')
      if (result.data?.requestId !== String(sequence) || !result.data?.planFingerprint)
        throw new Error('预览响应不匹配，请重新预览。')
      this.setState({ signature, preview: result.data })
    } catch (error) {
      if (sequence === this.sequence)
        this.setState({ error: error instanceof Error ? error.message : String(error) })
    } finally {
      if (sequence === this.sequence) this.setState({ busy: false })
    }
  }

  async apply() {
    const { preview, signature } = this.state
    if (!preview || this.state.applying) return
    const sequence = ++this.sequence
    this.setState({ applying: true, error: '', message: '' })
    try {
      if (!(await this.props.modelForm().validate()))
        throw new Error('表单存在无效输入，请先修正后重新预览。')
      if (signature !== this.signature())
        throw new Error('草稿或脚本已改变，请重新预览。')
      const result = await this.props.env.fetcher({
        method: 'post',
        url: `${this.url()}/script-action?planFingerprint=${encodeURIComponent(preview.planFingerprint)}`,
        data: this.request(),
      })
      if (sequence !== this.sequence) return
      if (!result.ok) throw new Error(result.msg || '创建脚本动作失败')
      const saved = result.data?.businessModel
      if (saved?.formatVersion !== '2.0')
        throw new Error('返回结果缺少已保存模型，请重新加载确认。')
      if (signature !== this.signature()) {
        this.setState({
          preview: null,
          message:
            '脚本动作已提交；提交期间草稿发生变化，当前改动未被覆盖，请保留草稿后重新加载。',
        })
        return
      }
      this.props.modelForm().updateData(saved)
      this.setState({
        open: false,
        preview: null,
        message: '脚本动作和正式逻辑流已一起提交，当前功能已引用该动作。',
      })
    } catch (error) {
      if (sequence === this.sequence)
        this.setState({ error: error instanceof Error ? error.message : String(error) })
    } finally {
      if (sequence === this.sequence) this.setState({ applying: false })
    }
  }

  render() {
    const {
      open,
      actionName,
      scriptLanguage,
      script,
      readOnly,
      busy,
      applying,
      preview,
      error,
      message,
      signature,
    } = this.state
    const disabled = this.props.disabled || this.props.static || applying
    const cx = this.props.classnames
    let stale = false
    try {
      stale = !!preview && signature !== this.signature()
    } catch {
      stale = true
    }
    return (
      <div aria-label="快捷创建脚本动作">
        <button
          type="button"
          className={cx('Button', 'Button--default')}
          disabled={disabled}
          onClick={() => this.setState({ open: true, error: '', message: '' })}>
          新建脚本动作
        </button>
        {open ? (
          <article>
            <label>
              新动作名称
              <input
                aria-label="新动作名称"
                value={actionName}
                disabled={disabled}
                onChange={(event) => this.setState({ actionName: event.target.value })}
              />
            </label>
            <label>
              脚本语言
              <select
                aria-label="脚本语言"
                value={scriptLanguage}
                disabled={disabled}
                onChange={(event) =>
                  this.setState({ scriptLanguage: event.target.value })
                }>
                <option value="javascript">JavaScript</option>
                <option value="groovy">Groovy</option>
              </select>
            </label>
            <p>
              脚本使用 $input.params、$input.data 和 $input.context。完整同步 HTTP
              请求可从 $input.context.request 访问；手动 invoke 不保证有 HTTP 请求。
            </p>
            {this.props.render(
              'script-action-source',
              {
                type: 'script-editor',
                name: 'scriptSource',
                language: scriptLanguage,
                codeResourceType: 'business-model',
                codeSite: 'business-model.script-action',
                codePointer: '/script',
                intelligenceApi: `/api/dev/${this.props.appName}/code-intelligence/context`,
                changeImmediately: true,
              },
              {
                data: { ...this.props.modelForm().data, __CODE_RESOURCE_DRAFT: this.props.modelForm().data, scriptSource: script },
                onChange: (value: string) => this.setState({ script: value }),
                disabled,
              }
            )}
            <label>
              执行效果
              <select
                aria-label="脚本执行效果"
                value={String(readOnly)}
                disabled={disabled}
                onChange={(event) =>
                  this.setState({ readOnly: event.target.value === 'true' })
                }>
                <option value="true">只读</option>
                <option value="false">允许写入</option>
              </select>
            </label>
            <p>
              将保存当前完整模型草稿，同时创建唯一 Action 和正式
              Flow，再更新本功能引用；原动作保留。须先保存 2.0 模型，取消不修改文件。
            </p>
            <p>
              未配置 HTTP 输入映射时，创建后默认从 request.params 和 request.body 取得
              params / data；已有映射保留。通用 params
              保持原值类型，可在动作契约中进一步声明字段类型。
            </p>
            <button
              type="button"
              className={cx('Button', 'Button--default')}
              disabled={disabled || busy || !actionName || !script.trim()}
              onClick={() => void this.preview()}>
              {busy ? '正在准备资源差异…' : '预览脚本动作资源'}
            </button>
            {stale ? <p role="status">草稿或脚本已修改，预览已过期。</p> : null}
            {preview ? (
              <div aria-label="脚本动作完整资源差异">
                <p>
                  Action：{preview.actionName}；Flow：{preview.flowName}
                </p>
                {preview.resources.map((resource) => (
                  <details key={resource.path}>
                    <summary>{resource.path}</summary>
                    <strong>保存前</strong>
                    <pre>{resource.before ?? '无此资源'}</pre>
                    <strong>保存后</strong>
                    <pre>{resource.after}</pre>
                  </details>
                ))}
                <button
                  type="button"
                  className={cx('Button', 'Button--primary')}
                  disabled={disabled || busy || stale}
                  onClick={() => void this.apply()}>
                  确认创建并提交完整资源
                </button>
              </div>
            ) : null}
            <button
              type="button"
              className={cx('Button', 'Button--default')}
              disabled={applying}
              onClick={() => this.cancel()}>
              取消创建
            </button>
          </article>
        ) : null}
        {error ? <p role="alert">{error}</p> : null}
        {message ? <p role="status">{message}</p> : null}
      </div>
    )
  }
}
