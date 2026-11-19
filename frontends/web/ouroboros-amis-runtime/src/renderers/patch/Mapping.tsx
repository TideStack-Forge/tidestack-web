import { Renderer, FormItemWrap } from 'amis-core'
import { MappingFieldRenderer } from 'amis/lib/renderers/Mapping'

/**
 * AMIS 的 mapping 渲染器只输出映射后的值，本身不是表单项（不会套 FormItem）。
 * 因此当它被配置在表单/详情表单的 body 里、并且写了 label 时：
 *   - label 会被直接丢掉（详情里只剩一个孤立的值）；
 *   - 也不会生成 `.Form-item`，无法参与表单栅格布局。
 *
 * 这里在「表单上下文 + 配置了 label」时补一层 FormItemWrap，让它和 static/tpl
 * 一样按表单项渲染。表格列等非表单场景（没有 formStore 或没有 label）保持原样。
 */
@Renderer({
  type: 'mapping',
  alias: ['map'],
  name: 'OuroborosMapping',
  override: true,
  weight: -200,
})
export class OuroborosMapping extends MappingFieldRenderer {
  render() {
    const props = this.props as any
    const shouldWrapAsFormItem =
      !!props.label && !!props.formStore && !props.inputOnly && props.wrap !== false

    if (!shouldWrapAsFormItem) {
      return super.render()
    }

    return (
      <FormItemWrap
        {...props}
        formMode={props.formMode || props.mode}
        renderControl={() => super.render()}
      />
    )
  }
}
