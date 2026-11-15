import type { EditorManager, RendererPluginAction } from 'amis-editor'


export type { RendererPluginAction }
export interface RegisteredRendererPluginAction {
  position?: number
  afterType?: string
  beforeType?: string
  action: RendererPluginAction
}

export type ActionPanel = Omit<RendererPluginAction, 'actionType' | 'actionLabel'> & {
  label: string;
  tag: string;
}

export type ActionTreeModifier = (
  actionTree: RendererPluginAction[]
) => RendererPluginAction[]

export type CustomActionGetter = (manager: EditorManager) => {
  [propsName: string]: RendererPluginAction
}

const actionPanels: { [actionType: string]: ActionPanel} = {}
const customActions: { [actionType: string]: RendererPluginAction } = {}
const customActionGetters: CustomActionGetter[] = []
const registeredActionTree: { [category: string]: RegisteredRendererPluginAction[] } = {}
const actionTreeModifiers: ActionTreeModifier[] = []

export function registerActionTreeModifier(modifier: ActionTreeModifier) {
  actionTreeModifiers.push(modifier)
}

export function registerCustomActionGetter(customActionGetter: CustomActionGetter) {
  customActionGetters.push(customActionGetter)
}

export function registerAction(category: string, action: RegisteredRendererPluginAction) {
  registeredActionTree[category] = registeredActionTree[category] || []
  registeredActionTree[category].push(action)
}

export function registerCustomAction(actionType: string, action: RendererPluginAction) {
  customActions[actionType] = action
}

export function registerActionPanel(actionType: string, actionPanel: ActionPanel) {
  actionPanels[actionType] = actionPanel
}

export function getRegisteredActionTree() {
  return registeredActionTree
}

export function getCustomActions() {
  return customActions
}

/**
 * 提供给 amis-editor 使用的 actionTreeGetter
 * @param actionTree
 * @returns
 */
export function actionTreeGetter(actionTree: RendererPluginAction[]) {
  return actionTreeModifiers.reduce((actionTree, modifier) => {
    return modifier(actionTree)
  }, actionTree)
}

/**
 * 提供给 amis-editor 使用的 customActionGetter
 * @param manager
 * @returns
 */
export function customActionGetter(manager: EditorManager) {
  return customActionGetters.reduce((actions, getter) => {
    return { ...actions, ...getter(manager) }
  }, {})
}

/**
 * 注册 actionPanel 的 actionTree 修改器
 */
registerActionTreeModifier((actionTree) => {
  actionTree = [...actionTree]
  for (const actionType in actionPanels) {
    const panel = actionPanels[actionType]
    const { tag, label, ...rest } = panel
    if (!tag || !label) continue
    const existsCategoryIdx = actionTree.findIndex(item => item.actionType === tag)
    const existsPanel = existsCategoryIdx > -1 && {...actionTree[existsCategoryIdx]}
    const childPanel = { actionType, actionLabel: label, ...rest }
    if (!existsPanel) {
      actionTree.push({
        actionType: tag,
        actionLabel: label,
        children: [childPanel]
      })
      continue
    }
    const children = existsPanel.children ? [...existsPanel.children] : []
    const existsIdx = children.findIndex(item => item.actionType === actionType)
    if (existsIdx > -1) {
      children[existsIdx] = childPanel
    }
    else {
      children.push(childPanel)
    }
    existsPanel.children = children
    actionTree[existsCategoryIdx] = existsPanel
  }
  return actionTree
})

/**
 * 注册默认的 actionTree 修改器
 */
registerActionTreeModifier((actionTree) => {
  const newTree = actionTree.map((root) => {
    const type = root.actionType || ''
    const actions = registeredActionTree[type] || []
    if (!actions.length) return root
    const children = root.children?.concat() || []
    // 先插入有 position 的
    actions
      .filter((a) => a.position != null)
      .sort((a, b) => a.position! - b.position!)
      .forEach((action, index, arr) => {
        const oldPosition = action.position!
        const newPosition = index === 0 ? oldPosition : oldPosition + index
        children.splice(newPosition, 0, action.action)
      })
    // 再插入有 beforeType 的
    actions
      .filter((a) => a.position == null && a.beforeType)
      .forEach((action) => {
        const index = children.findIndex(
          (child) => child.actionType === action.beforeType
        )
        if (index >= 0) {
          children.splice(index, 0, action.action)
        }
      })
    // 再插入有 afterType 的
    actions
      .filter((a) => a.position == null && a.afterType)
      .forEach((action) => {
        const index = children.findIndex((child) => child.actionType === action.afterType)
        if (index >= 0) {
          children.splice(index + 1, 0, action.action)
        }
      })
    // 最后插入没有任何位置信息的
    actions
      .filter((a) => a.position == null && !a.beforeType && !a.afterType)
      .forEach((action) => {
        children.push(action.action)
      })
    return { ...root, children }
  })
  return newTree
})

/**
 * 注册默认的 customActionGetter
 */
registerCustomActionGetter((manager) => {
  return customActions
})
