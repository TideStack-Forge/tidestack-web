import { FormRendererBase } from 'amis-core/lib/renderers/Form'
import {
  Renderer,
  FormStore,
  ScopedContext,
  isObjectShallowModified,
} from 'amis-core'
import { comparer, reaction, type IReactionDisposer } from 'mobx'
import { normalizeFormSmartLayout } from './formSmartLayout'

const DEFAULT_EXTERNAL_ERROR_SOURCE = 'external'
const EXTERNAL_ERROR_TAG_PREFIX = 'ouroboros:external:'

type ExternalFieldErrorMap = Record<string, string[]>

type ExternalErrorEntry = {
  msg: string
  tag: string
}

function normalizeExternalErrorSource(source?: string) {
  if (typeof source !== 'string') {
    return DEFAULT_EXTERNAL_ERROR_SOURCE
  }

  const normalizedSource = source.trim()
  return normalizedSource || DEFAULT_EXTERNAL_ERROR_SOURCE
}

function buildExternalErrorTag(source: string) {
  return `${EXTERNAL_ERROR_TAG_PREFIX}${normalizeExternalErrorSource(source)}`
}

function isExternalErrorTag(tag: unknown) {
  return typeof tag === 'string' && tag.startsWith(EXTERNAL_ERROR_TAG_PREFIX)
}

function isManagedExternalErrorTag(tag: unknown) {
  return isExternalErrorTag(tag) || shouldTreatErrorTagAsExternalSource(tag)
}

function normalizeExternalFieldErrors(errors: Record<string, unknown> = {}) {
  if (!errors || typeof errors !== 'object') {
    return {}
  }

  return Object.entries(errors).reduce<ExternalFieldErrorMap>((acc, [fieldPath, rawMessages]) => {
    if (typeof fieldPath !== 'string' || !fieldPath.trim()) {
      return acc
    }

    const messages = (Array.isArray(rawMessages) ? rawMessages : [rawMessages])
      .map((message) => (typeof message === 'string' ? message.trim() : ''))
      .filter(Boolean)

    if (!messages.length) {
      return acc
    }

    acc[fieldPath.trim()] = messages
    return acc
  }, {})
}

function resolveFormItemsForFieldPath(formStore: any, fieldPath: string) {
  if (!formStore || typeof fieldPath !== 'string' || !fieldPath.trim()) {
    return []
  }

  const itemById =
    typeof formStore.getItemById === 'function' ? formStore.getItemById(fieldPath) : null
  if (itemById) {
    return [itemById]
  }

  const itemByName =
    typeof formStore.getItemByName === 'function' ? formStore.getItemByName(fieldPath) : null
  if (itemByName) {
    return [itemByName]
  }

  const itemsByName =
    typeof formStore.getItemsByName === 'function' ? formStore.getItemsByName(fieldPath) : []
  const normalizedItemsByName = normalizeCollectionEntries(itemsByName)
  if (normalizedItemsByName.length) {
    return Array.from(new Set(normalizedItemsByName))
  }

  const itemsByPath =
    typeof formStore.getItemsByPath === 'function' ? formStore.getItemsByPath(fieldPath) : []
  return Array.from(new Set(normalizeCollectionEntries(itemsByPath)))
}

function normalizeCollectionEntries(collection: any = []) {
  if (!collection) {
    return []
  }

  if (Array.isArray(collection)) {
    return collection
  }

  if (typeof collection.slice === 'function') {
    return collection.slice()
  }

  if (typeof collection[Symbol.iterator] === 'function') {
    return Array.from(collection)
  }

  return []
}

function getFormStoreItems(formStore: any) {
  return normalizeCollectionEntries(formStore?.items)
}

function snapshotErrorEntries(errorData: Array<any> = []) {
  return normalizeCollectionEntries(errorData).map((entry) => ({
    msg: typeof entry?.msg === 'string' ? entry.msg : '',
    tag: typeof entry?.tag === 'string' ? entry.tag : '',
    rule: typeof entry?.rule === 'string' ? entry.rule : undefined,
  }))
}

function areErrorEntriesEqual(left: Array<any> = [], right: Array<any> = []) {
  if (left.length !== right.length) {
    return false
  }

  for (let index = 0; index < left.length; index += 1) {
    const leftEntry = left[index]
    const rightEntry = right[index]

    if (
      leftEntry?.msg !== rightEntry?.msg ||
      leftEntry?.tag !== rightEntry?.tag ||
      leftEntry?.rule !== rightEntry?.rule
    ) {
      return false
    }
  }

  return true
}

function dedupeExternalErrorEntries(entries: ExternalErrorEntry[]) {
  const seen = new Set<string>()
  return entries.filter((entry) => {
    const key = `${entry.tag}\u0000${entry.msg}`
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

function shouldTreatErrorTagAsExternalSource(tag: unknown) {
  return typeof tag === 'string' && (tag === 'logicflow-validation' || tag.startsWith('external:'))
}

function getDeclaredExternalFieldErrors(props: any) {
  return normalizeExternalFieldErrors(props?.externalFieldErrors)
}

function getDeclaredExternalErrorSource(props: any) {
  return normalizeExternalErrorSource(props?.externalErrorSource)
}

// 6.10.0 版本的 amis-core 没有导出 FormRendererBase 组件，因此从 FormRenderer 中提取出 FormRendererBase 组件
// 但是这种方式似乎有问题
// const FormRendererBase = (FormRenderer as any).ComposedComponent as typeof FormRenderer

const FORM_RENDER_CONTEXT_METHODS = [
  'renderFormItems',
  'renderChildren',
  'renderChild',
  'handleAction',
  'handleQuery',
  'handleChange',
  'handleBulkChange',
  'addHook',
  'removeHook',
  'dispatchEvent',
  'flush',
  'handleFormSubmit',
  'handleDialogConfirm',
  'handleDialogClose',
  'handleDrawerConfirm',
  'handleDrawerClose',
  'validate',
  'submit',
  'reload',
  'silentReload',
  'initInterval',
  'dispatchInited',
  'blockRouting',
  'beforePageUnload',
] as const

const NORMALIZED_RENDER_CONTEXT_KEY = '__ouroborosNormalizedRenderContext'

type NormalizedRenderContext<T extends FormRendererBase> = T & {
  props: T['props']
  [key: string]: any
}

function createNormalizedRenderContext<T extends FormRendererBase>(instance: T) {
  const renderContext = Object.create(instance) as NormalizedRenderContext<T>

  const prototype = Object.getPrototypeOf(instance)
  FORM_RENDER_CONTEXT_METHODS.forEach((methodName) => {
    const method = prototype?.[methodName]

    if (typeof method === 'function') {
      renderContext[methodName] = method.bind(renderContext)
    }
  })

  return renderContext
}

function getNormalizedRenderContext<T extends FormRendererBase>(
  instance: T,
  props: T['props']
) {
  const instanceWithCache = instance as T & {
    [NORMALIZED_RENDER_CONTEXT_KEY]?: NormalizedRenderContext<T>
  }
  let renderContext = instanceWithCache[NORMALIZED_RENDER_CONTEXT_KEY]

  if (!renderContext) {
    renderContext = createNormalizedRenderContext(instance)
    Object.defineProperty(instanceWithCache, NORMALIZED_RENDER_CONTEXT_KEY, {
      value: renderContext,
      configurable: true,
    })
  }

  renderContext.props = props
  return renderContext
}

@Renderer({
  type: 'form',
  name: 'OuroborosForm',
  storeType: FormStore.name,
  isolateScope: true,
  weight: -200,
  override: true,
  storeExtendsData: (props: any) => props.inheritData,
  shouldSyncSuperStore: (store, props, prevProps) => {
    // 如果是 QuickEdit，让 store 同步 __super 数据。
    if (
      props.quickEditFormRef &&
      props.onQuickChange &&
      (isObjectShallowModified(prevProps.data, props.data) ||
        isObjectShallowModified(prevProps.data.__super, props.data.__super) ||
        isObjectShallowModified(
          prevProps.data.__super?.__super,
          props.data.__super?.__super
        ))
    ) {
      return true
    }

    return undefined
  },
})
export default class OuroborosForm extends FormRendererBase {
  static contextType = ScopedContext

  private externalFieldErrorsBySource = new Map<string, ExternalFieldErrorMap>()

  private externalErrorItemsDisposer: IReactionDisposer | null = null

  private externalErrorItemDisposers: IReactionDisposer[] = []

  private synchronizingExternalErrors = false

  private externalErrorStoreApiBinding: {
    store: any
    setExternalErrors: (...args: any[]) => void
    clearExternalErrors: (...args: any[]) => void
    previousSetExternalErrors: unknown
    previousClearExternalErrors: unknown
  } | null = null

  static defaultProps = {
    ...FormRendererBase.defaultProps,
    horizontal: {
      leftFixed: true,
    } as any,
  }

  componentDidMount(): void {
    super.componentDidMount?.()
    this.syncDeclaredExternalErrors()
    this.attachExternalErrorStoreApi()
    this.ensureExternalErrorSynchronization()
    this.syncExternalErrors()
  }

  componentDidUpdate(prevProps: Readonly<any>): void {
    super.componentDidUpdate?.(prevProps)

    if (prevProps.store !== this.props.store) {
      this.detachExternalErrorStoreApi()
      this.disposeExternalErrorSynchronization()
    }

    this.syncDeclaredExternalErrors()
    this.attachExternalErrorStoreApi()
    this.ensureExternalErrorSynchronization()
    this.syncExternalErrors()
  }

  componentWillUnmount(): void {
    this.detachExternalErrorStoreApi()
    this.disposeExternalErrorSynchronization()
    super.componentWillUnmount?.()
  }

  setExternalErrors(errors: Record<string, unknown> = {}, source = DEFAULT_EXTERNAL_ERROR_SOURCE) {
    const normalizedSource = normalizeExternalErrorSource(source)
    const normalizedErrors = normalizeExternalFieldErrors(errors)

    if (Object.keys(normalizedErrors).length) {
      this.externalFieldErrorsBySource.set(normalizedSource, normalizedErrors)
    } else {
      this.externalFieldErrorsBySource.delete(normalizedSource)
    }

    this.ensureExternalErrorSynchronization()
    this.syncExternalErrors()
  }

  clearExternalErrors(source?: string) {
    if (typeof source === 'string') {
      this.externalFieldErrorsBySource.delete(normalizeExternalErrorSource(source))
    } else {
      this.externalFieldErrorsBySource.clear()
    }

    this.syncExternalErrors()
  }

  private resolveSystemConfig() {
    const props = this.props as any

    return (
      props.SystemConfig ?? props.data?.SystemConfig ?? props.env?.rootData?.SystemConfig
    )
  }

  setErrors(errors: Record<string, unknown>, tag = 'remote') {
    if (shouldTreatErrorTagAsExternalSource(tag)) {
      this.setExternalErrors(errors, tag)
      return
    }

    super.setErrors?.(errors, tag)
  }

  private syncDeclaredExternalErrors() {
    const source = getDeclaredExternalErrorSource(this.props)
    const errors = getDeclaredExternalFieldErrors(this.props)

    if (Object.keys(errors).length) {
      this.externalFieldErrorsBySource.set(source, errors)
    } else {
      this.externalFieldErrorsBySource.delete(source)
    }
  }

  syncExternalErrors() {
    const formStore = (this.props as any)?.store
    const formItems = getFormStoreItems(formStore)

    if (this.synchronizingExternalErrors || !formItems.length) {
      return
    }

    const desiredEntriesByItem = new Map<any, ExternalErrorEntry[]>()
    formItems.forEach((item: any) => {
      desiredEntriesByItem.set(item, [])
    })

    this.externalFieldErrorsBySource.forEach((fieldErrors, source) => {
      const tag = buildExternalErrorTag(source)
      Object.entries(fieldErrors).forEach(([fieldPath, messages]) => {
        resolveFormItemsForFieldPath(formStore, fieldPath).forEach((item: any) => {
          const desiredEntries = desiredEntriesByItem.get(item)
          if (!desiredEntries) {
            return
          }

          messages.forEach((message) => {
            desiredEntries.push({
              msg: message,
              tag,
            })
          })
        })
      })
    })

    this.synchronizingExternalErrors = true
    try {
      desiredEntriesByItem.forEach((entries, item) => {
        this.reconcileItemExternalErrors(item, dedupeExternalErrorEntries(entries))
      })
    } finally {
      this.synchronizingExternalErrors = false
    }
  }

  renderBody() {
    const props = this.props
    const normalizedProps = normalizeFormSmartLayout(
      props as any,
      this.resolveSystemConfig()
    )

    if (normalizedProps === props) {
      return super.renderBody()
    }

    const renderContext = getNormalizedRenderContext(
      this,
      normalizedProps as typeof this.props
    )
    return FormRendererBase.prototype.renderBody.call(renderContext)
  }

  private ensureExternalErrorSynchronization() {
    if (this.externalErrorItemsDisposer) {
      return
    }

    this.externalErrorItemsDisposer = reaction(
      () => {
        const formItems = getFormStoreItems((this.props as any)?.store)
        return formItems.map((item: any) => item)
      },
      () => {
        this.refreshExternalErrorItemDisposers()
        this.syncExternalErrors()
      },
      {
        equals: comparer.shallow,
      }
    )

    this.refreshExternalErrorItemDisposers()
  }

  private attachExternalErrorStoreApi() {
    const formStore = (this.props as any)?.store
    if (!formStore) {
      this.detachExternalErrorStoreApi()
      return
    }

    if (this.externalErrorStoreApiBinding?.store === formStore) {
      return
    }

    this.detachExternalErrorStoreApi()

    const setExternalErrors = this.setExternalErrors.bind(this)
    const clearExternalErrors = this.clearExternalErrors.bind(this)

    this.externalErrorStoreApiBinding = {
      store: formStore,
      setExternalErrors,
      clearExternalErrors,
      previousSetExternalErrors: formStore.setExternalErrors,
      previousClearExternalErrors: formStore.clearExternalErrors,
    }

    formStore.setExternalErrors = setExternalErrors
    formStore.clearExternalErrors = clearExternalErrors
  }

  private detachExternalErrorStoreApi() {
    const binding = this.externalErrorStoreApiBinding
    if (!binding) {
      return
    }

    const formStore = binding.store
    if (formStore?.setExternalErrors === binding.setExternalErrors) {
      if (typeof binding.previousSetExternalErrors === 'undefined') {
        delete formStore.setExternalErrors
      } else {
        formStore.setExternalErrors = binding.previousSetExternalErrors
      }
    }
    if (formStore?.clearExternalErrors === binding.clearExternalErrors) {
      if (typeof binding.previousClearExternalErrors === 'undefined') {
        delete formStore.clearExternalErrors
      } else {
        formStore.clearExternalErrors = binding.previousClearExternalErrors
      }
    }

    this.externalErrorStoreApiBinding = null
  }

  private disposeExternalErrorSynchronization() {
    this.externalErrorItemsDisposer?.()
    this.externalErrorItemsDisposer = null

    this.externalErrorItemDisposers.forEach((dispose) => dispose())
    this.externalErrorItemDisposers = []
  }

  private refreshExternalErrorItemDisposers() {
    this.externalErrorItemDisposers.forEach((dispose) => dispose())
    this.externalErrorItemDisposers = []

    const formStore = (this.props as any)?.store
    const formItems = getFormStoreItems(formStore)

    formItems.forEach((item: any) => {
      const disposer = reaction(
        () => ({
          loading: item?.loading === true,
          validatedAt: item?.validatedAt ?? 0,
          errors: snapshotErrorEntries(item?.errorData),
        }),
        () => {
          this.syncExternalErrors()
        },
        {
          equals: (left, right) =>
            left.loading === right.loading &&
            left.validatedAt === right.validatedAt &&
            areErrorEntriesEqual(left.errors, right.errors),
        }
      )

      this.externalErrorItemDisposers.push(disposer)
    })
  }

  private reconcileItemExternalErrors(item: any, desiredExternalEntries: ExternalErrorEntry[]) {
    if (
      !item?.errorData ||
      typeof item.clearError !== 'function' ||
      typeof item.addError !== 'function'
    ) {
      return
    }

    const currentEntries = snapshotErrorEntries(item.errorData)
    const currentExternalEntries = currentEntries
      .filter((entry) => isManagedExternalErrorTag(entry.tag))
      .map((entry) => ({
        msg: entry.msg,
        tag: entry.tag,
      }))

    if (areErrorEntriesEqual(currentExternalEntries, desiredExternalEntries)) {
      return
    }

    const currentExternalTags = Array.from(
      new Set(currentExternalEntries.map((entry) => entry.tag).filter(Boolean))
    )
    currentExternalTags.forEach((tag) => {
      item.clearError(tag)
    })

    const desiredMessagesByTag = desiredExternalEntries.reduce<Record<string, string[]>>(
      (acc, entry) => {
        if (!acc[entry.tag]) {
          acc[entry.tag] = []
        }
        acc[entry.tag].push(entry.msg)
        return acc
      },
      {}
    )

    Object.entries(desiredMessagesByTag).forEach(([tag, messages]) => {
      item.addError(messages, tag)
    })
  }
}
