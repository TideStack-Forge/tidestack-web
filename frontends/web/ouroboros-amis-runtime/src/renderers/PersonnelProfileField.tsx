import { FormItem } from 'amis'
import type { FormControlProps } from 'amis'

export interface PersonnelProfileFieldProps extends FormControlProps {
  fieldName?: string
}

export default function PersonnelProfileField(props: PersonnelProfileFieldProps) {
  const { fieldName, value, render } = props

  return render('personnel-profile-field-placeholder', {
    type: 'static',
    value: value ?? `[人员档案字段: ${fieldName || '未指定'}]`,
    label: false,
    wrap: false,
    className: 'text-muted'
  })
}

FormItem({
  type: 'personnel-profile-field',
  autoVar: true,
})(PersonnelProfileField)
