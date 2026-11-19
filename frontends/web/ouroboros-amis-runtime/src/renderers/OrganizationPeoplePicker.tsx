import {
  OptionsControl,
  GroupedSelection,
  Tag,
  autobind,
  toast,
} from 'amis'
import React from 'react'
import { isEqual, isEqualWith } from 'lodash'

import { default as PickerControl } from './Picker'
import type { PickerProps, PickerState } from './Picker'

// translate 找不到 key 时返回 key 本身，需要对比判断是否翻译成功
function tr(
  translate: ((key: string, ...args: any[]) => string) | undefined,
  key: string,
  fallback: string,
  params?: Record<string, any>
): string {
  if (!translate) return fallback
  const result = params ? translate(key, params) : translate(key)
  return result === key ? fallback : result
}

// 组织人员选择控件（弹窗内部的选择器）
export class OrganizationPeopleSelectControl extends React.Component<any, any> {
  private organizationIds: string[] = []
  private disabledOrganizationIds: Set<string> = new Set()

  constructor(props: any) {
    super(props)
    this.state = {
      departments: [],
      people: [],
      allPeople: [],
      selectedPeople: [],
      loading: true,
      peopleLoading: false,
      currentDepartmentId: null,
    }
  }

  // API 配置，子类可通过 defaultProps 覆盖
  get apiConfig() {
    return {
      listUrl: this.props.listUrl || '/api/organization/employees',
      getByIdsUrl: this.props.getByIdsUrl || '/api/organization/employees',
    }
  }

  filterOrganization(tree: any[]) {
    const { allowCompanyLevelSelect = false } = this.props
    let { organizations = [] } = this.props
    if (!Array.isArray(organizations)) {
      organizations = [organizations]
    }

    const organizationIds = organizations
      .map((organization: any) => organization.id || organization)
      .filter(Boolean)
      .flatMap((ids: any) => ids.split(',').map((s: any) => s.trim()))

    this.organizationIds = organizationIds
    this.disabledOrganizationIds.clear()

    const disableCompany = allowCompanyLevelSelect
      ? (node: any) => node
      : (node: any) => {
          if (node.type === 'company') {
            return { ...node, disabled: true }
          }
          return node
        }

    const newTree = tree
      .map((node: any) =>
        this.processOrganizationNode(node, {
          organizationIds,
          mapper: disableCompany,
          shouldShow: null,
        })
      )
      .filter(Boolean)
    return newTree
  }

  processOrganizationNode(
    node: any,
    context: {
      organizationIds: string[]
      shouldShow: null | boolean
      mapper: (node: any) => any
    }
  ): any {
    if (!node) return null

    const { organizationIds, mapper } = context
    const nodeId = node.id || node.key

    const shouldInclude =
      context.shouldShow === true ||
      organizationIds.length === 0 ||
      organizationIds.includes(nodeId) ||
      this.hasChildInOrganizations(node, organizationIds)

    if (!shouldInclude) {
      return null
    }

    let newNode = mapper({ ...node })

    const isInOrganizationIds =
      organizationIds.length === 0 || organizationIds.includes(nodeId)
    const isParentNode =
      !isInOrganizationIds && this.hasChildInOrganizations(node, organizationIds)

    if (isParentNode) {
      newNode = { ...newNode, disabled: true }
      this.disabledOrganizationIds.add(nodeId)
    }

    if (newNode.disabled && !this.disabledOrganizationIds.has(nodeId)) {
      this.disabledOrganizationIds.add(nodeId)
    }

    if (node.children && Array.isArray(node.children)) {
      const filteredChildren = node.children
        .map((child: any) =>
          this.processOrganizationNode(child, {
            ...context,
            shouldShow: context.shouldShow || isInOrganizationIds,
          })
        )
        .filter(Boolean)

      newNode.children = filteredChildren.length > 0 ? filteredChildren : undefined
    }

    return newNode
  }

  hasChildInOrganizations(node: any, organizationIds: string[]): boolean {
    if (!node) return false

    const nodeId = node.id || node.key
    if (organizationIds.includes(nodeId)) {
      return true
    }

    if (node.children && Array.isArray(node.children)) {
      return node.children.some((child: any) =>
        this.hasChildInOrganizations(child, organizationIds)
      )
    }

    return false
  }

  componentDidMount() {
    const { static: isStatic = false } = this.props
    this.setSelectedPeople()
    if (isStatic) return
    this.fetchDepartments()
  }

  componentDidUpdate(prevProps: any) {
    const { value } = this.props
    const prevValue = prevProps.value
    if (!isEqual(value, prevValue)) {
      this.setSelectedPeople()
    }
  }

  async setSelectedPeople() {
    const { value, valueField = 'id', delimiter = ',' } = this.props

    const valueArray = !value
      ? []
      : Array.isArray(value)
        ? value
        : typeof value === 'string'
          ? value.split(delimiter)
          : [value]

    let peopleValue = []

    if (valueArray.length === 0) {
      this.setState({ selectedPeople: [] })
      return
    }

    if (typeof valueArray[0] === 'object') {
      peopleValue = valueArray
    } else {
      peopleValue = this.state?.allPeople.filter((item: any) =>
        valueArray.includes(item[valueField])
      )

      if (!peopleValue || peopleValue.length !== valueArray.length) {
        const people = await this.getPeopleByIds(valueArray)
        const newAllPeople = this.mergePeople(this.state.allPeople, people)
        this.setState({
          allPeople: newAllPeople,
          selectedPeople: people,
          peopleLoading: false,
        })
        return
      }
    }
    this.setState({ selectedPeople: peopleValue || [] })
  }

  mergePeople(existingEmployees: any[], newEmployees: any[]) {
    const { valueField = 'id' } = this.props
    const merged = [...existingEmployees]

    newEmployees.forEach((newEmp) => {
      const exists = merged.find((emp) => emp[valueField] === newEmp[valueField])
      if (!exists) {
        merged.push(newEmp)
      }
    })

    return merged
  }

  async fetchDepartments() {
    const api = {
      url: this.props.organizationTreeUrl || '/api/organization/tree',
      method: 'get',
      cache: 3000,
    }
    const result = await this.props.env.fetcher(api)
    const items = (result.data && (result.data.items || result.data)) || []
    const newOriganizationTree = this.filterOrganization(items)
    this.setState({ departments: newOriganizationTree, loading: false })

    if (this.organizationIds.length === 1) {
      const defaultOrgId = this.organizationIds[0]
      this.fetchPeople(defaultOrgId)
    }
  }

  getNodeType(nodeId: string): string | null {
    const findNodeType = (tree: any[], id: string): string | null => {
      for (const node of tree) {
        if (node.id === id) return node.type
        if (node.children) {
          const found = findNodeType(node.children, id)
          if (found) return found
        }
      }
      return null
    }
    return findNodeType(this.state.departments, nodeId)
  }

  async fetchPeople(departmentValue: any) {
    this.setState({
      peopleLoading: true,
      currentDepartmentId: departmentValue,
    })

    const nodeType = this.getNodeType(departmentValue)
    const paramName =
      nodeType === 'company'
        ? 'companyId'
        : nodeType === 'position'
          ? 'positionId'
          : 'departmentId'

    const api = {
      url: `${this.apiConfig.listUrl}?${paramName}=${departmentValue}`,
      method: 'get',
      cache: 3000,
    }
    const result = await this.props.env.fetcher(api)
    const items = (result.data && (result.data.items || result.data)) || []

    const newAllEmployees = this.mergePeople(this.state.allPeople, items)

    this.setState({
      people: items,
      allPeople: newAllEmployees,
      peopleLoading: false,
    })
  }

  async getPeopleByIds(employeeIds: string[]) {
    if (!employeeIds || !employeeIds.length) return []
    const api = {
      url: this.apiConfig.getByIdsUrl,
      method: 'get',
      cache: 3000,
      data: {
        id: employeeIds.join(','),
      },
    }
    const result = await this.props.env.fetcher(api)
    const items = (result.data && (result.data.items || result.data)) || []
    return items
  }

  handleDepartmentSelect(departmentValue: any) {
    if (departmentValue) {
      if (this.disabledOrganizationIds.has(departmentValue)) {
        this.setState({
          people: [],
          peopleLoading: false,
          currentDepartmentId: departmentValue,
        })
      } else {
        this.fetchPeople(departmentValue)
      }
    }
  }

  handlePeopleSelect(value: any) {
    const { multiple = false, valueField = 'id' } = this.props
    const { selectedPeople, people } = this.state

    if (!multiple) {
      this.setState({ selectedPeople: value })
      this.changeValue(value)
      return
    }

    let newSelectedPeople = [...selectedPeople]

    const currentDepartmentPeopleIds = people.map((emp: any) => emp[valueField])
    const currentDepartmentSelected = value.filter((emp: any) =>
      currentDepartmentPeopleIds.includes(emp[valueField])
    )

    newSelectedPeople = newSelectedPeople.filter(
      (emp: any) => !currentDepartmentPeopleIds.includes(emp[valueField])
    )

    newSelectedPeople = [...newSelectedPeople, ...currentDepartmentSelected]

    this.setState({ selectedPeople: newSelectedPeople })
    this.changeValue(newSelectedPeople)
  }

  handleClose(employeeId: any) {
    const { selectedPeople } = this.state
    const { valueField = 'id' } = this.props
    const updatedEmployees = selectedPeople.filter(
      (i: any) => i[valueField] !== employeeId
    )
    this.setState({ selectedPeople: updatedEmployees })
    this.changeValue(updatedEmployees)
  }

  changeValue(value: any) {
    const {
      multiple = false,
      joinValues = true,
      extractValue = false,
      valueField = 'id',
      delimiter = ',',
    } = this.props

    let newValue: any = ''
    if (!multiple) {
      newValue = value[0]
    } else {
      newValue = value
    }

    if (joinValues || extractValue) {
      newValue = value.map((item: any) => item[valueField])
    }

    if (joinValues) {
      newValue = newValue.join(delimiter)
    }
    this.props.onChange?.(newValue)
  }

  getCurrentDepartmentSelectedEmployees() {
    const { people, selectedPeople } = this.state
    const { valueField = 'id' } = this.props

    if (!people.length) return []

    const currentDepartmentEmployeeIds = people.map((emp: any) => emp[valueField])
    return selectedPeople.filter((emp: any) =>
      currentDepartmentEmployeeIds.includes(emp[valueField])
    )
  }

  validate() {
    const { selectedPeople = [] } = this.state
    const { maxLength, minLength = 1, multiple = false, translate } = this.props

    if (!multiple) {
      if (selectedPeople.length < 1) {
        return tr(translate, 'OrganizationPeoplePicker.validation.minOne', '至少选择1个')
      }
      return ''
    }
    if (maxLength && selectedPeople.length > maxLength) {
      return tr(
        translate,
        'OrganizationPeoplePicker.validation.maxLength',
        `最多只能选择${maxLength}个`,
        { maxLength }
      )
    }
    if (selectedPeople.length < minLength) {
      return tr(
        translate,
        'OrganizationPeoplePicker.validation.minLength',
        `至少选择${minLength}个`,
        { minLength }
      )
    }
    return ''
  }

  getSelectedPeople() {
    return this.state.selectedPeople
  }

  render() {
    const { departments, people, selectedPeople = [], currentDepartmentId } = this.state
    const {
      maxLength,
      multiple = false,
      static: isStatic = false,
      disabled,
      render,
      disabledPeople = [],
      valueField = 'id',
      labelField = 'name',
      translate,
    } = this.props

    const disabledPeopleIds = (
      Array.isArray(disabledPeople) ? disabledPeople : [disabledPeople]
    )
      .map((item) => item[valueField] || item)
      .flatMap((ids) => ids.split(',').map((id: string) => id.trim()))
      .filter(Boolean)
    const finalPeople = people.map((employee: any) => {
      if (disabledPeopleIds.includes(employee[valueField])) {
        return {
          ...employee,
          disabled: true,
        }
      }
      return employee
    })

    const currentDepartmentSelected = this.getCurrentDepartmentSelectedEmployees()

    return (
      <div className="bg-white p-4 rounded-md">
        {isStatic ? (
          <div>
            {!selectedPeople || !selectedPeople.length
              ? tr(translate, 'OrganizationPeoplePicker.noData', '暂无数据')
              : selectedPeople.map((employee: any) => {
                  return (
                    <Tag closable={false} color="processing" key={employee[valueField]}>
                      {employee[labelField]}
                    </Tag>
                  )
                })}
          </div>
        ) : (
          <div>
            <div
              className="flex flex-wrap justify-between"
              style={{ minHeight: '350px' }}>
              <div
                className="rounded border-gray-200 border-solid border flex flex-col"
                style={{ width: '49.5%' }}>
                <h4 className="bg-gray-100 m-0 py-3 pl-8 mb-2 flex-shrink-0">
                  {tr(translate, 'OrganizationPeoplePicker.department', '部门')}
                </h4>
                {this.state.loading ? (
                  <div className="py-3 pl-8">
                    {tr(translate, 'OrganizationPeoplePicker.loading', '加载中...')}
                  </div>
                ) : (
                  render('tree', {
                    type: 'input-tree',
                    label: false,
                    name: 'selected_department',
                    options: departments,
                    onChange: this.handleDepartmentSelect.bind(this),
                    initiallyOpen: this.organizationIds.length,
                    searchable: true,
                    unfoldedLevel: 0,
                    mode: 'flex',
                    labelField: 'name',
                    valueField: 'id',
                    className: 'flex-grow mt-0 employee-picker--select-department',
                    inputClassName: 'border-0 w-full h-full p-0',
                    value:
                      this.organizationIds.length === 1
                        ? this.organizationIds[0]
                        : undefined,
                  })
                )}
              </div>
              <div
                className="rounded border-gray-200 border-solid border"
                style={{ width: '49.5%' }}>
                <h4 className="bg-gray-100 m-0 py-3 pl-8 mb-2">
                  {tr(translate, 'OrganizationPeoplePicker.people', '人员')}
                  {multiple && finalPeople.length > 0 && (
                    <span className="text-sm text-gray-500 ml-2">
                      (
                      {tr(
                        translate,
                        'OrganizationPeoplePicker.currentDepartmentSelected',
                        '当前部门已选'
                      )}
                      : {currentDepartmentSelected.length}/{finalPeople.length})
                    </span>
                  )}
                </h4>
                {this.state.peopleLoading ? (
                  <div className="py-3 pl-8">
                    {tr(translate, 'OrganizationPeoplePicker.loading', '加载中...')}
                  </div>
                ) : !currentDepartmentId && finalPeople.length === 0 ? (
                  <div className="py-3 pl-8 text-gray-500">
                    {tr(
                      translate,
                      'OrganizationPeoplePicker.selectDepartmentFirst',
                      '请先选择部门'
                    )}
                  </div>
                ) : currentDepartmentId &&
                  this.disabledOrganizationIds.has(currentDepartmentId) ? (
                  <div className="py-3 pl-8 text-gray-500">
                    {tr(
                      translate,
                      'OrganizationPeoplePicker.organizationNotInRange',
                      '该公司/部门不在可选择范围内'
                    )}
                  </div>
                ) : currentDepartmentId && finalPeople.length === 0 ? (
                  <div className="py-3 pl-8 text-gray-500">
                    {tr(
                      translate,
                      'OrganizationPeoplePicker.departmentEmpty',
                      '该部门人员为空'
                    )}
                  </div>
                ) : (
                  <GroupedSelection
                    options={finalPeople}
                    value={currentDepartmentSelected}
                    valueField={valueField}
                    labelField={labelField}
                    onChange={this.handlePeopleSelect.bind(this)}
                    checkAll={multiple}
                    checkAllLabel={tr(
                      translate,
                      'OrganizationPeoplePicker.selectAll',
                      '全选'
                    )}
                    disabled={!multiple && selectedPeople.length >= 1}
                  />
                )}
              </div>
            </div>

            <div style={{ marginTop: '20px' }}>
              <span
                className={
                  maxLength && maxLength < selectedPeople.length ? 'text-red-500' : ''
                }>
                {tr(translate, 'OrganizationPeoplePicker.selected', '已选择')}
                {multiple
                  ? '(' +
                    (selectedPeople.length + (maxLength ? `/${maxLength}` : '')) +
                    ')'
                  : null}
                ：
              </span>
              {!selectedPeople || !selectedPeople.length
                ? tr(translate, 'OrganizationPeoplePicker.noData', '暂无数据')
                : selectedPeople.map((employee: any) => {
                    return (
                      <Tag
                        key={employee[valueField]}
                        closable={!disabled}
                        color="processing"
                        className="rounded-sm"
                        onClose={this.handleClose.bind(this, employee[valueField])}>
                        {employee[labelField]}
                      </Tag>
                    )
                  })}
            </div>
          </div>
        )}
      </div>
    )
  }
}

interface OrganizationPeoplePickerControlState extends PickerState {
  staticDisplayValue: string
}

// 组织人员选择器（外层 Picker 组件）
export class OrganizationPeoplePickerControl extends PickerControl {
  static defaultProps: Partial<PickerProps> = {
    modalMode: 'dialog',
    multiple: false,
    placeholder: 'OrganizationPeoplePicker.placeholder',
    labelField: 'name',
    valueField: 'id',
    listUrl: '/api/organization/employees',
    getByIdsUrl: '/api/organization/employees',
    minLength: 1,
    pickerSchema: {
      mode: 'list',
    },
    embed: false,
    overflowConfig: {
      maxTagCount: 3,
      displayPosition: ['select', 'crud'],
      overflowTagPopover: {
        placement: 'top',
        trigger: 'hover',
        showArrow: false,
        offset: [0, -5],
      },
      overflowTagPopoverInCRUD: {
        placement: 'bottom',
        trigger: 'hover',
        showArrow: false,
        offset: [0, 0],
      },
    },
    allowCompanyLevelSelect: false,
    modalClassName: 'organization-people-picker-modal',
    selectControlClass: OrganizationPeopleSelectControl,
  }

  pickerRef: any = null

  state: OrganizationPeoplePickerControlState = {
    isOpened: false,
    schema: this.buildSchema(this.props),
    isFocused: false,
    staticDisplayValue: '',
  }

  constructor(props: PickerProps) {
    super(props)
    const { formItem, labelField, valueField } = props
    formItem?.config({
      labelField,
      valueField,
    })
  }

  componentDidMount(): void {
    const { static: isStatic } = this.props
    if (isStatic) {
      this.loadStaticDisplayValue()
      return
    }
    this.setDefaultValue()
  }

  setDefaultValue() {
    const {
      defaultCurrentPerson = false,
      defaultCurrentUser = false,
      multiple,
      value,
      data,
      onChange,
      setOptions,
      static: isStatic,
    } = this.props
    if (isStatic) return
    if (!value && defaultCurrentUser && !multiple) {
      const user = data.SystemContext?.user || data.SystemContext?.userInfo
      const userIdentity = user?.userIdentity || user?.id
      if (!userIdentity) return
      setOptions?.([
        {
          ...user,
          userIdentity,
          displayName: user?.displayName || userIdentity,
        },
      ])
      onChange?.(userIdentity)
      return
    }
    if (!value && defaultCurrentPerson && !multiple) {
      if (!data.SystemContext?.employee?.id) return
      setOptions?.([data.SystemContext.employee])
      onChange?.(data.SystemContext.employee.id)
    }
  }

  componentDidUpdate(prevProps: PickerProps): void {
    if (this.props.static && !isEqualWith(prevProps.value, this.props.value)) {
      this.loadStaticDisplayValue()
    }
    if (!this.props.static && prevProps.static) {
      this.setDefaultValue()
    }
  }

  @autobind
  fetchOptions(): any {
    const { value, formItem, valueField, labelField, getByIdsUrl } = this.props
    if (!formItem || (valueField || 'value') === (labelField || 'label')) {
      return
    }

    const selectedOptions = formItem.getSelectedOptions(value)
    if (
      selectedOptions &&
      (!selectedOptions.length ||
        selectedOptions[0][valueField || 'value'] !==
          selectedOptions[0][labelField || 'label'])
    ) {
      return
    }

    const valueArray = (
      Array.isArray(value)
        ? value
        : typeof value === 'string'
          ? value.split(',').map((item) => item.trim())
          : [value]
    ).filter((item) => item)

    if (!valueArray.length || typeof valueArray[0] === 'object') {
      return
    }

    const api: any = {
      url: getByIdsUrl,
      method: 'get',
      cache: 3000,
    }
    const ctx = {
      id: valueArray.join(','),
    }

    return formItem.loadOptions(api, ctx, {
      autoAppend: true,
    })
  }

  @autobind
  async handleModalConfirm(
    values: Array<any>
  ) {
    const {
      setOptions,
      name = '__organization_people_picker__',
      maxLength,
      multiple = false,
      translate,
    } = this.props

    let selectedItems = values[0][name]

    if (
      selectedItems &&
      (typeof selectedItems === 'string' ||
        (Array.isArray(selectedItems) &&
          selectedItems.length > 0 &&
          typeof selectedItems[0] === 'string'))
    ) {
      if (this.pickerRef && this.pickerRef.getSelectedPeople) {
        selectedItems = this.pickerRef.getSelectedPeople()
      }
    }

    if (
      selectedItems === undefined &&
      this.pickerRef &&
      this.pickerRef.getSelectedPeople
    ) {
      selectedItems = this.pickerRef.getSelectedPeople()
    }

    if (!selectedItems) {
      selectedItems = []
    } else if (typeof selectedItems === 'object' && !Array.isArray(selectedItems))
      selectedItems = [selectedItems]
    else if (typeof selectedItems === 'string')
      selectedItems = selectedItems
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item)

    if (multiple && maxLength && selectedItems && selectedItems.length > maxLength) {
      toast.error(
        tr(
          translate,
          'OrganizationPeoplePicker.validation.maxLengthWithCount',
          `最多只能选择${maxLength}个人员，当前已选择${selectedItems.length}个`,
          { maxLength, currentLength: selectedItems.length }
        )
      )
      return
    }

    if (this.pickerRef && this.pickerRef.validate) {
      const validateResult = this.pickerRef.validate()
      if (validateResult) {
        toast.error(validateResult)
        return
      }
    }

    await this.handleChange(selectedItems)
    setOptions?.(selectedItems)
    this.close()
  }

  @autobind
  selectControlRef(ref: any) {
    this.pickerRef = ref
  }

  @autobind
  renderBody() {
    const {
      render,
      name = '__organization_people_picker__',
      disabledPeople,
      formItem,
      value,
      selectControlClass: SelectControlClass = OrganizationPeopleSelectControl,
    } = this.props

    let initialValue = value
    if (formItem && value) {
      const selectedOptions = formItem.getSelectedOptions(value)
      if (selectedOptions && selectedOptions.length > 0) {
        initialValue = selectedOptions
      }
    }

    return render(
      'modal-body',
      {
        type: 'form',
        wrapWithPanel: false,
        data: {
          [name]: initialValue,
        },
        body: [
          {
            name,
            asFormItem: true,
            children: ({ value, onChange }: { value: any; onChange: any }) => {
              return (
                <SelectControlClass
                  {...this.props}
                  value={value}
                  onChange={onChange}
                  extractValue={false}
                  joinValues={false}
                  disabledPeople={disabledPeople}
                  ref={this.selectControlRef}
                />
              )
            },
          },
        ],
      },
      {
        data: this.props.data,
      }
    )
  }

  async loadStaticDisplayValue() {
    const { value, labelField = 'name', getByIdsUrl, translate } = this.props
    const valueArray = (
      Array.isArray(value)
        ? value
        : typeof value === 'string'
          ? value.split(',').map((item) => item.trim())
          : [value]
    ).filter((item) => item)
    let names: string[] = []

    if (!valueArray.length) {
      names = []
    } else if (typeof valueArray[0] === 'object') {
      names = valueArray.map((item: any) => item[labelField])
    } else if (typeof valueArray[0] === 'string' || typeof valueArray[0] === 'number') {
      const ids = valueArray.join(',')
      const api = {
        url: getByIdsUrl,
        method: 'get',
        cache: 3000,
        data: {
          id: ids,
        },
      }
      const result = await this.props.env.fetcher(api as any)
      const items = result.data?.items || result.data || []
      names = Array.isArray(items)
        ? items.map((item: any) => item[labelField])
        : items[labelField]
          ? [items[labelField]]
          : [
              tr(
                translate,
                'OrganizationPeoplePicker.error.apiResponse',
                '接口返回数据错误'
              ),
            ]
    } else {
      names = [tr(translate, 'OrganizationPeoplePicker.error.valueFormat', '值格错误')]
    }
    this.setState({
      staticDisplayValue: names.length ? names.join(', ') : '',
    })
  }

  renderStatic() {
    const { staticDisplayValue } = this.state
    return (
      <div className="cxd-Form-static cxd-Form-control">
        {staticDisplayValue || <span className="text-muted">-</span>}
      </div>
    )
  }

  render(): JSX.Element {
    const { static: isStatic } = this.props
    if (isStatic) {
      return this.renderStatic()
    }
    return super.render()
  }
}

// 员工选择器
@OptionsControl({
  type: 'employee-picker',
  autoVar: true,
})
export class EmployeePicker extends OrganizationPeoplePickerControl {
  static defaultProps = {
    ...OrganizationPeoplePickerControl.defaultProps,
    placeholder: 'EmployeePicker.placeholder',
    labelField: 'name',
    valueField: 'id',
    listUrl: '/api/organization/employees',
    getByIdsUrl: '/api/organization/employees',
    modalClassName: 'employee-picker-modal',
  }
}

// 用户选择器
@OptionsControl({
  type: 'user-picker',
  autoVar: true,
})
export class UserPicker extends OrganizationPeoplePickerControl {
  static defaultProps = {
    ...OrganizationPeoplePickerControl.defaultProps,
    placeholder: 'UserPicker.placeholder',
    labelField: 'displayName',
    valueField: 'userIdentity',
    listUrl: '/api/organization/users',
    getByIdsUrl: '/api/organization/users',
    modalClassName: 'user-picker-modal',
  }
}

export default OrganizationPeoplePickerControl
