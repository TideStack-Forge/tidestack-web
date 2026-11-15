import { FormItem, dataMapping, buildApi } from 'amis'
import React from 'react'
import JsonDataEditorControl, { type JsonDataEditorProps } from './JsonDataEditor'
import { Editor } from './LazyAmisEditor'
import {
  createSchemaChangeSourceTracker,
  getEditorCommonProps,
  getPureSchema,
  reorderSchemaLike,
} from '../editor/utils'
/**
 * amis schema 可视化编辑器，用于编辑单组件或者多组件，而非页面
 * 可配置项：
 * - value: 默认值
 * - defaultSchema: 默认值，当value不存在的时候使用
 * - showSwitch: 是否显示开关，如果有开关则当开关打开的时候必须有值，不管其是否配置了required
 * - onText: 开关打开时的文本
 * - offText: 开关关闭时的文本
 * - switchLayout: 是否显示多种布局的切换
 * - multiple: 是否支持多组件
 * - maxLength: 最多支持多少个组件
 * - minLength: 最少要有多少个组件
 * - propsEditMode: 是否是属性编辑模式，如果是属性编辑模式，只能编辑属性，不能编辑组件
 * - autoRemapping: 是否自动映射数据，如果开启，则会以上下文对 defaultSchema 进行数据映射
 * - pureSchema: 是否纯净模式，如果开启，则会剔除未使用的 id（默认为开启）
 */
class AmisSchemaEditor extends React.Component<any, any> {
  schemaChangeSource = createSchemaChangeSourceTracker()

  constructor(props: any) {
    super(props)
    this.state = { isEnabled: !!props.value }
  }

  async componentDidMount() {
    const { value, initValue, initValueApi, showSwitch } = this.props
    if (!value && !initValue && initValueApi && !showSwitch) {
      this.fetchInitSchema()
    }
    if (!value && initValue && !showSwitch) {
      this.props.onChange?.(dataMapping(initValue, this.props.data))
    }
  }

  async fetchInitSchema() {
    const {
      initValueApi,
      env: { fetcher },
      data,
    } = this.props
    if (!initValueApi) return
    const api = buildApi(initValueApi, data)
    const result = await fetcher(api)
    if (result.status !== 0) {
      return
    }
    this.props.onChange?.(result.data)
  }

  validate(): void | null | string {
    const {
      value,
      showSwitch,
      multiple = false,
      maxLength = Number.MAX_VALUE,
      minLength = 0,
    } = this.props
    const { isEnabled } = this.state
    if (multiple) {
      if (value?.length > maxLength) {
        return `最多只能添加${maxLength}个组件`
      }
      if (value?.length < minLength) {
        return `最少需要${minLength}个组件`
      }
      return null
    }
    if (showSwitch && isEnabled && !value) {
      return '未设置自定义组件'
    }
    if (!value) {
      if (showSwitch && isEnabled) return '当启用自定义组件时不能为空'
    }
  }

  componentDidUpdate(prevProps: any, prevState: any) {
    if (!prevState.isEnabled && this.state.isEnabled && !this.props.value) {
      this.fetchInitSchema()
    }
  }

  renderEditor() {
    return (props: any) => {
      const {
        value,
        onChange,
        onBuildPanels,
        defaultSchema,
        multiple,
        maxLength,
        minLength,
        propsEditMode = false,
        env: { notify },
        autoRemapping,
        pureSchema = true,
        platformContext,
        resourceBrowserContext,
      } = this.props
      const wrappedValue: any = {
        type: 'container',
        body: [],
      }
      // 赋予默认值
      const defaultValue =
        value ||
        (defaultSchema &&
          (autoRemapping ? dataMapping(defaultSchema, this.props.data) : defaultSchema))
      if (defaultValue) {
        if (multiple) {
          wrappedValue.body = Array.isArray(defaultValue)
            ? [...defaultValue]
            : [defaultValue]
        } else {
          wrappedValue.body.push(defaultValue)
        }
      }

      // 解包
      const dewrappedValue = (newValue: any) => {
        const emitValue = multiple
          ? newValue?.body?.filter((item: any) => item) || []
          : newValue?.body?.filter((item: any) => item)?.[0]
        const finalValue = pureSchema ? getPureSchema(emitValue) : emitValue
        const orderedValue =
          this.schemaChangeSource.consume() === 'code'
            ? finalValue
            : reorderSchemaLike(defaultValue, finalValue)
        onChange?.(orderedValue)
      }
      return (
        <Editor
          {...getEditorCommonProps({
            ...props,
            platformContext,
            resourceBrowserContext,
          })}
          theme={'cxd'}
          className={'is-fixed'}
          value={wrappedValue}
          amisEnv={{
            fetcher: async (config) => {
              // TODO: 自动转换开发环境与生产环境的接口
              return {
                status: 0,
                data: { items: [] },
              }
            },
          }}
          onChange={dewrappedValue}
          onInit={(editor) => ({})}
          beforeInsert={(event): void | boolean => {
            // 只对根节点做限制
            if (event.context.schemaPath !== '') return
            const schema = event.context.schema
            const content = schema.body.filter((item: any) => item)
            // 如果是单组件
            if (!multiple && content.length > 0) {
              notify?.('error', '根节点只能有一个组件，若需要多个组件请使用容器组件')
              return false
            }

            // 如果启用多组件
            if (multiple) {
              if (maxLength != null && content.length >= maxLength) {
                notify?.('error', `最多只能添加${maxLength}个组件`)
                return false
              }
              if (minLength != null && content.length <= minLength) {
                notify?.('error', `最少需要${minLength}个组件`)
                return false
              }
            }
          }}
          beforeResolveJsonSchema={(event): void | any => {
            if (event.context.schemaPath === '') return false
          }}
          afterResolveEditorInfo={(event) => {
            if (event.context.schemaPath !== '') return
            if (propsEditMode && event.data) event.data.memberImmutable = true
          }}
          onBuildPanels={(event) => {
            onBuildPanels?.(event)
            const panels = event.data || event.context?.data || []
            const removePanels = []
            // 如果是属性编辑模式，隐藏组件面板
            if (propsEditMode) {
              removePanels.push(panels.find((panel: any) => panel.key === 'renderers'))
            }
            // 如果不是属性编辑模式，且是根节点，检查是否可以插入，不能插入也要隐藏组件面板
            else if (event.context.schemaPath === '') {
              const schema = event.context.schema
              const content = schema.body.filter((item: any) => item)
              const cantInsert =
                (content.length > 0 && !multiple) ||
                (multiple && maxLength != null && content.length >= maxLength)
              if (cantInsert) {
                const removePanel = panels.find((panel: any) => panel.key === 'renderers')
                removePanels.push(removePanel)
                event.context.changeLeftPanelKey = 'outline'
              }
            }
            // 当选中最外层的时候，隐藏配置面板
            if (event.context.schemaPath === '') {
              removePanels.push(panels.find((panel: any) => panel.key === 'config'))
            }
            // 执行删除
            removePanels.forEach((panel) => {
              const index = panels.indexOf(panel)
              ~index && panels.splice(index, 1)
            })
            if (propsEditMode) event.context.changeLeftPanelKey = 'outline'
            this.schemaChangeSource.decorateOnBuildPanels(event)
          }}
        />
      )
    }
  }

  render() {
    const {
      render,
      value,
      initValue,
      placeholder = '点编辑按钮进行编辑',
      staticPlaceholder = '-',
      showSwitch,
      onText,
      offText,
      switchLayout = true,
      className,
      previewText = '预览',
      static: isStatic,
    } = this.props
    const { isEnabled } = this.state
    let previewSchema: any = {
      type: 'tpl',
      tpl: isStatic ? staticPlaceholder : placeholder,
      className: 'self-center text-secondary',
    }

    // 有值的时候渲染，并且根据switchLayout的值决定是否渲染多种布局
    if (value) {
      if (switchLayout) {
        previewSchema = {
          type: 'tabs',
          tabsMode: 'simple',
          tabs: [
            {
              title: '垂直布局',
              tab: {
                type: 'form',
                mode: 'normal',
                wrapWithPanel: false,
                body: value,
              },
            },
            {
              title: '水平布局',
              tab: {
                type: 'form',
                mode: 'horizontal',
                wrapWithPanel: false,
                body: value,
              },
            },
            {
              title: '行内布局',
              tab: {
                type: 'form',
                mode: 'inline',
                wrapWithPanel: false,
                body: value,
              },
            },
          ],
        }
      } else {
        previewSchema = value
      }
    }
    const editorSchema = {
      type: 'wrapper',
      className:
        'border border-dashed border-gray-300 hover:border-primary p-2 flex flex-col ' +
        className,
      style: {
        'min-height': '80px',
      },
      body: [
        {
          type: 'tpl',
          className: 'text-gray-300',
          tpl: previewText,
        },
        {
          type: 'form',
          wrapWithPanel: false,
          body: previewSchema,
        },
        {
          type: 'action',
          actionType: 'dialog',
          className: 'self-end',
          level: 'link',
          label: '',
          icon: 'fa fa-pencil',
          tooltip: '打开可视化编辑器',
          visible: !isStatic,
          dialog: {
            title: '编辑',
            size: 'lg',
            height: '80vh',
            bodyClassName: 'relative h-full',
            closeOnEsc: true,
            body: {
              component: this.renderEditor(),
            },
            actions: [],
          },
        },
      ],
    }
    const switchSchema = {
      type: 'switch',
      name: 'amisSchemaEditorIsEnabled',
      onChange: (value: any) => {
        this.setState({ isEnabled: value })
        if (!value) {
          this.props.onChange?.(null)
        } else if (!this.props.value) {
          const v = this.props.initValue
            ? dataMapping(this.props.initValue, this.props.data)
            : null
          this.props.onChange?.(v)
        }
      },
      value: isEnabled,
      label: false,
      onText,
      offText,
    }
    const finalSchema = {
      type: 'container',
      body: [
        showSwitch ? switchSchema : null,
        (showSwitch && isEnabled) || !showSwitch ? editorSchema : null,
      ],
    }
    const visualEditor = render('inner', finalSchema, {
      data: {
        value: value || {
          type: 'tpl',
          tpl: isStatic ? staticPlaceholder : placeholder,
          className: 'self-center text-secondary',
        },
      },
      amisSchemaEditorIsEnabled: isEnabled,
    })
    return (
      <>
        {visualEditor}
        {this.props.codeContext && (
          <details>
            <summary>后端参数模板源码</summary>
            <JsonDataEditorControl
              {...(this.props as JsonDataEditorProps)}
              value={value}
              allowValueTypes="object,array"
              codeContext={this.props.codeContext}
            />
          </details>
        )}
      </>
    )
  }
}

FormItem({
  type: 'amis-schema-editor',
  autoVar: true,
})(AmisSchemaEditor)

FormItem({
  type: 'ui-schema-editor',
  autoVar: true,
})(AmisSchemaEditor)

export default AmisSchemaEditor
