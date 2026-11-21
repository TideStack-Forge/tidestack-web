import React from 'react'
import { Icon, Renderer, type RendererProps } from 'amis'
import { openMenuItem } from '#ouroboros-host/common/menus'
import tabs from '#ouroboros-host/common/tabs'
import { Client } from '#ouroboros-host/utils/http'
import {
  capabilities,
  capabilityRelations,
  capabilityTitle,
  dashboardCatalog,
  dashboardMenuPath,
  relationTypes,
  type Capability,
  type DashboardEntry,
  type DashboardMenu,
} from './dev-app-dashboard'
import {
  DevAppDashboardCircuit,
  matchesCapability,
  type DashboardSelection,
} from './DevAppDashboardCircuit'
import './DevAppDashboard.scss'

type State = {
  view: 'relations' | 'matrix'
  selection: DashboardSelection
  query: string
  motion: boolean
  reducedMotion: boolean
  loading: boolean
  error: string
  menus: DashboardMenu[]
  app: { title?: string; name?: string; icon?: string; description?: string }
  recent: { message: string; authorName?: string; time?: number }[]
}
const groupTones: Record<string, string> = {
  DataAndModels: 'backend',
  UIDesign: 'presentation',
  BusinessLogic: 'service',
  OrganizationManagement: 'backend',
  Integration: 'service',
  BasicConfiguration: 'backend',
  ApplicationManagement: 'business',
  OperationsMonitoring: 'service',
  AdvancedFeatures: 'backend',
}

function MenuIcon({ icon = 'fas fa-list-ul' }: { icon?: string }) {
  return (
    <Icon
      icon={icon.startsWith('icon-') ? { id: `svg-${icon}` } : icon}
      vendor=""
      className="menu-source-icon"
    />
  )
}

function MatrixEntry({
  entry,
  onOpen,
}: {
  entry: DashboardEntry
  onOpen(menu: DashboardMenu): void
}) {
  return (
    <button
      type="button"
      className="matrix-entry"
      title={entry.breadcrumb.join(' / ')}
      onClick={() => onOpen(entry.menu)}>
      <MenuIcon icon={entry.menu.icon} />
      <span>{entry.menu.displayTitle || entry.menu.title}</span>
    </button>
  )
}

export class DevAppKanban extends React.Component<RendererProps, State> {
  state: State = {
    view: 'relations',
    selection: { kind: 'node', id: 'business-model' },
    query: '',
    motion: true,
    reducedMotion: false,
    loading: true,
    error: '',
    menus: [],
    app: {},
    recent: [],
  }
  private sequence = 0
  private reducedMotion?: MediaQueryList
  private search = React.createRef<HTMLInputElement>()
  private tabRefs = [
    React.createRef<HTMLButtonElement>(),
    React.createRef<HTMLButtonElement>(),
  ]
  private id = `dev-dashboard-${Math.random().toString(36).slice(2)}`

  componentDidMount() {
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    this.setState({ reducedMotion: this.reducedMotion.matches })
    this.reducedMotion.addEventListener('change', this.motionChanged)
    void this.load()
  }
  componentDidUpdate(previous: RendererProps) {
    if (previous.data?.appName !== this.props.data?.appName) void this.load()
  }
  componentWillUnmount() {
    this.sequence++
    this.reducedMotion?.removeEventListener('change', this.motionChanged)
  }
  private motionChanged = (event: MediaQueryListEvent) =>
    this.setState({ reducedMotion: event.matches })
  async load() {
    const sequence = ++this.sequence
    this.setState({ loading: true, error: '', menus: [], app: {}, recent: [] })
    try {
      const appName = this.props.data?.appName
      if (!appName) throw new Error('缺少开发应用，请重新进入应用开发看板')
      const base = `/api/dev/${encodeURIComponent(appName)}`
      const [app, workspace, recent] = await Promise.all(
        [
          'setting/init-form',
          'dev-workspace-menu',
          'version/recent-change-log?limit=3',
        ].map(async (suffix) => {
          const response = await Client.get(`${base}/${suffix}`)
          const body = response.data
          if (body?.code !== 0 || !body.data)
            throw new Error(body?.msg || '应用开发看板加载失败')
          return body.data
        })
      )
      if (sequence !== this.sequence) return
      if (!Array.isArray(workspace.main)) throw new Error('开发菜单数据无效')
      this.setState({
        app,
        menus: workspace.main,
        recent: recent.items || [],
        loading: false,
      })
    } catch (error) {
      if (sequence === this.sequence)
        this.setState({
          loading: false,
          error: error instanceof Error ? error.message : String(error),
        })
    }
  }
  private openMenu = (menu: DashboardMenu) => {
    void Promise.resolve(openMenuItem(menu)).catch((error) =>
      this.setState({ error: error instanceof Error ? error.message : String(error) })
    )
  }
  private menuFor(capability: Capability) {
    const catalog = dashboardCatalog(this.state.menus)
    return [
      ...catalog.standalone,
      ...catalog.groups.flatMap((group) => group.entries),
    ].find((entry) =>
      dashboardMenuPath(entry.menu).split(/[?#]/)[0].endsWith(`/${capability.route}`)
    )?.menu
  }
  private openCapability = (capability: Capability) => {
    const menu = this.menuFor(capability)
    if (menu) this.openMenu(menu)
  }
  private openPage = (path: string) => {
    void Promise.resolve(
      tabs.openOrSwitchTab(`/dev/${encodeURIComponent(this.props.data.appName)}/${path}`)
    ).catch((error) =>
      this.setState({ error: error instanceof Error ? error.message : String(error) })
    )
  }
  private openVisualModeling = () => {
    const menu = this.menuFor(capabilities[0])
    if (menu)
      this.openMenu({ ...menu, url: `${dashboardMenuPath(menu)}?view=visual-modeling` })
  }
  private switchView = (view: State['view']) => this.setState({ view })
  private matchesEntry = (entry: DashboardEntry) =>
    `${entry.breadcrumb.join(' ')} ${entry.menu.fullName}`
      .toLowerCase()
      .includes(this.state.query.trim().toLowerCase())

  private renderContext() {
    const { selection } = this.state
    if (!selection)
      return (
        <>
          <div className="context-copy">
            <h2>应用能力</h2>
            <p>选择节点或连线，查看能力与关系方向。</p>
          </div>
        </>
      )
    const clear = (
      <button
        type="button"
        className="context-close"
        aria-label="清除选择"
        onClick={() => this.setState({ selection: null })}>
        ×
      </button>
    )
    if (selection.kind === 'relationship') {
      const edge = capabilityRelations.find((item) => item.id === selection.id)!
      const source = capabilities.find((item) => item.id === edge.from)!
      const target = capabilities.find((item) => item.id === edge.to)!
      return (
        <>
          <span className={`relation-tag relation-tag--${edge.type}`}>
            {relationTypes[edge.type].title}
          </span>
          <div className="context-copy">
            <h2>
              {capabilityTitle(source)}
              <span className="direction-text"> → </span>
              {capabilityTitle(target)}
            </h2>
            <p>{edge.description}</p>
          </div>
          <div className="context-actions">
            <button
              type="button"
              className="cxd-Button cxd-Button--default cxd-Button--size-default"
              onClick={() =>
                this.setState({ selection: { kind: 'node', id: source.id } })
              }>
              查看来源
            </button>
            <button
              type="button"
              className="cxd-Button cxd-Button--default cxd-Button--size-default"
              onClick={() =>
                this.setState({ selection: { kind: 'node', id: target.id } })
              }>
              查看目标
            </button>
            {clear}
          </div>
        </>
      )
    }
    const item = capabilities.find((item) => item.id === selection.id)!
    const available = !!this.menuFor(item)
    return (
      <>
        <div className="context-icon">
          <Icon icon={`fa ${item.icon}`} vendor="" />
        </div>
        <div className="context-copy">
          <h2>
            {item.title}
            {item.subtitle && ` · ${item.subtitle}`}
          </h2>
          <p>{item.description}</p>
        </div>
        <div className="context-actions">
          {item.id === 'business-model' && (
            <button
              type="button"
              className="cxd-Button cxd-Button--default cxd-Button--size-default"
              disabled={!available}
              onClick={this.openVisualModeling}>
              可视化建模 <Icon icon="fa fa-external-link" vendor="" />
            </button>
          )}
          <button
            type="button"
            className="cxd-Button cxd-Button--primary cxd-Button--size-default"
            disabled={!available}
            title={available ? undefined : '当前应用未提供该开发入口'}
            onClick={() => this.openCapability(item)}>
            {['menu', 'permission'].includes(item.id)
              ? '在模块树中管理'
              : `打开${item.title}`}{' '}
            <Icon icon="fa fa-angle-right" vendor="" />
          </button>
          {clear}
        </div>
      </>
    )
  }
  render() {
    const { view, query, menus, app, loading, error, motion, reducedMotion, recent } =
      this.state
    const normalizedQuery = query.trim().toLowerCase()
    const catalog = dashboardCatalog(menus)
    const entries = [
      ...catalog.standalone,
      ...catalog.groups.flatMap((group) => group.entries),
    ]
    const matching =
      view === 'relations'
        ? capabilities.filter((item) => matchesCapability(item, normalizedQuery)).length
        : entries.filter(this.matchesEntry).length
    return (
      <main
        className="dev-app-dashboard"
        aria-label="应用开发看板"
        aria-busy={loading}
        onKeyDown={(event) => {
          if (event.key === '/' && !(event.target instanceof HTMLInputElement)) {
            event.preventDefault()
            this.search.current?.focus()
          }
          if (event.key === 'Escape') this.setState({ selection: null })
        }}>
        <header className="dashboard-heading">
          <div className="dashboard-app">
            <span className="dashboard-app-icon">
              <Icon icon={app.icon || 'fa fa-cubes'} vendor="" />
            </span>
            <div>
              <h1>{app.title || this.props.data?.appName}</h1>
              <p>
                {app.name || this.props.data?.appName}
                <span className="app-caption-divider">·</span>
                <button
                  type="button"
                  className="app-recent"
                  title={recent
                    .map((item) => `${item.message} ${item.authorName || ''}`)
                    .join('\n')}
                  onClick={() => this.openPage('versions')}>
                  最近提交{recent[0] && <span>{recent[0].message}</span>}
                </button>
              </p>
            </div>
          </div>
          <div className="dashboard-actions">
            {['configuration', 'extend-jar-management'].map((id) => {
              const item = capabilities.find((item) => item.id === id)!
              return (
                <button
                  key={id}
                  type="button"
                  className={`capability-tool ${normalizedQuery && matchesCapability(item, normalizedQuery) ? 'is-match' : ''}`}
                  disabled={!this.menuFor(item)}
                  onClick={() => this.openCapability(item)}>
                  <Icon icon={`fa ${item.icon}`} vendor="" />
                  {item.title}
                </button>
              )
            })}
            <span className="action-divider" aria-hidden="true" />
            <button
              type="button"
              className="cxd-Button cxd-Button--default cxd-Button--size-default"
              onClick={() => this.openPage('app-setting')}>
              <Icon icon="fa fa-cog" vendor="" /> 应用配置
            </button>
            <button
              type="button"
              className="cxd-Button cxd-Button--default cxd-Button--size-default"
              onClick={() => this.openPage('versions')}>
              <Icon icon="fa fa-code-fork" vendor="" /> 版本管理
            </button>
            {this.props.data?.canManageEditAccess &&
              this.props.render('edit-access', {
                type: 'button',
                label: '编辑权限',
                icon: 'fa fa-user-shield',
                actionType: 'dialog',
                dialog: {
                  title: '编辑权限',
                  size: 'lg',
                  url: `/dev/${encodeURIComponent(this.props.data.appName)}/edit-access`,
                  showCloseButton: true,
                  showErrorMsg: true,
                  showLoading: true,
                  closeOnEsc: false,
                },
              })}
          </div>
        </header>
        <div className="dashboard-viewbar">
          <div className="cxd-Tabs cxd-Tabs--line dashboard-tabs">
            <div
              className="cxd-Tabs-links"
              role="tablist"
              aria-label="开发面板视图"
              onKeyDown={(event) => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key))
                  return
                event.preventDefault()
                const next =
                  event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? 1
                      : view === 'relations'
                        ? 1
                        : 0
                this.switchView(next === 0 ? 'relations' : 'matrix')
                this.tabRefs[next].current?.focus()
              }}>
              {(['relations', 'matrix'] as const).map((key, index) => (
                <div
                  key={key}
                  className={`cxd-Tabs-link ${view === key ? 'is-active' : ''}`}>
                  <button
                    type="button"
                    ref={this.tabRefs[index]}
                    role="tab"
                    id={`${this.id}-${key}-tab`}
                    aria-controls={`${this.id}-${key}`}
                    aria-selected={view === key}
                    tabIndex={view === key ? 0 : -1}
                    onClick={() => this.switchView(key)}>
                    {index === 0 ? '能力关系' : '功能矩阵'}
                  </button>
                </div>
              ))}
            </div>
          </div>
          {view === 'relations' ? (
            <div className="graph-display-controls">
              <div className="board-legend" aria-label="关系类型">
                {Object.entries(relationTypes).map(([key, type]) => (
                  <span key={key} className={`legend-${key}`} title={type.description}>
                    <i />
                    {type.title}
                  </span>
                ))}
              </div>
              <button
                type="button"
                className="motion-toggle"
                role="switch"
                aria-label="流动动画"
                aria-checked={motion && !reducedMotion}
                disabled={reducedMotion}
                onClick={() => this.setState({ motion: !motion })}>
                <span className="motion-switch-track" aria-hidden="true" />
                <span>流动动画</span>
              </button>
            </div>
          ) : (
            <span className="matrix-summary">{entries.length} 个开发入口</span>
          )}
          <label className="dashboard-search">
            <Icon icon="fa fa-search" vendor="" />
            <input
              ref={this.search}
              type="search"
              aria-label="搜索开发功能"
              placeholder="搜索开发功能"
              value={query}
              onChange={(event) => this.setState({ query: event.target.value })}
            />
            <span aria-hidden="true">/</span>
          </label>
          {normalizedQuery && (
            <>
              <span className="search-summary" role="status">
                {matching} 个匹配
              </span>
              <button
                type="button"
                className="search-reset"
                onClick={() => {
                  this.setState({ query: '' })
                  this.search.current?.focus()
                }}>
                清空
              </button>
            </>
          )}
        </div>
        {loading && (
          <div className="dashboard-message" role="status">
            正在加载应用与开发菜单…
          </div>
        )}
        {error && (
          <div className="dashboard-error" role="alert">
            {error}
            <button
              type="button"
              className="cxd-Button cxd-Button--link"
              onClick={() => void this.load()}>
              重新加载
            </button>
          </div>
        )}
        <section
          className="dashboard-board"
          id={`${this.id}-relations`}
          role="tabpanel"
          aria-labelledby={`${this.id}-relations-tab`}
          hidden={view !== 'relations'}>
          <DevAppDashboardCircuit
            selection={this.state.selection}
            query={normalizedQuery}
            motion={motion && !reducedMotion && view === 'relations'}
            onSelect={(selection) => this.setState({ selection })}
            onOpen={this.openCapability}
          />
          <aside className="dashboard-context" aria-label="所选能力详情">
            {this.renderContext()}
          </aside>
        </section>
        <section
          className="dashboard-matrix"
          id={`${this.id}-matrix`}
          role="tabpanel"
          aria-labelledby={`${this.id}-matrix-tab`}
          hidden={view !== 'matrix'}>
          <div className="matrix-standalone">
            {catalog.standalone.filter(this.matchesEntry).map((entry) => (
              <MatrixEntry
                key={entry.menu.fullName}
                entry={entry}
                onOpen={this.openMenu}
              />
            ))}
          </div>
          <div className="matrix-groups">
            {catalog.groups.map((group) => {
              const matches = group.entries.filter(this.matchesEntry)
              if (!matches.length) return null
              return (
                <section
                  key={group.menu.fullName}
                  className={`matrix-group matrix-group--${groupTones[group.menu.fullName] || 'backend'}`}>
                  <h3>
                    <MenuIcon icon={group.menu.icon} />
                    {group.menu.displayTitle || group.menu.title}
                  </h3>
                  <div className="matrix-entries">
                    {matches.map((entry) => (
                      <MatrixEntry
                        key={entry.menu.fullName}
                        entry={entry}
                        onOpen={this.openMenu}
                      />
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
          {!loading && !entries.some(this.matchesEntry) && (
            <div className="dashboard-empty" role="status">
              没有匹配的开发功能
            </div>
          )}
        </section>
        {app.description && <span className="sr-only">{app.description}</span>}
      </main>
    )
  }
}

@Renderer({ type: 'dev-app-dashboard', autoVar: true })
export class DevAppKanbanRenderer extends DevAppKanban {}
export default DevAppKanban
