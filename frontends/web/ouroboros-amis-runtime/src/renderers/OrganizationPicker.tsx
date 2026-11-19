import { FormItem, Renderer, filterTree, findTree, findTreeAll, mapTree } from 'amis'
import { reaction } from 'mobx'
import React from 'react'
// @ts-ignore
import './OrganizationPicker.scss'

function joinClassNames(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(' ')
}

class OrganizationPicker extends React.Component<any, any> {
  private disposeValidationReaction?: () => void

  constructor(props: any) {
    super(props)
    this.state = {
      originalData: [], // 原始数据
    }
  }

  componentDidMount() {
    this.bindValidationReaction()
    this.getOriginalData()
    this.setDefaultValue()
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

  setDefaultValue() {
    const {
      pickCompany,
      pickDepartment,
      multiple,
      defaultCurrentCompany,
      defaultCurrentDepartment,
      value,
      data,
      static: isStatic,
    } = this.props
    if (value) return
    if (isStatic) return
    if (pickCompany && defaultCurrentCompany) {
      if (!data.SystemContext?.organization?.id) return
      this.props.onChange(data.SystemContext.organization.id)
    }
    if (pickDepartment && defaultCurrentDepartment) {
      if (!data.SystemContext?.department?.id) return
      this.props.onChange(data.SystemContext.department.id)
    }
  }

  componentDidUpdate(prevProps: Readonly<any>, prevState: Readonly<any>, snapshot?: any): void {
    if (prevProps.formItem !== this.props.formItem) {
      this.bindValidationReaction()
    }

    if (prevProps.parentNode !== this.props.parentNode) {
      const { value } = this.props
      if (!value) return
      const valueArray = Array.isArray(value) ? value : [value]
      const ids = valueArray
        .map((item) => item.id || item)
        .filter(Boolean)
        .flatMap(item => item.split(','))
        .map(item => item.trim())
      const node = findTree(this.state.originalData, (node) => node.id === this.props.parentNode)
      const valueNode = findTreeAll([node].filter(Boolean) as any, (node) => ids.includes(node.id))
      const newIds = valueNode.map((node) => node.id).filter(Boolean)
      if (newIds.length !== ids.length) {
        this.props.onChange(newIds.join(','))
      }
    }

    const { value, static: isStatic } = this.props
    if (!value && !isStatic && prevProps.static) {
      this.setDefaultValue()
    }
  }

  async getOriginalData() {
    const {
      showDepartment,
      showCompany,
      companyId,
      organizationTreeUrl,
      env: { fetcher },
    } = this.props
    const params = this.getRequestParams(showDepartment, showCompany, companyId)
    const api = {
      url: organizationTreeUrl || '/api/organization/tree',
      method: 'get',
      cache: 3000,
    }
    const result = await fetcher(api, params)
    this.setState({ originalData: result?.data?.items || [] })
  }

  getRequestParams(showDepartment = false, showCompany = false, companyId = '') {
    const result = []

    if (showCompany) {
      result.push('company')
    }

    if (showDepartment) {
      result.push('department')
    }

    return {
      types: result.join(','),
      companyId,
    }
  }

  getMappedData(originalData: any, parentNode: any) {
    const {
      pickCompany = true,
      pickDepartment = true,
      disabledOrganizations = [],
      disableChildOrganizations = true
    } = this.props as any

    let filteredData = originalData
    if (parentNode) {
      const found = findTree(originalData, (node) => node.id === parentNode)
      if (!found) return []
      filteredData = [found]
    }

    // 处理互斥组织
    const disabledOrgIds = (
      Array.isArray(disabledOrganizations) ? disabledOrganizations : [disabledOrganizations]
    )
      .map((item) => item.id || item)
      .flatMap((ids) => ids.split(',').map((id: string) => id.trim()))
      .filter(Boolean)

    // 选择公司 & 不选择部门
    if (pickCompany && !pickDepartment) {
      filteredData = filterTree(filteredData, (node) => node.type === 'company')
    }

    // 不选择公司 & 选择部门
    if (!pickCompany && pickDepartment) {
      filteredData = mapTree(filteredData, (node) => {
        // 判断节点类型是否为'company'，并增加disabled属性
        if (node.type === 'company') {
          return {
            ...node,
            disabled: true,
            visible: node.children?.length,
          }
        }
        return { ...node }
      })
    }

    // 应用互斥组织的 disabled 属性
    if (disabledOrgIds.length > 0) {
      filteredData = this.applyDisabledOrganizations(
        filteredData,
        disabledOrgIds,
        disableChildOrganizations
      )
    }

    // 选择部门 & 选择公司
    return filteredData
  }

  // 应用互斥组织的禁用逻辑
  applyDisabledOrganizations(data: any[], disabledOrgIds: string[], includeChildren: boolean) {
    if (!includeChildren) {
      // 不包含下级组织，只禁用指定的组织
      return mapTree(data, (node) => {
        if (disabledOrgIds.includes(node.id)) {
          return {
            ...node,
            disabled: true,
          }
        }
        return { ...node }
      })
    }

    // 包含下级组织，需要递归禁用
    const shouldDisable = (node: any, parentDisabled: boolean = false): boolean => {
      return parentDisabled || disabledOrgIds.includes(node.id)
    }

    const processNode = (node: any, parentDisabled: boolean = false): any => {
      const nodeDisabled = shouldDisable(node, parentDisabled)
      const newNode = {
        ...node,
        disabled: nodeDisabled || node.disabled,
      }

      if (node.children && Array.isArray(node.children)) {
        newNode.children = node.children.map((child: any) =>
          processNode(child, nodeDisabled)
        )
      }

      return newNode
    }

    return data.map((node) => processNode(node))
  }

  //TODO: 这个方法当前没有用到，待评估
  handleChange(val: any) {
    const { onChange } = this.props
    // 去除children 字段

    // 单选-返回对象；多选-返回数组
    if (Array.isArray(val)) {
      const finalArrayValue = val.map((item) => {
        const { children, ...rest } = item
        return { ...rest }
      })
      onChange?.(finalArrayValue)
      return
    }
    if (val) {
      const { children, ...finalObjectValue } = val
      onChange?.(finalObjectValue)
    } else {
      onChange?.(null)
    }
  }

  render() {
    const {
      render,
      itemHeight,
      maxTagCount,
      static: isStatic,
      value,
      showErrorMsg,
      parentNode,
      formItem,
      inputClassName,
      buildItemProps,
      quickEditFormRef,
      quickEditFormItemRef,
      formItemRef,
      ...rest
    } = this.props
    void showErrorMsg
    void buildItemProps
    void quickEditFormRef
    void quickEditFormItemRef
    void formItemRef
    const { originalData = [] } = this.state
    const mappedData = this.getMappedData(originalData, parentNode)
    const innerInputClassName = joinClassNames(
      'ouroboros-organization-picker',
      inputClassName,
      formItem && !formItem.valid && 'is-error'
    )
    const node = render(
      'organization-picker',
      {
        placeholder: isStatic ? '' : '请选择',
        options: mappedData,
        autoCheckChildren: false,
        cascade: true,
        withChildren: true,
        searchable: true,
        ...rest,
        label: false,
        wrap: false,
        type: 'tree-select',
        name: '__organizationPicker',
        inputClassName: innerInputClassName,
        valueField: 'id',
        labelField: 'name',
        itemHeight: itemHeight || 32,
        maxTagCount: maxTagCount || 5,
        static: isStatic,
      },
      {
        data: { __organizationPicker: value },
      }
    )
    return node
  }
}

@FormItem({
  type: 'organization-picker',
  autoVar: true,
  strictMode: false
})
class OrganizationPickerRenderer extends OrganizationPicker {}

export default OrganizationPicker
