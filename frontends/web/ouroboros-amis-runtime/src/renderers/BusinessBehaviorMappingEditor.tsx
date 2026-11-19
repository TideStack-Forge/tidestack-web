import React from 'react'
import Button from 'amis-ui/lib/components/Button'
import InputBox from 'amis-ui/lib/components/InputBox'
import Textarea from 'amis-ui/lib/components/Textarea'
import { isEqual } from 'lodash'
import { renderBusinessBehaviorControl } from './BusinessBehaviorControl'
import type { FormControlProps } from 'amis'
import JsonDataEditorControl from './JsonDataEditor'

type Mapping = Record<string, unknown>
type Row = {
  id: number
  target: string
  value: unknown
  kind: 'field' | 'literal' | 'expression' | 'tree'
}
type Props = FormControlProps & {
  partitioned?: boolean
  eventSubject?: string
  eventSchema?: Mapping
  targetSchema?: Mapping
}
type State = { rows: Row[]; error: string; advanced: boolean }

const object = (value: unknown): value is Mapping =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

/** A view of the existing target-path/EL mapping, never an expression evaluator. */
export class BusinessBehaviorMappingEditor extends React.Component<Props, State> {
  private nextRowId = 0
  private literalEditors = new Map<number, LiteralMappingValue>()
  private treeEditors = new Map<number, JsonDataEditorControl>()
  state: State = { rows: this.rows(this.props.value), error: '', advanced: false }
  private emitted: unknown = this.props.value
  private jsonEditor: JsonDataEditorControl | null = null

  componentDidUpdate(previous: Props) {
    if (previous.value !== this.props.value && !isEqual(this.props.value, this.emitted)) {
      this.emitted = this.props.value
      this.setState({ rows: this.rows(this.props.value), error: '' })
    }
  }

  private rows(value: unknown): Row[] {
    const containsExpressionValue = (value: unknown): boolean =>
      typeof value === 'string' ||
      (Array.isArray(value)
        ? value.some(containsExpressionValue)
        : object(value) && Object.values(value).some(containsExpressionValue))
    return object(value)
      ? Object.entries(value).map(([target, value]) => ({
          id: this.nextRowId++,
          target,
          value,
          kind:
            typeof value === 'string'
              ? 'expression'
              : containsExpressionValue(value)
                ? 'tree'
                : 'literal',
        }))
      : []
  }

  private representable() {
    return (
      this.props.value === undefined ||
      (object(this.props.value) &&
        Object.keys(this.props.value).every(
          (key) => !this.props.partitioned || /^(params|data)(\.|$)/.test(key)
        ))
    )
  }

  validate() {
    if (this.state.advanced || !this.representable())
      return this.jsonEditor?.validate() || ''
    const literalError = this.state.rows
      .map(
        (row) =>
          this.literalEditors.get(row.id)?.validate() ||
          this.treeEditors.get(row.id)?.validate()
      )
      .find(Boolean)
    if (literalError) return literalError
    const targets = this.state.rows.map((row) => row.target)
    for (const target of targets) {
      if (!target || target.split('.').some((part) => !part.trim()))
        return '请填写完整的目标字段路径。'
      if (
        target
          .split('.')
          .some((part) => ['__proto__', 'prototype', 'constructor'].includes(part))
      )
        return '目标字段包含不支持的名称。'
      if (
        targets.filter((other) => other === target).length > 1 ||
        targets.some((other) => other !== target && target.startsWith(`${other}.`))
      )
        return `目标字段冲突：${target}`
    }
    return ''
  }

  private emit(rows: Row[]) {
    this.setState({ rows, error: '' }, () => {
      const error = this.validate()
      this.props.onInputStateChange?.(error)
      if (error) {
        this.setState({ error })
        return
      }
      const mapping = Object.fromEntries(rows.map(({ target, value }) => [target, value]))
      this.emitted = mapping
      this.props.onChange(mapping)
    })
  }

  update(index: number, patch: Partial<Row>) {
    this.emit(
      this.state.rows.map((row, position) =>
        position === index ? { ...row, ...patch } : row
      )
    )
  }

  async setMode(partition: string, mode: string) {
    const snapshot = this.state.rows
    const existing = this.state.rows.filter(
      (row) => row.target === partition || row.target.startsWith(`${partition}.`)
    )
    if (
      existing.length &&
      !(await this.props.env.confirm('切换传入方式将替换本分区的映射，是否继续？'))
    )
      return false
    if (snapshot !== this.state.rows) return false
    const rest = this.state.rows.filter((row) => !existing.includes(row))
    const rows: Row[] =
      mode === 'none'
        ? []
        : mode === 'whole'
          ? [
              {
                id: this.nextRowId++,
                target: partition,
                value: '${ event.payload }',
                kind: 'expression',
              },
            ]
          : [
              {
                id: this.nextRowId++,
                target: `${partition}.`,
                value: '${ event.payload }',
                kind: 'expression',
              },
            ]
    this.emit([...rest, ...rows])
    return true
  }

  private fieldOptions() {
    const fields = [
      ...(this.props.eventSubject !== 'model' ? ['event.subject.id'] : []),
      'event.subject.modelFullName',
      'event.eventId',
      'event.occurredAt',
      'event.payload',
    ]
    const visit = (schema: Mapping | undefined, prefix: string) => {
      if (!object(schema?.properties)) return
      Object.entries(schema.properties).forEach(([key, value]) => {
        // Non-identifier field names remain available through the official EL editor.
        if (!/^[A-Za-z_$][\w$]*$/.test(key)) return
        fields.push(`${prefix}.${key}`)
        if (object(value)) visit(value, `${prefix}.${key}`)
      })
    }
    visit(this.props.eventSchema, 'event.payload')
    return fields.map((value) => ({ label: value, value: '${ ' + value + ' }' }))
  }

  private control(
    region: string,
    schema: Mapping & { type: string },
    value: unknown,
    onChange: (value: any) => void
  ) {
    return renderBusinessBehaviorControl(
      this.props.render,
      region,
      { label: false, ...schema },
      {
        value,
        onChange,
        disabled: this.props.disabled || this.props.static,
      }
    )
  }

  private targetFields(partition: string) {
    const fields: { path: string; title: string; required: boolean; type: string }[] = []
    const visit = (schema: unknown, prefix: string) => {
      if (!object(schema) || !object(schema.properties)) return
      Object.entries(schema.properties).forEach(([key, child]) => {
        if (!object(child)) return
        const path = prefix ? `${prefix}.${key}` : key
        fields.push({
          path,
          title: typeof child.title === 'string' ? child.title : path,
          required: Array.isArray(schema.required) && schema.required.includes(key),
          type: typeof child.type === 'string' ? child.type : '未限定',
        })
        visit(child, path)
      })
    }
    const properties = this.props.targetSchema?.properties
    if (object(properties)) visit(properties[partition], '')
    return fields
  }

  private row(row: Row, index: number, partition?: string) {
    const label = partition ? row.target.slice(partition.length + 1) : row.target
    const whole = row.target === partition
    return (
      <div className="BusinessBehaviorMapping-row" key={row.id}>
        {whole ? (
          <strong>{partition}</strong>
        ) : (
          <label>
            <span>目标字段</span>
            <InputBox
              aria-label={`目标字段 ${index + 1}`}
              list={partition ? `mapping-target-${row.id}` : undefined}
              value={label}
              disabled={this.props.disabled}
              onChange={(value: string) =>
                this.update(index, {
                  target: partition ? `${partition}.${value}` : value,
                })
              }
            />
            {partition ? (
              <datalist id={`mapping-target-${row.id}`}>
                {this.targetFields(partition).map((field) => (
                  <option key={field.path} value={field.path}>
                    {field.title} · {field.type}
                    {field.required ? ' · 必填' : ''}
                  </option>
                ))}
              </datalist>
            ) : null}
            <small>{row.target}</small>
          </label>
        )}
        <div>
          <span>取值方式</span>
          {this.control(
            `kind-${index}`,
            {
              type: 'button-group-select',
              options: [
                ...(this.props.partitioned
                  ? [{ label: '事件字段', value: 'field' }]
                  : []),
                { label: '固定值', value: 'literal' },
                { label: '表达式', value: 'expression' },
                ...(row.kind === 'tree' ? [{ label: '嵌套映射', value: 'tree' }] : []),
              ],
            },
            row.kind,
            (kind: Row['kind']) =>
              this.setState(
                {
                  rows: this.state.rows.map((item, position) =>
                    position === index ? { ...item, kind } : item
                  ),
                  error: '',
                },
                () => this.props.onInputStateChange?.(this.validate())
              )
          )}
        </div>
        <div>
          <span>值</span>
          {row.kind === 'field' ? (
            this.control(
              `field-${index}`,
              { type: 'select', searchable: true, options: this.fieldOptions() },
              row.value,
              (value: string) => this.update(index, { value })
            )
          ) : row.kind === 'tree' ? (
            <JsonDataEditorControl
              {...this.props}
              ref={(editor) => {
                if (editor) this.treeEditors.set(row.id, editor)
                else this.treeEditors.delete(row.id)
              }}
              value={row.value}
              allowValueTypes="object,array"
              onChange={(value) => this.update(index, { value })}
            />
          ) : row.kind === 'literal' ? (
            <LiteralMappingValue
              key={row.id}
              ref={(editor) => {
                if (editor) this.literalEditors.set(row.id, editor)
                else this.literalEditors.delete(row.id)
              }}
              value={row.value}
              renderControl={this.props.render}
              disabled={this.props.disabled}
              onError={(error) => {
                this.setState({ error })
                this.props.onInputStateChange?.(error)
              }}
              onChange={(value) => this.update(index, { value })}
            />
          ) : (
            <label>
              <span className="sr-only">{`来源表达式 ${index + 1}`}</span>
              <Textarea
                value={
                  typeof row.value === 'string' ? row.value : JSON.stringify(row.value)
                }
                placeholder="${ event.payload.orderId }"
                disabled={this.props.disabled}
                minRows={2}
                onChange={(value: string) => this.update(index, { value })}
              />
            </label>
          )}
        </div>
        <Button
          type="button"
          disabled={this.props.disabled}
          onClick={() =>
            this.emit(this.state.rows.filter((_, position) => position !== index))
          }>
          删除映射
        </Button>
      </div>
    )
  }

  render() {
    const advanced = this.state.advanced || !this.representable()
    return (
      <div
        className="BusinessBehaviorMapping"
        aria-label={this.props.partitioned ? '传入动作' : '流程输入映射'}>
        <Button
          type="button"
          onClick={() => {
            const error = this.validate()
            if (error) this.setState({ error })
            else this.setState({ advanced: !advanced })
          }}>
          {advanced ? '返回映射表' : '查看映射定义'}
        </Button>
        {this.state.error ? <p role="alert">{this.state.error}</p> : null}
        <div hidden={!advanced}>
          <JsonDataEditorControl
            {...this.props}
            ref={(editor) => {
              this.jsonEditor = editor
            }}
            allowValueTypes="object"
            onChange={(value) => {
              this.emitted = value
              this.setState({ rows: this.rows(value), error: '' })
              this.props.onChange(value)
            }}
          />
        </div>
        {!advanced ? (
          this.props.partitioned ? (
            ['params', 'data'].map((partition) => {
              const rows = this.state.rows.filter(
                (row) =>
                  row.target === partition || row.target.startsWith(`${partition}.`)
              )
              const mode = rows.some((row) => row.target === partition)
                ? 'whole'
                : rows.length
                  ? 'fields'
                  : 'none'
              return (
                <section
                  key={partition}
                  aria-label={
                    partition === 'params' ? '动作参数 params' : '动作数据 data'
                  }>
                  <h5>{partition === 'params' ? '动作参数 params' : '动作数据 data'}</h5>
                  {this.control(
                    `mode-${partition}`,
                    {
                      type: 'button-group-select',
                      options: [
                        { label: '逐字段', value: 'fields' },
                        { label: '整体传入', value: 'whole' },
                        { label: '不传入', value: 'none' },
                      ],
                    },
                    mode,
                    (value: string) => this.setMode(partition, value)
                  )}
                  {this.state.rows.map((row, index) =>
                    rows.includes(row) ? this.row(row, index, partition) : null
                  )}
                  {this.props.targetSchema ? (
                    <small>
                      {this.targetFields(partition)
                        .filter(
                          (field) =>
                            field.required &&
                            !rows.some(
                              (row) =>
                                row.target === partition ||
                                row.target === `${partition}.${field.path}` ||
                                row.target.startsWith(`${partition}.${field.path}.`)
                            )
                        )
                        .map((field) => `待映射必填字段：${field.title}`)
                        .join('；')}
                    </small>
                  ) : (
                    <small>目标输入结构待核验</small>
                  )}
                  {mode === 'fields' ? (
                    <Button
                      type="button"
                      disabled={this.props.disabled}
                      onClick={() =>
                        this.emit([
                          ...this.state.rows,
                          {
                            id: this.nextRowId++,
                            target: `${partition}.`,
                            value: '${ event.payload }',
                            kind: 'expression',
                          },
                        ])
                      }>
                      添加{partition === 'params' ? '参数' : '数据'}映射
                    </Button>
                  ) : null}
                </section>
              )
            })
          ) : (
            <>
              {this.state.rows.map((row, index) => this.row(row, index))}
              <Button
                type="button"
                disabled={this.props.disabled}
                onClick={() =>
                  this.emit([
                    ...this.state.rows,
                    {
                      id: this.nextRowId++,
                      target: '',
                      value: '${ input.params }',
                      kind: 'expression',
                    },
                  ])
                }>
                添加输入映射
              </Button>
            </>
          )
        ) : null}
      </div>
    )
  }
}

/** Literal strings use the existing platform EL quoting, never a browser evaluator. */
class LiteralMappingValue extends React.Component<
  {
    value: unknown
    renderControl: FormControlProps['render']
    disabled?: boolean
    onError: (error: string) => void
    onChange: (value: unknown) => void
  },
  { type: string; text: string; edited: boolean }
> {
  state = {
    type: Array.isArray(this.props.value)
      ? 'array'
      : this.props.value === null
        ? 'null'
        : typeof this.props.value,
    text: typeof this.props.value === 'string' ? '' : JSON.stringify(this.props.value),
    edited: typeof this.props.value !== 'string',
  }

  private literal() {
    if (!this.state.edited) throw new Error('请填写固定值。')
    if (this.state.type === 'string') return this.state.text
    const value: unknown = JSON.parse(this.state.text)
    if (
      this.state.type === 'array'
        ? !Array.isArray(value)
        : this.state.type === 'object'
          ? !object(value)
          : this.state.type === 'null'
            ? value !== null
            : typeof value !== this.state.type
    )
      throw new Error('固定值与所选类型不一致。')
    return value
  }

  validate() {
    try {
      this.literal()
      return ''
    } catch (error) {
      return error instanceof Error ? error.message : '固定值无效。'
    }
  }

  private publish() {
    try {
      const encode = (value: unknown): unknown =>
        typeof value === 'string'
          ? "${ '" + value.replace(/'/g, "''").replace(/\$\{/g, () => '$${') + "' }"
          : Array.isArray(value)
            ? value.map(encode)
            : object(value)
              ? Object.fromEntries(
                  Object.entries(value).map(([key, item]) => [key, encode(item)])
                )
              : value
      this.props.onChange(encode(this.literal()))
    } catch (error) {
      this.props.onError(error instanceof Error ? error.message : '固定值无效。')
    }
  }

  render() {
    return (
      <div aria-label="固定值编辑">
        {renderBusinessBehaviorControl(
          this.props.renderControl,
          'literal-type',
          {
            type: 'button-group-select',
            options: [
              { label: '文本', value: 'string' },
              { label: '数字', value: 'number' },
              { label: '是/否', value: 'boolean' },
              { label: '空值', value: 'null' },
              { label: '对象', value: 'object' },
              { label: '列表', value: 'array' },
            ],
          },
          {
            value: this.state.type,
            disabled: this.props.disabled,
            onChange: (type: string) => {
              const defaults: Record<string, string> = {
                string: '',
                number: '0',
                boolean: 'true',
                null: 'null',
                object: '{}',
                array: '[]',
              }
              this.setState({ type, text: defaults[type], edited: true }, () =>
                this.publish()
              )
            },
          }
        )}
        {this.state.type === 'null' ? null : this.state.type === 'boolean' ? (
          renderBusinessBehaviorControl(
            this.props.renderControl,
            'literal-boolean',
            { type: 'switch' },
            {
              value: this.state.text === 'true',
              disabled: this.props.disabled,
              onChange: (value: boolean) =>
                this.setState({ text: String(value), edited: true }, () =>
                  this.publish()
                ),
            }
          )
        ) : (
          <InputBox
            aria-label="固定值"
            value={this.state.text}
            type="text"
            inputMode={this.state.type === 'number' ? 'decimal' : undefined}
            placeholder={
              this.state.type === 'object' || this.state.type === 'array'
                ? 'JSON'
                : '输入固定值'
            }
            disabled={this.props.disabled}
            onChange={(text: string) =>
              this.setState({ text, edited: true }, () => this.publish())
            }
          />
        )}
      </div>
    )
  }
}
