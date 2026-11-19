import React from 'react'
import { ActionPlugin, registerEditorPlugin, unRegisterEditorPlugin } from 'amis-editor'
import { diff, mergeDefinitions, modalsToDefinitions } from 'amis-editor-core'
import type { AfterBuildPanelBody, EditorManager, PluginEvent } from 'amis-editor-core'

unRegisterEditorPlugin('ActionPlugin')

// AMIS property controls use untyped schema/render props at this adapter boundary.
function openActionModalEditor(
  manager: EditorManager,
  options: {
    title: string
    type: 'dialog' | 'drawer'
    value: any
    originalValue?: any
    onChange?: (schema: any) => void
  }
) {
  const { store } = manager
  const original = options.originalValue || options.value || {}
  const shared =
    original.$ref && store.modals.find((modal) => modal.$$ref === original.$ref)
  const modal = shared || { type: options.type, ...options.value, $$id: original.$$id }
  const modalId = modal.$$id

  manager.openSubEditor({
    title: options.title,
    value: { ...modal, definitions: modalsToDefinitions(store.modals, {}, modal) },
    onDefinitionsChange(definitions, _originDefinitions, schema) {
      const updated = { ...schema, $$id: modalId }
      if (shared || (!options.onChange && modalId)) {
        store.updateModal(modalId, updated, definitions)
      } else {
        // Only definitions actually referenced by the edited schema become shared.
        store.traceableSetSchema(
          mergeDefinitions(store.schema, definitions || {}, updated)
        )
        options.onChange?.(updated)
      }
      return false
    },
  })
}

function replaceModalEditButton(
  element: React.ReactNode,
  onClick: () => void
): React.ReactNode {
  let replaced = false
  function visit(node: React.ReactNode): React.ReactNode {
    if (!React.isValidElement<any>(node) || replaced) return node
    if (typeof node.props.onClick === 'function') {
      replaced = true
      return React.cloneElement(node, { onClick })
    }
    return React.cloneElement(node, {}, React.Children.map(node.props.children, visit))
  }
  return visit(element)
}

function patchModalControls(panel: any, manager: EditorManager, id: string): any {
  if (Array.isArray(panel))
    return panel.map((entry) => patchModalControls(entry, manager, id))
  if (!panel || typeof panel !== 'object') return panel
  const patched = Object.fromEntries(
    Object.entries(panel).map(([key, value]) => [
      key,
      patchModalControls(value, manager, id),
    ])
  )
  if (
    ['dialog', 'drawer', 'feedback'].includes(panel.name) &&
    typeof panel.children === 'function'
  ) {
    patched.children = (props: any) =>
      replaceModalEditButton(panel.children(props), () => {
        openActionModalEditor(manager, {
          title: panel.name === 'drawer' ? '配置抽屉内容' : '配置弹框内容',
          type: panel.name === 'drawer' ? 'drawer' : 'dialog',
          value: props.value,
          originalValue: manager.store.getSchema(id)?.[panel.name],
          onChange: props.onChange,
        })
      })
  }
  return patched
}

export class OuroborosActionPlugin extends ActionPlugin {
  static id = 'OuroborosActionPlugin'

  constructor(manager: EditorManager) {
    super(manager)
    const inheritedPanelBodyCreator = this.panelBodyCreator
    this.panelBodyCreator = (context) =>
      patchModalControls(inheritedPanelBodyCreator(context), manager, context.id)
  }

  afterBuildPanelBody(event: PluginEvent<AfterBuildPanelBody>) {
    if (event.context.plugin === this) return
    event.setData(
      patchModalControls(event.context.data, this.manager, event.context.context.id)
    )
  }

  editDetail(id: string) {
    const { store } = this.manager
    const action = store.getSchema(id)
    if (!action || !store.getNodeById(id)) return
    openActionModalEditor(this.manager, {
      title: '配置弹框内容',
      type: 'dialog',
      value: action.dialog,
      onChange:
        action.dialog?.$$id || action.dialog?.$ref
          ? undefined
          : (schema) => {
              const updated = { ...action, dialog: schema }
              this.manager.panelChangeValue(updated, diff(action, updated), undefined, id)
            },
    })
  }
}

registerEditorPlugin(OuroborosActionPlugin)
