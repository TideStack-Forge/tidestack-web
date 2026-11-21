import React from 'react'
import {
  Renderer,
  uuidv4,
  ScopedContext,
  buildApi,
  type IScopedContext,
  type RendererProps,
} from 'amis'
import { BusinessModelGraphCanvas } from './BusinessModelGraphCanvas'
import { BusinessModelGraphDetails } from './BusinessModelGraphDetails'
import { BusinessModelGraphLibrary } from './BusinessModelGraphLibrary'
import {
  canvasModels,
  canvasRelations,
  createModelCanvas,
  modelMatchesModule,
  normalizeBusinessModelGraphPayload,
  readGraphApiData,
  syncModelCanvas,
  type BusinessModelCanvas,
  type BusinessModelGraphData,
  type BusinessModelGraphEdge,
  type BusinessModelGraphNode,
  type ModelModule,
  type Point,
} from './business-model-graph'
import Tabs from '#ouroboros-host/common/tabs'
import { YjsWorkspace } from '../collaboration/YjsWorkspace'
import { platformCollaborationTransport } from '../collaboration/platformTransport'
import { canvasDocumentCodec } from './business-model-collaboration'
import './BusinessModelGraph.scss'

type Props = RendererProps & { module?: string; userIdentity?: string }
type State = {
  graph: BusinessModelGraphData
  modules: ModelModule[]
  canvases: BusinessModelCanvas[]
  activeId: string
  pending: number
  writable: boolean
  loading: boolean
  editing: boolean
  error: string
  message: string
  selected: string | null
  selectedEdge: BusinessModelGraphEdge | null
  query: string
  libraryQuery: string
  module: string
  libraryOpen: boolean
  relatedOnly: boolean
  newTitle: string
}
export class BusinessModelGraph extends React.Component<Props, State> {
  static contextType = ScopedContext
  state: State = {
    graph: { nodes: [], edges: [] },
    modules: [],
    canvases: [],
    activeId: 'overview',
    pending: 0,
    writable: false,
    loading: true,
    editing: false,
    error: '',
    message: '',
    selected: null,
    selectedEdge: null,
    query: '',
    libraryQuery: '',
    module: '',
    libraryOpen: false,
    relatedOnly: false,
    newTitle: '',
  }
  private workspace?: YjsWorkspace<BusinessModelCanvas>
  private restoredCanvases = new Set<string>()
  private removeLeaveGuard?: () => void
  private sequence = 0
  private refreshSequence = 0
  private graphCanvas = React.createRef<BusinessModelGraphCanvas>()
  private canvasDialog = React.createRef<HTMLDialogElement>()
  componentDidMount() {
    const scope = this.context as IScopedContext | undefined
    scope?.registerComponent(this)
    window.addEventListener('beforeunload', this.beforeUnload)
    const tabId = this.props.data?.SystemContext?.activeTabId
    if (tabId)
      this.removeLeaveGuard = Tabs.beforeLeave(
        tabId,
        () =>
          !this.workspace?.pending ||
          window.confirm('仍有操作尚未同步，离开后这些操作将丢失。确定离开？')
      )
    void this.load()
  }
  componentDidUpdate(previous: Props) {
    if (this.appName(previous) !== this.appName()) {
      this.setState({
        canvases: [],
        graph: { nodes: [], edges: [] },
        pending: 0,
        writable: false,
        activeId: 'overview',
      })
      void this.load()
    } else if (
      previous.module !== this.props.module ||
      previous.data?.module !== this.props.data?.module
    )
      this.setState({
        module: this.props.module || this.props.data?.module || '',
      })
  }
  componentWillUnmount() {
    this.sequence += 1
    this.workspace?.destroy()
    this.removeLeaveGuard?.()
    window.removeEventListener('beforeunload', this.beforeUnload)
    const scope = this.context as IScopedContext | undefined
    scope?.unRegisterComponent(this)
  }
  private beforeUnload = (event: BeforeUnloadEvent) => {
    if (this.workspace?.pending) {
      event.preventDefault()
      event.returnValue = ''
    }
  }
  private appName(props = this.props): string {
    return props.data?.appName || ''
  }
  private baseUrl() {
    if (!this.appName()) throw new Error('缺少开发应用，请重新进入业务模型页面')
    return `/api/dev/${encodeURIComponent(this.appName())}/business-model`
  }
  async load() {
    const sequence = ++this.sequence
    this.workspace?.destroy()
    this.setState({ loading: true, error: '', pending: 0, writable: false })
    this.restoredCanvases.clear()
    try {
      const base = this.baseUrl()
      const [graphResponse, modulesResponse] = await Promise.all([
        this.props.env.fetcher(
          buildApi(this.props.api || `${base}/graph`, this.props.data || {})
        ),
        this.props.env.fetcher({ method: 'get', url: `${base}/module-tree` }),
      ])
      if (sequence !== this.sequence) return
      const graph = normalizeBusinessModelGraphPayload(graphResponse)
      const modules = (readGraphApiData(modulesResponse) as { items: ModelModule[] })
        .items
      if (!Array.isArray(modules)) throw new Error('模块树数据无效')
      await new Promise<void>((resolve) =>
        this.setState(
          {
            graph,
            modules,
            canvases: [createModelCanvas(graph, modules)],
            activeId: 'overview',
            selected: null,
            selectedEdge: null,
            editing: false,
            module: this.props.module || this.props.data?.module || '',
          },
          resolve
        )
      )
      if (sequence !== this.sequence) return
      const workspace = new YjsWorkspace(
        platformCollaborationTransport(this.appName(), 'business-model-canvas', (api) =>
          this.props.env.fetcher(api)
        ),
        canvasDocumentCodec,
        (value) => {
          if (sequence !== this.sequence) return
          const restored = this.restoredCanvases.has(value.id)
          this.restoredCanvases.add(value.id)
          this.setState((state) => {
            const previous = state.canvases.find((item) => item.id === value.id)
            const canvas = syncModelCanvas(
              {
                ...value,
                grouped: restored ? (previous?.grouped ?? value.grouped) : value.grouped,
                freeLayout: {
                  ...value.freeLayout,
                  viewport: previous?.freeLayout.viewport ?? value.freeLayout.viewport,
                },
                groupedLayout: {
                  ...value.groupedLayout,
                  viewport:
                    previous?.groupedLayout.viewport ?? value.groupedLayout.viewport,
                },
              },
              state.graph,
              state.modules
            )
            return {
              canvases: previous
                ? state.canvases.map((item) => (item.id === canvas.id ? canvas : item))
                : [...state.canvases, canvas],
            }
          })
        },
        (pending, writable, error) => {
          if (sequence === this.sequence)
            this.setState({ pending, writable, error: error || '' })
        }
      )
      this.workspace = workspace
      await workspace.start()
      if (sequence !== this.sequence) return
      if (workspace.writable && !workspace.has('overview'))
        await workspace.create('overview', createModelCanvas(graph, modules))
      this.setState({ loading: false })
    } catch (error) {
      if (sequence === this.sequence)
        this.setState({
          loading: false,
          error: error instanceof Error ? error.message : String(error),
        })
    }
  }
  // AMIS reload actions carry the same module selection used by modelList.
  async reload(_subpath?: string, query?: { module?: string }) {
    if (query && typeof query.module === 'string') {
      this.setState({ module: query.module })
      return
    }
    const sequence = this.sequence
    const refreshSequence = ++this.refreshSequence
    try {
      const base = this.baseUrl()
      const [response, moduleResponse] = await Promise.all([
        this.props.env.fetcher(
          buildApi(this.props.api || `${base}/graph`, this.props.data || {})
        ),
        this.props.env.fetcher({ method: 'get', url: `${base}/module-tree` }),
      ])
      if (sequence !== this.sequence || refreshSequence !== this.refreshSequence) return
      const graph = normalizeBusinessModelGraphPayload(response)
      const modules = (readGraphApiData(moduleResponse) as { items: ModelModule[] }).items
      this.setState((state) => ({
        graph,
        modules,
        canvases: state.canvases.map((canvas) => syncModelCanvas(canvas, graph, modules)),
        error: '',
      }))
    } catch (error) {
      if (sequence === this.sequence && refreshSequence === this.refreshSequence)
        this.setState({
          error: error instanceof Error ? error.message : String(error),
        })
    }
  }
  canvas() {
    return this.state.canvases.find((canvas) => canvas.id === this.state.activeId)
  }
  changeCanvas = (canvas: BusinessModelCanvas, before = this.canvas()) => {
    if (!before || !this.workspace) return false
    try {
      this.workspace.change(canvas.id, before, canvas)
      return true
    } catch (error) {
      this.setState({
        error: error instanceof Error ? error.message : String(error),
      })
      return false
    }
  }
  changeViewport = (canvas: BusinessModelCanvas) => {
    this.setState((state) => ({
      canvases: state.canvases.map((item) => (item.id === canvas.id ? canvas : item)),
    }))
  }
  switchCanvas = (id: string) => {
    this.setState({
      activeId: id,
      selected: null,
      selectedEdge: null,
      relatedOnly: false,
      message: '',
      error: '',
    })
  }
  toggleGrouping = () => {
    const canvas = this.canvas()
    if (!canvas) return
    this.changeViewport({ ...canvas, grouped: !canvas.grouped })
    this.setState({
      message: canvas.grouped
        ? '已恢复自由布局，两套位置分别保存'
        : '已恢复模块分组布局，节点保持在所属框内',
    })
  }
  createCanvas = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!this.workspace) return
    const title = this.state.newTitle.trim()
    if (!title) return
    if (this.state.canvases.some((canvas) => canvas.title === title)) {
      this.setState({ message: '已有同名画布，请换一个名称' })
      return
    }
    const canvas = createModelCanvas(
      this.state.graph,
      this.state.modules,
      uuidv4(),
      title
    )
    try {
      await this.workspace.create(canvas.id, canvas)
      this.setState({
        activeId: canvas.id,
        libraryOpen: true,
        selected: null,
        selectedEdge: null,
        relatedOnly: false,
        newTitle: '',
        message: '',
      })
    } catch (error) {
      this.setState({
        error: error instanceof Error ? error.message : String(error),
      })
      return
    }
    this.canvasDialog.current?.close()
  }
  addModel = (id: string, point?: Point) => {
    const canvas = this.canvas()
    const node = this.state.graph.nodes.find((model) => model.fullName === id)
    if (!canvas || !node || canvas.allModels || canvas.modelIds.includes(id)) return
    let next = syncModelCanvas(
      { ...canvas, modelIds: [...canvas.modelIds, id] },
      this.state.graph,
      this.state.modules
    )
    if (point)
      next = {
        ...next,
        freeLayout: {
          ...next.freeLayout,
          nodes: { ...next.freeLayout.nodes, [id]: point },
        },
      }
    if (!this.changeCanvas(next)) return
    this.setState({ message: '已添加模型，画布内已有关系自动显示' })
  }
  removeModel = (id: string) => {
    const canvas = this.canvas()
    if (!canvas || canvas.allModels) return
    if (
      !this.changeCanvas(
        syncModelCanvas(
          {
            ...canvas,
            modelIds: canvas.modelIds.filter((model) => model !== id),
          },
          this.state.graph,
          this.state.modules
        )
      )
    )
      return
    this.setState({
      selected: null,
      selectedEdge: null,
      message: '已从此画布移除，可从模型库重新添加',
    })
  }
  async editModel(node: BusinessModelGraphNode) {
    if (this.state.editing) return
    const sequence = this.sequence
    const appName = this.appName()
    this.setState({ editing: true, error: '' })
    try {
      readGraphApiData(
        await this.props.env.fetcher({
          method: 'post',
          url: `${this.baseUrl()}/${encodeURIComponent(node.fullName)}/lock`,
        })
      )
      if (sequence !== this.sequence || appName !== this.appName()) return
      await this.props.onAction(
        null,
        {
          actionType: 'openOrSwitchTab',
          args: {
            title: `编辑业务模型「${node.title || node.fullName}」`,
            url: `/dev/${encodeURIComponent(appName)}/business-model/${encodeURIComponent(node.fullName)}`,
            reloadOnReceive: true,
          },
        },
        this.props.data
      )
      if (sequence === this.sequence) this.setState({ editing: false })
    } catch (error) {
      if (sequence === this.sequence)
        this.setState({
          editing: false,
          error: error instanceof Error ? error.message : String(error),
        })
    }
  }
  private highlighted(models: BusinessModelGraphNode[]) {
    const query = this.state.query.trim().toLowerCase()
    const adjacent = new Set([this.state.selected])
    if (this.state.selected)
      for (const edge of this.state.graph.edges) {
        if (edge.source === this.state.selected) adjacent.add(edge.target)
        if (edge.target === this.state.selected) adjacent.add(edge.source)
      }
    return new Set(
      models
        .filter(
          (node) =>
            modelMatchesModule(node, this.state.module) &&
            (!query ||
              `${node.title || ''} ${node.fullName}`.toLowerCase().includes(query)) &&
            (!this.state.relatedOnly ||
              !this.state.selected ||
              adjacent.has(node.fullName))
        )
        .map((node) => node.fullName)
    )
  }
  render() {
    const canvas = this.canvas()
    if (this.state.loading)
      return (
        <div className="business-model-graph__state" role="status">
          正在加载业务模型画布…
        </div>
      )
    if (!canvas)
      return (
        <div className="business-model-graph__state" role="alert">
          {this.state.error}
          <button
            type="button"
            className="cxd-Button cxd-Button--default"
            onClick={() => void this.load()}>
            重新加载
          </button>
        </div>
      )
    const models = canvasModels(this.state.graph, canvas),
      edges = canvasRelations(this.state.graph, canvas)
    const highlighted = this.highlighted(models)
    const missing = canvas.modelIds.filter(
      (id) => !this.state.graph.nodes.some((node) => node.fullName === id)
    )
    return (
      <div className="business-model-graph" data-testid="business-model-graph">
        <div className="business-model-graph__toolbar">
          <button
            type="button"
            className="cxd-Button cxd-Button--default cxd-Button--size-default"
            aria-label="显示模块树"
            aria-pressed={this.props.data?.moduleTreeVisible !== false}
            onClick={() =>
              void this.props.dispatchEvent('moduleTreeToggle', {
                visible: this.props.data?.moduleTreeVisible === false,
              })
            }>
            <i className="fa fa-sitemap" /> 模块树
          </button>
          <label>
            画布{' '}
            <select
              aria-label="当前画布"
              value={canvas.id}
              onChange={(event) => this.switchCanvas(event.target.value)}>
              {this.state.canvases.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="cxd-Button cxd-Button--default cxd-Button--size-default"
            disabled={!this.state.writable}
            onClick={() => this.canvasDialog.current?.showModal()}>
            <i className="fa fa-plus" /> 新建切面
          </button>
          <button
            type="button"
            className="cxd-Button cxd-Button--default cxd-Button--size-default"
            aria-pressed={this.state.libraryOpen}
            disabled={canvas.allModels || !this.state.writable}
            onClick={() =>
              this.setState((state) => ({ libraryOpen: !state.libraryOpen }))
            }>
            添加模型
          </button>
          <span className="business-model-graph__spacer" />
          <span role="status">
            {this.state.pending
              ? `${this.state.pending} 个操作待同步`
              : this.state.writable
                ? '实时协同 · 已同步'
                : '实时协同 · 仅查看'}
          </span>
        </div>
        <div className="business-model-graph__toolbar">
          <input
            aria-label="搜索画布模型"
            placeholder="搜索模型名称或标识"
            value={this.state.query}
            onChange={(event) => this.setState({ query: event.target.value })}
          />
          <button
            type="button"
            className="cxd-Button cxd-Button--default cxd-Button--size-default"
            aria-pressed={canvas.grouped}
            onClick={this.toggleGrouping}>
            模块分组
          </button>
          <button
            type="button"
            className="cxd-Button cxd-Button--default cxd-Button--size-default"
            aria-pressed={this.state.relatedOnly}
            disabled={!this.state.selected}
            onClick={() =>
              this.setState((state) => ({ relatedOnly: !state.relatedOnly }))
            }>
            直接关联
          </button>
          <button
            type="button"
            className="cxd-Button cxd-Button--default cxd-Button--size-default"
            onClick={() => this.graphCanvas.current?.fit()}>
            适应画布
          </button>
          <span className="business-model-graph__spacer" />
          <span>
            {models.length} 个模型 · {edges.length} 条关系
          </span>
        </div>
        {this.state.error && (
          <div className="business-model-graph__error" role="alert">
            {this.state.error}
            <button
              type="button"
              className="cxd-Button cxd-Button--link"
              onClick={() => void this.workspace?.refresh()}>
              重新同步
            </button>
          </div>
        )}
        {this.state.message && (
          <div className="business-model-graph__message" role="status">
            {this.state.message}
          </div>
        )}
        {missing.length > 0 && (
          <div className="business-model-graph__message">
            {missing.length} 个引用模型已不可用，已有画布位置保留
            {missing.map((id) => (
              <div key={id}>
                {id}
                <button
                  type="button"
                  className="cxd-Button cxd-Button--link"
                  aria-label={`移除失效引用${id}`}
                  onClick={() => this.removeModel(id)}>
                  从此画布移除
                </button>
              </div>
            ))}
          </div>
        )}
        {!!models.length && !highlighted.size && (
          <div className="business-model-graph__message">
            没有匹配的模型，请调整搜索或模块筛选
          </div>
        )}
        <div className="business-model-graph__workspace">
          {this.state.libraryOpen && !canvas.allModels && this.state.writable && (
            <BusinessModelGraphLibrary
              models={this.state.graph.nodes}
              modelIds={canvas.modelIds}
              query={this.state.libraryQuery}
              onQuery={(libraryQuery) => this.setState({ libraryQuery })}
              onClose={() => this.setState({ libraryOpen: false })}
              onAdd={this.addModel}
            />
          )}
          <BusinessModelGraphCanvas
            ref={this.graphCanvas}
            canvas={canvas}
            models={models}
            edges={edges}
            highlighted={highlighted}
            selected={this.state.selected}
            onChange={this.changeCanvas}
            onViewportChange={this.changeViewport}
            readOnly={!this.state.writable}
            onSelect={(id) => this.setState({ selected: id, selectedEdge: null })}
            onEdge={(edge) => this.setState({ selectedEdge: edge, selected: null })}
            onAdd={this.addModel}
            onMessage={(message) => this.setState({ message })}
            onActivate={() => void this.reload()}
          />
          <BusinessModelGraphDetails
            canvas={canvas}
            graph={this.state.graph}
            modules={this.state.modules}
            models={models}
            edges={edges}
            selected={this.state.selected}
            selectedEdge={this.state.selectedEdge}
            userIdentity={this.props.userIdentity || this.props.data?.userIdentity || ''}
            editing={this.state.editing}
            onClose={() => this.setState({ selected: null, selectedEdge: null })}
            onEdge={(selectedEdge) => this.setState({ selectedEdge, selected: null })}
            onRemove={this.removeModel}
            readOnly={!this.state.writable}
            onEdit={(node) => void this.editModel(node)}
          />
        </div>
        <div className="business-model-graph__status">
          <span>
            {canvas.grouped
              ? '组内拖动节点 · 拖动标题移动整组'
              : '自由拖动 · 模块分组布局单独保留'}
          </span>
          <span>空白处平移 · 方向键微调</span>
        </div>
        <dialog ref={this.canvasDialog} className="business-model-graph__dialog">
          <form onSubmit={this.createCanvas}>
            <h3>新建切面画布</h3>
            <label>
              画布名称
              <input
                required
                maxLength={80}
                value={this.state.newTitle}
                onChange={(event) => this.setState({ newTitle: event.target.value })}
              />
            </label>
            <p>从空白画布开始，拖入需要分析的业务模型。</p>
            <div>
              <button
                type="button"
                className="cxd-Button cxd-Button--default"
                onClick={() => this.canvasDialog.current?.close()}>
                取消
              </button>
              <button type="submit" className="cxd-Button cxd-Button--primary">
                创建画布
              </button>
            </div>
          </form>
        </dialog>
      </div>
    )
  }
}
Renderer({ type: 'business-model-graph', autoVar: true })(BusinessModelGraph)
export default BusinessModelGraph
