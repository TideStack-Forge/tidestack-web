import { FormItem } from 'amis'
import React from 'react'

export default class EmployeeRef extends React.Component<any, any> {
  render() {
    const { value = {}, render } = this.props
    // TODO: 先简单实现一下，后续要改成能打开详情
    return render('employeeRef', {
      type: 'static',
      value: value?.name,
      label: false,
      wrap: false,
    })
  }
}

FormItem({
  type: 'employee-ref',
  autoVar: true,
})(EmployeeRef as any)
