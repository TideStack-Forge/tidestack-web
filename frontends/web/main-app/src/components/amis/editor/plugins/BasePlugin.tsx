import { registerEditorPlugin, BasePlugin as AMISBasePlugin } from 'amis-editor'
import type { BaseEventContext, RendererJSONSchemaResolveEventContext, RendererScaffoldInfo, RendererInfo } from 'amis-editor'

export { registerEditorPlugin }

export type { BaseEventContext, RendererJSONSchemaResolveEventContext, RendererScaffoldInfo, RendererInfo }

export class BasePlugin extends AMISBasePlugin {
  buildJSONSchema(context: RendererJSONSchemaResolveEventContext): void | string {
    return '/schemas/UnkownSchema.json';
  }
}