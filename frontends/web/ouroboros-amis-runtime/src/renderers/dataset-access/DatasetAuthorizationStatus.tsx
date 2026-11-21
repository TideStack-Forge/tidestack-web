import React from 'react'
import { Button, Renderer } from 'amis'
import { Client } from '#ouroboros-host/utils/http'
import './DatasetAuthorizationStatus.scss'

type Props = { datasetName?: string }
type State = { loading: boolean; error: string; grants: string[] | null }

class DatasetAuthorizationStatus extends React.Component<Props, State> {
  state: State = { loading: true, error: '', grants: null }
  private request = 0

  componentDidMount() {
    void this.load()
  }

  componentDidUpdate(previous: Props) {
    if (previous.datasetName !== this.props.datasetName) {
      void this.load()
    }
  }

  componentWillUnmount() {
    this.request += 1
  }

  load = async () => {
    const request = ++this.request
    this.setState({ loading: true, error: '', grants: null })
    try {
      const response = await Client.get('/api/auth/authorities', {}, { isSilent: true })
      if (response.data?.code !== 0) {
        throw new Error(response.data?.msg || '授权状态读取失败')
      }
      if (request === this.request) {
        this.setState({
          loading: false,
          grants: Object.keys(response.data.data || {}).map(name => name.toLowerCase()),
        })
      }
    } catch (error) {
      if (request === this.request) {
        this.setState({ loading: false, error: error instanceof Error ? error.message : String(error) })
      }
    }
  }

  authorizationStatus(authority: string) {
    const { loading, error, grants } = this.state
    if (loading) return '读取中'
    if (error || !this.props.datasetName) return '未读取'
    return grants?.includes(authority.toLowerCase()) ? '已授权' : '未授权'
  }

  render() {
    const { error } = this.state
    const name = this.props.datasetName?.toLowerCase()
    return (
      <section className="statistics-dataset-authorization" aria-label="当前登录环境授权">
        <div className="statistics-dataset-access-title">当前登录环境授权</div>
        {error && (
          <div role="alert">
            {error} <Button type="button" level="link" onClick={this.load}>重试</Button>
          </div>
        )}
        <dl>
          {['execute', 'export'].map(operation => {
            const authority = `statisticsReporting.runtime.dataset.${name}.${operation}`
            return (
              <React.Fragment key={operation}>
                <dt>{operation === 'execute' ? '查询权限' : '导出权限'}</dt>
                <dd>
                  <span>{this.authorizationStatus(authority)}</span>
                  {name && <code>{authority}</code>}
                </dd>
              </React.Fragment>
            )
          })}
        </dl>
        <p className="text-muted text-xs">授权由平台权限管理分配，预览结果不代表目标运行环境的访问权限。</p>
      </section>
    )
  }
}

Renderer({ type: 'dataset-authorization-status', autoVar: true })(DatasetAuthorizationStatus as any)
export default DatasetAuthorizationStatus
