import React from 'react'
import { FormItem } from 'amis'
import {
  createSchemaChangeSourceTracker,
  getEditorCommonProps,
  getPureSchema,
  reorderSchemaLike,
} from '../editor/utils'
import { Editor, MiniEditor } from './LazyAmisEditor'

/**
 * amis 可视化编辑器
 * 可配置项：
 * - value: 默认值
 * - pureSchema: 是否纯净模式，如果开启，则会剔除未使用的 id（默认为开启）
 * - lockRoot: 是否锁定根节点，如果开启，则无法更改根节点的类型
 */
class AmisEditor extends React.Component {
  lastSchema: any = null
  schemaChangeSource = createSchemaChangeSourceTracker()

  // eslint-disable-next-line no-useless-constructor
  constructor(props: any) {
    super(props)
  }

  shouldComponentUpdate(nextProps: any) {
    // 若 value 变化是内部引起的，则不更新
    if (nextProps.value === this.lastSchema) {
      return false
    }
    return true
  }

  render() {
    const {
      data,
      className,
      onChange,
      pureSchema = true,
      lockRoot,
      env,
      platformContext,
      resourceBrowserContext,
      onBuildPanels,
      ...rest
    } = this.props as any
    // 因为默认开启了 pureSchema，value 会被剔除 id，所以这里将 value 缓存到内部状态
    // 避免在编辑的时候缺少id，造成无法正确引用
    return (
      <Editor
        theme={'cxd'}
        {...getEditorCommonProps({ ...rest, platformContext, resourceBrowserContext })}
        {...rest}
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        onInit={(editor) => {}}
        className={`${className || ''} is-fixed`}
        amisEnv={{
          fetcher: async (config) => {
            if (config.url?.includes('organization')) {
              return env.fetcher(config)
            }
            // TODO：自动切换环境
            return {
              status: 0,
              data: {
                items: [],
              },
            }
          },
        }}
        beforeResolveJsonSchema={(event): void | boolean => {
          if (lockRoot && event.context.schemaPath === '') return false
        }}
        onBuildPanels={(event) => {
          onBuildPanels?.(event)
          this.schemaChangeSource.decorateOnBuildPanels(event)
        }}
        onChange={(schema) => {
          let finalSchema = pureSchema ? getPureSchema(schema) : schema
          // eslint-disable-next-line no-prototype-builtins
          if (!finalSchema.hasOwnProperty('type')) {
            finalSchema = {
              type: 'page',
              ...finalSchema,
            }
          }
          if (this.schemaChangeSource.consume() !== 'code') {
            finalSchema = reorderSchemaLike((this.props as any).value, finalSchema)
          }
          this.lastSchema = finalSchema
          onChange?.(finalSchema)
        }}
      />
    )
  }
}

class AmisMiniEditor extends React.Component {
  render() {
    const { data, platformContext, resourceBrowserContext, ...rest } = this.props as any
    return (
      <MiniEditor
        {...getEditorCommonProps({ ...rest, platformContext, resourceBrowserContext })}
        {...rest}
      />
    )
  }
}

FormItem({
  type: 'amis-editor',
  autoVar: true,
})(AmisEditor as any)

FormItem({
  type: 'amis-mini-editor',
  autoVar: true,
})(AmisMiniEditor as any)

export default { AmisEditor, AmisMiniEditor }
