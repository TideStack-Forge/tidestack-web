import React from 'react'
import { FormItem, type FormControlProps } from 'amis'
import { Client } from '#ouroboros-host/utils/http'
import './ExecutionPolicyEditor'
import './CompositeViewEditor.scss'

type Definition = Record<string, any>
type Props = FormControlProps & { appName?: string }
type State = {
  previewConnection: Definition | null
  section: string
  datasets: Definition[]
  apis: Definition[]
  policy: Definition | null
  loading: boolean
  error: string
  datasetSearch: string
  apiSearch: string
  selectingDataset: boolean
  action: number | null
  diagnostics: string[]
  preview: Definition | null
  previewError: string
  previewLoading: boolean
  previewParameters: Definition
  previewOperators: Definition
  previewFilters: Definition
  page: number
  selectedRows: number[]
  actionPreview: Definition | null
}
const sections = [
  ['source', '数据来源'],
  ['columns', '列配置'],
  ['filters', '筛选条件'],
  ['actions', '操作按钮'],
  ['layout', '布局与分页'],
]
const operators = [
  ['eq', '等于'],
  ['neq', '不等于'],
  ['gt', '大于'],
  ['gte', '大于等于'],
  ['lt', '小于'],
  ['lte', '小于等于'],
  ['in', '属于'],
  ['notIn', '不属于'],
  ['like', 'SQL 模式匹配'],
  ['isNull', '为空'],
  ['isNotNull', '非空'],
]
const contextOptions = [
  ['currentUser', '当前用户'],
  ['employeeId', '当前员工'],
  ['departmentId', '当前部门'],
  ['organizationId', '当前组织'],
]

export function apiTargets(
  api: Definition,
  bindings: Definition = {},
): Definition[] {
  const parameters = (api?.parameters || [])
    .filter((item: Definition) => item.in !== 'header' && item.in !== 'cookie')
    .map((item: Definition) => ({
      name: item.name,
      schema: item.schema,
      required: item.required || item.in === 'path',
    }))
  const content = api?.requestBody?.content || {}
  const media = Object.keys(content).find(
    (key) => key === 'application/json' || key.endsWith('+json'),
  )
  function flatten(
    schema: Definition,
    prefix = '',
    required = true,
  ): Definition[] {
    return Object.entries(schema?.properties || {}).flatMap(([name, child]) => {
      const field = child as Definition
      const key = prefix + name
      const mandatory =
        (required && (schema.required || []).includes(name)) ||
        Object.keys(bindings).some((target) => target.startsWith(key + '.'))
      return field?.type === 'object' && field.properties
        ? flatten(field, key + '.', mandatory)
        : [{ name: key, schema: field || {}, required: mandatory }]
    })
  }
  return [
    ...parameters,
    ...flatten(content[media || '']?.schema, '', !!api?.requestBody?.required),
  ]
}

export function bindingProblem(
  target: Definition,
  source: string,
  scope: string,
  fields: Definition[],
) {
  if (!source) return target.required ? '缺少必填绑定' : ''
  const name = source.replace(/^\$\{|}$/g, '')
  const schema = target.schema || {}
  if (scope === 'batch' && schema.type !== 'array')
    return '批量字段需要数组参数'
  const fieldSchema = (field: Definition) => {
    const dataType = String(field.dataType || 'string').toLowerCase()
    const type = ['decimal', 'double', 'float'].includes(dataType)
      ? 'number'
      : ['int', 'long'].includes(dataType)
        ? 'integer'
        : ['date', 'datetime', 'timestamp'].includes(dataType)
          ? 'string'
          : dataType
    return {
      type,
      nullable: field.nullable !== false,
      format:
        dataType === 'date'
          ? 'date'
          : ['datetime', 'timestamp'].includes(dataType)
            ? 'date-time'
            : undefined,
    }
  }
  function compatible(source: Definition, target: Definition): boolean {
    if (!target || target.$ref || !target.type) return false
    if (source.nullable && !target.nullable) return false
    if (
      target.type !== source.type &&
      !(target.type === 'number' && source.type === 'integer')
    )
      return false
    if (
      target.type === 'string' &&
      target.format &&
      target.format !== source.format
    )
      return false
    if (target.type === 'array')
      return compatible(source.items || {}, target.items)
    if (target.type === 'object') {
      const properties = source.properties || {}
      return (
        (target.required || []).every((name: string) => properties[name]) &&
        Object.keys(properties).every((name) =>
          target.properties?.[name]
            ? compatible(properties[name], target.properties[name])
            : target.additionalProperties !== false,
        )
      )
    }
    return true
  }
  if (scope === 'batch' && name === 'selectedItems') {
    const selected = {
      type: 'array',
      items: {
        type: 'object',
        properties: Object.fromEntries(
          fields.map((field) => [field.name, fieldSchema(field)]),
        ),
      },
    }
    return compatible(selected, schema) ? '' : '选中记录与目标对象数组不兼容'
  }
  const field = fields.find(
    (item) => item.name.toLowerCase() === name.toLowerCase(),
  )
  if (!field) return '来源字段已失效'
  const definition = fieldSchema(field)
  return compatible(
    scope === 'batch' ? { type: 'array', items: definition } : definition,
    schema,
  )
    ? ''
    : '类型不兼容'
}

export function previewFilterNode(
  field: string,
  op: string,
  value: string,
  type: string,
) {
  if (['isNull', 'isNotNull'].includes(op)) return { field, op }
  if (value === '') return null
  const convert = (text: string) =>
    ['number', 'integer', 'int', 'long', 'decimal', 'double', 'float'].includes(
      type,
    )
      ? Number(text)
      : type === 'boolean'
        ? text === 'true'
        : text
  return ['in', 'notIn'].includes(op)
    ? {
        field,
        op,
        values: value.split(',').map((item) => convert(item.trim())),
      }
    : { field, op, value: convert(value) }
}

export class CompositeViewEditor extends React.Component<Props, State> {
  state: State = {
    previewConnection: null,
    selectedRows: [],
    actionPreview: null,
    section: 'source',
    datasets: [],
    apis: [],
    policy: null,
    loading: true,
    error: '',
    datasetSearch: '',
    apiSearch: '',
    selectingDataset: false,
    action: null,
    diagnostics: [],
    preview: null,
    previewError: '',
    previewLoading: false,
    previewParameters: {},
    previewOperators: {},
    previewFilters: {},
    page: 1,
  }
  private editorElement = React.createRef<HTMLDivElement>()
  private sequence = 0
  private previewSequence = 0
  private validationSequence = 0
  componentDidMount() {
    void this.load()
  }
  componentDidUpdate(previous: Props) {
    if (previous.appName !== this.props.appName) void this.load()
    if (previous.data?.fullName !== this.props.data?.fullName) {
      this.previewSequence++
      this.setState({
        preview: null,
        diagnostics: [],
        previewParameters: {},
        previewOperators: {},
        previewFilters: {},
        page: 1,
        previewLoading: false,
      })
    }
  }
  componentWillUnmount() {
    this.sequence++
    this.previewSequence++
    this.validationSequence++
  }
  model(): Definition {
    const data = this.props.data || {}
    const fields = [
      'modelType',
      'formatVersion',
      'source',
      'namespace',
      'name',
      'fullName',
      'title',
      'description',
      'icon',
      'isEnabled',
      'isAttachment',
      'datasetName',
      'embeddedQuery',
      'columns',
      'filterConfig',
      'actionButtons',
      'layoutConfig',
    ]
    return Object.fromEntries(
      fields
        .filter((key) => data[key] !== undefined)
        .map((key) => [key, data[key]]),
    )
  }
  base() {
    return `/api/dev/${encodeURIComponent(this.props.data?.appName || this.props.appName || '')}/composite-view`
  }
  async request(path: string, value?: Definition) {
    const response =
      value === undefined
        ? await Client.get(path, {}, { isSilent: true })
        : await Client.post(path, value, { isSilent: true })
    if (response.data?.code !== 0)
      throw new Error(response.data?.msg || '请求失败')
    return response.data.data
  }
  async load() {
    if (!(this.props.data?.appName || this.props.appName)) return
    const sequence = ++this.sequence
    this.setState({ loading: true })
    try {
      const contracts = await this.request(`${this.base()}/contracts`)
      if (sequence === this.sequence)
        this.setState({
          datasets: contracts.datasets || [],
          apis: contracts.apis || [],
          policy: contracts.executionPolicy,
          loading: false,
          error: '',
        })
    } catch (error) {
      if (sequence === this.sequence)
        this.setState({
          error: error instanceof Error ? error.message : String(error),
          loading: false,
        })
    }
  }
  change(patch: Definition) {
    this.previewSequence++
    this.validationSequence++
    this.props.onBulkChange?.(patch)
    this.setState({
      preview: null,
      previewLoading: false,
      selectedRows: [],
      actionPreview: null,
    })
  }
  source(): Definition {
    return this.model().datasetName
      ? this.state.datasets.find(
          (item) =>
            item.name.toLowerCase() === this.model().datasetName.toLowerCase(),
        ) || {}
      : this.model().embeddedQuery || {}
  }
  fields(): Definition[] {
    return this.source().schema?.fields || []
  }
  columns(): Definition[] {
    return this.model().columns || []
  }
  projectedFields() {
    return this.fields().filter((field) =>
      this.columns().some(
        (column) => column.field.toLowerCase() === field.name.toLowerCase(),
      ),
    )
  }
  select(
    label: string,
    value: any,
    choices: string[][],
    change: (value: string) => void,
    optional = false,
  ) {
    const values = choices.map(([key]) => key)
    const selectedValue =
      values.find(
        (key) => key.toLowerCase() === String(value || '').toLowerCase(),
      ) || value
    return (
      <select
        aria-label={label}
        value={selectedValue || ''}
        onChange={(event) => change(event.target.value)}
      >
        <option value="">{optional ? '不设置' : '请选择'}</option>
        {value && !values.includes(selectedValue) && (
          <option value={value}>{value} · 已失效</option>
        )}
        {choices.map(([key, text]) => (
          <option key={key} value={key}>
            {text}
          </option>
        ))}
      </select>
    )
  }
  fieldOptions(fields = this.fields()): string[][] {
    return fields.map((field) => [
      field.name,
      `${field.title || field.name} · ${field.dataType}`,
    ])
  }
  updateColumn(index: number, patch: Definition) {
    this.change({
      columns: this.columns().map((column, position) =>
        position === index ? { ...column, ...patch } : column,
      ),
    })
  }
  queryChange(patch: Definition) {
    this.change({ embeddedQuery: { ...this.source(), ...patch } })
  }
  async validateConfiguration() {
    const sequence = ++this.validationSequence
    try {
      const result = await this.request(`${this.base()}/validate`, this.model())
      if (sequence === this.validationSequence)
        this.setState({ diagnostics: result.diagnostics, error: '' })
    } catch (error) {
      if (sequence === this.validationSequence)
        this.setState({
          error: error instanceof Error ? error.message : String(error),
        })
    }
  }
  async preview(page = 1) {
    const sequence = ++this.previewSequence
    this.setState({ previewLoading: true, previewError: '', page })
    const children = (this.model().filterConfig?.items || []).flatMap(
      (filter: Definition) => {
        const op =
          this.state.previewOperators[filter.field] || filter.ops?.[0] || 'eq'
        const value = this.state.previewFilters[filter.field] ?? ''
        const type = this.fields().find(
          (item) => item.name.toLowerCase() === filter.field.toLowerCase(),
        )?.dataType
        const node = previewFilterNode(filter.field, op, value, type)
        return node ? [node] : []
      },
    )
    try {
      const result = await this.request(`${this.base()}/preview`, {
        definition: this.model(),
        request: {
          page: {
            pageNo: page,
            pageSize: this.model().layoutConfig?.pageSize || 20,
          },
          runtimeParameters: this.state.previewParameters,
          testConnection: this.state.previewConnection,
          dynamicFilter: {
            filter: children.length ? { op: 'and', children } : null,
          },
        },
      })
      if (sequence === this.previewSequence)
        this.setState({
          preview: result,
          previewLoading: false,
          selectedRows: [],
        })
    } catch (error) {
      if (sequence === this.previewSequence)
        this.setState({
          previewError: error instanceof Error ? error.message : String(error),
          previewLoading: false,
        })
    }
  }
  async infer() {
    const query = this.source()
    try {
      const result = await this.request(
        `${this.base().replace('/composite-view', '/dataset')}/infer-schema`,
        {
          datasetName: this.model().fullName,
          datasource: query.queryDefinition?.datasource || 'default',
          sql: query.queryDefinition?.sql,
          dialects: query.queryDefinition?.dialects || [],
          parameterDefinitions: query.parameters || [],
          parameters: this.state.previewParameters,
          testConnection: this.state.previewConnection,
        },
      )
      this.queryChange({ schema: { fields: result.fields } })
      this.setState({ diagnostics: result.warnings || [], error: '' })
    } catch (error) {
      this.setState({
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
  renderSource() {
    const query = this.source()
    const embedded = !this.model().datasetName
    return (
      <div className="composite-stack">
        <div className="composite-source-choice">
          <button
            type="button"
            aria-pressed={!embedded}
            onClick={() => this.setState({ selectingDataset: true })}
          >
            引用数据集
          </button>
          <button
            type="button"
            aria-pressed={embedded}
            onClick={() =>
              this.change({
                datasetName: null,
                embeddedQuery: this.model().embeddedQuery || {
                  queryDefinition: {
                    type: 'sql',
                    datasource: 'default',
                    sql: '',
                  },
                  requiredContext: ['currentUser'],
                  parameters: [],
                  schema: { fields: [] },
                },
              })
            }
          >
            内嵌查询
          </button>
        </div>
        {!embedded ? (
          <div className="composite-source-card">
            <strong>{query.title || this.model().datasetName}</strong>
            <code>{this.model().datasetName}</code>
            <span>
              {query.isEnabled ? '已启用' : '已禁用或不存在'} ·{' '}
              {this.fields().length} 个输出字段
            </span>
            <button
              type="button"
              onClick={() => this.setState({ selectingDataset: true })}
            >
              更换数据集
            </button>
            <p>查询权限和数据范围沿用所选数据集。</p>
          </div>
        ) : (
          <>
            <label>
              数据源
              <input
                aria-label="私有查询数据源"
                value={query.queryDefinition?.datasource || 'default'}
                onChange={(event) =>
                  this.queryChange({
                    queryDefinition: {
                      ...query.queryDefinition,
                      datasource: event.target.value,
                    },
                  })
                }
              />
            </label>
            <label>SQL</label>
            {this.props.render(
              'private-sql',
              {
                type: 'script-editor',
                language: 'sql',
                height: 240,
                value: query.queryDefinition?.sql || '',
              },
              {
                value: query.queryDefinition?.sql || '',
                onChange: (sql: string) =>
                  this.queryChange({
                    queryDefinition: {
                      ...query.queryDefinition,
                      sql,
                      type: 'sql',
                    },
                  }),
              },
            )}
            <details>
              <summary>方言 SQL</summary>
              {(query.queryDefinition?.dialects || []).map(
                (dialect: Definition, index: number) => (
                  <div className="composite-stack" key={index}>
                    <label>
                      方言
                      <input
                        aria-label={`方言 ${index + 1}`}
                        value={dialect.dialectName}
                        onChange={(event) =>
                          this.queryChange({
                            queryDefinition: {
                              ...query.queryDefinition,
                              dialects: query.queryDefinition.dialects.map(
                                (item: Definition, i: number) =>
                                  i === index
                                    ? {
                                        ...item,
                                        dialectName: event.target.value,
                                      }
                                    : item,
                              ),
                            },
                          })
                        }
                      />
                    </label>
                    <textarea
                      aria-label={`方言 SQL ${index + 1}`}
                      value={dialect.sql}
                      onChange={(event) =>
                        this.queryChange({
                          queryDefinition: {
                            ...query.queryDefinition,
                            dialects: query.queryDefinition.dialects.map(
                              (item: Definition, i: number) =>
                                i === index
                                  ? { ...item, sql: event.target.value }
                                  : item,
                            ),
                          },
                        })
                      }
                    />
                    <button
                      type="button"
                      onClick={() =>
                        this.queryChange({
                          queryDefinition: {
                            ...query.queryDefinition,
                            dialects: query.queryDefinition.dialects.filter(
                              (_: Definition, i: number) => i !== index,
                            ),
                          },
                        })
                      }
                    >
                      删除方言
                    </button>
                  </div>
                ),
              )}
              <button
                type="button"
                onClick={() =>
                  this.queryChange({
                    queryDefinition: {
                      ...query.queryDefinition,
                      dialects: [
                        ...(query.queryDefinition?.dialects || []),
                        { dialectName: '', sql: '' },
                      ],
                    },
                  })
                }
              >
                添加方言
              </button>
            </details>
            <button
              type="button"
              className="composite-link"
              onClick={() => void this.infer()}
            >
              执行并推导字段
            </button>
            <fieldset>
              <legend>必需账户上下文</legend>
              {contextOptions.map(([key, label]) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={(query.requiredContext || []).includes(key)}
                    onChange={(event) =>
                      this.queryChange({
                        requiredContext: event.target.checked
                          ? [...(query.requiredContext || []), key]
                          : query.requiredContext.filter(
                              (name: string) => name !== key,
                            ),
                      })
                    }
                  />
                  {label}
                </label>
              ))}
            </fieldset>
            <details open>
              <summary>参数与账户上下文</summary>
              {this.renderParameters()}
            </details>
            <details>
              <summary>输出字段</summary>
              {this.renderSchema()}
            </details>
            {this.props.render(
              'private-policy',
              {
                type: 'statistics-execution-policy',
                appName: this.props.appName,
                value: query.executionConstraints || {},
              },
              {
                value: query.executionConstraints || {},
                onChange: (value: Definition) =>
                  this.queryChange({ executionConstraints: value }),
              },
            )}
          </>
        )}
        <details>
          <summary>字段与能力</summary>
          <table>
            <thead>
              <tr>
                <th>字段</th>
                <th>类型</th>
                <th>筛选</th>
                <th>排序</th>
              </tr>
            </thead>
            <tbody>
              {this.fields().map((field) => (
                <tr key={field.name}>
                  <td>
                    {field.title || field.name}
                    <code>{field.name}</code>
                  </td>
                  <td>{field.dataType}</td>
                  <td>{field.filterable ? '支持' : '关闭'}</td>
                  <td>{field.sortable ? '支持' : '关闭'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </div>
    )
  }
  renderParameters() {
    const parameters = this.source().parameters || []
    const update = (index: number, patch: Definition) =>
      this.queryChange({
        parameters: parameters.map((item: Definition, i: number) =>
          i === index ? { ...item, ...patch } : item,
        ),
      })
    return (
      <div className="composite-stack">
        {parameters.map((parameter: Definition, index: number) => (
          <div className="composite-card" key={index}>
            <label>
              名称
              <input
                aria-label={`参数名称 ${index + 1}`}
                value={parameter.name}
                onChange={(event) =>
                  update(index, { name: event.target.value })
                }
              />
            </label>
            <label>
              类型
              {this.select(
                `参数类型 ${index + 1}`,
                parameter.type,
                ['string', 'number', 'boolean', 'date', 'datetime'].map(
                  (type) => [type, type],
                ),
                (type) => update(index, { type }),
              )}
            </label>
            <label>
              值来源
              {this.select(
                `参数值来源 ${index + 1}`,
                parameter.valueSource || 'request',
                [
                  ['request', '用户输入'],
                  ['systemContext', '账户上下文'],
                ],
                (valueSource) =>
                  update(index, {
                    valueSource,
                    systemContextBinding:
                      valueSource === 'systemContext' ? 'departmentId' : null,
                  }),
              )}
            </label>
            {parameter.valueSource === 'systemContext' &&
              this.select(
                `参数上下文 ${index + 1}`,
                parameter.systemContextBinding,
                contextOptions,
                (systemContextBinding) =>
                  update(index, { systemContextBinding }),
              )}
            <label>
              <input
                type="checkbox"
                checked={!!parameter.required}
                onChange={(event) =>
                  update(index, { required: event.target.checked })
                }
              />
              必填
            </label>
            <button
              type="button"
              onClick={() =>
                this.queryChange({
                  parameters: parameters.filter(
                    (_: Definition, i: number) => i !== index,
                  ),
                })
              }
            >
              移除参数
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            this.queryChange({
              parameters: [
                ...parameters,
                { name: '', type: 'string', valueSource: 'request' },
              ],
            })
          }
        >
          添加参数
        </button>
      </div>
    )
  }
  renderSchema() {
    const fields = this.fields()
    const update = (index: number, patch: Definition) =>
      this.queryChange({
        schema: {
          fields: fields.map((field, i) =>
            i === index ? { ...field, ...patch } : field,
          ),
        },
      })
    return (
      <div className="composite-stack">
        {fields.map((field, index) => (
          <div className="composite-card" key={index}>
            <label>
              字段名
              <input
                aria-label={`输出字段名 ${index + 1}`}
                value={field.name}
                onChange={(event) =>
                  update(index, { name: event.target.value })
                }
              />
            </label>
            <label>
              标题
              <input
                aria-label={`输出字段标题 ${index + 1}`}
                value={field.title || ''}
                onChange={(event) =>
                  update(index, { title: event.target.value })
                }
              />
            </label>
            {this.select(
              `输出字段类型 ${index + 1}`,
              field.dataType,
              [
                'string',
                'integer',
                'number',
                'boolean',
                'date',
                'datetime',
              ].map((type) => [type, type]),
              (dataType) => update(index, { dataType }),
            )}
            {['nullable', 'filterable', 'sortable', 'exportable'].map(
              (key, i) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={!!field[key]}
                    onChange={(event) =>
                      update(index, { [key]: event.target.checked })
                    }
                  />
                  {['允许空值', '可筛选', '可排序', '可导出'][i]}
                </label>
              ),
            )}
            <button
              type="button"
              onClick={() =>
                this.queryChange({
                  schema: { fields: fields.filter((_, i) => i !== index) },
                })
              }
            >
              移除字段
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            this.queryChange({
              schema: {
                fields: [
                  ...fields,
                  {
                    name: '',
                    title: '',
                    dataType: 'string',
                    semanticRole: 'dimension',
                    nullable: true,
                    filterable: true,
                    sortable: true,
                    exportable: true,
                  },
                ],
              },
            })
          }
        >
          添加输出字段
        </button>
      </div>
    )
  }
  renderColumns() {
    const columns = this.columns()
    return (
      <>
        <div className="composite-table-scroll">
          <table>
            <thead>
              <tr>
                <th>字段</th>
                <th>显示名</th>
                <th>格式</th>
                <th>宽度</th>
                <th>顺序</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {columns.map((column, index) => (
                <tr key={index}>
                  <td>
                    {this.select(
                      `列字段 ${index + 1}`,
                      column.field,
                      this.fieldOptions(),
                      (field) =>
                        this.updateColumn(index, {
                          field,
                          title:
                            this.fields().find((item) => item.name === field)
                              ?.title || field,
                        }),
                    )}
                  </td>
                  <td>
                    <input
                      aria-label={`显示名 ${index + 1}`}
                      value={column.title || ''}
                      onChange={(event) =>
                        this.updateColumn(index, { title: event.target.value })
                      }
                    />
                  </td>
                  <td>
                    {this.select(
                      `列格式 ${index + 1}`,
                      column.format || 'text',
                      [
                        ['text', '文本'],
                        ['number', '数值'],
                        ['currency', '金额'],
                        ['percent', '百分比'],
                        ['date', '日期'],
                        ['datetime', '日期时间'],
                        ['boolean', '状态'],
                      ],
                      (format) => this.updateColumn(index, { format }),
                    )}
                  </td>
                  <td>
                    <input
                      type="number"
                      min="1"
                      aria-label={`列宽 ${index + 1}`}
                      value={column.width || 160}
                      onChange={(event) =>
                        this.updateColumn(index, {
                          width: Number(event.target.value),
                        })
                      }
                    />
                  </td>
                  <td>
                    {[-1, 1].map((offset) => (
                      <button
                        type="button"
                        key={offset}
                        disabled={
                          index + offset < 0 || index + offset >= columns.length
                        }
                        aria-label={`${offset < 0 ? '上移' : '下移'}第 ${index + 1} 列`}
                        onClick={() => {
                          const next = [...columns]
                          ;[next[index], next[index + offset]] = [
                            next[index + offset],
                            next[index],
                          ]
                          this.change({ columns: next })
                        }}
                      >
                        {offset < 0 ? '↑' : '↓'}
                      </button>
                    ))}
                  </td>
                  <td>
                    <button
                      type="button"
                      aria-label={`移除第 ${index + 1} 列`}
                      onClick={() =>
                        this.change({
                          columns: columns.filter((_, i) => i !== index),
                        })
                      }
                    >
                      移除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          onClick={() =>
            this.change({
              columns: [
                ...columns,
                { field: '', title: '', format: 'text', width: 160 },
              ],
            })
          }
        >
          添加显示列
        </button>
      </>
    )
  }
  renderFilters() {
    const filters = this.model().filterConfig?.items || []
    const update = (items: Definition[]) =>
      this.change({ filterConfig: { ...this.model().filterConfig, items } })
    return (
      <div className="composite-stack">
        {filters.map((filter: Definition, index: number) => (
          <div className="composite-card" key={index}>
            <label>
              筛选字段
              {this.select(
                `筛选字段 ${index + 1}`,
                filter.field,
                this.fieldOptions(
                  this.fields().filter((item) => item.filterable),
                ),
                (field) =>
                  update(
                    filters.map((item: Definition, i: number) =>
                      i === index ? { ...item, field } : item,
                    ),
                  ),
              )}
            </label>
            <label>
              允许操作符
              <select
                multiple
                aria-label={`允许操作符 ${index + 1}`}
                value={filter.ops || []}
                onChange={(event) =>
                  update(
                    filters.map((item: Definition, i: number) =>
                      i === index
                        ? {
                            ...item,
                            ops: Array.from(
                              event.target.selectedOptions,
                              (option) => option.value,
                            ),
                          }
                        : item,
                    ),
                  )
                }
              >
                {operators.map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              输入控件
              {this.select(
                `输入控件 ${index + 1}`,
                filter.widget,
                [
                  ['input', '文本'],
                  ['number', '数字'],
                  ['date', '日期'],
                  ['datetime', '日期时间'],
                  ['select', '下拉选择'],
                  ['multiSelect', '多选'],
                  ['switch', '开关'],
                ],
                (widget) =>
                  update(
                    filters.map((item: Definition, i: number) =>
                      i === index ? { ...item, widget } : item,
                    ),
                  ),
              )}
            </label>
            <button
              type="button"
              onClick={() =>
                update(
                  filters.filter((_: Definition, i: number) => i !== index),
                )
              }
            >
              移除筛选
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            update([...filters, { field: '', ops: ['eq'], widget: 'input' }])
          }
        >
          添加筛选条件
        </button>
      </div>
    )
  }
  renderActions() {
    const actions = this.model().actionButtons || []
    return (
      <div className="composite-stack">
        {actions.map((action: Definition, index: number) => (
          <div className="composite-card" key={index}>
            <strong>{action.label || '新操作'}</strong>
            <span>{action.scope === 'batch' ? '批量操作' : '行操作'}</span>
            <code>{action.apiRef || '尚未选择接口'}</code>
            <button
              type="button"
              onClick={() => this.setState({ action: index, apiSearch: '' })}
            >
              配置操作与映射
            </button>
            <button
              type="button"
              onClick={() =>
                this.change({
                  actionButtons: actions.filter(
                    (_: Definition, i: number) => i !== index,
                  ),
                })
              }
            >
              移除操作
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => {
            this.change({
              actionButtons: [
                ...actions,
                {
                  label: '新操作',
                  scope: 'row',
                  apiRef: '',
                  contextBinding: {},
                },
              ],
            })
            this.setState({ action: actions.length })
          }}
        >
          添加操作按钮
        </button>
      </div>
    )
  }
  renderMapping() {
    const index = this.state.action
    const actions = this.model().actionButtons || []
    const action = index == null ? null : actions[index]
    if (!action) return null
    const update = (patch: Definition) =>
      this.change({
        actionButtons: actions.map((item: Definition, i: number) =>
          i === index ? { ...item, ...patch } : item,
        ),
      })
    const api = this.state.apis.find(
      (item) =>
        (item.operationId || `${item.method} ${item.path}`) === action.apiRef ||
        `${item.method} ${item.path}` === action.apiRef,
    )
    const targets = apiTargets(api, action.contextBinding || {})
    return (
      <div className="composite-modal-backdrop">
        <section
          className="composite-mapping"
          role="dialog"
          aria-modal="true"
          aria-label="操作与参数映射"
        >
          <header>
            <h3>操作与参数映射</h3>
            <button
              type="button"
              aria-label="关闭参数映射"
              onClick={() => this.setState({ action: null })}
            >
              ×
            </button>
          </header>
          <div className="composite-stack">
            <label>
              按钮文案
              <input
                aria-label="按钮文案"
                value={action.label}
                onChange={(event) => update({ label: event.target.value })}
              />
            </label>
            <label>
              操作范围
              {this.select(
                '操作范围',
                action.scope,
                [
                  ['row', '当前行'],
                  ['batch', '批量选择'],
                ],
                (scope) => update({ scope }),
              )}
            </label>
            <label>
              搜索接口
              <input
                aria-label="搜索接口"
                value={this.state.apiSearch}
                onChange={(event) =>
                  this.setState({ apiSearch: event.target.value })
                }
              />
            </label>
            <label>
              接口
              {this.select(
                '操作接口',
                action.apiRef,
                this.state.apis
                  .filter((item) =>
                    `${item.operationId} ${item.path} ${item.summary}`
                      .toLowerCase()
                      .includes(this.state.apiSearch.toLowerCase()),
                  )
                  .map((item) => [
                    item.operationId || `${item.method} ${item.path}`,
                    `${item.summary || item.operationId || ''} · ${item.method} ${item.path}`,
                  ]),
                (apiRef) => update({ apiRef, contextBinding: {} }),
              )}
            </label>
            {api && (
              <>
                <code>
                  {api.method} {api.path}
                </code>
                <div className="composite-table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>目标参数</th>
                        <th>类型</th>
                        <th>来源</th>
                        <th>状态</th>
                      </tr>
                    </thead>
                    <tbody>
                      {targets.map((target) => {
                        const source =
                          action.contextBinding?.[target.name] || ''
                        const problem = bindingProblem(
                          target,
                          source,
                          action.scope,
                          this.projectedFields(),
                        )
                        return (
                          <tr key={target.name}>
                            <td>
                              {target.name}
                              {target.required ? ' *' : ''}
                            </td>
                            <td>
                              {target.schema?.type}
                              {target.schema?.type === 'array'
                                ? `＜${target.schema.items?.type || '?'}＞`
                                : ''}
                            </td>
                            <td>
                              {this.select(
                                `映射来源 ${target.name}`,
                                source.replace(/^\$\{|}$/g, ''),
                                [
                                  ...this.fieldOptions(this.projectedFields()),
                                  ...(action.scope === 'batch'
                                    ? [['selectedItems', '完整选中记录']]
                                    : []),
                                ],
                                (value) => {
                                  const bindings = { ...action.contextBinding }
                                  if (value) bindings[target.name] = value
                                  else delete bindings[target.name]
                                  update({ contextBinding: bindings })
                                },
                                true,
                              )}
                            </td>
                            <td className={problem ? 'composite-error' : ''}>
                              {problem || (source ? '通过' : '可选')}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            <button
              type="button"
              className="composite-primary"
              onClick={() => {
                this.setState({ action: null })
                void this.validateConfiguration()
              }}
            >
              完成配置
            </button>
          </div>
        </section>
      </div>
    )
  }
  renderLayout() {
    const layout = this.model().layoutConfig || {
      pageSize: 20,
      defaultSort: [],
    }
    const update = (patch: Definition) =>
      this.change({ layoutConfig: { ...layout, ...patch } })
    return (
      <div className="composite-stack">
        <label>
          每页条数
          <input
            type="number"
            aria-label="每页条数"
            min="1"
            max={this.state.policy?.maxPageSize}
            value={layout.pageSize || ''}
            onChange={(event) =>
              update({ pageSize: Number(event.target.value) })
            }
          />
        </label>
        {this.state.policy && (
          <p>
            平台每页最多 {this.state.policy.maxPageSize.toLocaleString()}{' '}
            行，数据集限制可能进一步收紧。
          </p>
        )}
        {(layout.defaultSort || []).map((sort: Definition, index: number) => (
          <div className="composite-card" key={index}>
            {this.select(
              `默认排序字段 ${index + 1}`,
              sort.field,
              this.fieldOptions(
                this.fields().filter(
                  (item) =>
                    item.sortable &&
                    this.columns().some((column) => column.field === item.name),
                ),
              ),
              (field) =>
                update({
                  defaultSort: layout.defaultSort.map(
                    (item: Definition, i: number) =>
                      i === index ? { ...item, field } : item,
                  ),
                }),
            )}
            {this.select(
              `默认排序方向 ${index + 1}`,
              sort.direction,
              [
                ['asc', '升序'],
                ['desc', '降序'],
              ],
              (direction) =>
                update({
                  defaultSort: layout.defaultSort.map(
                    (item: Definition, i: number) =>
                      i === index ? { ...item, direction } : item,
                  ),
                }),
            )}
            <button
              type="button"
              onClick={() =>
                update({
                  defaultSort: layout.defaultSort.filter(
                    (_: Definition, i: number) => i !== index,
                  ),
                })
              }
            >
              移除排序
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            update({
              defaultSort: [
                ...(layout.defaultSort || []),
                { field: '', direction: 'asc' },
              ],
            })
          }
        >
          添加默认排序
        </button>
      </div>
    )
  }
  previewAction(action: Definition, rows: Definition[]) {
    const values = Object.fromEntries(
      Object.entries(action.contextBinding || {}).map(([target, source]) => {
        const field = String(source).replace(/^\$\{|}$/g, '')
        const get = (row: Definition) =>
          row[
            Object.keys(row).find(
              (key) => key.toLowerCase() === field.toLowerCase(),
            ) || field
          ]
        return [
          target,
          field === 'selectedItems'
            ? rows
            : action.scope === 'batch'
              ? rows.map(get)
              : get(rows[0]),
        ]
      }),
    )
    this.setState({
      actionPreview: { label: action.label, apiRef: action.apiRef, values },
    })
  }

  renderPreview() {
    const { preview, previewLoading, previewError, page } = this.state
    const pageSize = this.model().layoutConfig?.pageSize || 20
    const total = preview?.pageInfo?.total || 0
    return (
      <section className="composite-preview">
        <header>
          <h3>运行页面预览</h3>
          <button
            type="button"
            disabled={previewLoading}
            onClick={() => void this.preview()}
          >
            刷新预览
          </button>
        </header>
        <details>
          <summary>预览连接</summary>
          <div className="composite-stack">
            {this.select(
              '预览连接方式',
              this.state.previewConnection?.kind || 'application',
              [
                ['application', '使用已保存连接或应用默认连接'],
                ['platform', '平台连接'],
                ['runtime', '应用运行容器'],
              ],
              (kind) =>
                this.setState({
                  previewConnection: kind === 'application' ? null : { kind },
                }),
            )}
            {this.state.previewConnection?.kind === 'platform' && (
              <>
                {this.props.render(
                  'preview-platform-connection',
                  {
                    type: 'select',
                    label: '平台连接',
                    source: this.base().replace(
                      '/composite-view',
                      '/dataset/test-connections/platform',
                    ),
                  },
                  {
                    value:
                      this.state.previewConnection.platformDataSourceName || '',
                    onChange: (platformDataSourceName: string) =>
                      this.setState({
                        previewConnection: {
                          kind: 'platform',
                          platformDataSourceName,
                        },
                      }),
                  },
                )}
                {this.state.previewConnection.platformDataSourceName &&
                  this.props.render(
                    'preview-connection-environment',
                    {
                      type: 'select',
                      label: '连接环境',
                      source:
                        this.base().replace(
                          '/composite-view',
                          '/dataset/test-connections/platform/',
                        ) +
                        encodeURIComponent(
                          this.state.previewConnection.platformDataSourceName,
                        ) +
                        '/environments',
                    },
                    {
                      value: this.state.previewConnection.envName || '',
                      onChange: (envName: string) =>
                        this.setState({
                          previewConnection: {
                            ...this.state.previewConnection,
                            envName,
                          },
                        }),
                    },
                  )}
              </>
            )}
            {this.state.previewConnection?.kind === 'runtime' &&
              this.props.render(
                'preview-runtime-connection',
                {
                  type: 'select',
                  label: '运行容器',
                  source: this.base().replace(
                    '/composite-view',
                    '/dataset/test-connections/runtime',
                  ),
                },
                {
                  value: this.state.previewConnection.runtimeId || '',
                  onChange: (runtimeId: string) =>
                    this.setState({
                      previewConnection: { kind: 'runtime', runtimeId },
                    }),
                },
              )}
          </div>
        </details>
        <div className="composite-preview-inputs">
          {(this.source().parameters || [])
            .filter((item: Definition) => item.valueSource !== 'systemContext')
            .map((item: Definition) => (
              <label key={item.name}>
                {item.title || item.name}
                <input
                  aria-label={`预览参数 ${item.name}`}
                  value={this.state.previewParameters[item.name] || ''}
                  onChange={(event) =>
                    this.setState({
                      previewParameters: {
                        ...this.state.previewParameters,
                        [item.name]: event.target.value,
                      },
                    })
                  }
                />
              </label>
            ))}
          {(this.model().filterConfig?.items || []).map((item: Definition) => {
            const op =
              this.state.previewOperators[item.field] || item.ops?.[0] || 'eq'
            return (
              <label key={item.field}>
                {this.fields().find((field) => field.name === item.field)
                  ?.title || item.field}
                {this.select(
                  `预览操作符 ${item.field}`,
                  op,
                  operators.filter(([key]) => item.ops?.includes(key)),
                  (value) =>
                    this.setState({
                      previewOperators: {
                        ...this.state.previewOperators,
                        [item.field]: value,
                      },
                    }),
                )}
                {!['isNull', 'isNotNull'].includes(op) && (
                  <input
                    aria-label={`预览筛选 ${item.field}`}
                    placeholder={
                      ['in', 'notIn'].includes(op) ? '多个值以逗号分隔' : ''
                    }
                    value={this.state.previewFilters[item.field] ?? ''}
                    onChange={(event) =>
                      this.setState({
                        previewFilters: {
                          ...this.state.previewFilters,
                          [item.field]: event.target.value,
                        },
                      })
                    }
                  />
                )}
              </label>
            )
          })}
        </div>
        {previewLoading && <p role="status">查询中…</p>}
        {previewError && (
          <div role="alert" className="composite-error">
            {previewError}
            <button type="button" onClick={() => void this.preview(page)}>
              重试
            </button>
          </div>
        )}
        {!preview && !previewLoading && !previewError && (
          <p>完成配置后刷新预览。</p>
        )}
        {preview && (
          <>
            <div className="composite-preview-actions">
              {(this.model().actionButtons || [])
                .filter((action: Definition) => action.scope === 'batch')
                .map((action: Definition, index: number) => (
                  <button
                    type="button"
                    key={index}
                    disabled={!this.state.selectedRows.length}
                    onClick={() =>
                      this.previewAction(
                        action,
                        this.state.selectedRows.map(
                          (index) => preview.rows[index],
                        ),
                      )
                    }
                  >
                    {action.label}
                  </button>
                ))}
            </div>
            <div className="composite-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>选择</th>
                    {this.columns().map((column) => (
                      <th key={column.field}>{column.title}</th>
                    ))}
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {(preview.rows || []).map(
                    (row: Definition, index: number) => (
                      <tr key={index}>
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`选择预览第 ${index + 1} 行`}
                            checked={this.state.selectedRows.includes(index)}
                            onChange={(event) =>
                              this.setState({
                                selectedRows: event.target.checked
                                  ? [...this.state.selectedRows, index]
                                  : this.state.selectedRows.filter(
                                      (row) => row !== index,
                                    ),
                              })
                            }
                          />
                        </td>
                        {this.columns().map((column) => (
                          <td key={column.field}>
                            {String(row[column.field] ?? '')}
                          </td>
                        ))}
                        <td>
                          {(this.model().actionButtons || [])
                            .filter(
                              (action: Definition) => action.scope !== 'batch',
                            )
                            .map((action: Definition, i: number) => (
                              <button
                                type="button"
                                key={i}
                                onClick={() =>
                                  this.previewAction(action, [row])
                                }
                              >
                                {action.label}
                              </button>
                            ))}
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
            <footer>
              <span>
                共 {total} 条，第 {page} 页
              </span>
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => void this.preview(page - 1)}
              >
                上一页
              </button>
              <button
                type="button"
                disabled={page * pageSize >= total}
                onClick={() => void this.preview(page + 1)}
              >
                下一页
              </button>
            </footer>
          </>
        )}
        {this.state.actionPreview && (
          <div className="composite-modal-backdrop">
            <section
              className="composite-mapping"
              role="dialog"
              aria-modal="true"
              aria-label="操作参数预览"
            >
              <header>
                <h3>{this.state.actionPreview.label} · 参数预览</h3>
                <button
                  type="button"
                  onClick={() => this.setState({ actionPreview: null })}
                >
                  关闭参数预览
                </button>
              </header>
              <code>{this.state.actionPreview.apiRef}</code>
              <pre>
                {JSON.stringify(this.state.actionPreview.values, null, 2)}
              </pre>
            </section>
          </div>
        )}
      </section>
    )
  }
  focusDiagnostic(message: string) {
    const match = message.match(
      /(columns|filterConfig\.items|actionButtons|layoutConfig\.defaultSort)\[(\d+)\]/,
    )
    const section = message.includes('actionButtons')
      ? 'actions'
      : message.includes('filterConfig')
        ? 'filters'
        : message.includes('layoutConfig')
          ? 'layout'
          : message.includes('columns')
            ? 'columns'
            : 'source'
    const labels: Record<string, string> = {
      columns: '列字段',
      'filterConfig.items': '筛选字段',
      'layoutConfig.defaultSort': '默认排序字段',
    }
    this.setState(
      {
        section,
        ...(match?.[1] === 'actionButtons' ? { action: Number(match[2]) } : {}),
      },
      () => {
        const label =
          match && labels[match[1]]
            ? `${labels[match[1]]} ${Number(match[2]) + 1}`
            : section === 'actions'
              ? '操作接口'
              : ''
        const input = label
          ? this.editorElement.current?.querySelector<HTMLElement>(
              `[aria-label="${label}"]`,
            )
          : null
        input?.focus()
        input?.scrollIntoView({ block: 'nearest' })
      },
    )
  }

  render() {
    const { section, error, diagnostics, selectingDataset, datasetSearch } =
      this.state
    const panels: Record<string, () => React.ReactNode> = {
      source: () => this.renderSource(),
      columns: () => this.renderColumns(),
      filters: () => this.renderFilters(),
      actions: () => this.renderActions(),
      layout: () => this.renderLayout(),
    }
    return (
      <div
        className="composite-view-editor"
        ref={this.editorElement}
        onKeyDown={(event) => {
          if (
            event.key === 'Escape' &&
            (this.state.selectingDataset ||
              this.state.action != null ||
              this.state.actionPreview)
          ) {
            event.stopPropagation()
            this.setState({
              selectingDataset: false,
              action: null,
              actionPreview: null,
            })
          }
        }}
      >
        {error && (
          <div role="alert" className="composite-error">
            {error}
            <button type="button" onClick={() => void this.load()}>
              重试读取
            </button>
          </div>
        )}
        {this.state.loading && <p role="status">正在读取数据与接口合同…</p>}
        <div className="composite-workspace">
          <nav aria-label="综合查询配置">
            {sections.map(([key, label]) => (
              <button
                type="button"
                key={key}
                aria-current={section === key ? 'page' : undefined}
                onClick={() => this.setState({ section: key })}
              >
                {label}
              </button>
            ))}
          </nav>
          <section className="composite-configuration">
            <details>
              <summary>基本信息</summary>
              <label>
                标题
                <input
                  aria-label="综合查询标题"
                  value={this.model().title || ''}
                  onChange={(event) =>
                    this.change({ title: event.target.value })
                  }
                />
              </label>
              <label>
                描述
                <textarea
                  aria-label="综合查询描述"
                  value={this.model().description || ''}
                  onChange={(event) =>
                    this.change({ description: event.target.value })
                  }
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={!!this.model().isEnabled}
                  onChange={(event) =>
                    this.change({ isEnabled: event.target.checked })
                  }
                />
                启用综合查询
              </label>
            </details>
            <header>
              <h3>{sections.find(([key]) => key === section)?.[1]}</h3>
              <button
                type="button"
                onClick={() => void this.validateConfiguration()}
              >
                校验配置
              </button>
            </header>
            {!!diagnostics.length && (
              <div role="alert" className="composite-diagnostics">
                {diagnostics.map((message, index) => (
                  <button
                    type="button"
                    key={index}
                    onClick={() => this.focusDiagnostic(message)}
                  >
                    {message}
                  </button>
                ))}
              </div>
            )}
            {panels[section]()}
          </section>
          {this.renderPreview()}
        </div>
        {selectingDataset && (
          <div className="composite-modal-backdrop">
            <section
              className="composite-picker"
              role="dialog"
              aria-modal="true"
              aria-label="选择数据集"
            >
              <header>
                <h3>选择数据集</h3>
                <button
                  type="button"
                  aria-label="关闭数据集选择"
                  onClick={() => this.setState({ selectingDataset: false })}
                >
                  ×
                </button>
              </header>
              <input
                type="search"
                aria-label="搜索数据集"
                placeholder="搜索名称或标题"
                value={datasetSearch}
                onChange={(event) =>
                  this.setState({ datasetSearch: event.target.value })
                }
              />
              {this.state.datasets
                .filter((item) =>
                  `${item.name} ${item.title}`
                    .toLowerCase()
                    .includes(datasetSearch.toLowerCase()),
                )
                .map((item) => (
                  <button
                    type="button"
                    className="composite-dataset-option"
                    key={item.name}
                    onClick={() => {
                      this.change({
                        datasetName: item.name,
                        embeddedQuery: null,
                      })
                      this.setState({
                        selectingDataset: false,
                        diagnostics: [
                          '数据来源已切换，请校验列、筛选、排序和操作映射。',
                        ],
                      })
                    }}
                  >
                    <strong>{item.title || item.name}</strong>
                    <code>{item.name}</code>
                    <span>
                      {item.isEnabled ? '已启用' : '已禁用'} ·{' '}
                      {item.schema?.fields?.length || 0} 个字段
                    </span>
                  </button>
                ))}
              {!this.state.datasets.length && (
                <p>暂无数据集，请先创建数据集或配置内嵌查询。</p>
              )}
            </section>
          </div>
        )}
        {this.renderMapping()}
      </div>
    )
  }
}
FormItem({
  type: 'composite-view-editor',
  autoVar: true,
  detectProps: ['data'],
})(CompositeViewEditor)
