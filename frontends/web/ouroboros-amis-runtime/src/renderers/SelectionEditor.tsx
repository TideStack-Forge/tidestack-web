import { FormItem, dataMapping, isEffectiveApi } from 'amis'
import React from 'react'
import { defer } from 'lodash'
import './SelectionEditor.scss'
import { Deferred } from '#ouroboros-host/utils/Deferred'

/**
 * 打平树
 * @param {object[]} data 待打平的树
 * @param {*} childrenKey 子项键名
 * @returns {object[]} 打平后的树
 */
function flattenTree(data = [], childrenKey = 'children'): any[] {
  const result: any[] = []
  data.forEach((item) => {
    result.push(item)
    if (item[childrenKey]) {
      result.push(...flattenTree(item[childrenKey], childrenKey))
    }
  })
  return result
}

/**
 * 重映射树
 * @param {object[]} data 待重映射的树
 * @param {(item: object, children: object[]) => object} mapper 映射函数
 * @param {string} childrenKey 子项键名
 * @returns 重映射的树
 */
function mapTree(data = [], mapper: (item: object, children: object[]) => object, childrenKey = 'children'): any[] {
  if (!mapper) return data
  if (data.length === 0) return data
  return data.map((item) => {
    const children = item[childrenKey]
      ? mapTree(item[childrenKey], mapper, childrenKey)
      : []
    return mapper(item, children)
  })
}

/**
 * 查找树中所有符合条件的项
 * @param {object[]} data 待查找的树
 * @param {(item: object) => boolean} predicate 查找条件
 * @param {*} childrenKey 子项键名
 * @returns {object[]} 符合条件的项
 */
function findTreeAll(data = [], predicate: (item: object) => boolean, childrenKey = 'children'): object[] {
  const result: any = []
  data.forEach((item) => {
    if (predicate(item)) {
      result.push(item)
    }
    if (item[childrenKey]) {
      result.push(...findTreeAll(item[childrenKey], predicate, childrenKey))
    }
  })
  return result
}

/**
 * 选择并编辑组件
 * 1. 通过接口加载候选数据，支持树形结构
 * 2. 通过value获取已选数据，扁平化结构
 * 3. 通过columns指定表格列
 * 4. 已选中的数据，可以配置编辑按钮，点击后弹出编辑对话框
 * 5. 最终输出已选中的数据项和编辑后的值，可以设置数据映射
 *
 * amis 的 Table有自己的重渲染逻辑，组件的props和state变化不会触发重渲染，需要手动调用TableStore的相关方法
 * 用 setState 会徒增复杂度，所以用类属性来存储状态
 * 1. （初始化）加载表格数据以及初始化Value（选择项）之后，把选择项中的键值合并到表格数据中
 * 1.1. 表格数据先加载还没有选择项时，直接加载，等选择项加载完后再合并
 * 1.2. 选择项先加载时，先缓存起来，等表格数据加载完后再合并
 * 2. （修改）当编辑表单提交后，把表单数据覆盖到表格数据中更新表格数据，生成新Value，更新表格选择项，触发 onChange
 * 2.1. setState和onChange都会触发componentDidUpdate，如果是分别触发可能会导致死循环：
 *       - setState({ selectedItems }) 触发componentDidUpdate，后续动作不能触发 onChange
 *       - onChange 触发 componentDidUpdate，检测到 props 中的 value 引用变化
 * 3. （修改）当选择了新项后，重新生成Value，更新表格选择项，触发 onChange
 * 3.1. setState和onChange都会触发componentDidUpdate，如果是分别触发的话，可能会导致死循环
 */
class SelectionEditor extends React.Component<any, any> {
  deferredTableData: Deferred<any>
  dataMap: any
  flattenData: any[]
  selected: any[]
  formItemStore: any
  tableStore: any

  constructor(props: any) {
    super(props)
    this.deferredTableData = new Deferred()
    this.deferredTableData.promise.then((tableData) => {
      this.updateTableData(tableData)
    })
    this.dataMap = {}
    this.flattenData = []
  }

  componentDidMount() {
    this.fetchData()
  }

  async fetchData() {
    const {
      source,
      data,
      env: { fetcher },
    } = this.props

    const isApi = isEffectiveApi(source, data)
    if (isApi) {
      const result = await fetcher(source, data)
      const items = (result.data && (result.data.items || result.data)) || []
      if (Array.isArray(items)) this.deferredTableData.resolve(items)
    }

    if (source instanceof Array) this.deferredTableData.resolve(source)
  }

  getFormItemStore() {
    const { store, $path } = this.props
    if (!this.formItemStore) {
      this.formItemStore = store?.children.find((child: any) => child.path === $path)
    }
    return this.formItemStore
  }

  getTableStore() {
    const { store, $path } = this.props
    if (!this.tableStore) {
      this.tableStore = store?.children.find((child: any) => {
        return child.path === `${$path}/selection-table/0/table2`
      })
    }
    return this.tableStore
  }

  shouldComponentUpdate(nextProps: any) {
    return this.props.value !== nextProps.value
  }

  // 如果 value 发生变化，更新选择项，两种情况下会触发：
  // 1. form异步初始化
  // 2. form存在同名字段，或者通过setValue等方法更新了value
  // 组件内部通过onUpdate方法触发的更新引用没有变化（已验证），所以可以直接对比
  componentDidUpdate() {
    this.updateValueToSelect(this.props.value)
  }

  // 检查新增项，根据新值更新tableData
  async updateValueToSelect(newValue: any) {
    if (!Array.isArray(newValue)) return

    newValue.forEach((item) => {
      const key = item[this.props.primaryField || 'id']
      this.dataMap[key] || (this.dataMap[key] = item)
    })
    const tableStore = this.getTableStore()
    const primaryField = this.props.primaryField || 'id'
    const tableData = await this.deferredTableData.promise
    const newTableData = mapTree(tableData, (item: any, children) => {
      const selectedItem = newValue.find(
        (nitem) => nitem[primaryField] === item[primaryField]
      )
      if (!selectedItem) return { ...item, children }
      return { ...item, ...selectedItem, children }
    })

    const expandedRowKeys = findTreeAll(tableStore.rows, (row: any) => row.expanded).map(
      (row: any) => row.data[primaryField]
    )
    this.updateTableData(newTableData)
    tableStore.update({ multiple: true })

    // eslint-disable-next-line eqeqeq
    if (this.selected != newValue) {
      this.selected = newValue
      this.updateSelected(newValue)
    }
    const expandedRows = findTreeAll(
      tableStore.rows,
      (row: any) => expandedRowKeys.includes(row?.data[primaryField]) && row.collapsed
    )
    expandedRows.forEach((row) => tableStore.toggleExpanded(row))
  }

  // 以实现刷新表格内容
  updateTableData(tableData: any) {
    // initRows会自动重用已有的行，所以无脑更新就好了
    this.getTableStore()?.initRows?.(tableData)
    this.deferredTableData.promise = Promise.resolve(tableData)
  }

  // 以更新选中状态，并且尝试重建 valueMap
  updateSelected(selectedItems: any) {
    const tableStore = this.getTableStore()
    const { primaryField = 'id' } = this.props
    tableStore?.updateSelected?.(selectedItems, primaryField)
  }

  // 根据配置创建条目详情
  createSelectedData(item: any) {
    const selectedData = this.props.selectedData
    if (!selectedData) return { ...item }
    return dataMapping(selectedData, item)
  }

  async handleSelect(selected = [], unSelected = []) {
    if (this.props.static) {
      this.props.env.notify?.('warning', '只读模式下不可操作')
      this.updateSelected(this.props.value || [])
      return
    }

    // 重新构建全部最终的选择项
    const finalSelected = selected.map((item) => {
      const key = item[this.props.primaryField || 'id']
      const value = this.dataMap[key]
      if (!value) {
        this.dataMap[key] = this.createSelectedData(item)
        return this.dataMap[key]
      }
      return value
    })
    this.selected = finalSelected
    this.props.onChange?.(finalSelected)
  }

  render() {
    const {
      source,
      static: isStatic,
      value,
      primaryField = 'id',
      render,
      className,
      ...rest
    } = this.props
    const finalColumns = this.getColumnsSchema()
    const selectionEditorClassName = isStatic
      ? 'selection-editor-table static-selection-editor-table'
      : 'selection-editor-table'
    const finalClassName =
      typeof className === 'string'
        ? `${className} ${selectionEditorClassName}`
        : typeof className === 'object'
          ? { ...className, selectionEditorClassName: true }
          : 'selection-editor'
    const node = render(
      'selection-table',
      [
        {
          indentSize: 20,
          ...rest,
          source: '',
          primaryField,
          className: finalClassName,
          type: 'table2',
          name: 'selectItemTable',
          data: null,
          value: null,
          columns: finalColumns,
          selectable: true,
          multiple: true,
          onSelect: this.handleSelect.bind(this),
          selectedItems: value,
        },
      ],
      {
        data: { selectedItems: value || [] },
      }
    )
    return node
  }

  // 创建操作按钮列，并与用户自定义的列合并
  getColumnsSchema() {
    const {
      columns = [],
      primaryField = 'id',
      editColumnProps = {},
      editButtonProps = {},
      editDialogProps = {},
      editFormItems = [],
    } = this.props
    const mergedVisibleOnExpr = editButtonProps.visibleOn
      ? editButtonProps.visibleOn.startsWith('${')
        ? `\${AND(${editButtonProps.visibleOn.slice(
            2,
            -1
          )}, ARRAYSOME(selectedItems, item => item.${primaryField} === ${primaryField}))}`
        : `this.selectedItems.find(item => item.${primaryField} === ${primaryField}) && (${editButtonProps.visibleOn})`
      : `this.selectedItems.find(item => item.${primaryField} === ${primaryField})`
    const dialogActionSchema = {
      label: '设置',
      disabledTip: '只读模式下不可操作',
      ...editButtonProps,
      type: 'action',
      visibleOn: mergedVisibleOnExpr,
      disabled: this.props.static,
      actionType: 'dialog',
      dialog: {
        ...editDialogProps,
        type: 'dialog',
        body: {
          type: 'form',
          body: [
            {
              type: 'hidden',
              name: primaryField,
            },
            ...editFormItems,
          ],
          canAccessSuperData: true,
        },
        onConfirm: ([value]: any[]) => {
          const key = value?.[primaryField]
          const oldValue = this.dataMap[key]
          if (!oldValue) return
          this.dataMap[key] = value
          const newSelected = this.selected.map((item) => {
            if (item[primaryField] === key) return value
            return item
          })
          // 通过delay把更新操作放到异步队列中，避免弹窗卡顿
          defer(() => this.props.onChange?.(newSelected))
        },
      },
    }
    return [
      ...columns,
      {
        label: '操作',
        ...editColumnProps,
        type: 'operation',
        buttons: [dialogActionSchema],
      },
    ]
  }
}

FormItem({
  type: 'selection-editor',
  autoVar: true,
})(SelectionEditor)

export default SelectionEditor
