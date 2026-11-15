import { FormItem, dataMapping, autobind, ListenerAction, ActionObject, injectObjectChain } from 'amis'
import { TabsTransferProps } from 'amis/lib/renderers/Form/TabsTransferPicker'
import { defer } from 'lodash'
import React from 'react'
import './TabsTransferEditor.scss'

export interface TabsTransferEditorProps extends TabsTransferProps {
  editable?: boolean
  creatable?: boolean
  addButton?: any
  addDialog?: any
  addControls?: any[]
  editButton?: any
  editDialog?: any
  editControls?: any[]
}
export interface TabsTransferEditorState {
  changedData?: {[key: string]: any},
  options: any[]
}

function isApi(source: any) {
  if (!source) return
  if (typeof source === 'object' && source.url) {
    return true
  }
  if (typeof source === 'string' && !source.startsWith('$')) {
    return true
  }
  return false
}

class TabsTransferEditor extends React.Component<
  TabsTransferEditorProps,
  TabsTransferEditorState
> {
  formItemStore: any
  constructor(props: TabsTransferEditorProps) {
    super(props)
    this.state = {
      options: [],
    }
  }

  getFormItemStore() {
    const { store, $path } = this.props
    if (!this.formItemStore) {
      this.formItemStore = store?.children.find((child) => child.path === $path)
    }
    return this.formItemStore
  }

  componentDidMount() {
    this.buildOptions()
  }

  // 获取左侧选项列表数据
  async buildOptions(changedData?: {[key: string]: any}) {
    const { data: superData, options, source } = this.props
    if ((!options || !options.length) && !source) return

    const data = changedData ? injectObjectChain(changedData, superData) : superData

    const newOptions = []

    // 如果有 source 优先从 source 拉取数据
    if (source) {
      if (isApi(source)) {
        const items = await this.fetchData(source)
        items?.forEach?.((i) => newOptions.push(i))
      } else {
        const items = dataMapping(source, data)
        items?.forEach?.((i: any) => newOptions.push(i))
      }
    }
    // 否则从 options 中获取数据
    else {
      for (let i = 0; i < options.length; i++) {
        const option = options[i]
        if (!option) continue
        const { source, children = [], ...rest } = option
        // option 自带选项列表
        if (children && children.length > 0) {
          const remappedChildren = dataMapping(children, data)
          newOptions.push({
            ...rest,
            children: remappedChildren.filter((item: any) => item.visibleOn !== false),
          })
          continue
        }
        if (!source) continue

        // 如果是 api，拉取数据
        if (isApi(source)) {
          const items = await this.fetchData(source)
          newOptions.push({
            ...rest,
            children: items,
          })
          continue
        }

        // 尝试数据映射
        const childrenData = dataMapping(source, data)
        if (childrenData && childrenData.length > 0) {
          newOptions.push({
            ...rest,
            children: childrenData,
          })
        }
      }
    }
    this.setState({ changedData, options: newOptions })
  }

  // 配置接口，拉取左侧选项列表
  async fetchData(api: any) {
    const {
      data,
      env: { fetcher },
    } = this.props
    const result = await fetcher(api, data)
    const items = (result.data && (result.data.items || result.data)) || []
    if (Array.isArray(items)) return items
    return []
  }

  componentDidUpdate(prevProps: any) {
    if (
      prevProps.source !== this.props.source ||
      prevProps.options !== this.props.options
    ) {
      this.buildOptions()
    }
  }


  @autobind
  async doAction(
    action: ListenerAction | ActionObject,
    data: any,
    throwErrors: boolean = false,
    args?: any
  ) {
    const actionType = action.actionType
    if (actionType === 'reloadOptions') {
      const finalData = args.data || action.data || data
      return this.buildOptions(finalData)
    }
  }

  handleChange(selected: any) {
    const { valueField = 'value', value = [], onChange, selectedDataMapping } = this.props
    if (!selected || !selected.length) {
      onChange?.([])
      return
    }

    const finalSelected = selected.map((selectedItem: any) => {
      if (selectedDataMapping) {
        selectedItem = dataMapping(selectedDataMapping, selectedItem)
      }
      const key = selectedItem[valueField]
      const existingObj = key && value.find((o: any) => o[valueField] === key)
      if (existingObj) {
        return Object.assign(selectedItem, existingObj)
      } else {
        return selectedItem
      }
    })
    onChange?.(finalSelected)
  }

  renderResultItemTpl() {
    const {
      valueField = 'value',
      editable = false,
      editButton = {},
      editDialog = {},
      editControls = [],
      valueTpl,
      render,
    } = this.props
    const valueSchema =
      typeof valueTpl === 'string' ? { type: 'tpl', tpl: valueTpl } : valueTpl

    return {
      type: 'wrapper',
      className: 'p-0 flex w-full justify-between',
      body: [
        {
          type: 'wrapper',
          className: 'p-0',
          body: valueSchema,
        },
        editable
          ? {
              type: 'button',
              label: '设置',
              ...editButton,
              disabled: this.props.static,
              actionType: 'dialog',
              dialog: {
                ...editDialog,
                body: {
                  component: ({ data }: any) => {
                    const key = data[valueField]
                    const valueObject = this.props.value.find(
                      (o: any) => o[valueField] === key
                    )
                    return render(
                      'form',
                      [
                        {
                          type: 'form',
                          wrapWithPanel: false,
                          body: editControls,
                          canAccessSuperData: false,
                        },
                      ],
                      {
                        data: { ...valueObject },
                      }
                    )
                  },
                },
                onConfirm: (values: any) => {
                  const [value] = values
                  const key = value?.[valueField]

                  const data = this.props.value.map((item: any) =>
                    item[valueField] === key ? { ...item, ...value } : item
                  )
                  // 通过delay把更新操作放到异步队列中，避免弹窗卡顿
                  defer(() => this.props.onChange?.(data))
                },
              },
            }
          : null,
      ],
    }
  }

  render() {
    const {
      render,
      value,
      data: superData,
      creatable,
      addButton = {},
      addDialog = {},
      addControls = [],
      static: isStatic,
      ...rest
    } = this.props
    const { changedData, options } = this.state
    const data = injectObjectChain(changedData, superData)
    const wrappedData = injectObjectChain({selectedItems: value || []}, data)
    const valueField = this.props.valueField || 'value'
    const newValueTpl = this.renderResultItemTpl()
    const node = render(
      'tabs-transfer-editor',
      {
        type: 'container',
        className: 'relative',
        body: [
          creatable && !isStatic
            ? {
                type: 'wrapper',
                style: {
                  position: 'absolute',
                  zIndex: 1,
                  top: 0,
                  padding: 0,
                  right: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                },
                body: {
                  type: 'action',
                  label: '新增',
                  ...addButton,
                  actionType: 'dialog',
                  dialog: {
                    title: '新增',
                    ...addDialog,
                    body: {
                      type: 'form',
                      wrapWithPanel: false,
                      canAccessSuperData: false,
                      body: addControls,
                    },
                    onConfirm: (values: any) => {
                      const data = values[0]
                      const key = data?.[valueField]
                      // 检查是否有重名
                      if (
                        key &&
                        this.props.value.find((item: any) => item[valueField] === key)
                      ) {
                        this.props.env.notify('error', '新增的值重复')
                        return false
                      }
                      const newValues = [...value]
                      newValues.push({ ...data })
                      this.handleChange(newValues)
                      return true
                    },
                  },
                },
              }
            : null,
          {
            type: 'form',
            wrapWithPanel: false,
            source: '',
            body: [
              {
                ...rest,
                label: null,
                source: '',
                name: 'selectedItems',
                type: 'tabs-transfer',
                inputClassName: 'tabs-transfer-editor',
                options: [...options],
                valueTpl: newValueTpl,
                onChange: this.handleChange.bind(this),
              },
            ],
          },
        ],
      },
      {
        data: wrappedData,
      }
    )
    return node as any
  }
}

FormItem({
  type: 'tabs-transfer-editor',
  autoVar: true,
})(TabsTransferEditor as any)

export default TabsTransferEditor
