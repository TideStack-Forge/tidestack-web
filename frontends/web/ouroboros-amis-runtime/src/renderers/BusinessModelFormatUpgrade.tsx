import React from 'react'
import { FormItem, type FormControlProps } from 'amis'
import './BusinessModelFormatUpgrade.scss'

type Preview = {
  requestId: string
  planFingerprint: string
  upgradedModel: Record<string, any>
  resources: {
    path: string
    operation: string
    encoding: string
    before: string | null
    after: string
  }[]
}
type Props = FormControlProps & { appName?: string }
type State = {
  preparing: boolean
  applying: boolean
  error: string
  message: string
  signature: string
  preview: Preview | null
}

export class BusinessModelFormatUpgrade extends React.Component<Props, State> {
  state: State = {
    preparing: false,
    applying: false,
    error: '',
    message: '',
    signature: '',
    preview: null,
  }
  private sequence = 0

  componentWillUnmount() {
    this.sequence += 1
  }

  private draft() {
    return this.props.formStore?.data || this.props.data || {}
  }

  private appName() {
    return this.props.appName || this.props.data?.appName
  }

  private signature() {
    return JSON.stringify([this.appName(), this.draft()])
  }

  private url() {
    const data = this.draft()
    if (!this.appName() || !data.name)
      throw new Error('请先保存业务模型，并选择当前开发应用。')
    const fullName = [data.namespace, data.name].filter(Boolean).join('.')
    return `/api/dev/${encodeURIComponent(this.appName())}/business-model/${encodeURIComponent(fullName)}`
  }

  private async valid() {
    if (
      this.props.formStore &&
      !(await this.props.onAction(null, { actionType: 'validate' }, this.draft()))
    ) {
      throw new Error('表单存在无效输入，请先修正后重新预览。')
    }
  }

  cancel() {
    this.sequence += 1
    this.setState({ preview: null, preparing: false, error: '', signature: '' })
  }

  async loadPreview() {
    const sequence = ++this.sequence
    const signature = this.signature()
    this.setState({ preparing: true, error: '', message: '', preview: null, signature })
    try {
      await this.valid()
      if (sequence !== this.sequence || signature !== this.signature()) return
      const result = await this.props.env.fetcher({
        method: 'post',
        url: `${this.url()}/format-upgrade-preview?requestId=${sequence}`,
        data: JSON.parse(JSON.stringify(this.draft())),
      })
      if (sequence !== this.sequence || signature !== this.signature()) return
      if (!result.ok) throw new Error(result.msg || '升级预览失败')
      const preview: Preview = result.data
      if (preview.requestId !== String(sequence) || !preview.planFingerprint)
        throw new Error('升级响应与当前预览不一致，请重新预览。')
      this.setState({ preview })
    } catch (error) {
      if (sequence === this.sequence) {
        this.setState({ error: error instanceof Error ? error.message : String(error) })
      }
    } finally {
      if (sequence === this.sequence) this.setState({ preparing: false })
    }
  }

  async apply() {
    const { preview, signature } = this.state
    if (!preview || this.state.applying) return
    const sequence = ++this.sequence
    this.setState({ applying: true, error: '', message: '' })
    try {
      await this.valid()
      if (signature !== this.signature())
        throw new Error('草稿已改变，请重新预览完整差异后再确认。')
      if (!this.props.formStore)
        throw new Error('当前页面没有模型编辑表单，请重新打开模型。')
      const result = await this.props.env.fetcher({
        method: 'post',
        url: `${this.url()}/format-upgrade?planFingerprint=${encodeURIComponent(preview.planFingerprint)}`,
        data: JSON.parse(JSON.stringify(this.draft())),
      })
      if (sequence !== this.sequence) return
      if (!result.ok) throw new Error(result.msg || '升级失败，请检查已保存模型后重试。')
      if (result.data?.businessModel?.formatVersion !== '2.0')
        throw new Error('提交结果缺少新版模型，请重新读取已保存模型确认结果。')
      if (signature !== this.signature()) {
        this.setState({
          preview: null,
          message:
            '升级已提交；提交期间草稿发生变化，当前改动未被覆盖。请保留草稿后重新加载模型。',
        })
        return
      }
      this.props.formStore.updateData(result.data.businessModel)
      this.setState({
        preview: null,
        message: '当前模型已升级至 2.0 并提交，关联资源一同保存。',
      })
    } catch (error) {
      if (sequence === this.sequence) {
        this.setState({ error: error instanceof Error ? error.message : String(error) })
      }
    } finally {
      if (sequence === this.sequence) this.setState({ applying: false })
    }
  }

  render() {
    const { preparing, applying, preview, error, message, signature } = this.state
    const version = this.draft().formatVersion
    const legacy = version === undefined || version === '0.1' || version === '1.0'
    const stale = signature !== '' && signature !== this.signature()
    const cx = this.props.classnames
    return (
      <section className="BusinessModelFormatUpgrade" aria-label="模型格式升级">
        <p>
          {legacy
            ? '当前为兼容格式。普通编辑保留原定义；采用动作引用前，请显式升级当前模型。'
            : version === '2.0'
              ? '当前为 2.0 格式：动作唯一定义，自定义功能引用动作。'
              : '无法识别当前格式版本，请修正后再编辑。'}
        </p>
        {legacy ? (
          <button
            type="button"
            className={cx('Button', 'Button--default')}
            disabled={preparing || applying || this.props.disabled || this.props.readOnly}
            onClick={() => void this.loadPreview()}>
            {preparing ? '正在准备完整升级预览…' : '预览升级至 2.0'}
          </button>
        ) : null}
        {stale && preview ? <p role="status">草稿已改变，升级预览已过期。</p> : null}
        {error ? (
          <p role="alert" className="text-danger">
            {error}
          </p>
        ) : null}
        {message ? <p role="status">{message}</p> : null}
        {preview ? (
          <div aria-label="完整升级差异">
            <p>只升级当前模型。以下模型与关联资源将一起提交；取消不会修改文件。</p>
            <p>代码贡献仅核验当前开发环境；运行应用须按现有发布流程更新。</p>
            {preview.resources.map((resource) => (
              <details key={resource.path}>
                <summary>
                  {resource.operation === 'create' ? '新增' : '更新'} · {resource.path}
                </summary>
                <div className="BusinessModelFormatUpgrade-diff">
                  <div>
                    <strong>升级前</strong>
                    <pre>{resource.before ?? '无此资源'}</pre>
                  </div>
                  <div>
                    <strong>
                      升级后{resource.encoding === 'base64' ? '（二进制 Base64）' : ''}
                    </strong>
                    <pre>{resource.after}</pre>
                  </div>
                </div>
              </details>
            ))}
            <button
              type="button"
              className={cx('Button', 'Button--primary')}
              disabled={stale || applying || this.props.disabled || this.props.readOnly}
              onClick={() => void this.apply()}>
              {applying ? '正在升级并提交…' : '确认升级并提交'}
            </button>
            <button
              type="button"
              className={cx('Button', 'Button--default', 'ml-2')}
              disabled={applying}
              onClick={() => this.cancel()}>
              取消升级
            </button>
          </div>
        ) : null}
      </section>
    )
  }
}

FormItem({ type: 'business-model-format-upgrade', autoVar: true, strictMode: false })(
  BusinessModelFormatUpgrade
)
export default BusinessModelFormatUpgrade
