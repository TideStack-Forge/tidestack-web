import { FormItem } from 'amis'
import React from 'react'

export default class UserRef extends React.Component<any, any> {
  render() {
    const { value, render } = this.props
    // TODO: 先简单实现一下，后续要改成能打开详情
    return render('userRef', {
      type: 'static',
      value,
      label: false,
      wrap: false,
    })
  }
}

FormItem({
  type: 'user-ref',
  autoVar: true,
})(UserRef as any)
