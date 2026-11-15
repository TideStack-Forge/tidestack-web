import { dataMapping, FormItem } from 'amis'
import { reaction } from 'mobx'
import React from 'react'
import { getPlatformAdapter, resolvePlatformContext } from '../platform/context'
// @ts-ignore
import './DataDictPicker.scss'

function joinClassNames(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(' ')
}

class DataDictPicker extends React.Component<any, any> {
  private disposeValidationReaction?: () => void

  componentDidMount() {
    this.bindValidationReaction()
  }

  componentDidUpdate(prevProps: Readonly<any>) {
    if (prevProps.formItem !== this.props.formItem) {
      this.bindValidationReaction()
    }
  }

  componentWillUnmount() {
    this.disposeValidationReaction?.()
  }

  bindValidationReaction() {
    this.disposeValidationReaction?.()
    this.disposeValidationReaction = undefined

    const { formItem } = this.props
    if (!formItem) return

    this.disposeValidationReaction = reaction(
      () => `${formItem.validatedAt || 0}:${formItem.valid}:${(formItem.errors || []).join('\n')}`,
      () => this.forceUpdate()
    )
  }

  normalizeValue(value: any, isRoot = true) {
    if (value === null || typeof value === 'undefined') {
      return isRoot ? '' : undefined
    }
    if (typeof value === 'string') {
      return value
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.normalizeValue(item, false))
    }
    if (typeof value !== 'object') {
      return value
    }
    const result: any = {}
    for (const key in value) {
      if (value[key] === null) {
        result[key] = undefined
      } else {
        result[key] = value[key]
      }
    }
    return result
  }

  getDictValue() {
    const { value, name, data } = this.props
    if (typeof value !== 'undefined') return this.normalizeValue(value)
    if (!name) return undefined
    const tryParseValue = dataMapping(`\${${name}}`, data)
    return typeof tryParseValue !== 'undefined'
      ? this.normalizeValue(tryParseValue)
      : undefined
  }

  resolveOptionsSource() {
    const { dataDictName, tenantId, selectorType, env } = this.props
    const platformContext = resolvePlatformContext(env?.platformContext)
    const adapter = getPlatformAdapter(platformContext, 'dict')
    const adaptedSource = adapter?.resolveOptionsSource({
      dictName: dataDictName,
      tenantId,
      selectorType,
    })
    if (adaptedSource) {
      return adaptedSource
    }
    return {
      method: 'get',
      url: '/api/sys/data-dict/' + dataDictName,
      cache: 3000,
      data: {
        tenantId,
      },
      adaptor(data: any) {
        if (data.code !== 0) return data
        return {
          ...data,
          data: {
            items: data.data?.items?.map((item: any) => {
              const children = item.children?.length ? item.children : undefined
              return {
                ...item,
                children,
              }
            }),
          },
        }
      },
    }
  }

  render() {
    const {
      render,
      selectorType,
      inputClassName = 'min-w-15',
      dataDictName,
      tenantId,
      joinValues,
      extractValue,
      showErrorMsg,
      formItem,
      buildItemProps,
      quickEditFormRef,
      quickEditFormItemRef,
      formItemRef,
      ...rest
    } = this.props
    void dataDictName
    void tenantId
    void showErrorMsg
    void buildItemProps
    void quickEditFormRef
    void quickEditFormItemRef
    void formItemRef
    const value = this.getDictValue()
    const innerInputClassName = joinClassNames(
      'ouroboros-data-dict-picker',
      inputClassName,
      formItem && !formItem.valid && 'is-error'
    )
    const node = render('data-dict-select', {
      ...rest,
      label: false,
      wrap: false,
      type: selectorType ?? 'tree-select',
      valueField: 'code',
      labelField: 'label',

      inputClassName: innerInputClassName,
      source: this.resolveOptionsSource(),
      value,
      joinValues,
      extractValue,
    })
    return node
  }
}

FormItem({
  type: 'data-dict-picker',
  autoVar: true,
})(DataDictPicker)

export default DataDictPicker
