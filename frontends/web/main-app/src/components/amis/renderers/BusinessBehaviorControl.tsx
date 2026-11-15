import type { FormControlProps, Schema } from 'amis'
import { isEqual } from 'lodash'

/** Isolated AMIS form scope keeps editor-only values out of model metadata. */
export function renderBusinessBehaviorControl(
  render: FormControlProps['render'],
  region: string,
  schema: Schema,
  props: { value?: unknown; disabled?: boolean; onChange: (value: any) => unknown }
) {
  return render(
    region,
    {
      type: 'form',
      wrapWithPanel: false,
      mode: 'normal',
      inheritData: false,
      canAccessSuperData: false,
      preventEnterSubmit: true,
      formLazyChange: false,
      actions: [],
      body: [
        {
          ...schema,
          name: 'value',
          label: false,
          className: 'm-b-none',
          disabled: props.disabled,
        },
      ],
    },
    {
      data: { value: props.value },
      onChange: async (
        values: { value?: unknown },
        _diff: unknown,
        form: { store: { changeValue: (name: string, value: unknown) => void } }
      ) => {
        if (isEqual(values.value, props.value)) return
        if ((await props.onChange(values.value)) === false)
          form.store.changeValue('value', props.value)
      },
    }
  )
}
