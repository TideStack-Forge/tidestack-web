import {
  FormItem,
  Tree,
  PickerContainer,
  ResultBox,
  Icon,
  GroupedSelection,
  Tag,
  dataMapping,
} from 'amis'
import { normalizeApi } from 'amis-core'
import React from 'react'

class DynamicTreeTransferPicker extends React.Component<any, any> {
  constructor(props: any) {
    super(props)
    this.state = {
      leftOptions: [], // 左侧树
      selectedTreeList: [], // 选中树的list
      selectedItems: [], // 选中的item
      leftTreeLoading: true,
      treeItemsLoading: false,
      allTreeItems: [], // 树的所有list
    }
  }

  componentDidMount() {
    this.fetchtTreeData()
    const { value = [] } = this.props
    if (!value || !value.length) return
    // 拉取全部左侧树列表
    this.fetchAllTreeItems()
  }

  // 获取左侧树
  async fetchtTreeData() {
    const {
      leftTreeSource,
      env: { fetcher },
      data,
    } = this.props
    if (!leftTreeSource) return
    const mapTreeSource = dataMapping(leftTreeSource, data)

    const api = normalizeApi(mapTreeSource)
    api.cache = 3000

    const result = await fetcher(api)
    const items = (result.data && (result.data.items || result.data)) || []
    this.setState({ leftOptions: items, leftTreeLoading: false })
  }

  // 获取点击的左侧树列表
  async fetchSelectTreeItems(selectedTreeKey: any) {
    const {
      selectItemSource,
      env: { fetcher },
      data,
    } = this.props
    if (!selectItemSource) return
    const mapTreeItemsSource = dataMapping(selectItemSource, {
      ...data,
      category: selectedTreeKey,
    })

    const api = normalizeApi(mapTreeItemsSource)
    api.cache = 3000

    const result = await fetcher(api)
    const items = (result.data && (result.data.items || result.data)) || []
    this.setState({ selectedTreeList: items, treeItemsLoading: false })
  }

  // 获取全部左侧树列表
  async fetchAllTreeItems() {
    const {
      selectItemSource,
      env: { fetcher },
      data,
      value,
      valueField = 'value',
    } = this.props
    if (!selectItemSource) return
    const mapTreeItemsSource = dataMapping(selectItemSource, {
      ...data,
      value: value,
    })
    const api = normalizeApi(mapTreeItemsSource)
    api.cache = 3000

    const result = await fetcher(api)
    const items: any[] = (result.data && (result.data.items || result.data)) || []

    const newValue: any[] = []
    value.forEach((value: any) => {
      items.forEach((element) => {
        if (value == element[valueField]) {
          newValue.push(element)
        }
      })
    })

    this.setState({ selectedItems: newValue })
  }

  // 点击左侧tree
  handleLeftSelect(val: any) {
    this.setState({
      treeItemsLoading: true,
    })
    this.fetchSelectTreeItems(val)
  }

  // item 点击
  handleLeftItemSelect(value: any) {
    this.setState({ selectedItems: value })
  }

  // 弹窗内删除已选中的item
  handleClose(key: any) {
    const { valueField = 'value' } = this.props
    const { selectedItems } = this.state
    const updatedEmployees = selectedItems.filter((item: any) => item[valueField] !== key)
    this.setState({ selectedItems: updatedEmployees })
  }

  handleConfirm() {
    this.changeValue(this.state.selectedItems)
  }

  onResultChange(val: any) {
    this.setState({ selectedItems: val })
    this.changeValue(val)
  }

  changeValue(value: any) {
    const {
      multiple = true,
      extractValue = true,
      joinValues = false,
      valueField,
      delimiter,
      onChange,
    } = this.props
    let finalValue = value

    if (joinValues) {
      finalValue = value.map((item: any) => item[valueField || 'value']).join(delimiter || ',')
    } else if (extractValue) {
      finalValue = multiple
        ? value.map((item: any) => item[valueField || 'value'])
        : (value[0] && value[0][valueField || 'value']) || ''
    } else {
      finalValue = multiple ? value : value[0]
    }
    onChange(finalValue)
  }

  render() {
    const { leftOptions, selectedTreeList, selectedItems } = this.state
    const {
      classnames: cx,
      value,
      translate: __,
      disabled,
      className,
      onChange,
      pickerSize = 'md',
      borderMode,
      labelField = 'label',
      valueField = 'value',
      maxTagCount,
      overflowTagPopover,
      selectTitle, // 左侧的标题文字
      render,
      ...rest
    } = this.props

    /**
     * TODO
     * 1. searchable 开启查询
     * 2. multiple joinValues extractValue 配置化
     */

    return (
      <PickerContainer
        className={className}
        title={selectTitle || __('Select.placeholder')}
        bodyRender={() => {
          return (
            <div className="flex flex-wrap justify-between h-full ">
              <div
                className="rounded border-gray-200 border-solid border flex flex-col"
                style={{ width: '49.5%' }}>
                <h4 className="bg-gray-100 m-0 py-3 pl-8 mb-2 flex-grow-0 flex-shrink-0">
                  选项树
                </h4>
                {this.state.leftTreeLoading ? (
                  <div className="py-3 pl-8">加载中...</div>
                ) : (
                  <Tree
                    name="treeValue"
                    options={leftOptions}
                    onChange={this.handleLeftSelect.bind(this)}
                    loading={true}
                    className="flex-grow flex-shrink overflow-y-auto h-96"
                  />
                )}
              </div>
              <div
                className="rounded border-gray-200 border-solid border flex flex-col"
                style={{ width: '49.5%' }}>
                <h4 className="bg-gray-100 m-0 py-3 pl-8 mb-2 flex-grow-0 flex-shrink-0">
                  可选项
                </h4>
                {this.state.treeItemsLoading ? (
                  <div className="py-3 pl-8">加载中...</div>
                ) : (
                  <GroupedSelection
                    options={selectedTreeList}
                    value={selectedItems}
                    onChange={this.handleLeftItemSelect.bind(this)}
                    className="overflow-y-auto h-96 flex-grow flex-shrink relative max-h-full"
                  />
                )}
              </div>
              <div style={{ marginTop: '20px', minHeight: '24px' }}>
                已选项：
                {!selectedItems || !selectedItems.length
                  ? '暂无数据'
                  : selectedItems.map((item: any) => {
                      return (
                        <Tag
                          key={item[valueField]}
                          closable="true"
                          color="processing"
                          onClose={this.handleClose.bind(this, item[valueField])}
                          className="mb-1.5">
                          {item[labelField]}
                        </Tag>
                      )
                    })}
              </div>
            </div>
          )
        }}
        value={value}
        size={pickerSize}
        onConfirm={this.handleConfirm.bind(this)}>
        {({ onClick, isOpened }: any) => (
          <ResultBox
            className={cx('TransferPicker', className, isOpened ? 'is-active' : '')}
            allowInput={false}
            result={selectedItems}
            onResultChange={this.onResultChange.bind(this)}
            onResultClick={onClick}
            placeholder={__('Select.placeholder')}
            disabled={disabled || this.props.static}
            borderMode={borderMode}
            itemRender={(option: any) => (
              <span>{(option && option[labelField]) || 'undefined'}</span>
            )}
            maxTagCount={maxTagCount}
            overflowTagPopover={overflowTagPopover}>
            <span className={cx('TransferPicker-icon')}>
              <Icon icon="pencil" className="icon" />
            </span>
          </ResultBox>
        )}
      </PickerContainer>
    )
  }
}
FormItem({
  type: 'dynamic-tree-transfer-picker',
  autoVar: false,
})(DynamicTreeTransferPicker)
export default DynamicTreeTransferPicker
