import {
  OptionsControl,
  autobind,
  createObject,
  isEffectiveApi,
  isPureVariable,
  resolveVariableAndFilter,
} from 'amis'
import PickerControl from 'amis/lib/renderers/Form/Picker'

const PICKER_ROW_DBCLICK_ACTION_FLAG = 'picker-row-dblclick-confirm'

export default class OuroborosPickerControl extends PickerControl {
  @autobind
  fetchOptions(): any {
    const {
      formItem,
      valueField = 'value',
      labelField = 'label',
      source,
      data,
    } = this.props
    const value = formItem?.value

    // 如果 value 是对象或对象数组，说明已经包含完整数据，直接设置为 options，不需要请求接口
    if (value && typeof value === 'object') {
      const valueArray = Array.isArray(value) ? value : [value]
      if (valueArray.length > 0 && typeof valueArray[0] === 'object') {
        formItem?.setOptions(valueArray)
        return
      }
    }
    let selectedOptions: any

    if (
      !source ||
      !formItem ||
      (valueField || 'value') === (labelField || 'label') ||
      ((selectedOptions = formItem.getSelectedOptions(value)) &&
        (!selectedOptions.length ||
          selectedOptions[0][valueField || 'value'] !==
            selectedOptions[0][labelField || 'label']))
    ) {
      return
    }

    const nomalizedValue = Array.isArray(value)
      ? value.map((item) =>
          typeof item === 'object' ? item[valueField || 'value'] : item
        )
      : value

    const ctx = createObject(data, {
      [valueField || 'value']: nomalizedValue,
    })

    if (isPureVariable(source)) {
      formItem.setOptions(resolveVariableAndFilter(source, data, '| raw'))
    } else if (isEffectiveApi(source, ctx)) {
      return formItem.loadOptions(source, ctx, {
        autoAppend: true,
      })
    }
  }

  @autobind
  buildSchema(props: any) {
    const schema = super.buildSchema(props) as any

    if (props.multiple || props.embed || props.disabled) {
      return schema
    }

    const rowDbClickActions = schema?.onEvent?.rowDbClick?.actions ?? []
    const hasPickerRowDbClickAction = rowDbClickActions.some(
      (action: any) => action?.from === PICKER_ROW_DBCLICK_ACTION_FLAG
    )

    if (hasPickerRowDbClickAction) {
      return schema
    }

    return {
      ...schema,
      onEvent: {
        ...schema?.onEvent,
        rowDbClick: {
          ...schema?.onEvent?.rowDbClick,
          actions: [
            ...rowDbClickActions,
            {
              actionType: 'custom',
              from: PICKER_ROW_DBCLICK_ACTION_FLAG,
              script: async (_renderer: any, _doAction: any, event: any) => {
                const rowData = event?.data?.item
                if (!rowData) {
                  return
                }

                await this.handleChange([rowData])
                this.close()
              },
            },
          ],
        },
      },
    }
  }

  // 这个重写是为了解决 input-table 中使用 picker 时破坏校验功能的问题
  // TODO: #10568 已完成合并，待测试后删除
  @autobind
  renderBody({ popOverContainer }: any = {}) {
    const {
      render,
      selectedOptions,
      options,
      multiple,
      valueField,
      embed,
      source,
      strictMode,
      testIdBuilder,
    } = this.props
    const { maxTagCount, overflowTagPopoverInCRUD, displayPosition } =
      this.getOverflowConfig()

    const body = render('modal-body', this.state.schema, {
      value: selectedOptions,
      valueField,
      primaryField: valueField,
      options: source ? [] : options,
      multiple,
      strictMode,
      onSelect: embed ? this.handleSelect : undefined,
      testIdBuilder: testIdBuilder?.getChild('body-schema'),
      ref: this.crudRef,
      popOverContainer,
      ...(embed || (Array.isArray(displayPosition) && displayPosition.includes('crud'))
        ? { maxTagCount, overflowTagPopover: overflowTagPopoverInCRUD }
        : {}),
      /** 清空上游组件传过来的属性 */
      buildItemProps: null,
      quickEditFormRef: null,
      quickEditFormItemRef: null,
      formItemRef: null,
      /** -END- 清空上游组件传过来的属性 */
    }) as JSX.Element

    return body
  }
}

@OptionsControl({
  type: 'picker',
  name: 'OuroborosPicker',
  autoLoadOptionsFromSource: false,
  sizeMutable: false,
  override: true,
  weight: -200,
})
export class OuroborosPickerRenderer extends OuroborosPickerControl {}
