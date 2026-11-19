import isEqual from 'lodash/isEqual'

export type Model = Record<string, any>
export type Request = (
  method: 'get' | 'post' | 'put',
  url: string,
  data?: any,
  timeout?: number
) => Promise<any>
export type TestInput = {
  name: string
  type: string
  value: string
  override?: boolean
  sensitive?: boolean
  provided?: boolean
  references?: string[]
  required?: boolean
}

const MODEL_FIELDS = [
  'name',
  'title',
  'type',
  'group',
  'description',
  'authCredential',
  'isEnabled',
  'request',
  'retry',
  'timeout',
]
const UI_FIELDS = new Set([
  'appName',
  'add',
  'fullName',
  '__rpcEditor',
  'params',
  'query',
  'queryParams',
  'pathVariables',
  'SystemConfig',
  'SystemContext',
])

export function persistableModel(draft: Model, original: Model = {}): Model {
  const model = Object.fromEntries(
    Object.entries(original).filter(([key]) => !UI_FIELDS.has(key))
  )
  for (const field of MODEL_FIELDS) {
    if (draft[field] !== undefined) model[field] = draft[field]
  }
  for (const field of ['group', 'description', 'authCredential']) model[field] ??= null
  model.retry ??= 3
  model.timeout ??= 10000
  model.isEnabled ??= false
  model.request ??= null
  return JSON.parse(JSON.stringify(model))
}

export function canonical(value: any): string {
  const sort = (item: any): any =>
    Array.isArray(item)
      ? item.map(sort)
      : item && typeof item === 'object'
        ? Object.fromEntries(
            Object.keys(item)
              .sort()
              .map((key) => [key, sort(item[key])])
          )
        : item
  return JSON.stringify(sort(value))
}

export async function modelHash(value: Model): Promise<string> {
  const bytes = new TextEncoder().encode(canonical(value))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('')
}

export function testValues(inputs: TestInput[], configuration = false): Model {
  const values: Model = {}
  for (const input of inputs) {
    if (configuration ? !input.override : input.provided === false) continue
    if (Object.hasOwn(values, input.name)) throw new Error(`输入项重复：${input.name}`)
    if (configuration || input.type === 'string') values[input.name] = input.value
    else if (input.type === 'null') values[input.name] = null
    else if (input.type === 'boolean') {
      if (!['true', 'false'].includes(input.value))
        throw new Error(`${input.name} 请输入 true 或 false`)
      values[input.name] = input.value === 'true'
    } else if (input.type === 'number') {
      if (!input.value.trim() || !Number.isFinite(Number(input.value)))
        throw new Error(`${input.name} 请输入有效数字`)
      values[input.name] = Number(input.value)
    } else {
      const parsed = JSON.parse(input.value)
      if (
        input.type === 'array'
          ? !Array.isArray(parsed)
          : parsed === null || Array.isArray(parsed) || typeof parsed !== 'object'
      )
        throw new Error(`${input.name} 的 JSON 类型不匹配`)
      values[input.name] = parsed
    }
  }
  return values
}

/** Owns one drawer's saved baseline, request ordering and lock lifecycle. */
export class RpcModelEditorState {
  draft: Model = {}
  original: Model = {}
  baseline: Model | null = null
  identity: string | null = null
  tab = 'config'
  testTab = 'parameters'
  phase = ''
  initializing = false
  init: any = null
  initHash = ''
  result: any = null
  resultStale = false
  variables: TestInput[] = []
  configs: TestInput[] = []
  error = ''
  commitMessage = ''
  pendingCommit = false
  commitConfirmed = false
  ownedLock = false
  canEdit = true
  disposed = false
  private generation = 0
  private initGeneration = 0
  private configSignature = canonical({})
  private configTimer?: ReturnType<typeof setTimeout>
  private releasing?: Promise<void>

  constructor(
    readonly appName: string,
    readonly request: Request,
    readonly changed: () => void
  ) {}

  get dirty() {
    return this.baseline === null || !isEqual(this.model(), this.baseline)
  }
  get busy() {
    return Boolean(this.phase)
  }
  get canTest() {
    return Boolean(
      this.identity &&
      !this.disposed &&
      !this.dirty &&
      !this.busy &&
      !this.initializing &&
      this.init?.testable &&
      this.init.ready &&
      this.init.modelHash === this.initHash
    )
  }
  get testDisabledReason() {
    if (!this.identity) return '请先保存模型'
    if (this.dirty) return '模型已修改，请先保存'
    if (this.initializing) return '正在准备测试参数'
    if (this.busy) return '当前操作尚未完成'
    if (this.init?.disabledReason) return this.init.disabledReason
    return this.canTest ? '' : '测试快照未就绪，请重新加载测试参数'
  }

  private base() {
    return `/api/dev/${encodeURIComponent(this.appName)}/rpc-model`
  }
  url() {
    return `${this.base()}/${encodeURIComponent(this.identity || '')}`
  }
  model() {
    return persistableModel(this.draft, this.original)
  }
  notify() {
    if (!this.disposed) this.changed()
  }

  change(draft: Model) {
    if (this.disposed) return
    this.draft = draft
    if (this.result && this.dirty) this.resultStale = true
    this.notify()
  }

  async load(name?: string) {
    const generation = ++this.generation
    this.initGeneration++
    this.init = null
    this.initializing = false
    this.phase = 'loading'
    this.error = ''
    this.notify()
    try {
      if (!name) {
        this.draft = {
          type: 'OpenApi',
          isEnabled: true,
          retry: 3,
          timeout: 10000,
          request: { method: 'POST', parameters: [] },
        }
        return
      }
      this.identity = name
      const saved = await this.request('get', this.url())
      if (generation !== this.generation || this.disposed) return
      this.original = saved
      this.draft = persistableModel(saved, saved)
      this.baseline = this.model()
      try {
        await this.acquireLock()
      } catch (error) {
        this.fail(error)
      }
      if (generation !== this.generation || this.disposed) return
      await this.status()
      if (generation !== this.generation || this.disposed) return
      await this.initialize()
    } catch (error) {
      this.fail(error)
    } finally {
      if (generation === this.generation) {
        this.phase = ''
        this.notify()
      }
    }
  }

  async acquireLock() {
    const url = this.url()
    const generation = this.generation
    const status = await this.request('get', `${url}/status`)
    if (this.disposed || generation !== this.generation) return
    if (status.lockState === 'OWNED') {
      this.canEdit = true
      return
    }
    try {
      await this.request('post', `${url}/lock`, {})
      if (this.disposed || generation !== this.generation) {
        await this.request('post', `${url}/release-lock`, {})
        return
      }
      this.ownedLock = true
      this.canEdit = true
    } catch (error) {
      this.canEdit = false
      throw error
    }
  }

  async status() {
    if (!this.identity) return
    const generation = this.generation
    const status = await this.request('get', `${this.url()}/status`)
    if (this.disposed || generation !== this.generation) return
    this.pendingCommit = ['CHANGED', 'UNVERSIONED'].includes(status.versionState)
    this.notify()
    return status
  }

  async initialize() {
    if (!this.identity) return
    clearTimeout(this.configTimer)
    const generation = ++this.initGeneration
    const saved = this.baseline
    this.initializing = true
    this.init = null
    this.error = ''
    this.notify()
    try {
      const init = await this.request('post', `${this.url()}/test/init-form`, {
        configValues: testValues(this.configs, true),
      })
      const hash = await modelHash(saved!)
      if (generation !== this.initGeneration || this.disposed) return
      if (hash !== init.modelHash)
        throw new Error('模型已被其他操作修改，请保留草稿并重新加载模型。')
      this.init = init
      if (this.result && this.result.revision !== init.revision) this.resultStale = true
      this.initHash = hash
      const reconcile = (definitions: any[], current: TestInput[], config = false) =>
        definitions.map((item) => {
          const old = current.find((input) => input.name === item.name)
          return old &&
            (config ||
              item.suggestedType !== 'object' ||
              ['object', 'array'].includes(old.type))
            ? {
                ...old,
                sensitive: item.sensitive,
                required: item.required,
                references: item.references,
                provided: item.required || old.provided,
              }
            : {
                name: item.name,
                type: config
                  ? 'string'
                  : item.suggestedType === 'json'
                    ? 'object'
                    : item.suggestedType || 'string',
                value: '',
                override: !item.hasDefault,
                sensitive: item.sensitive,
                provided: item.required || false,
                required: item.required,
                references: item.references,
              }
        })
      this.variables = reconcile(init.variables, this.variables)
      this.configs = reconcile(init.configItems, this.configs, true)
      this.configSignature = canonical(testValues(this.configs, true))
    } catch (error) {
      if (generation === this.initGeneration && !this.disposed) this.fail(error)
    } finally {
      if (generation === this.initGeneration && !this.disposed) {
        this.initializing = false
        this.notify()
      }
    }
  }

  async save() {
    if (this.busy || !this.canEdit) return false
    const isNew = !this.identity
    const generation = this.generation
    this.phase = 'saving'
    this.error = ''
    this.notify()
    try {
      if (this.identity) await this.acquireLock()
      if (this.disposed || generation !== this.generation) return false
      const saved = await this.request(
        this.identity ? 'put' : 'post',
        this.identity ? this.url() : this.base(),
        this.model()
      )
      this.identity = saved.name
      this.ownedLock = this.ownedLock || isNew
      if (this.disposed || generation !== this.generation) {
        await this.releaseLock()
        return false
      }
      this.original = saved
      this.draft = persistableModel(saved, saved)
      this.baseline = this.model()
      // Creation obtains a normal resource lock in the save service.
      this.pendingCommit = true
      this.commitConfirmed = false
      this.resultStale = Boolean(this.result)
      this.init = null
      await this.status()
      await this.initialize()
      return true
    } catch (error) {
      if (this.disposed || generation !== this.generation) return false
      this.fail(error)
      const name = this.identity || this.model().name
      if (name) {
        try {
          const actual = await this.request(
            'get',
            `${this.base()}/${encodeURIComponent(name)}`
          )
          if (!this.disposed && isEqual(persistableModel(actual, actual), this.model())) {
            this.identity = name
            this.ownedLock = this.ownedLock || isNew
            this.original = actual
            this.baseline = this.model()
            this.commitConfirmed = false
            await this.status()
            await this.initialize()
            this.error += '；已核对工作区内容，数据已保存，请确认后继续。'
          }
        } catch (verificationError) {
          this.error += `；工作区状态核对失败：${verificationError instanceof Error ? verificationError.message : String(verificationError)}`
        }
      }
      return false
    } finally {
      this.phase = ''
      this.notify()
    }
  }

  async commit() {
    const message = this.commitMessage.trim()
    if (!message || message.length > 200) {
      this.error = '提交信息须为 1～200 个字符'
      this.notify()
      return false
    }
    if (this.busy || !this.canEdit) return false
    if (this.commitConfirmed && !this.dirty) {
      try {
        await this.releaseLock()
        return true
      } catch (error) {
        this.fail(error)
        return false
      }
    }
    if (this.dirty && !(await this.save())) return false
    this.phase = 'submitting'
    this.error = ''
    this.notify()
    const generation = this.generation
    let previousCommit: string | undefined
    let commitAttempted = false
    try {
      await this.acquireLock()
      if (this.disposed || generation !== this.generation) return false
      const history = await this.request('get', `${this.url()}/change-log`)
      previousCommit = history[0]?.id
      commitAttempted = true
      await this.request('post', `${this.url()}/commit`, { commitMsg: message })
      if (this.disposed || generation !== this.generation) return false
      this.ownedLock = false
      this.pendingCommit = false
      this.commitConfirmed = true
      return true
    } catch (error) {
      if (this.disposed || generation !== this.generation) return false
      this.fail(error)
      try {
        const status = await this.status()
        if (commitAttempted && !this.pendingCommit) {
          const history = await this.request('get', `${this.url()}/change-log`)
          const latest = history[0]
          if (
            latest?.id &&
            latest.id !== previousCommit &&
            latest.message.split(' 操作人:')[0] === message
          ) {
            this.commitConfirmed = true
            this.ownedLock = status.lockState === 'OWNED'
            this.error = '已核对版本记录，提交已完成；请再次确认以完成关闭和锁释放。'
          }
        }
      } catch (statusError) {
        this.error += `；${String(statusError)}`
      }
      return false
    } finally {
      this.phase = ''
      this.notify()
    }
  }

  async test() {
    if (!this.canTest) return
    this.error = ''
    this.resultStale = true
    let data
    try {
      data = {
        revision: this.init.revision,
        variables: testValues(this.variables),
        configValues: testValues(this.configs, true),
      }
    } catch (error) {
      this.fail(error)
      this.notify()
      return
    }
    const generation = this.generation
    this.phase = 'testing'
    this.testTab = 'response'
    this.notify()
    try {
      const result = await this.request(
        'post',
        `${this.url()}/test`,
        data,
        this.init.maxDurationMs + 10000
      )
      if (this.disposed || generation !== this.generation) return
      this.result = result
      this.resultStale = false
      if (result.error?.reason === 'RESOURCE_CHANGED') {
        this.init = null
        this.resultStale = true
      }
    } catch (error) {
      if (!this.disposed) {
        this.result = null
        this.fail(error)
      }
    } finally {
      this.phase = ''
      this.notify()
    }
  }

  async releaseLock() {
    if (this.releasing) return this.releasing
    if (!this.ownedLock || !this.identity) return
    this.releasing = this.request('post', `${this.url()}/release-lock`, {}).then(() => {
      this.ownedLock = false
    })
    try {
      await this.releasing
    } finally {
      this.releasing = undefined
    }
  }

  inputChanged() {
    this.resultStale = Boolean(this.result)
    this.notify()
  }
  configurationChanged(inputs: TestInput[]) {
    const signature = canonical(testValues(inputs, true))
    this.configs = inputs
    if (signature === this.configSignature) return
    this.configSignature = signature
    this.resultStale = Boolean(this.result)
    this.initGeneration++
    this.init = null
    this.initializing = true
    clearTimeout(this.configTimer)
    this.notify()
    // Invalidate immediately; group keystrokes so dependency discovery does not interrupt input.
    this.configTimer = setTimeout(() => {
      if (!this.disposed) void this.initialize()
    }, 350)
  }
  fail(error: unknown) {
    this.error = error instanceof Error ? error.message : String(error)
    this.notify()
  }
  dispose() {
    clearTimeout(this.configTimer)
    this.disposed = true
    this.generation++
    this.initGeneration++
  }
}
