import { Deferred } from '#ouroboros-host/utils/Deferred'
import {
  Renderer,
  ScopedContext,
  IScopedContext,
  Schema,
  dataMapping,
  buildApi,
} from 'amis'
import { debounce, isEqual, merge, type DebouncedFunc } from 'lodash'
import React from 'react'
import { processAmisSchema } from '#ouroboros-host/common/i18n/amis'
import { EventBus } from '#ouroboros-host/common/eventBus'

interface AmisSchemaProps extends Schema {
  source: any
  schemaId?: string
  autoRemapping?: boolean | string[]
  replaceProps?: any
  mergeProps?: any
  onSchemaResolved?: (schema: any) => any
}

/**
 * amis 渲染器组件
 * 用于渲染 amis schema
 * 可配置项：
 * - schemaId: amis schema 的 id，用于从后端获取 amis schema
 * - source: amis schema 的来源，可以是一个api，也可以是一个schema，或一个数据映射字符串，优先级低于 schemaId
 * - autoRemapping: boolean | string[] 是否自动映射数据，如果为 true，则会将 schema 中的数据映射字符串替换为实际数据，如果为数组则仅重新映射指定key的属性，可动态配置原本不支持动态配置的 schema 属性。
 * - replaceProps: 用于重写 schema 中的 props，会覆盖掉 schema 中的同名属性。
 * - mergeProps: 用于重写 schema 中的 props，会将 schema 中的 props 与 mergeProps 进行合并。
 */

export default class AmisSchema extends React.Component<AmisSchemaProps, any> {
  static contextType = ScopedContext
  fetcher: any
  latestSchemaRequestKey: string | null = null
  latestSchemaPromise: Promise<any> | null = null
  schemaRequestSequence = 0
  latestRawSchema: any = null
  latestApi: any = null
  localeChangeHandler?: () => void
  refreshSchema: DebouncedFunc<() => void>

  constructor(props: any, context: IScopedContext) {
    super(props)
    this.context = context
    this.fetcher = props.env.fetcher
    this.state = { schema: null }
    this.refreshSchema = debounce(this.resolveSchema.bind(this), 100)
  }

  componentDidMount() {
    this.refreshSchema()

    // 监听语言切换事件
    this.localeChangeHandler = () => {
      this.forceUpdate()
    }
    EventBus.subscribe('locale-changed', this.localeChangeHandler)
  }

  componentDidUpdate() {
    this.refreshSchema()
  }

  componentWillUnmount() {
    this.refreshSchema.cancel()
    this.schemaRequestSequence++
    // 取消监听
    if (this.localeChangeHandler) {
      EventBus.unsubscribe('locale-changed', this.localeChangeHandler)
    }
  }

  private getSchemaId(): string | undefined {
    return this.props.schemaId || (this.props as any).data?.__schemaId || undefined
  }

  private resolveSchema() {
    const { schemaId, source, autoRemapping, data = {}, schema = {} } = this.props
    const schemaDeferred = new Deferred()
    let requestSequence = this.schemaRequestSequence

    // 缓存原始 schema，检查更新渲染 schema
    schemaDeferred.promise.then((schema: any) => {
      if (requestSequence !== this.schemaRequestSequence) return
      this.latestRawSchema = schema
      if (autoRemapping === true) {
        schema = dataMapping(schema, this.props.data)
      } else if (Array.isArray(autoRemapping)) {
        const remapped = autoRemapping.reduce((acc, key) => {
          if (schema[key]) acc[key] = dataMapping(schema[key], data)
          return acc
        }, {} as any)
        schema = { ...schema, ...remapped }
      }

      // 处理多语言
      const currentSchemaId = this.getSchemaId()
      if (currentSchemaId) {
        schema = processAmisSchema(currentSchemaId, schema)
      }

      const resolvedSchema = this.props.onSchemaResolved?.(schema)
      if (resolvedSchema && typeof resolvedSchema === 'object') {
        schema = resolvedSchema
      }

      if (!isEqual(schema, this.state.schema)) {
        this.setState({ schema })
      }
    })

    // 优先检查 schemaId
    if (schemaId && typeof schemaId === 'string') {
      const finalSchemaId = schemaId.includes('$')
        ? dataMapping(schemaId, data)
        : schemaId
      if (typeof finalSchemaId === 'string') {
        const schemaContext = this.getSchemaContext()
        const requestKey = JSON.stringify([finalSchemaId, schemaContext])
        if (requestKey !== this.latestSchemaRequestKey) {
          this.latestSchemaRequestKey = requestKey
          requestSequence = ++this.schemaRequestSequence
          this.latestSchemaPromise = this.fetchSchemaById(finalSchemaId, schemaContext)
        }
        schemaDeferred.resolve(this.latestSchemaPromise)
      }
      return
    }
    // 再检查 source
    const finalSource =
      typeof source === 'string' && source.includes('$')
        ? dataMapping(source, data)
        : source

    if (finalSource && (finalSource.type || Array.isArray(finalSource))) {
      schemaDeferred.resolve(finalSource)
      return
    }

    // 再检查 source 是不是 api
    if (finalSource && (typeof finalSource === 'string' || finalSource.url)) {
      const finalApi = buildApi(finalSource, data)
      // 检查是否 api 是否是同一个，如果是，则直接返回缓存的 schema
      if (isEqual(this.latestApi, finalApi)) {
        schemaDeferred.resolve(this.latestRawSchema)
      }
      // 如果不是同一个 api，则重新请求 schema
      else {
        this.latestApi = finalApi
        this.fetchSchemaByApi(finalApi).then(schemaDeferred.resolve)
      }
      return
    }

    // 最后检查 schema 是否为空
    if (schema && (schema.type || Array.isArray(schema))) {
      schemaDeferred.resolve(schema)
      return
    }

    // 最后如果没有指定 schema 来源，返回一个错误提示
    schemaDeferred.resolve({
      type: 'tpl',
      tpl: '未指定 Schema 来源',
    })
  }

  render() {
    const {
      $path,
      type,
      render,
      source,
      schemaId,
      autoRemapping,
      api,
      initApi,
      onSchemaResolved: __ignoreOnSchemaResolved,
      visibleOn: __ignore1,
      hiddenOn: __ignore2,
      $schema: {
        type: _ignore1,
        source: _ignore2,
        schemaId: _ignore3,
        onSchemaResolved: _ignoreOnSchemaResolved,
        visibleOn: _ignore4,
        hiddenOn: _ignore5,
        rewriteProps,
        replaceProps,
        mergeProps,
        defaultProps = {},
        ...restSchema
      },
      // WARN:
      // 上层组件会传入一些联动的回调函数，这里需要把这些回调函数传递给内部的 schema
      // 但是要注意的是，这里可能会传入太多不必要的 props，需要观察一下
      ...restProps
    } = this.props as any
    const { schema } = this.state as any
    if (!schema) return null

    // 如果有来自schema的props，删掉对应的props
    if (replaceProps || rewriteProps || restSchema) {
      Object.keys(replaceProps || rewriteProps || restSchema).forEach(
        (key) => delete restProps[key]
      )
    }

    let finalSchema = Array.isArray(schema)
      ? schema
      : merge(
          {},
          {
            ...defaultProps,
            ...schema,
            ...(replaceProps || rewriteProps || restSchema || {}),
          },
          mergeProps || {}
        )

    // 处理多语言
    const currentSchemaId = this.getSchemaId()
    if (currentSchemaId) {
      finalSchema = processAmisSchema(currentSchemaId, finalSchema)
    }

    // 这里不能把 render 传入 props，否则 $path 会快速膨胀
    return render('', finalSchema, { ...restProps, context: this.context })
  }

  private getSchemaContext() {
    const runtimeData = (this.props as any).data || {}
    const schemaContext = {
      appName: runtimeData.appName,
      fullName: runtimeData.fullName,
      modelType: runtimeData.modelType,
    }
    Object.keys(schemaContext).forEach((key) => {
      if ((schemaContext as any)[key] == null || (schemaContext as any)[key] === '') {
        delete (schemaContext as any)[key]
      }
    })
    return schemaContext
  }

  async fetchSchemaById(schemaId: string, schemaContext = this.getSchemaContext()) {
    return await this.fetchSchemaByApi({
      method: 'get',
      url: '/api/ui-schema',
      data: {
        path: schemaId,
        ...schemaContext,
      },
    })
  }

  async fetchSchemaByApi(schemaApi: any) {
    const fetcher = this.fetcher
    const data = schemaApi.data || {}
    const result = await fetcher(schemaApi, data)
    if (result?.status !== 0) {
      return null
    }
    return result.data
  }
}

Renderer({
  type: 'amis-schema',
  autoVar: false,
})(AmisSchema as any)

Renderer({
  type: 'ui-schema',
  autoVar: false,
})(AmisSchema as any)
