import { FormItem } from 'amis'
import React from 'react'

export default class CompanyRef extends React.Component<any, any> {
  render() {
    const { value = {}, render, ...rest } = this.props
    // TODO: 先简单实现一下，后续要改成能打开详情
    return render('companyRef', {
      type: 'static',
      value: value?.name,
      label: false,
      wrap: false,
    })
  }
}

FormItem({
  type: 'company-ref',
  autoVar: true,
})(CompanyRef as any)
