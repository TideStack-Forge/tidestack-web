import { FormItem } from 'amis'
import React from 'react'
class StaticCheckboxes extends React.Component<any, any> {
  static defaultProps: any = {
    placeholder: '-'
  }
  render() {
    const { options, value, placeholder } = this.props
    if (!value) {
      return (
        <div className="cxd-Form-static cxd-Form-control is-inline is-thin">
          <div className="cxd-Words-field cxd-Form-control is-inline is-thin">
            <span className="text-muted">{placeholder}</span>
          </div>
        </div>
      )
    }

    const valueArray = value.split(',')
    const labels = options
      .filter((option: any) => valueArray.includes(option.value))
      .map((option: any) => option.label)

    return (
      <div className="cxd-Form-static cxd-Form-control is-inline is-thin">
        <div className="cxd-Words-field cxd-Form-control is-inline is-thin">
          {labels.join(', ')}
        </div>
      </div>
    )
  }
}

FormItem({
  type: 'static-checkboxes',
  autoVar: true,
})(StaticCheckboxes as any)

export default StaticCheckboxes
