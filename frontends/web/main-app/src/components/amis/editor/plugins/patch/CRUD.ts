import { CRUDPlugin, registerEditorPlugin } from 'amis-editor'
import type {
  AfterBuildPanelBody,
  PluginEvent,
} from 'amis-editor-core'

function resolvePanelData(source: any) {
  if (source && typeof source === 'object' && source.data) {
    return source.data
  }

  return source
}

function isBulkActionsToolbarItem(item: any) {
  const itemType = item && typeof item === 'object' ? item.type : item
  return itemType === 'bulkActions' || itemType === 'bulk-actions'
}

function hasBulkActionsToolbar(formData: any) {
  if (formData?.enableBulkActions === false) {
    return false
  }

  const containsBulkActions = (toolbar: any) =>
    Array.isArray(toolbar) && toolbar.some(isBulkActionsToolbarItem)

  return (
    containsBulkActions(formData?.headerToolbar) ||
    containsBulkActions(formData?.footerToolbar)
  )
}

function hasBulkActions(formData: any) {
  return Array.isArray(formData?.bulkActions) && formData.bulkActions.length > 0
}

function isCrudEffectivelySelectable(formData: any) {
  return !!(
    (hasBulkActionsToolbar(formData) && hasBulkActions(formData)) ||
    formData?.pickerMode ||
    formData?.selectable
  )
}

function patchCrudSelectionDefaults(panelBody: any): any {
  if (Array.isArray(panelBody)) {
    return panelBody.map((item) => patchCrudSelectionDefaults(item))
  }

  if (!panelBody || typeof panelBody !== 'object') {
    return panelBody
  }

  const nextPanelBody = { ...panelBody }

  if (nextPanelBody.name === 'checkOnItemClick') {
    nextPanelBody.visibleOn =
      'this.selectable || this.bulkActions && this.bulkActions.length || this.pickerMode'
    nextPanelBody.pipeIn = (value: any, formStoreOrData: any) => {
      const formData = resolvePanelData(formStoreOrData)
      return typeof value === 'boolean'
        ? value
        : isCrudEffectivelySelectable(formData)
    }
    nextPanelBody.pipeOut = (
      value: boolean | undefined,
      _originValue: any,
      formData: any
    ) => {
      const nextFormData = resolvePanelData(formData)

      if (isCrudEffectivelySelectable(nextFormData)) {
        return value === false ? false : undefined
      }

      return value ? true : undefined
    }
  }

  Object.keys(nextPanelBody).forEach((key) => {
    const fieldValue = nextPanelBody[key]
    if (Array.isArray(fieldValue) || (fieldValue && typeof fieldValue === 'object')) {
      nextPanelBody[key] = patchCrudSelectionDefaults(fieldValue)
    }
  })

  return nextPanelBody
}

export class OuroborosCRUDPlugin extends CRUDPlugin {
  rendererName = 'OuroborosCRUD'
  disabledRendererPlugin = true // 组件面板不显示

  afterBuildPanelBody(event: PluginEvent<AfterBuildPanelBody>) {
    const { plugin, data } = event.context

    if (plugin !== this) {
      return
    }

    event.setData(patchCrudSelectionDefaults(data))
  }
}

registerEditorPlugin(OuroborosCRUDPlugin)
