import { cloneDeep, isEqual } from 'lodash'

export type Template = {
  name: string
  title: string | null
  isEnabled: boolean
  payloadSchema: unknown
  channel: Record<
    string,
    { schema: Record<string, unknown>; options?: Record<string, unknown> }
  >
}
export type Problem = { path: string; channel?: string; code: string; message: string }
export type Difference = {
  path: string
  operation: string
  before?: unknown
  after?: unknown
}
export type Definition = {
  name: string
  effectiveTemplate: Template
  defaultTemplate: Template | null
  hasOverride: boolean
  defaultExists: boolean
  effectiveSource: string
  effectiveProvider: string
  defaultRevision: string
  overrideRevision: string
  baseChanged: boolean | null
  modifiedBy?: string
  modifiedAt?: string
  availableActions: { view: boolean; edit: boolean; restore: boolean }
  diagnostics: Problem[]
  differences: Difference[]
}
export type JsonSchema = {
  type?: string | string[]
  title?: string
  properties?: Record<string, JsonSchema>
  required?: string[]
  enum?: unknown[]
  minimum?: number
  maximum?: number
}
export type Channel = {
  id: string
  title: string
  installed: boolean
  manageable: boolean
  referenceCount: number
  configurationGroups: string[]
  schema?: JsonSchema
  options?: JsonSchema
}
export type Validation = {
  valid: boolean
  errors: Problem[]
  warnings: Problem[]
  changes: Difference[]
  overrides: Difference[]
}
type Response = { code: number; msg?: string; data: any }
export type Request = (method: string, url: string, data?: unknown) => Promise<Response>
export const sourceLabel: Record<string, string> = {
  DEFAULT: '默认配置',
  OVERRIDE: '运行时覆盖',
  DATABASE_ONLY: '数据库独有',
}
export const impact =
  '修改影响后续新发送；已生成的投递计划保留原内容，已发出的通知不会被撤回。'

export function differences(before: unknown, after: unknown, path = ''): Difference[] {
  if (isEqual(before, after)) return []
  if (
    before &&
    after &&
    typeof before === 'object' &&
    typeof after === 'object' &&
    !Array.isArray(before) &&
    !Array.isArray(after)
  ) {
    const a = before as Record<string, unknown>,
      b = after as Record<string, unknown>
    return [...new Set([...Object.keys(a), ...Object.keys(b)])].sort().flatMap((key) => {
      const field = path ? `${path}.${key}` : key
      if (!(key in a)) return [{ path: field, operation: 'ADD', after: b[key] }]
      if (!(key in b)) return [{ path: field, operation: 'REMOVE', before: a[key] }]
      return differences(a[key], b[key], field)
    })
  }
  return [{ path, operation: 'REPLACE', before, after }]
}

/** Page commands use the original management API; sending and Provider resolution stay on the server. */
export class NotificationTemplateManagementState {
  definition?: Definition
  draft?: Template
  latest?: Definition
  channels: Channel[] = []
  channelError = ''
  editing = false
  busy = false
  error = ''
  message = ''
  conflict = false
  pendingCommit?: Record<string, unknown>
  validation?: Validation
  inputErrors: Record<string, string> = {}
  disposed = false

  constructor(
    readonly name: string,
    private request: Request,
    private changed: () => void
  ) {}

  private url(action: string) {
    return `/api/sys/notification-template/${encodeURIComponent(this.name)}/${action}`
  }
  get dirty() {
    return (
      this.editing &&
      (!!Object.values(this.inputErrors).find(Boolean) ||
        !isEqual(this.draft, this.definition?.effectiveTemplate))
    )
  }
  get changes() {
    return differences(this.definition?.effectiveTemplate, this.draft)
  }
  get canWrite() {
    return (
      this.editing &&
      this.dirty &&
      !this.busy &&
      !this.conflict &&
      !this.pendingCommit &&
      !Object.values(this.inputErrors).some(Boolean) &&
      !!this.definition?.availableActions.edit
    )
  }
  command(restore = false) {
    if (!this.definition || !this.draft) throw new Error('请先读取模板')
    const changes: Partial<Template> = {}
    if (!restore) {
      for (const field of ['title', 'isEnabled', 'channel'] as const) {
        if (!isEqual(this.draft[field], this.definition.effectiveTemplate[field]))
          Object.assign(changes, { [field]: cloneDeep(this.draft[field]) })
      }
    }
    return {
      expectedDefaultRevision: this.definition.defaultRevision,
      expectedOverrideRevision: this.definition.overrideRevision,
      changes,
    }
  }
  beginEdit() {
    if (!this.definition?.availableActions.edit || this.busy || this.pendingCommit) return
    this.draft = cloneDeep(this.definition.effectiveTemplate)
    this.editing = true
    this.validation = undefined
    this.inputErrors = {}
    this.message = ''
    this.changed()
  }
  change(patch: Partial<Pick<Template, 'title' | 'isEnabled' | 'channel'>>) {
    if (!this.editing || this.busy || this.pendingCommit) return
    this.draft = { ...this.draft!, ...cloneDeep(patch) }
    this.validation = undefined
    this.error = ''
    this.changed()
  }
  inputState(path: string, error: string) {
    this.inputErrors[path] = error
    this.validation = undefined
    this.changed()
  }
  cancel() {
    this.editing = false
    this.draft = cloneDeep(this.definition?.effectiveTemplate)
    this.inputErrors = {}
    this.validation = undefined
    this.latest = undefined
    this.conflict = false
    this.error = ''
    this.changed()
  }
  async load(latestOnly = false) {
    if (this.busy) return
    this.busy = true
    this.error = ''
    this.changed()
    try {
      const response = await this.request('get', this.url('runtime-definition'))
      if (this.disposed) return
      if (response.code !== 0) throw new Error(response.msg || '暂时无法加载通知模板')
      if (latestOnly) this.latest = response.data
      else {
        this.definition = response.data
        this.draft = cloneDeep(this.definition!.effectiveTemplate)
        this.editing = false
        this.conflict = false
        this.latest = undefined
        this.pendingCommit = undefined
        this.inputErrors = {}
        this.validation = undefined
      }
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error)
    } finally {
      this.busy = false
      if (!this.disposed) this.changed()
    }
  }
  async loadChannels() {
    try {
      const result = await this.request(
        'get',
        '/api/notification/adapter-schema/management'
      )
      if (result.code !== 0) throw new Error(result.msg || '渠道目录读取失败')
      this.channels = Array.isArray(result.data) ? result.data : result.data.items
      this.channelError = ''
    } catch (error) {
      this.channelError = error instanceof Error ? error.message : String(error)
    }
    if (!this.disposed) this.changed()
  }
  acceptLatest() {
    if (!this.latest || this.pendingCommit) return
    this.definition = this.latest
    this.latest = undefined
    this.conflict = false
    this.validation = undefined
    this.error = ''
    this.changed()
  }
  private failure(response: Response) {
    this.error = response.msg || '操作失败，请重试'
    this.conflict = response.code === 409
    if (response.data?.errors)
      this.validation = {
        valid: false,
        errors: response.data.errors,
        warnings: [],
        changes: [],
        overrides: [],
      }
  }
  async check() {
    if (!this.canWrite) return false
    this.busy = true
    this.error = ''
    this.changed()
    try {
      const response = await this.request(
        'post',
        this.url('runtime-override/validate'),
        this.command()
      )
      if (response.code !== 0) {
        this.failure(response)
        return false
      }
      this.validation = response.data
      return this.validation!.valid
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error)
      return false
    } finally {
      this.busy = false
      if (!this.disposed) this.changed()
    }
  }
  async write(restore = false) {
    if (
      this.busy ||
      this.pendingCommit ||
      this.conflict ||
      (restore ? !this.definition?.availableActions.restore : !this.canWrite)
    )
      return
    this.busy = true
    this.error = ''
    this.changed()
    try {
      const response = await this.request(
        restore ? 'post' : 'put',
        this.url(restore ? 'restore-default' : 'runtime-override'),
        this.command(restore)
      )
      if (response.data?.committed && !response.data.confirmed) {
        this.pendingCommit = response.data
        this.message = '已保存，生效状态待核对；请读取最新状态，勿重复提交。'
      } else if (response.code === -1 || response.code >= 500) {
        this.pendingCommit = { reason: 'RESPONSE_LOST' }
        this.message = '提交结果待核对；请先读取最新状态，再决定下一步。'
        this.error = response.msg || '未收到提交结果'
      } else if (response.code !== 0) this.failure(response)
      else {
        this.definition = response.data.definition
        this.draft = cloneDeep(this.definition!.effectiveTemplate)
        this.editing = false
        this.inputErrors = {}
        this.validation = undefined
        this.message = response.data.changed
          ? restore
            ? '已撤销覆盖，当前跟随部署默认'
            : '配置已保存并生效'
          : '没有需要保存的修改'
      }
    } catch (error) {
      // A lost write response cannot establish whether the transaction committed.
      this.pendingCommit = { reason: 'RESPONSE_LOST' }
      this.error = error instanceof Error ? error.message : String(error)
      this.message = '提交结果待核对；请先读取最新状态，再决定下一步。'
    } finally {
      this.busy = false
      if (!this.disposed) this.changed()
    }
  }
}
