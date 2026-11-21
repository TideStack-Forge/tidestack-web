import React from 'react'
import { FormItem, type FormControlProps } from 'amis'
import { Client } from '#ouroboros-host/utils/http'
import './CompositeViewEditor.scss'

const limits = [
  ['queryTimeoutSeconds', '查询超时', '秒'],
  ['maxPageSize', '最大分页条数', '行'],
  ['maxExportRows', '最大导出条数', '行'],
]

type Props = FormControlProps & { appName?: string }
type State = { policy: Record<string, number> | null; error: string }
export class ExecutionPolicyEditor extends React.Component<Props, State> {
  state: State = { policy: null, error: '' }
  private sequence = 0
  componentDidMount() {
    void this.load()
  }
  componentDidUpdate(previous: Props) {
    if (previous.appName !== this.props.appName) void this.load()
  }
  componentWillUnmount() {
    this.sequence++
  }
  async load() {
    const sequence = ++this.sequence
    const appName = this.props.data?.appName || this.props.appName
    if (!appName) return
    try {
      const response = await Client.get(
        `/api/dev/${encodeURIComponent(appName)}/composite-view/execution-policy`,
        {},
        { isSilent: true },
      )
      if (response.data?.code !== 0)
        throw new Error(response.data?.msg || '执行限制读取失败')
      if (sequence === this.sequence)
        this.setState({ policy: response.data.data, error: '' })
    } catch (error) {
      if (sequence === this.sequence)
        this.setState({
          error: error instanceof Error ? error.message : String(error),
        })
    }
  }
  validate(value = this.props.value) {
    const policy = this.state.policy
    if (!policy) return this.state.error || '执行限制尚未读取'
    return limits.some(
      ([key]) =>
        value?.[key] != null &&
        (!Number.isInteger(value[key]) ||
          value[key] < 1 ||
          value[key] > policy[key]),
    )
      ? '数据集限制必须为正整数，并且不能超过平台上限'
      : ''
  }
  render() {
    const { policy, error } = this.state
    return (
      <section className="statistics-execution-policy">
        <p>留空继承平台配置，填写更小的数值可以收紧限制。</p>
        {error && (
          <div role="alert">
            {error}
            <button type="button" onClick={() => void this.load()}>
              重试
            </button>
          </div>
        )}
        {!policy && !error && <p role="status">正在读取平台配置…</p>}
        {policy && (
          <div className="composite-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>限制项</th>
                  <th>平台配置</th>
                  <th>数据集收紧值</th>
                  <th>最终生效</th>
                </tr>
              </thead>
              <tbody>
                {limits.map(([key, label, unit]) => {
                  const value = this.props.value?.[key]
                  const invalid =
                    value != null &&
                    (!Number.isInteger(value) ||
                      value < 1 ||
                      value > policy[key])
                  return (
                    <tr key={key}>
                      <td>{label}</td>
                      <td>
                        {policy[key].toLocaleString()} {unit}
                      </td>
                      <td>
                        <input
                          type="number"
                          aria-label={`${label}收紧值`}
                          min="1"
                          max={policy[key]}
                          value={value ?? ''}
                          placeholder="继承"
                          aria-invalid={invalid}
                          onChange={(event) => {
                            const next = { ...this.props.value }
                            if (event.target.value === '') delete next[key]
                            else next[key] = Number(event.target.value)
                            this.props.onChange(next)
                          }}
                        />
                        {invalid && (
                          <span className="composite-error">
                            请输入 1–{policy[key]} 的整数
                          </span>
                        )}
                      </td>
                      <td>
                        {Math.min(
                          policy[key],
                          value ?? policy[key],
                        ).toLocaleString()}{' '}
                        {unit}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    )
  }
}
FormItem({ type: 'statistics-execution-policy', autoVar: true })(
  ExecutionPolicyEditor,
)
