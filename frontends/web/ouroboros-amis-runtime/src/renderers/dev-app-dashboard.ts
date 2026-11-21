export type DashboardMenu = {
  fullName: string
  title: string
  displayTitle?: string
  icon?: string
  url?: string
  path?: string
  fullPath?: string
  showMode?: string
  children?: DashboardMenu[]
}
export type DashboardEntry = { menu: DashboardMenu; breadcrumb: string[] }
export type DashboardGroup = { menu: DashboardMenu; entries: DashboardEntry[] }
export type RelationType = 'projection' | 'call' | 'dependency'
export type BoardPoint = [number, number]
export type Capability = {
  id: string
  title: string
  icon: string
  description: string
  route: string
  subtitle?: string
}
export type BoardNode = {
  id: string
  tone: string
  x: number
  y: number
  width: number
  height: number
  main?: boolean
  caption?: string
}
export type CapabilityRelation = {
  id: string
  from: string
  to: string
  type: RelationType
  description: string
  points: BoardPoint[]
}

export const capabilities: Capability[] = [
  {
    id: 'business-model',
    title: '业务模型',
    icon: 'fa-building-o',
    description: '定义业务对象的属性、关系、视图、动作、事件和访问权限。',
    route: 'business-model',
  },
  {
    id: 'data-model',
    title: '数据模型',
    icon: 'fa-database',
    description: '维护应用的数据结构与字段定义。',
    route: 'data-model',
  },
  {
    id: 'app-module',
    title: '模块树',
    icon: 'fa-sitemap',
    description: '组织业务模型投射的应用模块，并维护对应的菜单与权限。',
    route: 'app-module',
  },
  {
    id: 'data-dict',
    title: '数据字典',
    icon: 'fa-book',
    description: '维护字段使用的枚举与字典选项。',
    route: 'data-dict',
  },
  {
    id: 'logicflow-model',
    title: '逻辑流',
    icon: 'fa-code-fork',
    description: '编排业务处理步骤，连接模型、接口和集成能力。',
    route: 'logicflow-model',
  },
  {
    id: 'webapi',
    title: 'WebAPI 模型',
    icon: 'fa-exchange',
    description: '定义应用的 HTTP 接口及其处理逻辑。',
    route: 'webapi',
  },
  {
    id: 'rpc-model',
    title: 'RPC 模型',
    icon: 'fa-plug',
    description: '管理应用间的服务调用契约。',
    route: 'rpc-model',
  },
  {
    id: 'mq-producer',
    title: '消息队列',
    icon: 'fa-share-alt',
    description: '配置业务消息的生产绑定。',
    route: 'mq-binding',
    subtitle: '生产端',
  },
  {
    id: 'mq-consumer',
    title: '消息队列',
    icon: 'fa-share-alt',
    description: '配置业务消息的消费绑定。',
    route: 'mq-binding',
    subtitle: '消费端',
  },
  {
    id: 'menu',
    title: '菜单模型',
    icon: 'fa-th-large',
    description: '由业务模型投射生成，在模块树中统一维护菜单关联。',
    route: 'app-module',
  },
  {
    id: 'permission',
    title: '权限模型',
    icon: 'fa-shield',
    description: '由业务模型投射生成，在模块树中统一维护权限关联。',
    route: 'app-module',
  },
  {
    id: 'notification',
    title: '消息通知',
    icon: 'fa-bell-o',
    description: '配置业务消息的通知渠道和模板。',
    route: 'notification',
  },
  {
    id: 'schedule',
    title: '计划任务',
    icon: 'fa-clock-o',
    description: '管理按时间触发的任务。',
    route: 'schedule',
  },
  {
    id: 'ui',
    title: 'UI 模型',
    icon: 'fa-window-maximize',
    description: '组织页面、组件与界面模型。',
    route: 'ui',
  },
  {
    id: 'ui-schema',
    title: '低码界面',
    icon: 'fa-object-group',
    description: '通过可视编辑器维护页面 Schema。',
    route: 'ui-schema',
  },
  {
    id: 'micro-web',
    title: '微前端',
    icon: 'fa-th-large',
    description: '接入应用使用的微前端页面。',
    route: 'micro-web',
  },
  {
    id: 'configuration',
    title: '配置项',
    icon: 'fa-sliders',
    description: '维护应用使用的动态配置。',
    route: 'configuration',
  },
  {
    id: 'extend-jar-management',
    title: '扩展包',
    icon: 'fa-puzzle-piece',
    description: '管理应用开发使用的扩展能力包。',
    route: 'extend-jar-management',
  },
]

export const boardNodes: BoardNode[] = [
  {
    id: 'business-model',
    tone: 'business',
    x: 20,
    y: 158,
    width: 180,
    height: 76,
    main: true,
    caption: '属性 · 关系 · 视图\n动作 · 事件 · 访问权限',
  },
  {
    id: 'app-module',
    tone: 'presentation',
    x: 148,
    y: 84,
    width: 128,
    height: 40,
  },
  {
    id: 'menu',
    tone: 'presentation',
    x: 20,
    y: 32,
    width: 128,
    height: 40,
  },
  {
    id: 'permission',
    tone: 'backend',
    x: 20,
    y: 320,
    width: 180,
    height: 52,
    main: true,
    caption: '访问控制',
  },
  {
    id: 'ui',
    tone: 'presentation',
    x: 390,
    y: 32,
    width: 174,
    height: 52,
    main: true,
    caption: '页面与组件',
  },
  {
    id: 'webapi',
    tone: 'service',
    x: 390,
    y: 132,
    width: 174,
    height: 52,
    main: true,
    caption: '接口契约',
  },
  {
    id: 'logicflow-model',
    tone: 'service',
    x: 390,
    y: 212,
    width: 174,
    height: 72,
    main: true,
    caption: '业务流程编排',
  },
  {
    id: 'data-model',
    tone: 'backend',
    x: 390,
    y: 320,
    width: 174,
    height: 52,
    main: true,
    caption: '结构与存储',
  },
  {
    id: 'micro-web',
    tone: 'presentation',
    x: 710,
    y: 32,
    width: 130,
    height: 32,
  },
  {
    id: 'ui-schema',
    tone: 'presentation',
    x: 710,
    y: 76,
    width: 130,
    height: 32,
  },
  {
    id: 'notification',
    tone: 'service',
    x: 710,
    y: 128,
    width: 130,
    height: 32,
  },
  {
    id: 'rpc-model',
    tone: 'service',
    x: 710,
    y: 172,
    width: 130,
    height: 32,
  },
  {
    id: 'mq-producer',
    tone: 'service',
    x: 710,
    y: 216,
    width: 130,
    height: 32,
  },
  {
    id: 'mq-consumer',
    tone: 'service',
    x: 710,
    y: 260,
    width: 130,
    height: 32,
  },
  {
    id: 'schedule',
    tone: 'service',
    x: 710,
    y: 304,
    width: 130,
    height: 32,
  },
  {
    id: 'data-dict',
    tone: 'backend',
    x: 710,
    y: 352,
    width: 130,
    height: 32,
  },
]

export const capabilityRelations: CapabilityRelation[] = [
  {
    from: 'business-model',
    to: 'ui',
    type: 'projection',
    description: '业务模型投射为 UI 模型',
    points: [
      [200, 176],
      [240, 176],
      [358, 58],
      [390, 58],
    ],
    id: 'business-model--ui',
  },
  {
    from: 'business-model',
    to: 'webapi',
    type: 'projection',
    description: '业务模型投射为 WebAPI 模型',
    points: [
      [200, 188],
      [278, 188],
      [308, 158],
      [390, 158],
    ],
    id: 'business-model--webapi',
  },
  {
    from: 'business-model',
    to: 'logicflow-model',
    type: 'projection',
    description: '业务模型投射为逻辑流',
    points: [
      [200, 200],
      [278, 200],
      [326, 248],
      [390, 248],
    ],
    id: 'business-model--logicflow-model',
  },
  {
    from: 'business-model',
    to: 'data-model',
    type: 'projection',
    description: '业务模型投射为数据模型',
    points: [
      [200, 212],
      [226, 212],
      [360, 346],
      [390, 346],
    ],
    id: 'business-model--data-model',
  },
  {
    from: 'business-model',
    to: 'app-module',
    type: 'projection',
    description: '业务模型投射为模块树',
    points: [
      [184, 158],
      [184, 124],
    ],
    id: 'business-model--app-module',
  },
  {
    from: 'business-model',
    to: 'menu',
    type: 'projection',
    description: '业务模型投射为菜单模型',
    points: [
      [80, 158],
      [80, 72],
    ],
    id: 'business-model--menu',
  },
  {
    from: 'business-model',
    to: 'permission',
    type: 'projection',
    description: '业务模型投射为权限模型',
    points: [
      [80, 234],
      [80, 320],
    ],
    id: 'business-model--permission',
  },
  {
    from: 'ui',
    to: 'micro-web',
    type: 'dependency',
    description: 'UI 模型依赖微前端承载',
    points: [
      [564, 48],
      [710, 48],
    ],
    id: 'ui--micro-web',
  },
  {
    from: 'ui',
    to: 'ui-schema',
    type: 'dependency',
    description: 'UI 模型使用低码界面 Schema',
    points: [
      [564, 68],
      [616, 68],
      [640, 92],
      [710, 92],
    ],
    id: 'ui--ui-schema',
  },
  {
    from: 'logicflow-model',
    to: 'notification',
    type: 'call',
    description: '逻辑流调用消息通知',
    points: [
      [564, 224],
      [610, 224],
      [690, 144],
      [710, 144],
    ],
    id: 'logicflow-model--notification',
  },
  {
    from: 'logicflow-model',
    to: 'rpc-model',
    type: 'call',
    description: '逻辑流调用 RPC',
    points: [
      [564, 236],
      [614, 236],
      [662, 188],
      [710, 188],
    ],
    id: 'logicflow-model--rpc-model',
  },
  {
    from: 'logicflow-model',
    to: 'mq-producer',
    type: 'call',
    description: '逻辑流调用消息生产',
    points: [
      [564, 248],
      [628, 248],
      [644, 232],
      [710, 232],
    ],
    id: 'logicflow-model--mq-producer',
  },
  {
    from: 'mq-consumer',
    to: 'logicflow-model',
    type: 'call',
    description: '消息消费触发逻辑流',
    points: [
      [710, 276],
      [644, 276],
      [628, 260],
      [564, 260],
    ],
    id: 'mq-consumer--logicflow-model',
  },
  {
    from: 'schedule',
    to: 'logicflow-model',
    type: 'call',
    description: '计划任务触发逻辑流',
    points: [
      [710, 320],
      [662, 320],
      [614, 272],
      [564, 272],
    ],
    id: 'schedule--logicflow-model',
  },
  {
    from: 'data-model',
    to: 'data-dict',
    type: 'dependency',
    description: '数据模型字段引用数据字典',
    points: [
      [564, 346],
      [630, 346],
      [652, 368],
      [710, 368],
    ],
    id: 'data-model--data-dict',
  },
]

export const relationTypes: Record<
  RelationType,
  { title: string; speed: number; description: string }
> = {
  projection: {
    title: '投射',
    speed: 58,
    description: '来源模型 → 投射产物',
  },
  call: {
    title: '调用',
    speed: 78,
    description: '调用或触发方 → 执行方',
  },
  dependency: {
    title: '依赖',
    speed: 42,
    description: '依赖方 → 被依赖方',
  },
}

export function dashboardMenuPath(menu: DashboardMenu) {
  return menu.url || menu.path || menu.fullPath || ''
}

export function capabilityTitle(capability: Capability) {
  return capability.subtitle
    ? `${capability.title} · ${capability.subtitle}`
    : capability.title
}

export function dashboardCatalog(menus: DashboardMenu[]) {
  const groups: DashboardGroup[] = [],
    standalone: DashboardEntry[] = []
  function entries(items: DashboardMenu[], parents: string[]): DashboardEntry[] {
    return items.flatMap((menu) => {
      const breadcrumb = [...parents, menu.displayTitle || menu.title]
      return [
        ...(dashboardMenuPath(menu) ? [{ menu, breadcrumb }] : []),
        ...entries(menu.children || [], breadcrumb),
      ]
    })
  }
  for (const menu of menus) {
    if (
      menu.fullName === 'AppDevDashboard' ||
      /\/dashboard(?:[?#]|$)/.test(dashboardMenuPath(menu))
    )
      continue
    if (menu.children?.length)
      groups.push({
        menu,
        entries: entries(menu.children, [menu.displayTitle || menu.title]),
      })
    else if (dashboardMenuPath(menu))
      standalone.push({ menu, breadcrumb: [menu.displayTitle || menu.title] })
  }
  return { groups, standalone }
}

/** Preserve 45 degree bends when the board width changes. */
export function circuitCoordinates(points: BoardPoint[], scale: number): BoardPoint[] {
  const result: BoardPoint[] = points.map(([x, y]) => [x * scale, y])
  if (points.length !== 4) return result
  const start = result[0],
    end = result[3]
  const diagonal = Math.abs(points[2][1] - points[1][1])
  const direction = Math.sign(points[2][0] - points[1][0])
  const remaining = Math.abs(end[0] - start[0]) - diagonal
  const original = Math.abs(points[3][0] - points[0][0]) - diagonal
  const fraction = Math.abs(points[1][0] - points[0][0]) / original
  const launch = Math.max(12, Math.min(remaining - 12, remaining * fraction))
  result[1][0] = start[0] + direction * launch
  result[2][0] = result[1][0] + direction * diagonal
  return result
}
