import { Renderer } from 'amis'
import FieldSetControl from 'amis/lib/renderers/Form/FieldSet'

/**
 * 把 fieldSet body 中的 input-table 包裹到 panel 中，来解决 input-table 的各种奇怪问题
 * @param body fieldSet 的 body
 * @returns
 */
function wrapInputTable(body: any): any {
  if (!body) {
    return body
  }
  const children = Array.isArray(body) ? body : [body]
  return children.map((child: any) => {
    if (!child || child.type !== 'input-table') return child
    return {
      type: 'panel',
      className: 'shadow-none border-none p-0 m-0',
      bodyClassName: 'p-0 m-0',
      body: child,
    }
  })
}

@Renderer({
  type: 'fieldset',
  weight: -200,
  name: 'OuroborosFieldset',
  override: true,
})
// 这个补丁是解决 input-table 组件在 fieldSet 中的一些行为异常，后期要跟踪 amis 官方解决方案
export default class OuroborosFieldSet extends FieldSetControl {
  renderBody(): JSX.Element {
    const {
      body,
      collapsable,
      horizontal,
      render,
      mode,
      formMode,
      classnames: cx,
      store,
      formClassName,
      disabled,

      formHorizontal,
      subFormMode,
      subFormHorizontal,
    } = this.props

    const props: any = {
      store,
      data: store?.data,
      render,
      disabled,
      formMode: subFormMode || formMode,
      formHorizontal: subFormHorizontal || formHorizontal,
    }
    mode && (props.mode = mode)
    horizontal && (props.horizontal = horizontal)
    return (
      <div className={cx(`Form--${props.mode || formMode || 'normal'}`, formClassName)}>
        {body ? render('body', wrapInputTable(body), props) : null}
      </div>
    )
  }
}
