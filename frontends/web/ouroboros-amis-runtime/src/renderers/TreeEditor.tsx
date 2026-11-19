import {
  FormItem,
  autobind,
  evaluate,
  filterTree,
  findTree,
  mapTree,
  flattenTree,
  Icon,
  ThemeProps,
  LocaleProps,
  SpinnerExtraProps,
  ActionSchema,
  Schema,
  eachTree,
  createObjectFromChain,
  extractObjectChain,
  ListenerAction,
  ActionObject,
  getTree,
  evalExpressionWithConditionBuilderAsync,
  resolveEventData,
  isApiOutdated,
  isEffectiveApi,
  localeable,
  themeable,
} from 'amis'
import React from 'react'
import { TreeSelector } from 'amis-ui/lib/components/Tree'
import { confirm, alert, openDialog } from '#ouroboros-host/common/modal'
import { isEqual } from 'lodash'
import {
  applyTreeEditorNodeGuards,
  appendTreeEditorChild,
  buildTreeEditorMovePayload,
  createTreeEditorCommandData,
  extractTreeEditorItems,
  isTreeEditorApi,
  isTreeEditorDescendant,
  isTreeEditorNodeAllowed,
  isTreeEditorNodeDraggable,
  moveTreeEditorNodes,
  normalizeTreeEditorApi,
  normalizeTreeEditorMode,
  normalizeTreeEditorNodes,
  requestTreeEditorApi,
  resolveTreeEditorBoolean,
  resolveTreeEditorSelection,
  resolveTreeEditorSource,
  resolveTreeEditorValue,
  setTreeEditorChildren,
  TreeEditorMode,
} from './treeEditorCommand'

import './TreeEditor.scss'

export class TreeEditorTreeSelector extends TreeSelector {
  onDragStart(node: any) {
    const isNodeDraggable = (this.props as any).isNodeDraggable
    if (isNodeDraggable && !isNodeDraggable(node)) {
      return (event: React.DragEvent<Element>) => {
        event.preventDefault()
        event.stopPropagation()
      }
    }

    return super.onDragStart(node)
  }
}

const TreeEditorTree = themeable(localeable(TreeEditorTreeSelector as any))

const TREE_EDITOR_ONLY_PROPS = new Set([
  'value',
  'mode',
  'source',
  'selectedValue',
  'options',
  'render',
  'itemActions',
  'static',
  'data',
  'onChange',
  'onSelect',
  'env',
  'dispatchEvent',
  'draggableOn',
  'creatableOn',
  'editableOn',
  'removableOn',
  'moveApi',
  'createApi',
  'updateApi',
  'deleteApi',
  'reloadOnSuccess',
  'optimistic',
  'deferLoad',
  'childrenField',
  'autoFillHeight',
])

function getTreeEditorTreeProps(props: TreeEditorProps) {
  return Object.keys(props).reduce<Record<string, any>>((treeProps, key) => {
    if (!TREE_EDITOR_ONLY_PROPS.has(key)) treeProps[key] = (props as any)[key]
    return treeProps
  }, {})
}

interface TreeEditorProps extends ThemeProps, LocaleProps, SpinnerExtraProps {
  // 基本属性
  value: any
  mode?: TreeEditorMode
  source?: any
  selectedValue?: any
  labelField?: string
  childrenField?: string
  keyField?: string
  valueField?: string // 为兼容而保留，应使用 keyField
  onChange?: (value: any) => void
  onSelect?: (value: any, item: any) => void
  render: (...args: unknown[]) => React.ReactNode
  static: boolean
  autoFillHeight?: boolean

  // 功能开关
  draggable?: boolean
  creatable?: boolean
  editable?: boolean
  removable?: boolean
  draggableOn?: any
  creatableOn?: any
  editableOn?: any
  removableOn?: any
  rootCreatable?: boolean

  // 命令模式 API
  moveApi?: any
  createApi?: any
  updateApi?: any
  deleteApi?: any
  reloadOnSuccess?: boolean
  optimistic?: boolean
  deferLoad?: any

  // CUD相关属性
  deleteConfirmText?: string
  deleteConfirmTitle?: string
  editControls?: any
  editDialogProps?: any
  addControls?: any
  addDialogProps?: any

  // 提示信息
  rootCreateTip?: string
  createTip?: string
  editTip?: string
  removeTip?: string

  // 显示相关属性
  showIcon?: boolean
  iconField?: string
  defaultBranchIcon?: string
  defaultLeafIcon?: string
  nodeDisplayTpl: undefined | string | Schema

  // 动作相关属性
  itemActions?: ActionSchema[]

  // 组合 Tree 组件的属性
  // highlightTxt?: string;
  onRef?: any
  initiallyOpen?: boolean
  unfoldedLevel?: number
  disabled?: boolean
  unfoldedField: string
  foldedField: string
  disabledField: string
  showOutline?: boolean
  className?: string
  itemClassName?: string
  placeholder?: string
  hideRoot?: boolean
  rootLabel?: string
  rootValue?: any
  /**
   * 是否使用 disable 字段
   */
  selfDisabledAffectChildren?: boolean
  virtualThreshold?: number
  itemHeight?: number

  data: any
  env?: {
    fetcher?: (api: any, data?: any, options?: any) => Promise<any>
    notify?: (type: string, msg: any, conf?: any) => void
    isCancel?: (value: any) => boolean
  }
  dispatchEvent: (
    eventName: string,
    eventData?: unknown
  ) => Promise<{ prevented?: boolean } | undefined> | { prevented?: boolean } | undefined
}

class TreeEditor extends React.Component<TreeEditorProps, any> {
  treeRef: any
  fetchRequestId = 0
  pendingCommandCount = 0
  deferRequestIds = new Map<any, number>()
  unmounted = false
  skipNextValueSync = false
  runtimeOptionsCache: {
    value?: any
    data?: any
    childrenField?: string
    creatableOn?: any
    editableOn?: any
    removableOn?: any
    options?: any[]
  } = {}
  constructor(props: any) {
    super(props)
    this.state = {
      value: [],
      loading: false,
      error: null,
    }
  }

  componentDidMount() {
    if (this.props.source && this.props.deferLoad !== true) {
      this.fetchData()
      return
    }

    this.syncValueFromProps()
  }

  componentWillUnmount() {
    this.unmounted = true
    this.fetchRequestId += 1
    this.deferRequestIds.clear()
  }

  componentDidUpdate(prevProps: any) {
    if (
      this.props.source &&
      this.props.deferLoad !== true &&
      (normalizeTreeEditorMode(prevProps.mode) !== this.getMode() ||
        prevProps.deferLoad === true ||
        this.isSourceChanged(prevProps))
    ) {
      this.fetchData()
      return
    }

    if (this.props.source) return
    if (this.skipNextValueSync) {
      this.skipNextValueSync = false
      return
    }

    this.syncValueFromProps()
  }

  getMode() {
    return normalizeTreeEditorMode(this.props.mode)
  }

  isCommandMode() {
    return this.getMode() === 'command'
  }

  isSourceChanged(prevProps: TreeEditorProps) {
    if (Array.isArray(prevProps.source) || Array.isArray(this.props.source)) {
      return !isEqual(prevProps.source, this.props.source)
    }

    return isApiOutdated(
      prevProps.source,
      this.props.source,
      prevProps.data,
      this.props.data
    )
  }

  setTreeState(nextState: any) {
    if (this.unmounted) return Promise.resolve()
    if (!this.props.source && Object.prototype.hasOwnProperty.call(nextState, 'value')) {
      this.skipNextValueSync = true
    }
    return new Promise<void>((resolve) => {
      this.setState(nextState, resolve)
    })
  }

  resolveTreeValue(props: TreeEditorProps = this.props) {
    const { childrenField = 'children' } = props
    const value = resolveTreeEditorValue(props.value, props.data)
    return normalizeTreeEditorNodes(value || [], childrenField)
  }

  resolveIdentityField() {
    const { keyField, valueField = 'value' } = this.props
    return keyField || valueField
  }

  isSameNode(left: any, right: any) {
    if (left === right) return true
    if (!left || !right) return false

    const identityField = this.resolveIdentityField()
    const leftValue = left[identityField]
    const rightValue = right[identityField]
    return leftValue !== undefined && rightValue !== undefined && leftValue === rightValue
  }

  resolveSelectedValue() {
    const { selectedValue, data } = this.props
    if (selectedValue === undefined) return ''
    return resolveTreeEditorValue(selectedValue, data)
  }

  captureExpandedKeys() {
    const tree = this.treeRef?.ref
    const unfolded = tree?.unfolded
    const options = tree?.props?.options || []
    const identityField = this.resolveIdentityField()
    const expanded = new Set<any>()
    if (!unfolded) return expanded

    eachTree(options, (item: any) => {
      const key = item?.[identityField]
      if (unfolded.get(item) && key !== undefined) {
        expanded.add(key)
      }
    })
    return expanded
  }

  restoreExpandedKeys(value: any[], expanded: Set<any>) {
    if (!expanded.size) return

    const tree = this.treeRef?.ref
    const unfolded = tree?.unfolded
    if (!unfolded) return

    const identityField = this.resolveIdentityField()
    eachTree(value, (item: any) => {
      const key = item?.[identityField]
      if (key !== undefined) {
        unfolded.set(item, expanded.has(key))
      }
    })
    tree.flattenOptions?.()
    tree.forceUpdate?.()
  }

  resolveRuntimeOptions() {
    const {
      data,
      creatableOn,
      editableOn,
      removableOn,
      childrenField = 'children',
    } = this.props
    const value = this.state.value || []
    if (
      this.runtimeOptionsCache.value === value &&
      this.runtimeOptionsCache.data === data &&
      this.runtimeOptionsCache.childrenField === childrenField &&
      this.runtimeOptionsCache.creatableOn === creatableOn &&
      this.runtimeOptionsCache.editableOn === editableOn &&
      this.runtimeOptionsCache.removableOn === removableOn
    ) {
      return this.runtimeOptionsCache.options || value
    }

    const options = applyTreeEditorNodeGuards(value, {
      data,
      childrenField,
      creatableOn,
      editableOn,
      removableOn,
    })
    this.runtimeOptionsCache = {
      value,
      data,
      childrenField,
      creatableOn,
      editableOn,
      removableOn,
      options,
    }
    return options
  }

  syncValueFromProps() {
    const value = this.resolveTreeValue()
    if (isEqual(value, this.state.value)) return
    this.setState({ value })
  }

  async fetchData() {
    const { source, data, childrenField = 'children', env } = this.props
    if (!source) return

    const requestId = ++this.fetchRequestId
    const expandedKeys = this.captureExpandedKeys()
    const isCurrentRequest = () => !this.unmounted && requestId === this.fetchRequestId

    const resolvedSource = resolveTreeEditorSource(source, data)
    if (Array.isArray(resolvedSource)) {
      await this.setTreeState({
        value: normalizeTreeEditorNodes(resolvedSource, childrenField),
        loading: this.pendingCommandCount > 0,
        error: null,
      })
      if (isCurrentRequest()) {
        this.restoreExpandedKeys(this.resolveRuntimeOptions(), expandedKeys)
      }
      return isCurrentRequest()
    }

    if (!isTreeEditorApi(resolvedSource, data)) {
      if (!isCurrentRequest()) return false
      await this.setTreeState({
        value: [],
        loading: this.pendingCommandCount > 0,
        error: null,
      })
      return true
    }

    if (!isCurrentRequest()) return false
    await this.setTreeState({ loading: true, error: null })
    try {
      const result = await requestTreeEditorApi(resolvedSource, data, env, {
        fallbackMessage: '树数据加载失败',
        invalidApiMessage: 'TreeEditor source is not configured',
        missingFetcherMessage: 'TreeEditor source requires env.fetcher',
      })
      const value = normalizeTreeEditorNodes(
        extractTreeEditorItems(result),
        childrenField
      )
      if (!isCurrentRequest()) return false
      await this.setTreeState({
        value,
        loading: this.pendingCommandCount > 0,
        error: null,
      })
      this.restoreExpandedKeys(this.resolveRuntimeOptions(), expandedKeys)
      await this.dispatchEvent('fetchSuccess', { value, responseData: result?.data })
      return true
    } catch (error: any) {
      if (!isCurrentRequest()) return false
      if (!env?.isCancel?.(error)) {
        console.error(error)
        env?.notify?.('error', error?.message || '树数据加载失败')
      }
      await this.setTreeState({ loading: this.pendingCommandCount > 0, error })
      await this.dispatchEvent('fetchFail', { error })
      return false
    }
  }

  async reload() {
    if (this.props.source) {
      return this.fetchData()
    }

    this.syncValueFromProps()
    return true
  }

  async runCommandApi(api: any, payload: any, successEvent: string, failEvent: string) {
    const { env, data, reloadOnSuccess = true } = this.props
    const commandData = createTreeEditorCommandData(data, payload)

    this.pendingCommandCount += 1
    await this.setTreeState({ loading: true, error: null })
    let result: any
    try {
      result = await requestTreeEditorApi(api, commandData, env, {
        fallbackMessage: 'TreeEditor command api failed',
      })
    } catch (error: any) {
      console.error(error)
      env?.notify?.('error', error?.message || '树命令执行失败')
      await this.setTreeState({ error })
      await this.dispatchEvent(failEvent, { ...payload, error })
      return false
    } finally {
      this.pendingCommandCount -= 1
      await this.setTreeState({
        loading: this.pendingCommandCount > 0,
      })
    }

    // A command being accepted and a subsequent snapshot reload are separate
    // outcomes. The command success event must not be converted into a command
    // failure when the refresh request fails.
    await this.dispatchEvent(successEvent, {
      ...payload,
      responseData: result?.data,
      responseStatus: result?.status,
      responseMsg: result?.msg,
    })
    if (reloadOnSuccess && this.props.source) {
      await this.reload()
    }
    return true
  }

  async executeCommandLifecycle(options: {
    api: any
    payload: any
    guardItem?: any
    guard?: any
    beforeEvent?: string
    event?: string
    successEvent: string
    failEvent: string
    skipBefore?: boolean
  }) {
    const {
      api,
      payload,
      guardItem,
      guard,
      beforeEvent,
      event,
      successEvent,
      failEvent,
      skipBefore = false,
    } = options
    if (guard !== undefined && guardItem && !this.isNodeAllowed(guardItem, guard)) {
      return false
    }
    if (!skipBefore && beforeEvent && (await this.dispatchEvent(beforeEvent, payload))) {
      return false
    }
    if (event && (await this.dispatchEvent(event, payload))) return false
    return this.runCommandApi(api, payload, successEvent, failEvent)
  }

  render() {
    const {
      autoFillHeight = false,
      classnames,
      draggable = true,
      creatable = false,
      editable = false,
      removable = false,
      static: isStatic = false,
    } = this.props as any
    const treeProps = getTreeEditorTreeProps(this.props)
    const options = this.resolveRuntimeOptions()
    const { loading, error } = this.state
    const resolvedDraggable = resolveTreeEditorBoolean(draggable, this.props.data, true)
    const resolvedCreatable = resolveTreeEditorBoolean(creatable, this.props.data, false)
    const resolvedEditable = resolveTreeEditorBoolean(editable, this.props.data, false)
    const resolvedRemovable = resolveTreeEditorBoolean(removable, this.props.data, false)
    const treeClassName = [
      treeProps.className,
      autoFillHeight ? classnames('TreeEditor--autoFillHeight') : undefined,
    ]
      .filter(Boolean)
      .join(' ')

    return (
      <TreeEditorTree
        options={options}
        {...treeProps}
        className={treeClassName || undefined}
        onChange={this.handleSelectChange}
        value={this.resolveSelectedValue()}
        valueField={this.resolveIdentityField()}
        disabled={treeProps.disabled || loading}
        placeholder={
          loading ? '加载中...' : error ? '加载失败，请稍后重试' : treeProps.placeholder
        }
        draggable={!isStatic && !loading && resolvedDraggable}
        isNodeDraggable={this.isNodeDraggable}
        creatable={!isStatic && !loading && resolvedCreatable}
        removable={!isStatic && !loading && resolvedRemovable}
        editable={!isStatic && !loading && resolvedEditable}
        onMove={this.itemMoveHandler}
        onHandleNodeClick={this.handleNodeClick}
        onDeferLoad={this.handleDeferLoad}
        itemRender={this.itemRender}
        itemActionsRender={this.itemActionsRender}
        bultinCUD={false}
        onDelete={this.handleDelete}
        onAdd={this.handleCreate}
        onEdit={this.handleEdit}
        showIcon={false}
        ref={(ref: any) => (this.treeRef = ref)}
      />
    )
  }

  @autobind
  isNodeDraggable(item: any) {
    return isTreeEditorNodeDraggable(item, this.props.draggableOn, this.props.data)
  }

  isNodeAllowed(item: any, guard: any) {
    return isTreeEditorNodeAllowed(item, guard, this.props.data)
  }

  @autobind
  itemActionsRender(item: any, states: any) {
    const { render, itemActions, static: isStatic = false } = this.props
    if (!itemActions || !itemActions.length) return null
    const dataChain = extractObjectChain(this.props.data)
    const currentLayer = { item, states }
    dataChain.push(currentLayer)
    const data = createObjectFromChain(dataChain)

    // 如果组件是静态的，除非 action 设置了 disabledOnStatic 为 true，否则显示为禁用按钮
    const finalActions = isStatic
      ? itemActions.map((action: any) => ({
          ...action,
          disabled: action.disableOnStatic ?? true,
        }))
      : itemActions
    return render('actions', finalActions, { data })
  }

  @autobind
  async handleNodeClick(item: any) {
    const value = item?.[this.resolveIdentityField()]
    await this.dispatchEvent('itemClick', {
      item,
      value,
    })
  }

  @autobind
  async handleSelectChange(value: any) {
    const { onSelect } = this.props
    const selectedValue = resolveTreeEditorSelection(value, this.resolveIdentityField())
    const lookupValue = Array.isArray(selectedValue) ? selectedValue[0] : selectedValue
    const item = findTree(
      this.state.value,
      (node: any) => node?.[this.resolveIdentityField()] === lookupValue || node === value
    )
    const prevented = await this.dispatchEvent('select', {
      value: selectedValue,
      item,
      rawValue: value,
    })
    if (prevented) return

    onSelect?.(selectedValue, item)
  }

  @autobind
  async handleDeferLoad(item: any) {
    const { deferLoad, data, childrenField = 'children' } = this.props
    if (!deferLoad || deferLoad === true) return

    const context = createTreeEditorCommandData(data, { item, node: item })
    if (!isEffectiveApi(normalizeTreeEditorApi(deferLoad), context)) {
      await this.dispatchEvent('deferLoad', { item, node: item })
      return
    }

    const sourceRequestId = this.fetchRequestId
    const requestKey = item?.[this.resolveIdentityField()] ?? item
    const requestId = (this.deferRequestIds.get(requestKey) || 0) + 1
    this.deferRequestIds.set(requestKey, requestId)
    const isCurrentRequest = () =>
      !this.unmounted &&
      this.fetchRequestId === sourceRequestId &&
      this.deferRequestIds.get(requestKey) === requestId
    const originalValue = this.state.value
    const loadingTree = mapTree(this.state.value, (node: any) =>
      this.isSameNode(node, item) ? { ...node, loading: true } : node
    )
    await this.setTreeState({ value: loadingTree, error: null })
    try {
      const result = await requestTreeEditorApi(deferLoad, context, this.props.env, {
        fallbackMessage: '树节点加载失败',
        invalidApiMessage: 'TreeEditor deferLoad is not configured',
        missingFetcherMessage: 'TreeEditor deferLoad requires env.fetcher',
      })
      if (!isCurrentRequest()) return
      const children = normalizeTreeEditorNodes(
        extractTreeEditorItems(result),
        childrenField
      )
      const value = mapTree(loadingTree, (node: any) =>
        this.isSameNode(node, item)
          ? setTreeEditorChildren(
              { ...node, loading: false, loaded: true },
              children,
              childrenField
            )
          : node
      )
      await this.setTreeState({ value, error: null })
      await this.dispatchEvent('deferLoadSuccess', {
        item,
        node: item,
        children,
        responseData: result?.data,
      })
    } catch (error: any) {
      if (!isCurrentRequest()) return
      console.error(error)
      await this.setTreeState({ value: originalValue, error })
      await this.dispatchEvent('deferLoadFail', { item, node: item, error })
    }
  }

  async executeDeleteCommand(item: any) {
    const eventData = { item, items: [item], value: this.state.value }
    return this.executeCommandLifecycle({
      api: this.props.deleteApi,
      payload: eventData,
      guardItem: item,
      guard: this.props.removableOn,
      beforeEvent: 'beforeDelete',
      event: 'delete',
      successEvent: 'deleteSuccess',
      failEvent: 'deleteFail',
    })
  }

  async executeCreateCommand(
    item: any,
    parent: any = null,
    path: number[] = [],
    beforeChecked = false
  ) {
    const eventData = { item, parent, path, value: this.state.value }
    return this.executeCommandLifecycle({
      api: this.props.createApi,
      payload: eventData,
      guardItem: parent,
      guard: this.props.creatableOn,
      beforeEvent: 'beforeCreate',
      event: 'create',
      skipBefore: beforeChecked,
      successEvent: 'createSuccess',
      failEvent: 'createFail',
    })
  }

  @autobind
  async handleDelete(item: any) {
    const { deleteConfirmText, deleteConfirmTitle } = this.props
    if (!this.isNodeAllowed(item, this.props.removableOn)) return
    if (deleteConfirmText) {
      const msg = evaluate(deleteConfirmText, item)
      const title = deleteConfirmTitle ? evaluate(deleteConfirmTitle, item) : ''
      const confirmed = await confirm(msg, title)
      if (!confirmed) return
    }
    if (this.isCommandMode()) {
      await this.executeDeleteCommand(item)
      return
    }

    const eventData = { item, items: [item], value: this.state.value }
    if (await this.dispatchEvent('beforeDelete', eventData)) return
    if (await this.dispatchEvent('delete', eventData)) return

    const { value = [] } = this.state
    const newValue = filterTree(value, (node) => !this.isSameNode(node, item))

    this.dispatchEvent('deleteSuccess', { item, items: [item], value: newValue })
    this.notifyChange(newValue)
    return undefined
  }

  @autobind
  async handleEdit(item: any) {
    const { editControls = [], editDialogProps = {} } = this.props

    if (!this.isNodeAllowed(item, this.props.editableOn)) return

    if (await this.dispatchEvent('beforeUpdate', { item, value: this.state.value })) {
      return
    }

    if (!editControls.length) {
      if (this.isCommandMode()) {
        const eventData = { item, value: this.state.value }
        await this.executeCommandLifecycle({
          api: this.props.updateApi,
          payload: eventData,
          guardItem: item,
          guard: this.props.editableOn,
          event: 'update',
          successEvent: 'updateSuccess',
          failEvent: 'updateFail',
        })
      }
      return
    }

    const editForm = {
      type: 'form',
      title: null,
      body: editControls as any[],
    }
    const editDialog = {
      title: '编辑',
      ...editDialogProps,
      type: 'dialog',
      body: editForm,
      data: item,
    }
    // @ts-ignore
    const result = await openDialog(editDialog)
    if (!result) return

    const oldValue = this.state.value
    const formData = result[0]
    const newNode = {
      ...item,
      ...formData,
    }
    const newValue = mapTree(oldValue, (node) => {
      if (!this.isSameNode(node, item)) return { ...node }
      return newNode
    })

    if (this.isCommandMode()) {
      const eventData = { item: newNode, oldItem: item, value: oldValue, formData }
      await this.executeCommandLifecycle({
        api: this.props.updateApi,
        payload: eventData,
        guardItem: item,
        guard: this.props.editableOn,
        event: 'update',
        successEvent: 'updateSuccess',
        failEvent: 'updateFail',
      })
      return
    }

    this.dispatchEvent('editSuccess', { item: newNode, value: newValue })
    this.notifyChange(newValue)
  }

  @autobind
  async handleCreate(parent: number[]) {
    const { addControls = [], addDialogProps = {}, valueField, keyField } = this.props
    const value = this.state.value
    const path = parent.slice(0, -1)
    const parentNode = path.length ? getTree(value, path) : null
    if (parentNode && !this.isNodeAllowed(parentNode, this.props.creatableOn)) return
    if (await this.dispatchEvent('beforeCreate', { parent: parentNode, path, value })) {
      return
    }
    if (!addControls.length) {
      if (this.isCommandMode()) {
        await this.executeCreateCommand(undefined, parentNode, path, true)
      }
      return
    }
    const identityField = keyField || valueField
    const keys = identityField
      ? flattenTree(value, (item: any) => item[identityField]).filter(
          (key) => key !== undefined
        )
      : []
    const addForm = {
      type: 'form',
      title: '',
      onValidate(value: any, form: any) {
        if (!identityField) return {}
        const key = value[identityField]
        if (keys.includes(key)) {
          const fieldLabel = form.getItemByName(identityField)?.label ?? identityField
          return {
            [identityField]: `${fieldLabel} ${key} 已存在`,
          }
        }
        return {}
      },
      body: addControls,
    }
    const addDialog = {
      title: '添加',
      ...addDialogProps,
      type: 'dialog',
      body: addForm,
    }

    // @ts-ignore
    const result = await openDialog(addDialog)
    if (!result) return

    if (this.isCommandMode()) {
      const item = result[0]
      await this.executeCreateCommand(item, parentNode, path, true)
      return
    }

    this.addItem(result[0], path)
  }

  @autobind
  async itemMoveHandler(dropInfo: any) {
    const {
      draggableOn,
      data,
      childrenField = 'children',
      optimistic = false,
    } = this.props
    const payload = buildTreeEditorMovePayload(dropInfo, this.state.value, {
      valueField: this.resolveIdentityField(),
      childrenField,
    })
    if (
      isTreeEditorDescendant(
        this.state.value,
        payload.dragNode,
        payload.targetNode,
        childrenField,
        this.resolveIdentityField()
      )
    ) {
      await this.dispatchEvent('moveFail', {
        ...payload,
        error: new Error('TreeEditor cannot move a node into its descendant'),
      })
      return
    }
    if (!isTreeEditorNodeDraggable(payload.dragNode, draggableOn, data)) return
    if (await this.dispatchEvent('beforeMove', payload)) return
    if (await this.dispatchEvent('move', payload)) return

    if (this.isCommandMode()) {
      const originalValue = this.state.value
      if (optimistic) {
        this.applyLocalMove(dropInfo, false)
      }
      const succeeded = await this.runCommandApi(
        this.props.moveApi,
        payload,
        'moveSuccess',
        'moveFail'
      )
      if (!succeeded && optimistic) {
        if (this.props.source) {
          const reloaded = await this.reload()
          if (!reloaded) {
            await this.setTreeState({ value: originalValue })
          }
        } else {
          await this.setTreeState({ value: originalValue })
        }
      }
      return
    }

    const value = this.applyLocalMove(dropInfo)
    await this.dispatchEvent('moveSuccess', { ...payload, value })
  }

  applyLocalMove(dropInfo: any, notify = true) {
    const value = moveTreeEditorNodes(this.state.value, dropInfo, {
      valueField: this.resolveIdentityField(),
      childrenField: this.props.childrenField,
    })
    if (value === this.state.value) return value
    this.commitTreeValue(value, notify)
    return value
  }

  moveIn(dragNode: any, targetNode: any, notify = true) {
    return this.applyLocalMove({ dragNode, node: targetNode, position: 'self' }, notify)
  }

  moveAfter(dragNode: any, targetNode: any, notify = true) {
    return this.applyLocalMove({ dragNode, node: targetNode, position: 'bottom' }, notify)
  }

  moveBefore(dragNode: any, targetNode: any, notify = true) {
    return this.applyLocalMove({ dragNode, node: targetNode, position: 'top' }, notify)
  }

  @autobind
  itemRender(item: any) {
    const {
      defaultLeafIcon = 'file',
      defaultBranchIcon = 'folder',
      iconField = 'icon',
      showIcon = true,
      labelField,
      nodeDisplayTpl,
      render,
    } = this.props
    const icon =
      item[iconField] || (item.children?.length ? defaultBranchIcon : defaultLeafIcon)

    return (
      <div className="flex items-center">
        {showIcon ? <Icon icon={icon} className="mr-2 h-3 w-4" /> : null}
        {nodeDisplayTpl
          ? render('', nodeDisplayTpl, { data: item })
          : [
              <span key="title">{item[labelField || 'title']}</span>,
              <span key="description" className="ml-2 text-gray-400">
                {item.description}
              </span>,
            ]}
      </div>
    )
  }

  commitTreeValue(value: any, notify = true) {
    const { onChange } = this.props
    const expandedKeys = this.captureExpandedKeys()
    void this.setTreeState({ value }).then(() => {
      this.restoreExpandedKeys(this.resolveRuntimeOptions(), expandedKeys)
    })
    if (notify) {
      onChange?.(value)
    }
  }

  notifyChange(value: any) {
    this.commitTreeValue(value, true)
  }

  addItem(item: any, path: number[] = []) {
    const { value } = this.state
    const { keyField, valueField } = this.props
    const identityField = keyField || valueField
    const parentNode = path.length ? getTree(value, path) : null
    if (parentNode && !this.isNodeAllowed(parentNode, this.props.creatableOn)) return

    const newNode = { ...item }
    // 如果有keyField，则检查key
    if (identityField) {
      const newKey = newNode[identityField]
      if (!newKey) {
        alert('节点缺少 key 值', '错误')
        return
      }
      const exist = findTree(value, (item: any) => item[identityField] === newKey)
      if (exist) {
        alert(`节点重复，${newKey} 已存在`, '错误')
        return
      }
    }

    // 插入节点
    const newValue = !path.length
      ? [...value, newNode]
      : mapTree(
          value,
          (node: any, _1: number, _2: number, _3: any[], indexes: number[]) =>
            !isEqual(indexes, path)
              ? node
              : appendTreeEditorChild(node, newNode, this.props.childrenField)
        )
    this.dispatchEvent('addSuccess', { item: newNode, value: newValue })
    this.notifyChange(newValue)
  }

  removeByIndex(index: any) {
    const path: number[] = []
    if (typeof index === 'number') {
      path.push(index)
    }
    if (typeof index === 'string') {
      const idx = index
        .split('.')
        .map((item: any) => parseInt(item.trim(), 10))
        .filter((n) => !isNaN(n))
      path.push(...idx)
    }
    if (index instanceof Array) {
      path.push(...index.map((item: any) => parseInt(item, 10)).filter((n) => !isNaN(n)))
    }
    if (!path.length) return
    const oldValue = this.state.value
    const item = getTree(oldValue, path)
    if (!item || !this.isNodeAllowed(item, this.props.removableOn)) return false
    const newValue = filterTree(oldValue, (node: any) => !this.isSameNode(node, item))
    this.dispatchEvent('deleteSuccess', { item, items: [item], value: newValue })
    this.notifyChange(newValue)
    return undefined
  }

  async removeByCondition(condition: any, data: any) {
    const oldValue = this.state.value
    const promises: Promise<{ item: any; toBeRemoved: boolean }>[] = []
    eachTree(oldValue, (item: any) => {
      const result = evalExpressionWithConditionBuilderAsync(condition, {
        ...item,
        event: { data },
      })
        .then((toBeRemoved) => ({ item, toBeRemoved, condition, event: { data } }))
        .catch((err) => {
          console.error(err)
          return { item, toBeRemoved: false, condition }
        })
      promises.push(result)
    })

    const results = await Promise.all(promises)
    const items = results
      .filter((result) => result.toBeRemoved)
      .map((result) => result.item)

    if (this.isCommandMode()) {
      const results = []
      for (const item of items) {
        results.push(await this.executeDeleteCommand(item))
      }
      return results
    }

    const newValue = filterTree(oldValue, (item: any) => {
      const result = results.find((result) => result.item === item)
      return !result?.toBeRemoved
    })

    this.dispatchEvent('deleteSuccess', {
      item: items.length ? items[0] : undefined,
      items,
      value: newValue,
    })
    this.notifyChange(newValue)
    return undefined
  }

  @autobind
  async doAction(
    action: ListenerAction | ActionObject,
    data: any,
    ...rest: [boolean?, any?]
  ) {
    const args = rest[1]
    const actionType = action.actionType
    if (actionType === 'reload' || actionType === 'reloadOptions') {
      return this.reload()
    }
    if (actionType === 'addItem') {
      const toAdd = args?.item
      if (this.isCommandMode()) {
        return this.executeCreateCommand(toAdd)
      }
      return this.addItem(toAdd)
    }
    if (actionType === 'removeItem' || actionType === 'deleteItem') {
      const index =
        args?.index !== undefined
          ? args.index
          : args?.indexs !== undefined
            ? args.indexs
            : args?.indexPath
      if (index !== undefined) {
        const path = this.resolveIndexPath(index)
        const item = getTree(this.state.value, path)
        if (item && !this.isNodeAllowed(item, this.props.removableOn)) return false
        if (this.isCommandMode()) {
          return item ? this.executeDeleteCommand(item) : false
        }
        return this.removeByIndex(index)
      }
      const condition = args?.condition
      if (condition) return await this.removeByCondition(condition, data)
    }
  }

  resolveIndexPath(index: any) {
    if (typeof index === 'number') return [index]
    if (typeof index === 'string') {
      return index
        .split('.')
        .map((item) => parseInt(item.trim(), 10))
        .filter((item) => !Number.isNaN(item))
    }
    if (Array.isArray(index)) {
      return index.map((item) => parseInt(item, 10)).filter((item) => !Number.isNaN(item))
    }
    return []
  }

  /**
   * 派发事件
   * @param eventName 事件名称
   * @param eventData 事件数据
   * @returns
   */
  async dispatchEvent(eventName: string, eventData: any = {}) {
    const { dispatchEvent } = this.props
    const rendererEvent = await dispatchEvent(
      eventName,
      resolveEventData(this.props, eventData)
    )

    return !!rendererEvent?.prevented
  }
}

FormItem({
  type: 'tree-editor',
  autoVar: false,
})(TreeEditor as any)

export default TreeEditor
