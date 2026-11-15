import React from 'react'
import ReactDOM from 'react-dom'
import { createObject, getTree, isEffectiveApi, spliceTree } from 'amis'
import { createObject as createOperationObject } from 'amis-core/lib/utils/object'
import {
  TableControlRenderer,
  type TableProps,
  type TableState,
} from 'amis/lib/renderers/Form/InputTable'
import cloneDeep from 'lodash/cloneDeep'
import isEqual from 'lodash/isEqual'
import {
  findEditableInputTableControl,
  focusInputTableControl,
  getInputTableControlName,
  hasInputTableQuickEditableAncestor,
  isEditableInputTableControl,
  revealInputTableControl,
} from './inputTableDomControls'
import { INPUT_TABLE_PLACEHOLDER } from './inputTableConstants'
import {
  buildInputTableCandidateItems,
  getInputTableRowRefValues,
  getInputTableTreeItem,
  resolveInputTableActionEditBehavior,
  spliceInputTableTree,
  type InputTableActionEditBehavior,
  validateInputTableCandidateItems,
} from './inputTableInlineEdit'
import { presentInputTableInlineEditRow } from './inputTableInlineEditPresentation'
import {
  buildInputTableOverlayActions,
  buildInputTableOverlayFormSchema,
  isInputTableOverlayMode,
  normalizeInputTableEditMode,
  resolveInputTableOverlayFormItems,
  type InputTableEditMode,
  type InputTableOverlayAction,
} from './inputTableOverlay'
import {
  INPUT_TABLE_OPERATION_CONTEXT_MARKER,
  INPUT_TABLE_TOP_ADD_ACTION_TYPE,
  canRunInputTableOperationAction as canRunInputTableOperationActionWithOptions,
  hasInputTableOperationButtonOverrides as hasConfiguredInputTableOperationButtonOverrides,
  isInputTableAddButtonTopPosition,
  isInputTableOperationActionType,
  normalizeInputTableAddButtonPosition,
  normalizeInputTableOperationButtonSchema,
  resolveInputTableOperationButtonSchemas,
  type InputTableOperationButtonState,
} from './inputTableOperation'
import {
  buildInputTablePatchedRenderProps,
  buildInputTablePatchedTableSchema,
  buildInputTableTopAddActionSchema,
  renderInputTableWithPositionedAddButton,
} from './inputTableRender'
import type {
  ArrowRowNavigationConfig,
  RowAggregateConfig,
} from './inputTableRowEnhancements'
import { computeRowAggregates } from './inputTableRowEnhancements'

const INPUT_TABLE_ACTIVE_INPUT_GRACE_MS = 1000
const INPUT_TABLE_AUTO_INLINE_SYNC_IDLE_MS = 600

type InputTableOverlayMode = Extract<InputTableEditMode, 'dialog' | 'drawer'>

type InputTableOverlayState = {
  mode: InputTableOverlayMode
  action: InputTableOverlayAction
  editIndex: string
  data: Record<string, unknown>
}

type InputTableRuntimeProps = TableProps & {
  addMode?: InputTableEditMode
  editMode?: InputTableEditMode
  height?: number | string
  minHeight?: number | string
  maxHeight?: number | string
  overflow?: string
  overflowX?: string
  overflowY?: string
  lazyRenderAfter?: number | string
  loadingMaxDuration?: number | string
  $schema?: {
    height?: number | string
    minHeight?: number | string
    maxHeight?: number | string
    overflow?: string
    overflowX?: string
    overflowY?: string
    lazyRenderAfter?: number | string
    loadingMaxDuration?: number | string
    rowAggregate?: RowAggregateConfig
    arrowRowNavigation?: boolean | ArrowRowNavigationConfig
    addButtonPosition?: Parameters<typeof normalizeInputTableAddButtonPosition>[0]
    operationButtons?: any[]
    addingOperationButtons?: any[]
    editingOperationButtons?: any[]
  }
  addFormItems?: any[]
  editFormItems?: any[]
  addDialogProps?: Record<string, any>
  editDialogProps?: Record<string, any>
  addDrawerProps?: Record<string, any>
  editDrawerProps?: Record<string, any>
  rowAggregate?: RowAggregateConfig
  arrowRowNavigation?: boolean | ArrowRowNavigationConfig
  addButtonPosition?: Parameters<typeof normalizeInputTableAddButtonPosition>[0]
  operationButtons?: any[]
  addingOperationButtons?: any[]
  editingOperationButtons?: any[]
}

type InputTableRuntimeState = TableState & {
  inputTableOverlay?: InputTableOverlayState
}

type InputTableRowRef = {
  flush?: () => unknown
  validate?: (
    forceValidate?: boolean,
    throwErrors?: boolean,
    toastErrors?: boolean
  ) => boolean | Promise<boolean>
  props?: {
    onFlushChange?: () => unknown
    onValidate?: () => boolean | Promise<boolean>
  }
}

type InputTableAutoInlineSyncResult =
  { status: 'synced' } | { status: 'invalid'; message: string } | { status: 'stale' }

type InputTableAutoInlineSyncOptions = {
  commit?: 'none' | 'validated'
  deferWhileInputActive?: boolean
  // 表单校验/提交路径需要同步写回，见 emitInputTableValueImmediately
  immediateEmit?: boolean
}

type InputTableIdleSession = {
  kind: 'idle'
}

type InputTableAutoInlineSession = {
  kind: 'auto-inline'
  action: InputTableOverlayAction
  editIndex: string
  isNew: boolean
  revision: number
  syncRequested: boolean
  syncScheduled: boolean
  syncTimer?: ReturnType<typeof setTimeout>
  canAddAfterSync: boolean
  hasUserInteracted: boolean
  lastInputAt: number
  flushDepth: number
  lastEmittedItem?: Record<string, any>
  cancelPresentation?: () => void
  syncTail: Promise<void>
}

type InputTableConfirmInlineSession = {
  kind: 'confirm-inline'
  action: InputTableOverlayAction
  editIndex: string
  isNew: boolean
  cancelPresentation?: () => void
}

type InputTableNativeImmediateSession = {
  kind: 'native-immediate'
  lastInputAt: number
  forceEmitDepth: number
  emitTimer?: ReturnType<typeof setTimeout>
}

type InputTableOverlaySession = {
  kind: 'overlay'
  action: InputTableOverlayAction
  editIndex: string
  mode: InputTableOverlayMode
  descriptor: InputTableOverlayState
}

type InputTableRuntimeSession =
  | InputTableIdleSession
  | InputTableAutoInlineSession
  | InputTableConfirmInlineSession
  | InputTableNativeImmediateSession
  | InputTableOverlaySession

export function createInputTableRendererAdapter(
  Base: typeof TableControlRenderer
): typeof TableControlRenderer {
  return class InputTableRendererAdapter extends Base {
    private inputTableSession: InputTableRuntimeSession = {
      kind: 'idle',
    }

    private inputTableCooperativeMaterializationDisabled = false

    get inputTableProps() {
      return this.props as InputTableRuntimeProps
    }

    get inputTableState() {
      return this.state as InputTableRuntimeState
    }

    setInputTableState(
      state:
        | Partial<InputTableRuntimeState>
        | ((state: InputTableRuntimeState) => Partial<InputTableRuntimeState> | null),
      callback?: () => void
    ) {
      const setState = this.setState.bind(this) as (
        state:
          | Partial<InputTableRuntimeState>
          | ((state: InputTableRuntimeState) => Partial<InputTableRuntimeState> | null),
        callback?: () => void
      ) => void

      setState(state, callback)
    }

    get rowAggregateConfig(): RowAggregateConfig | undefined {
      const config =
        this.inputTableProps.rowAggregate ?? this.inputTableProps.$schema?.rowAggregate

      return config &&
        config.valueField &&
        Array.isArray(config.keyPaths) &&
        config.keyPaths.length &&
        Array.isArray(config.sourcesPaths) &&
        config.sourcesPaths.length
        ? (config as RowAggregateConfig)
        : undefined
    }

    get arrowRowNavigationConfig(): ArrowRowNavigationConfig | undefined {
      const config =
        this.inputTableProps.arrowRowNavigation ??
        this.inputTableProps.$schema?.arrowRowNavigation

      if (!config) {
        return undefined
      }

      return typeof config === 'object' ? config : {}
    }

    componentDidMount() {
      super.componentDidMount?.()
      document.addEventListener('keydown', this.handleArrowRowNavigation, true)
      document.addEventListener(
        'keypress',
        this.handleInputTableQuickEditSpaceKeyPress,
        true
      )
      document.addEventListener(
        'keydown',
        this.handleInputTableAutoInlineInteraction,
        true
      )
      document.addEventListener('input', this.handleInputTableAutoInlineInteraction, true)
    }

    componentDidUpdate(prevProps: any, prevState: any) {
      super.componentDidUpdate?.(prevProps, prevState)
      this.ensureInputTableAutoInlineEditSession()

      const session = this.getActiveInputTableAutoInlineEditSession()

      if (session?.syncRequested && prevState.items !== this.inputTableState.items) {
        session.syncRequested = false
        this.scheduleInputTableAutoInlineSync()
      }
    }

    componentWillUnmount() {
      this.disposeInputTableSession()
      document.removeEventListener('keydown', this.handleArrowRowNavigation, true)
      document.removeEventListener(
        'keypress',
        this.handleInputTableQuickEditSpaceKeyPress,
        true
      )
      document.removeEventListener(
        'keydown',
        this.handleInputTableAutoInlineInteraction,
        true
      )
      document.removeEventListener(
        'input',
        this.handleInputTableAutoInlineInteraction,
        true
      )
      super.componentWillUnmount()
    }

    private disposeInputTableSession(
      session: InputTableRuntimeSession = this.inputTableSession,
      reset = true
    ) {
      if (session.kind === 'auto-inline') {
        if (session.syncTimer) {
          clearTimeout(session.syncTimer)
        }
        session.syncTimer = undefined
        session.syncScheduled = false
        session.cancelPresentation?.()
      } else if (session.kind === 'confirm-inline') {
        session.cancelPresentation?.()
      } else if (session.kind === 'native-immediate' && session.emitTimer) {
        clearTimeout(session.emitTimer)
        session.emitTimer = undefined
      }

      if (reset && this.inputTableSession === session) {
        this.inputTableSession = {
          kind: 'idle',
        }
      }
    }

    private useInputTableSession<T extends InputTableRuntimeSession>(session: T): T {
      this.disposeInputTableSession(this.inputTableSession, false)
      this.inputTableSession = session
      return session
    }

    emitValue(value?: any[]): Promise<boolean> {
      if (this.shouldDeferInputTableNativeImmediateEmit(value)) {
        this.scheduleInputTableNativeImmediateEmit()
        return Promise.resolve(false)
      }

      const config = this.rowAggregateConfig

      if (!config) {
        return super.emitValue(value)
      }

      const items = computeRowAggregates(
        Array.isArray(value) ? value : this.inputTableState.items,
        config
      )

      if (Array.isArray(value) && items === value) {
        return super.emitValue(value)
      }

      if (!Array.isArray(value) && items === this.inputTableState.items) {
        return super.emitValue()
      }

      this.rebindInputTableEntries(items, this.inputTableState.items)

      return new Promise<boolean>((resolve) => {
        this.setState(
          {
            items,
            ...this.transformState(items, this.inputTableState),
          },
          () => resolve(super.emitValue(items))
        )
      })
    }

    /**
     * 同步把值写回表单。
     * FormTable.emitValue 只以单参数调用 onChange（即 wrapControl#handleChange），
     * 使 changeImmediately 为假而落到 250ms 防抖的 lazyEmitChange 上；
     * 而表单取值（amis Form#getValues）会紧接着同步读取 store.data，
     * 于是提交读到的是尚未写入值的新增行。这里显式以 changeImmediately=true 触发同步发射。
     */
    emitInputTableValueImmediately(value?: any[]) {
      if (!Array.isArray(value)) {
        return
      }

      // 仅作用于 auto-inline：其它编辑模式的发射时机有其自身语义（如 needConfirm 的保存确认），
      // 不能一并改为立即发射。
      if (!this.getActiveInputTableAutoInlineEditSession()) {
        return
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const onChange = (this.props as any).onChange

      if (typeof onChange !== 'function') {
        return
      }

      onChange(value, undefined, true)
    }

    flush() {
      if (!this.shouldUseInputTableNativeImmediateEditSurface()) {
        return super.flush()
      }

      const session = this.getInputTableNativeImmediateSession()
      session.forceEmitDepth += 1

      try {
        const result = super.flush()

        return Promise.resolve(result).finally(() => {
          session.forceEmitDepth -= 1
        })
      } catch (error) {
        session.forceEmitDepth -= 1
        throw error
      }
    }

    rebindInputTableEntries(nextItems: any[], originItems: any[]) {
      const entries = this.entries as any

      if (!entries?.has || !entries?.set || !entries?.delete) {
        return
      }

      nextItems.forEach((item, index) => {
        const origin = originItems[index]

        if (item !== origin && entries.has(origin)) {
          entries.set(item, entries.get(origin))
          entries.delete(origin)
        }
      })
    }

    getInputTableRootElement() {
      const root = ReactDOM.findDOMNode(this)

      return root instanceof HTMLElement ? root : undefined
    }

    handleArrowRowNavigation = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
        return
      }

      if (event.defaultPrevented || !this.arrowRowNavigationConfig) {
        return
      }

      const target = event.target as HTMLElement | null
      const root = this.getInputTableRootElement()

      if (!target || !root?.contains(target) || !isEditableInputTableControl(target)) {
        return
      }

      if (this.arrowRowNavigationConfig.columns?.length) {
        const fieldName = getInputTableControlName(target)

        if (!fieldName || !this.arrowRowNavigationConfig.columns.includes(fieldName)) {
          return
        }
      }

      const cell = target.closest('td')
      const row = cell?.closest('tr')
      const body = row?.parentElement

      if (!cell || !row || !body) {
        return
      }

      const columnIndex = cell.cellIndex
      const rows = Array.from(body.children).filter(
        (node): node is HTMLTableRowElement => node.tagName === 'TR'
      )
      const from = rows.indexOf(row)

      if (from < 0) {
        return
      }

      const step = event.key === 'ArrowUp' ? -1 : 1

      for (let i = from + step; i >= 0 && i < rows.length; i += step) {
        const nextCell = rows[i].cells[columnIndex]
        const nextControl = nextCell ? findEditableInputTableControl(nextCell) : undefined

        if (nextControl) {
          event.preventDefault()
          event.stopPropagation()
          focusInputTableControl(nextControl)
          revealInputTableControl(nextControl)
          return
        }
      }
    }

    handleInputTableQuickEditSpaceKeyPress = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const root = this.getInputTableRootElement()

      if (
        event.defaultPrevented ||
        (event.key !== ' ' && event.code !== 'Space') ||
        !target ||
        !root?.contains(target) ||
        !isEditableInputTableControl(target) ||
        !hasInputTableQuickEditableAncestor(target, root)
      ) {
        return
      }

      event.stopPropagation()
    }

    handleInputTableAutoInlineInteraction = (event: Event) => {
      this.recordInputTableNativeImmediateInteraction(event)
      const session = this.getActiveInputTableAutoInlineEditSession()

      if (!session) {
        return
      }

      const target = event.target as HTMLElement | null
      const root = this.getInputTableRootElement()

      if (!target || !root?.contains(target)) {
        return
      }

      session.hasUserInteracted = true
      session.lastInputAt = Date.now()
      this.scheduleInputTableAutoInlineSync()
    }

    recordInputTableNativeImmediateInteraction(event: Event) {
      if (!this.shouldUseInputTableNativeImmediateEditSurface()) {
        return
      }

      const root = this.getInputTableRootElement()
      const target = event.target

      if (
        !root ||
        !(target instanceof HTMLElement) ||
        !root.contains(target) ||
        !isEditableInputTableControl(target) ||
        !hasInputTableQuickEditableAncestor(target, root)
      ) {
        return
      }

      this.getInputTableNativeImmediateSession().lastInputAt = Date.now()
    }

    getActiveInputTableNativeImmediateControl() {
      const root = this.getInputTableRootElement()
      const activeElement = document.activeElement

      if (
        !root ||
        !(activeElement instanceof HTMLElement) ||
        !root.contains(activeElement) ||
        !isEditableInputTableControl(activeElement) ||
        !hasInputTableQuickEditableAncestor(activeElement, root)
      ) {
        return undefined
      }

      return activeElement
    }

    shouldDeferInputTableNativeImmediateEmit(value?: any[]) {
      if (
        value !== undefined ||
        !this.shouldUseInputTableNativeImmediateEditSurface() ||
        !this.getActiveInputTableNativeImmediateControl()
      ) {
        return false
      }

      const session = this.getInputTableNativeImmediateSession()

      if (session.forceEmitDepth > 0) {
        return false
      }

      return Date.now() - session.lastInputAt < INPUT_TABLE_ACTIVE_INPUT_GRACE_MS
    }

    cancelInputTableNativeImmediateEmit() {
      const session = this.inputTableSession

      if (session.kind !== 'native-immediate' || !session.emitTimer) {
        return
      }

      clearTimeout(session.emitTimer)
      session.emitTimer = undefined
    }

    scheduleInputTableNativeImmediateEmit() {
      this.cancelInputTableNativeImmediateEmit()
      const session = this.getInputTableNativeImmediateSession()

      const run = () => {
        if (this.inputTableSession !== session) {
          return
        }

        const elapsedSinceInput = Date.now() - session.lastInputAt

        if (elapsedSinceInput < INPUT_TABLE_ACTIVE_INPUT_GRACE_MS) {
          session.emitTimer = setTimeout(
            run,
            INPUT_TABLE_ACTIVE_INPUT_GRACE_MS - elapsedSinceInput
          )
          return
        }

        session.emitTimer = undefined
        void this.emitInputTableNativeImmediateValueNow()
      }

      run()
    }

    emitInputTableNativeImmediateValueNow() {
      const session = this.getInputTableNativeImmediateSession()
      session.forceEmitDepth += 1

      try {
        const result = this.emitValue()

        return Promise.resolve(result).finally(() => {
          session.forceEmitDepth -= 1
        })
      } catch (error) {
        session.forceEmitDepth -= 1
        throw error
      }
    }

    getInputTableNativeImmediateSession() {
      if (this.inputTableSession.kind === 'native-immediate') {
        return this.inputTableSession
      }

      return this.useInputTableSession<InputTableNativeImmediateSession>({
        kind: 'native-immediate',
        lastInputAt: 0,
        forceEmitDepth: 0,
      })
    }

    getActiveInputTableAutoInlineEditSession() {
      const session = this.inputTableSession

      if (
        session.kind !== 'auto-inline' ||
        session.editIndex !== this.inputTableState.editIndex ||
        this.getInputTableActionEditBehavior(session.action) !== 'auto-inline'
      ) {
        return undefined
      }

      return session
    }

    beginInputTableAutoInlineEdit(action: InputTableOverlayAction, editIndex?: string) {
      const index = editIndex || this.inputTableState.editIndex

      if (!index || this.getInputTableActionEditBehavior(action) !== 'auto-inline') {
        return undefined
      }

      const indexes = index.split('.').map((item) => parseInt(item, 10))
      const item = getInputTableTreeItem(this.inputTableState.items, indexes)
      const isNew =
        action === 'add' ||
        Object.prototype.hasOwnProperty.call(item || {}, INPUT_TABLE_PLACEHOLDER)

      return this.useInputTableSession<InputTableAutoInlineSession>({
        kind: 'auto-inline',
        action,
        editIndex: index,
        isNew,
        revision: 0,
        syncRequested: false,
        syncScheduled: false,
        canAddAfterSync: false,
        hasUserInteracted: false,
        lastInputAt: 0,
        flushDepth: 0,
        syncTail: Promise.resolve(),
      })
    }

    ensureInputTableAutoInlineEditSession() {
      const state = this.inputTableState

      if (!state.editIndex || this.getActiveInputTableAutoInlineEditSession()) {
        return
      }

      const action = this.getInputTableActionForEditColumns(
        Boolean(state.isCreateMode),
        state.editIndex
      )

      if (!action || this.getInputTableActionEditBehavior(action) !== 'auto-inline') {
        return
      }

      const session = this.beginInputTableAutoInlineEdit(action, state.editIndex)
      this.presentInputTableAutoInlineEditRow(session)

      if (!session?.isNew) {
        this.scheduleInputTableAutoInlineSync()
      }
    }

    cancelInputTableAutoInlineSync(
      session = this.getActiveInputTableAutoInlineEditSession()
    ) {
      if (!session?.syncTimer) {
        return
      }

      clearTimeout(session.syncTimer)
      session.syncTimer = undefined
      session.syncScheduled = false
    }

    presentInputTableAutoInlineEditRow(session?: InputTableAutoInlineSession) {
      const root = this.getInputTableRootElement()

      if (!session || !root) {
        return
      }

      session.cancelPresentation?.()
      session.cancelPresentation = presentInputTableInlineEditRow({
        root,
        editIndex: session.editIndex,
        isNew: session.isNew,
        isActive: () => this.getActiveInputTableAutoInlineEditSession() === session,
        shouldFocus: () => !session.hasUserInteracted,
      })
    }

    presentInputTableConfirmInlineEditRow(
      action: InputTableOverlayAction,
      editIndex: string,
      isNew: boolean
    ) {
      const root = this.getInputTableRootElement()

      if (!root) {
        return
      }

      const session = this.useInputTableSession<InputTableConfirmInlineSession>({
        kind: 'confirm-inline',
        action,
        editIndex,
        isNew,
      })
      session.cancelPresentation = presentInputTableInlineEditRow({
        root,
        editIndex,
        isNew,
        isActive: () =>
          this.inputTableSession === session &&
          this.inputTableState.editIndex === editIndex,
      })
    }

    scheduleInputTableAutoInlineSync() {
      const session = this.getActiveInputTableAutoInlineEditSession()

      if (!session) {
        return
      }

      session.revision += 1

      if (session.syncTimer) {
        clearTimeout(session.syncTimer)
      }

      session.syncScheduled = true
      const run = () => {
        if (this.getActiveInputTableAutoInlineEditSession() !== session) {
          return
        }

        const elapsedSinceInput = Date.now() - session.lastInputAt

        if (elapsedSinceInput < INPUT_TABLE_ACTIVE_INPUT_GRACE_MS) {
          session.syncTimer = setTimeout(
            run,
            INPUT_TABLE_ACTIVE_INPUT_GRACE_MS - elapsedSinceInput
          )
          return
        }

        session.syncTimer = undefined
        session.syncScheduled = false
        const revision = session.revision

        void this.syncInputTableAutoInlineEdit(revision, {
          commit: 'validated',
          deferWhileInputActive: true,
        }).catch((error) => {
          this.inputTableProps.env?.notify?.(
            'error',
            error instanceof Error
              ? error.message
              : this.inputTableProps.translate?.('Form.validateFailed')
          )
        })
      }

      session.syncTimer = setTimeout(run, INPUT_TABLE_AUTO_INLINE_SYNC_IDLE_MS)
    }

    syncInputTableAutoInlineEdit(
      scheduledRevision?: number,
      options: InputTableAutoInlineSyncOptions = {}
    ): Promise<InputTableAutoInlineSyncResult> {
      const session = this.getActiveInputTableAutoInlineEditSession()

      if (!session) {
        return Promise.resolve({ status: 'stale' })
      }

      if (scheduledRevision === undefined) {
        this.cancelInputTableAutoInlineSync(session)
      }

      const revision = scheduledRevision ?? ++session.revision
      const result = session.syncTail.then(() =>
        this.performInputTableAutoInlineSync(session, revision, options)
      )

      session.syncTail = result.then(
        () => undefined,
        () => undefined
      )
      return result
    }

    async performInputTableAutoInlineSync(
      session: InputTableAutoInlineSession,
      revision: number,
      options: InputTableAutoInlineSyncOptions
    ): Promise<InputTableAutoInlineSyncResult> {
      if (!this.isInputTableAutoInlineSyncCurrent(session, revision)) {
        return { status: 'stale' }
      }

      const commit = options.commit ?? 'none'
      const startedAt = Date.now()
      const deferIfInputActive = () =>
        this.deferInputTableAutoInlineScheduledSyncIfNeeded(session, startedAt, options)

      let effectiveRevision = revision

      if (commit !== 'none') {
        await this.flushInputTableAutoInlineEditRow(session)
        // 刷新会把快捷编辑子表单的值推进行数据，该过程自身会触发变更并再次排定同步，
        // 从而让 session.revision 前移。这是本次刷新的副产物而非更新的用户输入，
        // 不能据此把本次同步判为过期——否则表单在校验/提交时永远提交不了行内新增行。
        effectiveRevision = session.revision
      }

      if (
        deferIfInputActive() ||
        !this.isInputTableAutoInlineSyncCurrent(session, effectiveRevision)
      ) {
        return { status: 'stale' }
      }

      const validRow =
        commit === 'validated'
          ? await this.validateInputTableAutoInlineEditRow(session.editIndex)
          : true

      if (
        !this.isInputTableAutoInlineSyncCurrent(session, effectiveRevision) ||
        deferIfInputActive()
      ) {
        return { status: 'stale' }
      }

      if (!validRow) {
        this.updateInputTableAutoInlineAddAvailability(session, false)
        return {
          status: 'invalid',
          message: this.getInputTableValidationFailureMessage(),
        }
      }

      const indexes = session.editIndex.split('.').map((item) => parseInt(item, 10))
      const currentItem = getInputTableTreeItem(this.inputTableState.items, indexes)

      if (!currentItem) {
        this.updateInputTableAutoInlineAddAvailability(session, false)
        return {
          status: 'invalid',
          message: this.getInputTableValidationFailureMessage(),
        }
      }

      const candidate = buildInputTableCandidateItems({
        items: this.inputTableState.items,
        indexes,
        item: currentItem,
        placeholderKey: INPUT_TABLE_PLACEHOLDER,
      })
      const message = this.getInputTableCandidateItemsValidationMessage(
        candidate.items,
        candidate.item
      )

      if (message) {
        this.updateInputTableAutoInlineAddAvailability(session, false)
        return { status: 'invalid', message }
      }

      if (session.lastEmittedItem && isEqual(candidate.item, session.lastEmittedItem)) {
        this.finishInputTableAutoInlineSync(session)
        return { status: 'synced' }
      }

      if (
        !this.isInputTableAutoInlineSyncCurrent(session, effectiveRevision) ||
        deferIfInputActive()
      ) {
        return { status: 'stale' }
      }

      const nextItemsForEmit = session.isNew
        ? candidate.items
        : this.inputTableState.items

      if (session.isNew) {
        this.reUseRowId(nextItemsForEmit, this.inputTableState.items, indexes)
      }

      if (
        !this.isInputTableAutoInlineSyncCurrent(session, effectiveRevision) ||
        deferIfInputActive()
      ) {
        return { status: 'stale' }
      }

      if (options.immediateEmit) {
        this.emitInputTableValueImmediately(nextItemsForEmit)
      }

      const prevented = await this.emitValue(nextItemsForEmit)

      if (!prevented && deferIfInputActive()) {
        return { status: 'stale' }
      }

      if (!prevented) {
        session.lastEmittedItem = cloneDeep(candidate.item)
        this.finishInputTableAutoInlineSync(session, nextItemsForEmit, candidate.item)
      }

      return prevented
        ? {
            status: 'invalid',
            message: this.getInputTableValidationFailureMessage(),
          }
        : { status: 'synced' }
    }

    async validateInputTableCurrentItems() {
      const __ = this.inputTableProps.translate || ((key: string) => key)
      const candidateMessage = this.getInputTableCandidateItemsValidationMessage(
        this.inputTableState.items
      )
      const subForms = Object.values(
        (this.subForms || {}) as Record<string, InputTableRowRef>
      ).filter(Boolean)
      const subFormResults = subForms.length
        ? await Promise.all(
            subForms.map((item) => item.validate?.(undefined, false, false))
          )
        : []
      const subFormItems = Object.values(
        (this.subFormItems || {}) as Record<string, InputTableRowRef>
      ).filter(Boolean)
      const subFormItemResults = await Promise.all(
        subFormItems.map((item) => item.props?.onValidate?.())
      )

      if (candidateMessage) {
        return candidateMessage
      }

      return subFormResults.includes(false) || subFormItemResults.includes(false)
        ? __('Form.validateFailed')
        : ''
    }

    deferInputTableAutoInlineScheduledSyncIfNeeded(
      session: InputTableAutoInlineSession,
      startedAt: number,
      options: InputTableAutoInlineSyncOptions
    ) {
      if (
        !options.deferWhileInputActive ||
        this.getActiveInputTableAutoInlineEditSession() !== session
      ) {
        return false
      }

      if (
        session.lastInputAt <= startedAt &&
        Date.now() - session.lastInputAt >= INPUT_TABLE_ACTIVE_INPUT_GRACE_MS
      ) {
        return false
      }

      this.scheduleInputTableAutoInlineSync()
      return true
    }

    updateInputTableAutoInlineAddAvailability(
      session: InputTableAutoInlineSession,
      canAddAfterSync: boolean
    ) {
      if (session.canAddAfterSync === canAddAfterSync) {
        return
      }

      session.canAddAfterSync = canAddAfterSync
      this.forceUpdate()
    }

    completeInputTableAutoInlineNewRow(
      session: InputTableAutoInlineSession,
      items: any[],
      item?: Record<string, any>
    ) {
      if (!session.isNew || this.inputTableSession !== session) {
        return
      }

      this.disposeInputTableSession(session)
      this.setState({
        editIndex: '',
        isCreateMode: false,
        items,
        rowIndex: session.editIndex,
        ...this.transformState(items, this.inputTableState, item),
        columns: this.buildColumns(this.inputTableProps, false, ''),
        lastModifiedRow: undefined,
      })
    }

    finishInputTableAutoInlineSync(
      session: InputTableAutoInlineSession,
      items?: any[],
      item?: Record<string, any>
    ) {
      if (session.isNew) {
        this.completeInputTableAutoInlineNewRow(
          session,
          items || this.inputTableState.items,
          item
        )
        return
      }

      this.updateInputTableAutoInlineAddAvailability(session, true)
    }

    async flushInputTableAutoInlineEditRow(session: InputTableAutoInlineSession) {
      const subForms = getInputTableRowRefValues(this.subForms || {}, session.editIndex)
      const subFormItems = getInputTableRowRefValues(
        this.subFormItems || {},
        session.editIndex
      )

      session.flushDepth += 1

      try {
        await Promise.all([
          ...subForms.map((form) => form?.flush?.()),
          ...subFormItems.map((item) => item?.props?.onFlushChange?.()),
        ])
      } finally {
        session.flushDepth -= 1
      }

      await new Promise<void>((resolve) => {
        this.setState({}, resolve)
      })
    }

    async validateInputTableAutoInlineEditRow(editIndex: string) {
      const subForms = getInputTableRowRefValues(this.subForms || {}, editIndex)
      const subFormItems = getInputTableRowRefValues(this.subFormItems || {}, editIndex)

      if (!subForms.length && !subFormItems.length) {
        return false
      }

      const results = await Promise.all(
        subForms
          // 内部快捷编辑 form 只提供校验结果，失败提示统一交给外层 form。
          .map((form) => form?.validate?.(undefined, false, false))
          .concat(subFormItems.map((item) => item?.props?.onValidate?.()))
      )

      return !results.includes(false)
    }

    getInputTableCandidateItemsValidationMessage(
      items: any[],
      item?: Record<string, any>
    ) {
      return validateInputTableCandidateItems({
        items,
        item,
        columns: this.inputTableProps.columns,
        minLength: this.resolveVariableProps(this.inputTableProps, 'minLength'),
        maxLength: this.resolveVariableProps(this.inputTableProps, 'maxLength'),
        translate: this.inputTableProps.translate,
      })
    }

    getInputTableValidationFailureMessage() {
      return (
        this.inputTableProps.translate?.('Form.validateFailed') || 'Form.validateFailed'
      )
    }

    isInputTableAutoInlineSyncCurrent(
      session: InputTableAutoInlineSession,
      revision: number
    ) {
      return (
        this.getActiveInputTableAutoInlineEditSession() === session &&
        session.revision === revision
      )
    }

    getInputTableOverlayMode(action: InputTableOverlayAction) {
      return normalizeInputTableEditMode(
        action === 'add' ? this.inputTableProps.addMode : this.inputTableProps.editMode
      )
    }

    getInputTableActionEditBehavior(
      action: InputTableOverlayAction
    ): InputTableActionEditBehavior {
      return resolveInputTableActionEditBehavior({
        action,
        mode: this.getInputTableOverlayMode(action),
        addApi: this.inputTableProps.addApi,
        updateApi: this.inputTableProps.updateApi,
        needConfirm: this.inputTableProps.needConfirm,
      })
    }

    withInputTableTemporaryProps<T>(
      overrides: Partial<InputTableRuntimeProps>,
      callback: () => T
    ): T {
      const originalProps = this.props

      Object.assign(this, {
        props: {
          ...(this.props as any),
          ...overrides,
        },
      })

      try {
        return callback()
      } finally {
        Object.assign(this, {
          props: originalProps,
        })
      }
    }

    withInputTableForcedNeedConfirm<T>(callback: () => T): T {
      if (this.inputTableProps.needConfirm !== false) {
        return callback()
      }

      return this.withInputTableTemporaryProps({ needConfirm: true }, callback)
    }

    shouldUseInputTableNativeImmediateEditSurface() {
      return (
        this.getInputTableActionEditBehavior('edit') === 'native-immediate' &&
        (this.inputTableSession.kind === 'idle' ||
          this.inputTableSession.kind === 'native-immediate')
      )
    }

    async validate() {
      const session = this.getActiveInputTableAutoInlineEditSession()

      if (!session) {
        return this.shouldUseInputTableNativeImmediateEditSurface()
          ? this.validateInputTableCurrentItems()
          : super.validate()
      }

      const result = await this.syncInputTableAutoInlineEdit(undefined, {
        commit: 'validated',
        immediateEmit: true,
      })

      if (result.status === 'invalid') {
        return result.message
      }

      if (result.status === 'stale') {
        return this.getInputTableValidationFailureMessage()
      }

      return this.validateInputTableCurrentItems()
    }

    openInputTableOverlay(
      action: InputTableOverlayAction,
      editIndex = this.inputTableState.editIndex,
      data?: Record<string, unknown>
    ) {
      const mode = this.getInputTableOverlayMode(action)

      if (!editIndex || !isInputTableOverlayMode(mode)) {
        return
      }

      const indexes = editIndex.split('.').map((item) => parseInt(item, 10))
      const rowData = data ?? getTree(this.inputTableState.items, indexes)
      const overlay: InputTableOverlayState = {
        mode,
        action,
        editIndex,
        data: { ...(rowData || {}) },
      }
      const session = this.useInputTableSession<InputTableOverlaySession>({
        kind: 'overlay',
        action,
        editIndex,
        mode,
        descriptor: overlay,
      })

      this.setInputTableState(
        {
          columns: this.removeInlineQuickEditForOverlay(this.inputTableState.columns),
          inputTableOverlay: overlay,
        },
        () => this.openInputTableOverlayAction(session)
      )
    }

    closeInputTableOverlay() {
      if (this.inputTableSession.kind === 'overlay') {
        this.disposeInputTableSession(this.inputTableSession)
      }
      this.setInputTableState({ inputTableOverlay: undefined })
    }

    getInputTableOverlayAddIndex(index?: string) {
      const rawIndex = index || `${this.inputTableState.items.length - 1}`
      const indexes = rawIndex.split('.').map((item) => parseInt(item, 10))
      const next = indexes.concat()
      next[next.length - 1] += 1
      return next.join('.')
    }

    buildInputTableOverlayAddData() {
      const value: Record<string, unknown> = {}
      const { columns, scaffold } = this.inputTableProps

      if (Array.isArray(columns)) {
        columns.forEach((column) => {
          if (
            column &&
            typeof column.name === 'string' &&
            typeof column.value !== 'undefined'
          ) {
            value[column.name] = column.value
          }
        })
      }

      return {
        ...value,
        ...(scaffold || {}),
      }
    }

    buildInputTableOverlayFormItems(action: InputTableOverlayAction) {
      return resolveInputTableOverlayFormItems({
        action,
        columns: this.inputTableProps.columns,
        addFormItems: this.inputTableProps.addFormItems,
        editFormItems: this.inputTableProps.editFormItems,
        columnToQuickEdit: this.columnToQuickEdit.bind(this),
      })
    }

    getInputTableOverlayContainerProps(overlay: InputTableOverlayState) {
      const overlayProps =
        overlay.mode === 'dialog'
          ? overlay.action === 'add'
            ? this.inputTableProps.addDialogProps
            : this.inputTableProps.editDialogProps
          : overlay.action === 'add'
            ? this.inputTableProps.addDrawerProps
            : this.inputTableProps.editDrawerProps

      return overlayProps &&
        typeof overlayProps === 'object' &&
        !Array.isArray(overlayProps)
        ? overlayProps
        : {}
    }

    buildInputTableOverlaySchema(overlay: InputTableOverlayState) {
      const { translate: __ } = this.inputTableProps
      const containerProps = this.getInputTableOverlayContainerProps(overlay)
      const body = this.buildInputTableOverlayFormItems(overlay.action)

      return {
        ...containerProps,
        type: overlay.mode,
        title:
          containerProps.title ??
          (overlay.action === 'add' ? __('Table.add') : __('Table.editRow')),
        actions:
          containerProps.actions ?? buildInputTableOverlayActions(overlay.mode, __),
        body: {
          ...buildInputTableOverlayFormSchema(body, overlay.data),
          onSubmit: (values: any) => this.handleInputTableOverlaySubmit(values),
        },
        onConfirm: () => this.closeInputTableOverlay(),
        onClose: () => this.handleInputTableOverlayCancel(),
      }
    }

    openInputTableOverlayAction(session: InputTableOverlaySession) {
      if (
        this.inputTableSession !== session ||
        this.inputTableState.inputTableOverlay !== session.descriptor
      ) {
        return
      }

      const onAction = this.inputTableProps.onAction

      if (typeof onAction !== 'function') {
        this.closeInputTableOverlay()
        this.inputTableProps.env?.notify?.(
          'error',
          'Input table overlay requires onAction'
        )
        return
      }

      const schema = this.buildInputTableOverlaySchema(session.descriptor)

      void onAction(
        undefined,
        {
          actionType: session.mode,
          [session.mode]: schema,
        },
        session.descriptor.data
      )
    }

    removeInlineQuickEditForOverlay(columns: Array<any>) {
      return columns.map((column) => {
        if (!column || column.type === 'operation' || !column.quickEdit) {
          return column
        }

        const rest = { ...column }
        delete rest.quickEdit
        return rest
      })
    }

    async commitInputTableOverlayEdit(values: any) {
      const session = this.inputTableSession
      const overlay = this.inputTableState.inputTableOverlay

      if (
        session.kind !== 'overlay' ||
        overlay !== session.descriptor ||
        !overlay?.editIndex
      ) {
        return undefined
      }

      const indexes = overlay.editIndex.split('.').map((item) => parseInt(item, 10))
      const origin = getTree(this.inputTableState.items, indexes)
      const isNew =
        overlay.action === 'add' ||
        Object.prototype.hasOwnProperty.call(origin || {}, INPUT_TABLE_PLACEHOLDER)

      if (!isNew && !origin) {
        return false
      }

      const item = {
        ...(origin || overlay.data || {}),
        ...(values || {}),
      }
      const confirmEventName = isNew ? 'addConfirm' : 'editConfirm'
      const isPrevented = await this.dispatchEvent(confirmEventName, {
        index: indexes[indexes.length - 1],
        indexPath: indexes.join('.'),
        item,
      })

      if (isPrevented || this.inputTableSession !== session) {
        return false
      }

      const { addApi, updateApi, data, env, translate: __ } = this.inputTableProps
      const api = (isNew ? addApi : updateApi) as any
      let remote: any = null
      let apiMsg: any

      if (isNew && isEffectiveApi(addApi, createObject(data, item))) {
        remote = await env.fetcher(addApi, createObject(data, item))
        apiMsg = (addApi as any)?.messages?.failed
      } else if (!isNew && isEffectiveApi(updateApi, createObject(data, item))) {
        remote = await env.fetcher(updateApi, createObject(data, item))
        apiMsg = (updateApi as any)?.messages?.failed
      }

      if (this.inputTableSession !== session) {
        return false
      }

      if (remote && !remote.ok) {
        if (!api?.silent) {
          env.notify('error', apiMsg ?? remote.msg ?? __('saveFailed'))
        }

        void this.dispatchEvent(isNew ? 'addFail' : 'editFail', {
          index: indexes[indexes.length - 1],
          indexPath: indexes.join('.'),
          item,
          error: remote,
        })
        return false
      }

      const nextItem =
        remote && remote.ok
          ? {
              ...(api?.replaceData ? {} : item),
              ...remote.data,
            }
          : item
      Reflect.deleteProperty(nextItem, INPUT_TABLE_PLACEHOLDER)

      let nextItemsForEmit: any[] = []

      await new Promise<void>((resolve) => {
        this.setState((state: InputTableRuntimeState) => {
          if (this.inputTableSession !== session) {
            return null
          }

          const items = state.items.concat()
          const current = getTree(items, indexes)

          if (!isNew && !current) {
            return null
          }

          const nextItems = isNew
            ? spliceTree(items, indexes, 0, nextItem)
            : spliceTree(items, indexes, 1, nextItem)
          this.reUseRowId(nextItems, items, indexes)
          nextItemsForEmit = nextItems

          return {
            editIndex: '',
            items: nextItems,
            rowIndex: overlay.editIndex,
            columns: this.buildColumns(this.inputTableProps, false, ''),
            lastModifiedRow:
              overlay.action === 'edit' &&
              state.lastModifiedRow?.index !== overlay.editIndex
                ? {
                    index: overlay.editIndex,
                    data: { ...current },
                  }
                : state.lastModifiedRow,
            ...this.transformState(nextItems, undefined, nextItem),
          }
        }, resolve)
      })

      if (this.inputTableSession !== session || !nextItemsForEmit.length) {
        return false
      }

      const emitPrevented = await this.emitValue(nextItemsForEmit)

      if (!emitPrevented && this.inputTableSession === session) {
        void this.dispatchEvent(isNew ? 'addSuccess' : 'editSuccess', {
          index: indexes[indexes.length - 1],
          indexPath: indexes.join('.'),
          item: nextItem,
        })
      }

      return true
    }

    async handleInputTableOverlaySubmit(values: any) {
      const committed = await this.commitInputTableOverlayEdit(values)

      if (!committed) {
        throw new Error(this.inputTableProps.translate?.('saveFailed') || 'saveFailed')
      }

      return values
    }

    handleInputTableOverlayCancel() {
      if (this.inputTableState.editIndex) {
        this.cancelEdit()
      }
      this.closeInputTableOverlay()
    }

    getInputTableAddButtonPosition() {
      return normalizeInputTableAddButtonPosition(
        this.inputTableProps.addButtonPosition ??
          this.inputTableProps.$schema?.addButtonPosition
      )
    }

    getInputTableOperationRowPath(ctx: any) {
      const path =
        ctx?.rowIndexPath ??
        ctx?.indexPath ??
        ctx?.path ??
        (typeof ctx?.index === 'number' || typeof ctx?.index === 'string'
          ? String(ctx.index)
          : undefined)

      return typeof path === 'string' && path ? this.convertToRawPath(path) : ''
    }

    hasInputTableOperationPlaceholder(data: any) {
      return (
        !!data &&
        (Object.prototype.hasOwnProperty.call(data, INPUT_TABLE_PLACEHOLDER) ||
          INPUT_TABLE_PLACEHOLDER in Object(data))
      )
    }

    getInputTableOperationButtonState(
      rowIndexPath: string,
      data?: Record<string, any>
    ): InputTableOperationButtonState {
      if (rowIndexPath && this.inputTableState.editIndex === rowIndexPath) {
        return Object.prototype.hasOwnProperty.call(data || {}, INPUT_TABLE_PLACEHOLDER)
          ? 'adding'
          : 'editing'
      }

      return 'default'
    }

    buildInputTableOperationData(
      data: any,
      rowIndexPath: string,
      state: InputTableOperationButtonState,
      buttonProps: any
    ) {
      const canAdd = this.canRunInputTableOperationAction(
        'add',
        rowIndexPath,
        undefined,
        buttonProps
      )
      const canRemove = this.canRunInputTableOperationAction(
        'delete',
        rowIndexPath,
        undefined,
        buttonProps
      )

      return createOperationObject(data, {
        inputTableOperation: {
          [INPUT_TABLE_OPERATION_CONTEXT_MARKER]: true,
          state,
          rowIndexPath,
          rowIndex: rowIndexPath
            ? Number(rowIndexPath.split('.').slice(-1)[0])
            : undefined,
          isAdding: state === 'adding',
          isEditing: state === 'editing',
          isDefault: state === 'default',
          canAdd,
          canRemove,
        },
      })
    }

    getInputTableOperationButtonSchemas(
      state: InputTableOperationButtonState,
      rowIndexPath: string
    ) {
      if (
        state === 'default' &&
        rowIndexPath &&
        this.inputTableState.editIndex &&
        this.inputTableProps.needConfirm !== false
      ) {
        return []
      }

      return resolveInputTableOperationButtonSchemas({
        state,
        operationButtons:
          this.inputTableProps.operationButtons ??
          this.inputTableProps.$schema?.operationButtons,
        addingOperationButtons:
          this.inputTableProps.addingOperationButtons ??
          this.inputTableProps.$schema?.addingOperationButtons,
        editingOperationButtons:
          this.inputTableProps.editingOperationButtons ??
          this.inputTableProps.$schema?.editingOperationButtons,
      })
    }

    buildInputTableOperationAvailabilityOptions(
      actionType: unknown,
      rowIndexPath: string,
      ctx: any,
      buttonProps?: any
    ) {
      const operationContext = ctx?.inputTableOperation || {}
      const hasButtonCanAdd = typeof buttonProps?.inputTableCanAddItem !== 'undefined'
      const hasButtonCanRemove =
        typeof buttonProps?.inputTableCanRemoveItem !== 'undefined'

      return {
        actionType,
        rowIndexPath,
        editIndex: this.inputTableState.editIndex,
        needConfirm: this.inputTableProps.needConfirm,
        isStatic: this.inputTableProps.static,
        disabled: this.inputTableProps.disabled,
        addable: this.inputTableProps.addable,
        childrenAddable: this.inputTableProps.childrenAddable,
        copyable: this.inputTableProps.copyable,
        editable: this.inputTableProps.editable,
        removable: this.inputTableProps.removable,
        showTableAddBtn: this.inputTableProps.showTableAddBtn,
        showCopyBtn: this.inputTableProps.showCopyBtn,
        canAdd: hasButtonCanAdd
          ? buttonProps.inputTableCanAddItem !== false
          : operationContext.canAdd !== false,
        canRemove: hasButtonCanRemove
          ? buttonProps.inputTableCanRemoveItem !== false
          : operationContext.canRemove !== false,
        isPlaceholder: this.hasInputTableOperationPlaceholder(buttonProps?.data || ctx),
      }
    }

    canRunInputTableOperationAction(
      actionType: unknown,
      rowIndexPath: string,
      ctx?: any,
      buttonProps?: any
    ) {
      return canRunInputTableOperationActionWithOptions(
        this.buildInputTableOperationAvailabilityOptions(
          actionType,
          rowIndexPath,
          ctx,
          buttonProps
        )
      )
    }

    runInputTableOperationAction(action: any, ctx: any, buttonProps?: any) {
      const actionType = action?.actionType

      if (!isInputTableOperationActionType(actionType) || !buttonProps) {
        return { handled: false }
      }

      const rowIndexPath = this.getInputTableOperationRowPath(buttonProps)
      const operationCtx = this.buildInputTableOperationData(
        buttonProps?.data,
        rowIndexPath,
        this.getInputTableOperationButtonState(rowIndexPath, buttonProps?.data),
        buttonProps
      )

      if (
        !this.canRunInputTableOperationAction(
          actionType,
          rowIndexPath,
          operationCtx,
          buttonProps
        )
      ) {
        return { handled: true }
      }

      if (actionType === 'save' || actionType === 'confirm') {
        return { handled: true, result: this.confirmEdit() }
      }
      if (actionType === 'cancel') {
        return { handled: true, result: this.cancelEdit() }
      }
      if (actionType === 'add') {
        return { handled: true, result: this.addItem(rowIndexPath) }
      }
      if (actionType === 'edit') {
        return { handled: true, result: this.editItem(rowIndexPath) }
      }
      if (actionType === 'delete' || actionType === 'remove') {
        return { handled: true, result: this.removeItem(rowIndexPath) }
      }
      if (actionType === 'copy') {
        return { handled: true, result: this.copyItem(rowIndexPath) }
      }
      if (actionType === 'sub-add' || actionType === 'subAdd') {
        return {
          handled: true,
          result: this.subAddItem(rowIndexPath, true, buttonProps?.row),
        }
      }

      return { handled: false }
    }

    createInputTableOperationActionHandler(
      fallbackOnAction?: (...args: any[]) => any,
      buttonProps?: any
    ) {
      return (
        event: React.UIEvent<any> | undefined,
        action: any,
        ctx: any,
        ...rest: any[]
      ) => {
        const operation = this.runInputTableOperationAction(action, ctx, buttonProps)

        if (operation.handled) {
          event?.preventDefault?.()
          event?.stopPropagation?.()
          return operation.result
        }

        return typeof fallbackOnAction === 'function'
          ? fallbackOnAction(event, action, ctx, ...rest)
          : this.inputTableProps.onAction?.(event, action, ctx, ...rest)
      }
    }

    createInputTableOperationButtonActionHandler(buttonProps: any) {
      return this.createInputTableOperationActionHandler(
        buttonProps.onAction,
        buttonProps
      )
    }

    hasInputTableOperationButtonOverrides() {
      return hasConfiguredInputTableOperationButtonOverrides({
        operationButtons:
          this.inputTableProps.operationButtons ??
          this.inputTableProps.$schema?.operationButtons,
        addingOperationButtons:
          this.inputTableProps.addingOperationButtons ??
          this.inputTableProps.$schema?.addingOperationButtons,
        editingOperationButtons:
          this.inputTableProps.editingOperationButtons ??
          this.inputTableProps.$schema?.editingOperationButtons,
      })
    }

    renderInputTableOperationButtons(defaultButtons: any[], buttonProps: any) {
      const rowIndexPath = this.getInputTableOperationRowPath(buttonProps)
      const state = this.getInputTableOperationButtonState(rowIndexPath, buttonProps.data)
      const customButtons = this.getInputTableOperationButtonSchemas(state, rowIndexPath)
      const buttons = customButtons ?? defaultButtons

      if (!buttons.length) {
        return null
      }

      const data = this.buildInputTableOperationData(
        buttonProps.data,
        rowIndexPath,
        state,
        buttonProps
      )

      return (
        <>
          {buttons.map((button, index) => {
            if (this.shouldHideInputTableOperationButton(button)) {
              return null
            }

            if (typeof button?.children === 'function') {
              return button.children({
                ...buttonProps,
                key: `default-${index}`,
              })
            }

            const schema = normalizeInputTableOperationButtonSchema(button)

            return buttonProps.render(`operation-button-${state}-${index}`, schema, {
              key: `${state}-${index}`,
              data,
              onAction: this.createInputTableOperationButtonActionHandler(buttonProps),
              ...(this.inputTableProps.disabled ? { disabled: true } : {}),
              testIdBuilder: buttonProps.testIdBuilder?.getChild(
                button?.testid || button?.id || `${state}-${index}`
              ),
            })
          })}
        </>
      )
    }

    shouldHideInputTableOperationButton(button: any) {
      return (
        button?.actionType === 'edit' &&
        this.getInputTableActionEditBehavior('edit') === 'native-immediate'
      )
    }

    applyInputTableOperationButtonOverrides(columns: Array<any>) {
      if (!this.hasInputTableOperationButtonOverrides()) {
        return columns
      }

      let operationIndex = columns.findIndex((item) => item?.type === 'operation')
      const nextColumns = columns.concat()

      if (operationIndex === -1) {
        operationIndex = nextColumns.length
        nextColumns.push({
          type: 'operation',
          buttons: [],
          label: this.inputTableProps.translate?.('Table.operation'),
          className: 'v-middle nowrap',
          fixed: this.inputTableProps.mobileUI ? '' : 'right',
          width: 150,
          innerClassName: 'm-n',
        })
      }

      const operation = { ...nextColumns[operationIndex] }
      const defaultButtons = Array.isArray(operation.buttons)
        ? operation.buttons.concat()
        : []

      operation.buttons = [
        {
          children: (buttonProps: any) =>
            this.renderInputTableOperationButtons(defaultButtons, buttonProps),
        },
      ]

      if (Object.prototype.hasOwnProperty.call(operation, 'quickEdit')) {
        delete operation.quickEdit
      }

      nextColumns[operationIndex] = operation
      return nextColumns
    }

    handleTableSave(rows: any, diff: any, rowIndexes: any) {
      const session = this.getActiveInputTableAutoInlineEditSession()

      if (session && session.flushDepth === 0) {
        session.syncRequested = true
      }

      return super.handleTableSave(rows, diff, rowIndexes)
    }

    computedAddBtnDisabled() {
      if (this.inputTableProps.disabled) {
        return this.inputTableProps.disabled
      }

      if (this.getActiveInputTableAutoInlineEditSession()?.canAddAfterSync) {
        return false
      }

      return super.computedAddBtnDisabled()
    }

    addItem(
      index?: string,
      isDispatch?: boolean,
      callback?: () => void
    ): Promise<boolean> {
      const behavior = this.getInputTableActionEditBehavior('add')

      if (behavior === 'native-immediate') {
        return super.addItem(index, isDispatch, callback)
      }

      if (behavior === 'overlay') {
        this.openInputTableOverlay(
          'add',
          this.getInputTableOverlayAddIndex(index),
          this.buildInputTableOverlayAddData()
        )
        callback?.()
        return Promise.resolve(false)
      }

      if (behavior === 'auto-inline') {
        const addAutoInlineItem = () =>
          this.withInputTableForcedNeedConfirm(() =>
            super.addItem(index, isDispatch, () => {
              const session = this.beginInputTableAutoInlineEdit('add')
              // 新行先保留在 input-table 草稿态，等用户编辑或主动校验时再写回表单。
              // 此处发射空的必填行会让外部 form 把新增点击当成 submitOnChange 校验。
              this.presentInputTableAutoInlineEditRow(session)
              callback?.()
            })
          )
        const session = this.getActiveInputTableAutoInlineEditSession()

        if (!session) {
          return addAutoInlineItem()
        }

        return this.syncInputTableAutoInlineEdit(undefined, {
          commit: 'validated',
        }).then((result) => (result.status === 'synced' ? addAutoInlineItem() : false))
      }

      return this.withInputTableForcedNeedConfirm(() =>
        super.addItem(index, isDispatch, () => {
          if (this.inputTableState.editIndex) {
            this.presentInputTableConfirmInlineEditRow(
              'add',
              this.inputTableState.editIndex,
              true
            )
          }
          callback?.()
        })
      )
    }

    subAddItem(index?: string, isDispatch = true, item?: any): Promise<boolean> {
      return this.addItem(`${index}.-1`, isDispatch, () => {
        item?.setExpanded(true)
      })
    }

    async editItem(index: string) {
      const behavior = this.getInputTableActionEditBehavior('edit')

      if (behavior === 'native-immediate') {
        return
      }

      if (behavior === 'auto-inline') {
        return super.editItem(index).then((result) => {
          const session = this.beginInputTableAutoInlineEdit(
            'edit',
            this.inputTableState.editIndex
          )
          this.presentInputTableAutoInlineEditRow(session)
          this.scheduleInputTableAutoInlineSync()
          return result
        })
      }

      if (behavior !== 'overlay') {
        return super.editItem(index).then((result) => {
          this.presentInputTableConfirmInlineEditRow('edit', index, false)
          return result
        })
      }

      const indexes = index.split('.').map((item) => parseInt(item, 10))
      const item = getInputTableTreeItem(this.inputTableState.items, indexes)
      const isPrevented = await this.dispatchEvent('edit', {
        index: indexes[indexes.length - 1],
        indexPath: indexes.join('.'),
        item,
      })

      if (isPrevented) {
        return
      }

      this.startEdit(index, false)
      this.setState({}, () => {
        this.openInputTableOverlay('edit')
      })
    }

    buildColumns(
      props: InputTableRuntimeProps,
      isCreateMode = false,
      editRowIndex?: string
    ): Array<any> {
      const fixedOperationsColumn = this.inputTableProps.fixedOperationsColumn || false
      const action = this.getInputTableActionForEditColumns(isCreateMode, editRowIndex)
      const behavior = action
        ? this.getInputTableActionEditBehavior(action)
        : this.getInputTableActionEditBehavior('edit')
      const columnProps =
        behavior === 'native-immediate'
          ? { ...props, needConfirm: false }
          : props.needConfirm === false
            ? { ...props, needConfirm: true }
            : props
      const baseColumns = super.buildColumns(columnProps, isCreateMode, editRowIndex)
      const columns =
        behavior === 'auto-inline'
          ? this.removeInputTableAutoInlineConfirmButtons(baseColumns)
          : baseColumns
      const operationColumns = this.applyInputTableOperationButtonOverrides(columns)

      if (!fixedOperationsColumn) {
        const lastColumn = operationColumns[operationColumns.length - 1]
        if (lastColumn?.type === 'operation') {
          return [
            ...operationColumns.slice(0, -1),
            { ...operationColumns.slice(-1)[0], fixed: 'none' },
          ]
        }
      }

      return operationColumns
    }

    buildItemProps(item: any, index: number) {
      const shouldUseStaticDisplayRows = this.shouldUseInputTableStaticDisplayRows()

      if (
        !shouldUseStaticDisplayRows &&
        this.shouldUseInputTableNativeImmediateEditSurface()
      ) {
        return this.withInputTableTemporaryProps({ needConfirm: false }, () =>
          super.buildItemProps(item, index)
        )
      }

      const rowProps =
        shouldUseStaticDisplayRows && this.inputTableProps.needConfirm === false
          ? this.withInputTableTemporaryProps({ needConfirm: true }, () =>
              super.buildItemProps(item, index)
            )
          : super.buildItemProps(item, index)

      if (shouldUseStaticDisplayRows) {
        rowProps.static = !rowProps.quickEditEnabled
      }

      return rowProps
    }

    getInputTableActionForEditColumns(
      isCreateMode: boolean,
      editRowIndex?: string
    ): InputTableOverlayAction | undefined {
      const state = this.state as InputTableRuntimeState | undefined
      const index = typeof editRowIndex === 'undefined' ? state?.editIndex : editRowIndex

      if (!index) {
        return undefined
      }

      const indexes = index.split('.').map((item) => parseInt(item, 10))
      const item = Array.isArray(state?.items)
        ? getInputTableTreeItem(state.items, indexes)
        : undefined

      if (Object.prototype.hasOwnProperty.call(item || {}, INPUT_TABLE_PLACEHOLDER)) {
        return 'add'
      }

      if (item) {
        return 'edit'
      }

      return isCreateMode ? 'add' : 'edit'
    }

    shouldUseInputTableStaticDisplayRows() {
      const state = this.inputTableState
      const action = state.editIndex
        ? this.getInputTableActionForEditColumns(
            Boolean(state.isCreateMode),
            state.editIndex
          )
        : undefined
      const activeBehavior = action
        ? this.getInputTableActionEditBehavior(action)
        : undefined
      const isStaticBehavior = (behavior?: InputTableActionEditBehavior) =>
        behavior === 'inline-confirm' || behavior === 'overlay'

      return (
        isStaticBehavior(activeBehavior) ||
        isStaticBehavior(this.getInputTableActionEditBehavior('edit'))
      )
    }

    removeInputTableAutoInlineConfirmButtons(columns: Array<any>) {
      return columns.map((column) => {
        if (!column || column.type !== 'operation' || !Array.isArray(column.buttons)) {
          return column
        }

        return {
          ...column,
          buttons: column.buttons.map((button: any) => {
            if (!button || typeof button.children !== 'function') {
              return button
            }

            const renderButton = button.children

            return {
              ...button,
              children: (buttonProps: any) => {
                const node = renderButton(buttonProps)
                return React.isValidElement(node) &&
                  (node.props as any)?.onClick === this.confirmEdit
                  ? null
                  : node
              },
            }
          }),
        }
      })
    }

    cancelEdit() {
      const session = this.getActiveInputTableAutoInlineEditSession()

      if (!session) {
        this.disposeInputTableSession()
        return super.cancelEdit()
      }

      this.cancelInputTableAutoInlineSync(session)

      if (!session.isNew) {
        this.disposeInputTableSession(session)
        return super.cancelEdit()
      }

      const indexes = session.editIndex.split('.').map((item) => parseInt(item, 10))
      const originItems = this.inputTableState.items
      const items = spliceInputTableTree(originItems, indexes, 1)
      this.reUseRowId(items, originItems, indexes)
      this.disposeInputTableSession(session)

      this.setState(
        {
          editIndex: '',
          items,
          ...this.transformState(items),
          columns: this.buildColumns(this.inputTableProps, false, ''),
          lastModifiedRow: undefined,
        },
        this.emitValue
      )
    }

    columnToQuickEdit(column: any) {
      if ((column.type ?? '').startsWith('input-') || column.type === 'picker') {
        return {
          ...column,
          label: '',
        }
      }

      return super.columnToQuickEdit(column)
    }

    getInputTableLazyRenderAfter() {
      const configured =
        this.inputTableProps.lazyRenderAfter ??
        this.inputTableProps.$schema?.lazyRenderAfter
      const lazyRenderAfter =
        typeof configured === 'string' ? Number(configured) : configured

      return typeof lazyRenderAfter === 'number' && Number.isFinite(lazyRenderAfter)
        ? lazyRenderAfter
        : undefined
    }

    shouldDisableInputTableCooperativeMaterialization() {
      return Boolean(this.inputTableState.editIndex && this.inputTableState.isCreateMode)
    }

    getInputTableCooperativeMaterializationDisabled() {
      const disabled = this.shouldDisableInputTableCooperativeMaterialization()
      const shouldPropagate =
        disabled || this.inputTableCooperativeMaterializationDisabled

      this.inputTableCooperativeMaterializationDisabled = disabled

      return shouldPropagate ? disabled : undefined
    }

    getInputTableLoadingMaxDuration() {
      const configured =
        this.inputTableProps.loadingMaxDuration ??
        this.inputTableProps.$schema?.loadingMaxDuration
      const maxDuration = typeof configured === 'string' ? Number(configured) : configured

      return typeof maxDuration === 'number' && Number.isFinite(maxDuration)
        ? maxDuration
        : undefined
    }

    getInputTableSizingOptions() {
      const schema = this.inputTableProps.$schema || {}

      return {
        height: this.inputTableProps.height ?? schema.height,
        minHeight: this.inputTableProps.minHeight ?? schema.minHeight,
        maxHeight: this.inputTableProps.maxHeight ?? schema.maxHeight,
        overflow: this.inputTableProps.overflow ?? schema.overflow,
        overflowX: this.inputTableProps.overflowX ?? schema.overflowX,
        overflowY: this.inputTableProps.overflowY ?? schema.overflowY,
      }
    }

    shouldRenderInputTableTopAddButton(): boolean {
      const maxLength = this.resolveVariableProps(this.inputTableProps, 'maxLength')

      return !!(
        !this.inputTableProps.static &&
        this.inputTableProps.addable &&
        this.inputTableProps.showFooterAddBtn !== false &&
        (!maxLength || maxLength > this.inputTableState.items.length)
      )
    }

    handleInputTableTopAddToolbarAction = (
      event: React.MouseEvent<any> | undefined,
      action: any,
      data: any,
      renderProps: any,
      ...rest: any[]
    ) => {
      if (action?.actionType === INPUT_TABLE_TOP_ADD_ACTION_TYPE) {
        return this.addItem()
      }

      return renderProps?.onAction?.(event, action, data, ...rest)
    }

    renderInputTable() {
      const lazyRenderAfter = this.getInputTableLazyRenderAfter()
      const loadingMaxDuration = this.getInputTableLoadingMaxDuration()
      const inputTableSizing = this.getInputTableSizingOptions()
      const cooperativeMaterializationDisabled =
        this.getInputTableCooperativeMaterializationDisabled()
      const addButtonPosition = this.getInputTableAddButtonPosition()
      const shouldRenderTopAddButton =
        isInputTableAddButtonTopPosition(addButtonPosition) &&
        this.shouldRenderInputTableTopAddButton()
      const topAddActionSchema = shouldRenderTopAddButton
        ? buildInputTableTopAddActionSchema({
            position: addButtonPosition,
            translate: this.inputTableProps.translate,
            footerAddBtn: (this.inputTableProps as any).footerAddBtn,
            disabled: this.computedAddBtnDisabled(),
          })
        : undefined
      const props = this.props as any
      const originalRender = props.render

      if (typeof originalRender !== 'function') {
        return super.render()
      }

      const originalProps = this.props
      const patchedRender = (...args: any[]) => {
        const [region, schema, renderProps] = args

        if (region === 'body' && schema?.type === 'table') {
          const tablePatchOptions = {
            addButtonPosition,
            classnames: props.classnames,
            columnsTogglable: this.inputTableProps.columnsTogglable === true,
            cooperativeMaterializationDisabled,
            lazyRenderAfter,
            loadingMaxDuration,
            renderProps,
            schema,
            shouldRenderTopAddButton,
            inputTableSizing,
            topAddActionSchema,
            onAction: (
              event: React.MouseEvent<any> | undefined,
              action: any,
              data: any,
              ...rest: any[]
            ) =>
              this.handleInputTableTopAddToolbarAction(
                event,
                action,
                data,
                renderProps,
                ...rest
              ),
          }
          const tableSchema = buildInputTablePatchedTableSchema(tablePatchOptions)
          const tableRenderProps = buildInputTablePatchedRenderProps(tablePatchOptions)

          return originalRender(region, tableSchema, tableRenderProps)
        }

        return originalRender(...args)
      }

      Object.assign(this, {
        props: {
          ...props,
          ...(shouldRenderTopAddButton ? { showFooterAddBtn: false } : {}),
          render: patchedRender,
        },
      })

      try {
        const table = super.render()

        if (table == null) {
          return table
        }

        return renderInputTableWithPositionedAddButton(table, addButtonPosition)
      } finally {
        Object.assign(this, {
          props: originalProps,
        })
      }
    }

    render(): any {
      return this.renderInputTable() ?? null
    }
  }
}
