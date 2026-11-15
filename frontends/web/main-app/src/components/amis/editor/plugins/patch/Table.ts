import { TablePlugin, registerEditorPlugin } from 'amis-editor'

import type {
  BasicRendererInfo,
  RendererInfoResolveEventContext,
} from 'amis-editor-core'

export class OuroborosTablePlugin extends TablePlugin {
  rendererName = 'OuroborosTable'
  disabledRendererPlugin = true

  getRendererInfo(
    context: RendererInfoResolveEventContext
  ): BasicRendererInfo | void {
    const plugin = this as any
    const { schema, renderer } = context
    const parentRendererName = schema.$$editor?.renderer.name

    if (
      !schema.$$id &&
      (parentRendererName === 'OuroborosCRUD' || parentRendererName === 'crud') &&
      (renderer.name === 'table' || renderer.name === 'OuroborosTable')
    ) {
      return {
        ...(({ id: schema.$$editor.id } as any)),
        name: plugin.name!,
        regions: plugin.regions,
        patchContainers: plugin.patchContainers,
        vRendererConfig: plugin.vRendererConfig,
        wrapperProps: plugin.wrapperProps,
        wrapperResolve: plugin.wrapperResolve,
        filterProps: plugin.filterProps,
        $schema: plugin.$schema,
        renderRenderer: plugin.renderRenderer,
      }
    }

    if (renderer.name === 'table' || renderer.name === 'OuroborosTable') {
      return {
        name: plugin.name!,
        regions: plugin.regions,
        patchContainers: plugin.patchContainers,
        vRendererConfig: plugin.vRendererConfig,
        wrapperProps: plugin.wrapperProps,
        wrapperResolve: plugin.wrapperResolve,
        filterProps: plugin.filterProps,
        $schema: plugin.$schema,
        renderRenderer: plugin.renderRenderer,
      }
    }

    return super.getRendererInfo(context)
  }
}

registerEditorPlugin(OuroborosTablePlugin)
