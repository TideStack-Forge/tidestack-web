import React from 'react'
import { Button, Drawer, toast } from 'amis'
import type { Api, RendererProps } from 'amis'
import type { WidgetDefinition } from './common'
import { WidgetDefinitionPanel } from './WidgetDefinitionPanel'
import { openDialog } from '@/common/modal'

export interface DashboardEditToolbarProps {
  editable: boolean
  isEditing: boolean
  widgetDefinitions: WidgetDefinition[]
  isDefinitionsDrawerOpen: boolean
  categoriesCollapsed: Record<string, boolean>
  allowLoadTemplate?: boolean
  listTemplatesApi?: Api
  loadTemplateApi?: Api
  onEditClick: () => void
  onCancelEdit: () => void
  onConfirmEdit: () => void
  onOpenDrawer: () => void
  onCloseDrawer: () => void
  onToggleCollapse: (key: string) => void
  onDragStart: (widgetDef: WidgetDefinition, e: React.DragEvent) => void
  onDragEnd: () => void
  onLoadTemplate: (templateId: string) => Promise<void>
  render: RendererProps['render']
  classnames: RendererProps['classnames']
  translate: RendererProps['translate']
  env: any
}

export class DashboardEditToolbar extends React.Component<DashboardEditToolbarProps> {
  // 加载模板列表并显示选择对话框
  handleLoadTemplateClick = async () => {
    const { listTemplatesApi, onLoadTemplate, env } = this.props

    if (!listTemplatesApi) {
      toast.error('未配置模板列表接口')
      return
    }

    try {
      // 显示模板选择对话框
      const formData = await openDialog(
        {
          title: '选择模板',
          body: [
            {
              type: 'form',
              body: [
                {
                  type: 'select',
                  name: 'templateId',
                  label: '模板',
                  placeholder: '请选择要加载的模板',
                  required: true,
                  source: listTemplatesApi,
                },
                {
                  type: 'static',
                  label: '提示',
                  value: '加载模板将替换当前画布的所有内容',
                  className: 'text-warning',
                },
              ],
            },
          ],
        },
        {}
      )

      if (formData && formData.length && formData[0].templateId) {
        await onLoadTemplate(formData[0].templateId)
      }
    } catch (error) {
      console.error('Error fetching templates:', error)
      toast.error('获取模板列表失败')
    }
  }

  render() {
    const {
      editable,
      isEditing,
      widgetDefinitions,
      isDefinitionsDrawerOpen,
      categoriesCollapsed,
      allowLoadTemplate,
      onEditClick,
      onCancelEdit,
      onConfirmEdit,
      onOpenDrawer,
      onCloseDrawer,
      onToggleCollapse,
      onDragStart,
      onDragEnd,
      render,
      classnames: cx,
      translate: __,
    } = this.props

    if (!editable) return null

    if (!isEditing) {
      return (
        <div className="toolbar-box">
          <div className="hover-area"></div>
          <Button
            level="link"
            classPrefix="cxd-"
            onClick={onEditClick}
            className="mr-2 edit-button">
            开始编辑
          </Button>
        </div>
      )
    }

    return (
      <>
        <div className="edit-operation">
          <Button onClick={onCancelEdit} disabled={!isEditing} className="mr-2">
            取消
          </Button>
          <Button
            level="primary"
            onClick={onConfirmEdit}
            disabled={!isEditing}
            className="mr-2">
            确定
          </Button>
          <Button level="enhance" onClick={onOpenDrawer} disabled={!isEditing}>
            选择栏目
          </Button>
          {allowLoadTemplate && (
            <Button
              level="enhance"
              onClick={this.handleLoadTemplateClick}
              disabled={!isEditing}
              className="ml-2">
              加载模板
            </Button>
          )}
        </div>
        <Drawer
          showCloseButton
          closeOnOutside
          resizable
          overlay={false}
          position="right"
          show={isDefinitionsDrawerOpen}
          onHide={onCloseDrawer}>
          <div className={cx('Drawer-header')}>
            <div className={cx('Drawer-title')}>组件列表</div>
          </div>
          <div className={cx('Drawer-body')}>
            {!widgetDefinitions || !widgetDefinitions.length ? (
              render('empty-component', {
                type: 'tpl',
                tpl: ' 当前没有可用的组件 <i class="fas fa-frown"></i>',
              })
            ) : (
              <WidgetDefinitionPanel
                widgetDefinitions={widgetDefinitions}
                categoriesCollapsed={categoriesCollapsed}
                onToggleCollapse={onToggleCollapse}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                render={render}
              />
            )}
          </div>
          <div className={cx('Drawer-footer')}>
            <Button onClick={onCloseDrawer}>{__('cancel')}</Button>
          </div>
        </Drawer>
      </>
    )
  }
}
