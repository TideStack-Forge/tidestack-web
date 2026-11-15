import React from 'react'
import { renderBusinessBehaviorControl } from './BusinessBehaviorControl'
import Button from 'amis-ui/lib/components/Button'
import InputBox from 'amis-ui/lib/components/InputBox'
import Textarea from 'amis-ui/lib/components/Textarea'
import { FormItem, type FormControlProps } from 'amis'
import JsonDataEditorControl from './JsonDataEditor'
import './BusinessBehaviorEditor.scss'
import { BusinessBehaviorMappingEditor } from './BusinessBehaviorMappingEditor'

type Definition = Record<string, any>
type Props = FormControlProps & {
  memberType: 'action' | 'event' | 'subscription'
  selectedIndex?: number
  catalog?: Record<string, any>
  appName?: string
  onInputStateChange?: (error: string) => void
  modelFullName?: string
}
type State = {
  advanced: boolean
  error: string
  flows: { name: string; projected?: boolean; model?: Definition }[]
  flowError: string
  references: Record<string, { model: string; members: Definition[]; error?: string }>
}

/** Edits only the original dynamic array. Generated and code definitions belong to the catalog. */
export class BusinessBehaviorDefinitions extends React.Component<Props, State> {
  state: State = { advanced: false, error: '', flows: [], flowError: '', references: {} }
  private jsonEditors = new Map<string, JsonDataEditorControl>()
  private mappingEditors = new Map<string, BusinessBehaviorMappingEditor>()

  private flowSequence = 0

  componentDidMount() {
    if (this.props.memberType === 'action') void this.loadFlows()
  }
  componentWillUnmount() {
    this.flowSequence += 1
    this.referenceSequences.event += 1
    this.referenceSequences.action += 1
  }

  async loadFlows() {
    const { appName, modelFullName } = this.props
    if (!appName || !modelFullName || !this.props.env?.fetcher) return
    const sequence = ++this.flowSequence
    const base = `/api/dev/${encodeURIComponent(appName)}`
    const results = await Promise.allSettled([
      this.props.env.fetcher({ method: 'get', url: `${base}/logic-flow` }),
      this.props.env.fetcher({
        method: 'get',
        url: `${base}/business-model/${encodeURIComponent(modelFullName)}/model-bundle`,
      }),
    ])
    if (sequence !== this.flowSequence) return
    const flows = new Map<
      string,
      { name: string; projected?: boolean; model?: Definition }
    >()
    const failures: string[] = []
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        failures.push(
          result.reason instanceof Error ? result.reason.message : String(result.reason)
        )
        return
      }
      const response = result.value
      if (!response.ok) {
        failures.push(response.msg || '候选查询失败')
        return
      }
      const entries =
        index === 0 ? response.data?.items || response.data : response.data?.FlowModelMeta
      if (!Array.isArray(entries)) {
        failures.push('流程列表未返回有效数据')
        return
      }
      entries.forEach((entry) => {
        const name = index === 0 ? entry.model?.name : entry.name
        if (typeof name === 'string' && !flows.has(name))
          flows.set(name, { name, projected: index === 1, model: entry.model })
      })
    })
    this.setState({ flows: [...flows.values()], flowError: failures.join('；') })
  }

  validate() {
    return (
      [...this.jsonEditors.values(), ...this.mappingEditors.values()]
        .map((editor) => editor.validate())
        .find(Boolean) || ''
    )
  }

  switchMode() {
    const error = this.validate()
    if (error) this.setState({ error: '请先修正当前 JSON，避免丢失未完成的输入。' })
    else this.setState({ advanced: !this.state.advanced, error: '' })
  }

  private disabled() {
    return this.props.disabled || this.props.static || this.props.data?.readOnly
  }

  change(index: number, path: string, value: any) {
    const definitions = [...(this.props.value || [])]
    const segments = path.split('.')
    function update(source: Definition, depth: number): Definition {
      const copy = { ...source }
      const key = segments[depth]
      if (depth < segments.length - 1) copy[key] = update(copy[key], depth + 1)
      else if (value === undefined) delete copy[key]
      else copy[key] = value
      return copy
    }
    definitions[index] = update(definitions[index], 0)
    this.props.onChange(definitions, undefined, true)
  }

  add() {
    this.props.onChange([...(this.props.value || []), { name: '' }])
  }

  remove(index: number) {
    this.props.onChange(
      this.props.value.filter((_: Definition, position: number) => position !== index)
    )
  }

  private get(definition: Definition, path: string) {
    return path.split('.').reduce((value, key) => value?.[key], definition)
  }

  private text(
    definition: Definition,
    index: number,
    path: string,
    label: string,
    multiline = false
  ) {
    const value = this.get(definition, path) ?? ''
    const codeSite = this.codeSite(path)
    if (codeSite) {
      const collection =
        this.props.memberType === 'action'
          ? 'actions'
          : this.props.memberType === 'subscription'
            ? 'eventSubscriptions'
            : 'events'
      const pointer = `/${collection}/${index}/${path
        .split('.')
        .map((segment) => segment.replace(/~/g, '~0').replace(/\//g, '~1'))
        .join('/')}`
      return (
        <div>
          <p>{label}</p>
          {this.props.render(
            `${index}/${path}/code-editor`,
            {
              type: 'script-editor',
              name: path,
              language: 'spel',
              codeResourceType: 'business-model',
              codeSite,
              codePointer: pointer,
              intelligenceApi: `/api/dev/${this.props.data?.appName || ''}/code-intelligence/context`,
              changeImmediately: true,
            },
            {
              data: {
                ...(this.props.data || {}),
                __CODE_RESOURCE_DRAFT: this.props.data || {},
              },
              value,
              disabled: this.disabled(),
              onChange: (next: any) =>
                this.change(index, path, typeof next === 'string' ? next : next?.value),
            }
          )}
        </div>
      )
    }
    const props = {
      value,
      disabled: this.disabled(),
      onChange: (value: string) => this.change(index, path, value),
    }
    return (
      <label>
        <span>{label}</span>
        {multiline ? <Textarea {...props} minRows={3} /> : <InputBox {...props} />}
      </label>
    )
  }

  private effectiveValue(definition: Definition, path: string, boolean: boolean) {
    const entries =
      this.props.catalog?.[
        this.props.memberType === 'action'
          ? 'actions'
          : this.props.memberType === 'event'
            ? 'events'
            : 'subscriptions'
      ] || []
    const resolved = entries.find((entry: Definition) => entry.name === definition.name)
    const value = resolved && this.get(resolved, path)
    if (value !== undefined) return value
    if (!boolean) return undefined
    return this.props.memberType === 'subscription' && path === 'isEnabled'
  }

  private codeSite(path: string) {
    if (path.endsWith('precondition.expression')) return 'business-model.precondition'
    if (path.endsWith('filter')) return 'business-model.restricted-expression'
    return null
  }

  private choice(
    definition: Definition,
    index: number,
    path: string,
    label: string,
    choices: [string, string][],
    boolean = false
  ) {
    const value = this.get(definition, path)
    return (
      <div className="BusinessBehaviorEditor-field">
        <span>{label}</span>
        {renderBusinessBehaviorControl(
          this.props.render,
          `choice-${index}-${path}`,
          {
            type: path === 'readOnly' || !boolean ? 'button-group-select' : 'switch',
            label: false,
            options: choices.map(([value, label]) => ({
              value: boolean ? value === 'true' : value,
              label,
            })),
          },
          {
            value: value ?? this.effectiveValue(definition, path, boolean),
            disabled: this.disabled(),
            onChange: async (value: unknown) => {
              if (
                path === 'subject' &&
                definition.subject &&
                definition.subject !== value &&
                !(await this.props.env.confirm(
                  '更改事件主体后，请确认产生方与订阅输入仍匹配。事件数据保持不变。'
                ))
              )
                return false
              this.change(index, path, value)
              return true
            },
          }
        )}
      </div>
    )
  }

  private json(
    key: string,
    value: any,
    onChange: (value: any) => void,
    types: string,
    pointer?: string
  ) {
    return (
      <JsonDataEditorControl
        {...this.props}
        key={key}
        ref={(editor) => {
          if (editor) this.jsonEditors.set(key, editor)
          else this.jsonEditors.delete(key)
        }}
        value={value}
        codeContext={
          pointer
            ? {
                codeSite: 'business-model.mapping',
                codeResourceType: 'business-model',
                codePointer: pointer,
                language: 'spel',
                intelligenceApi: `/api/dev/${this.props.data?.appName || ''}/code-intelligence/context`,
                data: { __CODE_RESOURCE_DRAFT: this.props.data },
              }
            : undefined
        }
        jsonSchema={key === 'advanced' ? this.props.jsonSchema : undefined}
        onChange={onChange}
        allowValueTypes={types}
        disabled={this.disabled()}
        static={this.disabled()}
        render={(region, schema, props) =>
          this.props.render(`${key}/${region}`, schema, props)
        }
      />
    )
  }

  private jsonField(
    definition: Definition,
    index: number,
    path: string,
    label: string,
    types = 'object'
  ) {
    return (
      <div>
        <p>{label}</p>
        {this.json(
          `${index}/${path}`,
          this.get(definition, path),
          (value) => this.change(index, path, value),
          types,
          /(?:inputMapping|outputMapping|listenerInputMapping)$/.test(path)
            ? `/${this.props.name}/${index}/${path.replaceAll('.', '/')}`
            : undefined
        )}
        <Button
          type="button"
          disabled={this.disabled()}
          onClick={() => this.change(index, path, undefined)}>
          清除{label}
        </Button>
      </div>
    )
  }

  private schema(
    definition: Definition,
    index: number,
    path: string,
    label: string,
    objectRoot = false
  ) {
    const value = this.get(definition, path)
    const complex = (node: any): boolean =>
      node != null &&
      typeof node === 'object' &&
      ([
        '$ref',
        '$defs',
        'definitions',
        'oneOf',
        'anyOf',
        'allOf',
        'not',
        'if',
        'patternProperties',
        'dependentSchemas',
        'prefixItems',
      ].some((key) => key in node) ||
        Array.isArray(node.type) ||
        (node.items && Array.isArray(node.items)) ||
        (Array.isArray(node.required) &&
          node.required.some((key: string) => !node.properties?.[key])) ||
        Object.values(node.properties || {}).some(complex) ||
        complex(node.items))
    return (
      <section aria-label={label}>
        <h5>{label}</h5>
        {value === undefined ? <small>未声明数据结构</small> : null}
        {complex(value) ? (
          <p>此数据结构使用高级定义维护。</p>
        ) : (
          renderBusinessBehaviorControl(
            this.props.render,
            `schema-${index}-${path}`,
            {
              type: 'json-schema-editor',
              label: false,
              rootTypeMutable: !objectRoot,
              showRootInfo: !objectRoot,
              disabledTypes: [],
              enableAdvancedSetting: true,
              placeholder: {
                key: '字段标识',
                title: '显示名称',
                description: '字段说明',
              },
              advancedSettings: {
                object: [
                  {
                    type: 'select',
                    name: 'x-business-object-ref',
                    label: '业务对象所属模型',
                    searchable: true,
                    clearable: true,
                    creatable: true,
                    source: this.props.appName
                      ? {
                          url: `/api/dev/${encodeURIComponent(this.props.appName)}/business-model/list`,
                          responseData: { options: '${ items }' },
                        }
                      : undefined,
                    labelField: 'title',
                    valueField: 'fullName',
                  },
                ],
              },
            },
            {
              value,
              disabled: this.disabled(),
              onChange: async (next: any) => {
                if (JSON.stringify(value) === JSON.stringify(next)) return
                const destructive = (before: any, after: any): boolean =>
                  before &&
                  typeof before === 'object' &&
                  ((before.type && before.type !== after?.type) ||
                    Object.entries(before.properties || {}).some(
                      ([key, field]) =>
                        !after?.properties?.[key] ||
                        destructive(field, after.properties[key])
                    ) ||
                    (before.items && destructive(before.items, after?.items)))
                if (
                  destructive(value, next) &&
                  !(await this.props.env.confirm(
                    '此修改会改变字段类型或移除字段，请确认相关引用已调整。'
                  ))
                )
                  return false
                this.change(index, path, next)
                return true
              },
            }
          )
        )}
        <details>
          <summary>高级数据定义</summary>
          {this.jsonField(definition, index, path, label)}
        </details>
      </section>
    )
  }

  private mapping(
    definition: Definition,
    index: number,
    path: string,
    partitioned = false
  ) {
    const key = `${index}/${path}`
    const event =
      this.props.catalog?.events?.find(
        (item: Definition) =>
          item.name === definition.sourceEventName &&
          this.props.modelFullName === definition.sourceEventModelFullName
      ) ||
      (definition.sourceEventModelFullName &&
      this.state.references.event?.model === definition.sourceEventModelFullName
        ? this.state.references.event.members.find(
            (item) => item.name === definition.sourceEventName
          )
        : undefined)
    const target =
      this.props.catalog?.actions?.find(
        (item: Definition) =>
          item.name === definition.targetActionName &&
          this.props.modelFullName === definition.targetActionModelFullName
      ) ||
      (definition.targetActionModelFullName &&
      this.state.references.action?.model === definition.targetActionModelFullName
        ? this.state.references.action.members.find(
            (item) => item.name === definition.targetActionName
          )
        : undefined)
    return (
      <BusinessBehaviorMappingEditor
        {...this.props}
        key={key}
        ref={(editor) => {
          if (editor) this.mappingEditors.set(key, editor)
          else this.mappingEditors.delete(key)
        }}
        value={this.get(definition, path)}
        onChange={(value) => this.change(index, path, value)}
        disabled={this.disabled()}
        partitioned={partitioned}
        eventSchema={event?.payloadSchema}
        eventSubject={event?.subject}
        targetSchema={target?.inputSchema}
      />
    )
  }

  async loadReferenceMembers(model: string, kind: 'event' | 'action') {
    if (!this.props.appName || !model || model === this.props.modelFullName) return
    const request = ++this.referenceSequences[kind]
    try {
      const response = await this.props.env.fetcher({
        method: 'get',
        url: `/api/dev/${encodeURIComponent(this.props.appName)}/business-model/${encodeURIComponent(model)}/model-bundle`,
      })
      if (request !== this.referenceSequences[kind]) return
      if (!response.ok) throw new Error(response.msg || '模型成员未加载')
      const behavior = response.data?.BusinessModelBehavior?.find(
        (entry: Definition) => entry.name === model
      )?.model
      if (!behavior) throw new Error('此环境没有可用的模型行为目录')
      this.setState((previous) => ({
        references: {
          ...previous.references,
          [kind]: {
            model,
            members: Object.values(
              behavior[kind === 'event' ? 'events' : 'actions'] || {}
            ),
          },
        },
      }))
    } catch (error) {
      if (request === this.referenceSequences[kind])
        this.setState((previous) => ({
          references: {
            ...previous.references,
            [kind]: {
              model,
              members: [],
              error: error instanceof Error ? error.message : String(error),
            },
          },
        }))
    }
  }

  private referenceSequences = { event: 0, action: 0 }

  private reference(definition: Definition, index: number, kind: 'event' | 'action') {
    const modelPath =
      kind === 'event' ? 'sourceEventModelFullName' : 'targetActionModelFullName'
    const namePath = kind === 'event' ? 'sourceEventName' : 'targetActionName'
    const label = kind === 'event' ? '订阅事件' : '响应动作'
    const candidates: Definition[] =
      definition[modelPath] === this.props.modelFullName
        ? this.props.catalog?.[kind === 'event' ? 'events' : 'actions'] || []
        : definition[modelPath] &&
            this.state.references[kind]?.model === definition[modelPath]
          ? this.state.references[kind].members
          : []
    return (
      <section aria-label={label}>
        <h5>{label}</h5>
        <label>
          业务模型
          {renderBusinessBehaviorControl(
            this.props.render,
            `model-${index}-${kind}`,
            {
              type: 'select',
              searchable: true,
              labelField: 'title',
              valueField: 'fullName',
              source: this.props.appName
                ? {
                    url: `/api/dev/${encodeURIComponent(this.props.appName)}/business-model/list`,
                    responseData: { options: '${ items }' },
                  }
                : undefined,
            },
            {
              value: definition[modelPath],
              disabled: this.disabled(),
              onChange: (model: string) => {
                this.change(index, modelPath, model)
                void this.loadReferenceMembers(model, kind)
              },
            }
          )}
        </label>
        {definition[modelPath] && definition[modelPath] !== this.props.modelFullName ? (
          <Button
            type="button"
            onClick={() => void this.loadReferenceMembers(definition[modelPath], kind)}>
            读取可见成员
          </Button>
        ) : null}
        {renderBusinessBehaviorControl(
          this.props.render,
          `reference-${index}-${kind}`,
          {
            type: 'select',
            label: false,
            searchable: true,
            placeholder: kind === 'event' ? '选择本模型事件' : '选择本模型动作',
            options: candidates.map((item) => ({
              label: `${item.title || item.name} · ${item.name}`,
              value: item.name,
            })),
          },
          {
            value: definition[namePath],
            disabled: this.disabled(),
            onChange: (name: string) => {
              const definitions = [...this.props.value]
              definitions[index] = {
                ...definition,
                [modelPath]: definition[modelPath] || this.props.modelFullName,
                [namePath]: name,
              }
              this.props.onChange(definitions, undefined, true)
            },
          }
        )}
        <details
          open={
            !!definition[modelPath] && definition[modelPath] !== this.props.modelFullName
          }>
          <summary>手动填写外部引用</summary>
          {this.text(definition, index, modelPath, '模型全名')}
          {this.text(
            definition,
            index,
            namePath,
            kind === 'event' ? '事件标识' : '动作标识'
          )}
        </details>
        {definition[namePath] &&
        !candidates.some((item) => item.name === definition[namePath]) ? (
          <p role="status">外部引用待核验</p>
        ) : null}
        {this.state.references[kind]?.model === definition[modelPath] &&
        this.state.references[kind]?.error ? (
          <p role="alert">{this.state.references[kind].error}</p>
        ) : null}
      </section>
    )
  }

  private action(definition: Definition, index: number) {
    const appName = this.props.appName
    return (
      <>
        {this.choice(
          definition,
          index,
          'isEnabled',
          '动作状态',
          [
            ['true', '启用'],
            ['false', '停用'],
          ],
          true
        )}
        {this.schema(
          definition,
          index,
          'inputSchema.properties.params',
          '动作参数 params',
          true
        )}
        {this.schema(definition, index, 'inputSchema.properties.data', '动作数据 data')}
        {this.schema(definition, index, 'outputSchema', '返回结果')}
        <section aria-label="执行配置">
          <h5>执行配置</h5>
          {definition.binding?.kind === 'handler' ? (
            <p>原代码绑定：{definition.binding.handlerName}（在高级定义中维护）</p>
          ) : (
            <>
              <label>
                <span>逻辑流</span>
                {renderBusinessBehaviorControl(
                  this.props.render,
                  `flow-${index}`,
                  {
                    type: 'select',
                    label: false,
                    searchable: true,
                    options: this.state.flows.map((flow) => ({
                      label: flow.name,
                      value: flow.name,
                    })),
                  },
                  {
                    value: definition.binding?.flowName,
                    disabled: this.disabled(),
                    onChange: (flowName: string) => {
                      const definitions = [...this.props.value]
                      definitions[index] = {
                        ...definition,
                        binding: { ...definition.binding, kind: 'logicflow', flowName },
                      }
                      this.props.onChange(definitions, undefined, true)
                    },
                  }
                )}
              </label>
              <div className="BusinessBehaviorEditor-actions">
                <Button
                  type="button"
                  disabled={!appName || !definition.binding?.flowName}
                  onClick={() => this.openFlow(definition.binding.flowName)}>
                  打开逻辑流
                </Button>
                <Button
                  type="button"
                  disabled={!appName || this.disabled()}
                  onClick={() => this.openFlow()}>
                  新建逻辑流
                </Button>
                <Button type="button" onClick={() => void this.loadFlows()}>
                  刷新流程列表
                </Button>
              </div>
              {this.state.flowError ? (
                <p role="alert">流程候选未完全加载：{this.state.flowError}</p>
              ) : null}
              <p>自动传入标准动作输入</p>
              <details>
                <summary>兼容旧流程输入</summary>
                {this.mapping(definition, index, 'binding.inputMapping')}
              </details>
            </>
          )}
          {this.text(definition, index, 'precondition.expression', '执行前检查', true)}
          {this.text(definition, index, 'precondition.message', '不满足时的提示')}
        </section>
        <section aria-label="允许发出事件">
          <h5>允许发出事件</h5>
          {renderBusinessBehaviorControl(
            this.props.render,
            `emits-${index}`,
            {
              type: 'select',
              label: false,
              multiple: true,
              joinValues: false,
              extractValue: true,
              searchable: true,
              options: (this.props.catalog?.events || []).map((event: Definition) => ({
                label: event.title || event.name,
                value: event.name,
              })),
            },
            {
              value: (definition.emits || [])
                .filter(
                  (event: Definition) => event.modelFullName === this.props.modelFullName
                )
                .map((event: Definition) => event.eventName),
              disabled: this.disabled(),
              onChange: (names: string[]) =>
                this.change(index, 'emits', [
                  ...(definition.emits || []).filter(
                    (event: Definition) =>
                      event.modelFullName !== this.props.modelFullName
                  ),
                  ...names.map((eventName) => ({
                    modelFullName: this.props.modelFullName,
                    eventName,
                  })),
                ]),
            }
          )}
          <small>由实现派发</small>
          <details>
            <summary>外部事件与高级引用</summary>
            {this.jsonField(definition, index, 'emits', '事件引用', 'array')}
          </details>
        </section>
        <details>
          <summary>高级执行设置</summary>
          {this.choice(
            definition,
            index,
            'readOnly',
            '数据操作',
            [
              ['true', '只读'],
              ['false', '允许写入'],
            ],
            true
          )}
          {this.choice(
            definition,
            index,
            'binding.requiresHttpRequest',
            '依赖 HTTP 请求',
            [
              ['true', '需要'],
              ['false', '不需要'],
            ],
            true
          )}
          {this.jsonField(
            definition,
            index,
            'binding.outputMapping',
            '流程返回映射',
            'object,array,string,number,boolean,null'
          )}
        </details>
        {definition.binding?.requiresHttpRequest ? (
          <p role="status">此动作需要 HTTP 请求，不能用于异步订阅。</p>
        ) : null}
      </>
    )
  }

  private openFlow(name?: string) {
    const flow = this.state.flows.find((flow) => flow.name === name)
    if (flow?.projected)
      return this.props.onAction(
        null,
        {
          actionType: 'dialog',
          dialog: {
            title: '逻辑流',
            size: 'full',
            url: `/dev/${encodeURIComponent(this.props.appName || '')}/business-model/model-bundle/flow-model-detail`,
            data: { model: flow.model },
          },
        },
        this.props.data
      )
    return this.props.onAction(
      null,
      {
        actionType: 'openOrSwitchTab',
        args: {
          url: `/dev/${encodeURIComponent(this.props.appName || '')}/logicflow-model/${name ? encodeURIComponent(name) : 'add'}`,
          title: name ? '逻辑流' : '新建逻辑流',
        },
      },
      this.props.data
    )
  }

  private event(definition: Definition, index: number) {
    return (
      <>
        {this.text(definition, index, 'occurrenceCondition', '发生说明', true)}
        {this.choice(definition, index, 'subject', '事件主体', [
          ['instance', '对象'],
          ['model', '模型'],
        ])}
        <details>
          <summary>主体与事件数据</summary>
          <p>
            对象：发出事件时提供主体 ID。模型：不提供主体
            ID。两者都显式传入事件数据，不自动读取对象快照。
          </p>
        </details>
        {this.schema(definition, index, 'payloadSchema', '事件数据', true)}
        <details>
          <summary>高级设置</summary>
          {this.jsonField(
            definition,
            index,
            'allowedProducerKinds',
            '允许的生产者种类',
            'array'
          )}
          {this.choice(
            definition,
            index,
            'requireUnfilteredModelRead',
            '完整模型读取要求',
            [
              ['true', '要求完整读取权'],
              ['false', '按普通披露规则'],
            ],
            true
          )}
        </details>
      </>
    )
  }

  private subscription(definition: Definition, index: number) {
    return (
      <>
        {this.choice(
          definition,
          index,
          'isEnabled',
          '订阅状态',
          [
            ['true', '启用'],
            ['false', '停用'],
          ],
          true
        )}
        {definition.isEnabled === false ? (
          <p role="status">
            停用后不接收新事件；已有待处理交付将阻塞，恢复后须显式重驱。
          </p>
        ) : null}
        {this.reference(definition, index, 'event')}
        {definition.listenerName ? (
          <p>此订阅使用原代码监听器：{definition.listenerName}。在高级定义中维护。</p>
        ) : (
          <>
            {this.reference(definition, index, 'action')}
            {this.mapping(definition, index, 'inputMapping', true)}
          </>
        )}
        <details>
          <summary>筛选与交付设置</summary>
          {typeof definition.filter === 'object' && definition.filter !== null
            ? this.jsonField(
                definition,
                index,
                'filter',
                '事件筛选',
                'object,string,boolean'
              )
            : this.text(definition, index, 'filter', '事件筛选表达式', true)}
          {this.text(definition, index, 'executionPrincipalRef', '事件处理身份')}
          <small>使用已授权的应用用户标识；不会继承事件发起人的身份。</small>
        </details>
        {!definition.executionPrincipalRef ? (
          <p role="alert">尚未配置事件处理身份，请在交付设置中指定。</p>
        ) : null}
      </>
    )
  }

  render() {
    const type = this.props.memberType
    const title = { action: '动作', event: '事件', subscription: '订阅' }[type]
    const structured =
      !this.state.advanced &&
      (this.props.value === undefined || Array.isArray(this.props.value))
    return (
      <section className="BusinessBehaviorEditor" aria-label={`动态${title}定义`}>
        <Button type="button" onClick={() => this.switchMode()}>
          {structured ? '高级定义' : '返回表单'}
        </Button>
        {this.state.error ? <p role="alert">{this.state.error}</p> : null}
        {structured ? (
          <>
            {(this.props.value || []).map((definition: Definition, index: number) =>
              this.props.selectedIndex !== undefined &&
              this.props.selectedIndex !== index ? null : definition &&
                typeof definition === 'object' &&
                !Array.isArray(definition) ? (
                <article key={index} aria-label={`${title}定义 ${index + 1}`}>
                  <div className="BusinessBehaviorEditor-basics">
                    {type !== 'subscription'
                      ? this.text(definition, index, 'title', '显示名称')
                      : null}
                    {this.text(definition, index, 'name', '标识')}
                  </div>
                  {type !== 'subscription'
                    ? this.text(definition, index, 'description', '业务说明', true)
                    : null}
                  {type === 'action'
                    ? this.action(definition, index)
                    : type === 'event'
                      ? this.event(definition, index)
                      : this.subscription(definition, index)}
                  <Button
                    type="button"
                    disabled={this.disabled()}
                    onClick={async () => {
                      if (
                        await this.props.env.confirm(
                          '删除此定义前，请确认相关动作、事件与订阅引用已调整。'
                        )
                      )
                        this.remove(index)
                    }}>
                    删除此{title}
                  </Button>
                </article>
              ) : (
                <p key={index} role="alert">
                  第 {index + 1} 项不是对象，请在 JSON 高级编辑中修正。
                </p>
              )
            )}
            {this.props.selectedIndex === undefined ? (
              <Button type="button" disabled={this.disabled()} onClick={() => this.add()}>
                新增自定义{title}
              </Button>
            ) : null}
          </>
        ) : (
          this.json(
            'advanced',
            this.props.value,
            (value) => this.props.onChange(value, undefined, true),
            'array'
          )
        )}
      </section>
    )
  }
}

@FormItem({ type: 'business-behavior-definitions', autoVar: true })
export class BusinessBehaviorDefinitionsRenderer extends BusinessBehaviorDefinitions {}
