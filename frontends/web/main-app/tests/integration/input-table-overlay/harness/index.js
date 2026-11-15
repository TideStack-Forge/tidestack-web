import React from 'react'
import ReactDOM from 'react-dom'
import { toast } from 'amis'

import { renderAmisSchema } from '@/components/amis/AmisComponent'

window.React = React
window.ReactDOM = ReactDOM

const statusElement = document.getElementById('input-table-overlay-playwright-status')
const editorRoot = document.getElementById('input-table-overlay-editor-root')
const snapshotElement = document.getElementById('input-table-overlay-live-data')

const HARNESS_FORM_NAME = 'inputTableOverlayHarnessForm'

let latestHarnessValues = null
const notifications = []
const harnessParams = new URLSearchParams(window.location.search)

function buildValidationHarnessSchema() {
  return {
    type: 'form',
    name: HARNESS_FORM_NAME,
    id: HARNESS_FORM_NAME,
    wrapWithPanel: false,
    submitOnChange: harnessParams.get('submitOnChange') !== 'false',
    messages: { validateFailed: '外层表单校验失败' },
    onChange: (values) => updateLatestHarnessValues(values),
    onSubmit: () => false,
    body: [
      {
        type: 'input-table',
        name: 'autoInlineLines',
        className: 'input-table-auto-inline-default',
        addable: true,
        editable: true,
        removable: true,
        showFooterAddBtn: true,
        ...(harnessParams.get('needConfirm') === 'false' ? { needConfirm: false } : {}),
        columns: [
          {
            name: 'name',
            label: '名称',
            type: 'input-text',
            required: true,
            // unique 会让 AMIS 使用内部 quick-edit form，而非单字段快捷编辑。
            unique: harnessParams.get('validation') === 'form',
          },
          {
            name: 'amount',
            label: '金额',
            type: 'input-number',
            required: true,
            min: 0,
          },
        ],
      },
      { type: 'button', actionType: 'submit', label: '提交校验' },
    ],
  }
}

function buildLazyInlineRows() {
  return Array.from({ length: 40 }, (_, index) => ({
    id: `lazy-row-${index + 1}`,
    name: `Lazy Inline ${String(index + 1).padStart(2, '0')}`,
    amount: index + 1,
    remark: `Row ${index + 1}`,
  }))
}

function buildColumnsTogglerRows(prefix) {
  return [
    {
      code: `${prefix}-A`,
      name: `${prefix} Columns A`,
      owner: 'Owner A',
      status: 'ready',
      amount: 6,
      remark: 'explicit toggler',
    },
  ]
}

function buildHorizontalOverflowRows() {
  return [
    {
      metricCode: 'electricity.total.active.energy',
      metricName: '总有功电能',
      category: '电能量',
      unit: 'kWh',
      dataType: 'decimal',
    },
  ]
}

function buildColumnsTogglerColumns() {
  return [
    {
      name: 'code',
      label: '编码',
      type: 'input-text',
    },
    {
      name: 'name',
      label: '名称',
      type: 'input-text',
    },
    {
      name: 'owner',
      label: '负责人',
      type: 'input-text',
    },
    {
      name: 'status',
      label: '状态',
      type: 'input-text',
    },
    {
      name: 'amount',
      label: '金额',
      type: 'input-number',
    },
    {
      name: 'remark',
      label: '备注',
      type: 'input-text',
    },
  ]
}

const initialHarnessData = {
  defaultOverlayLines: [
    {
      name: 'A',
      amount: 11,
      hiddenRemark: 'not-editable',
    },
  ],
  mixedModeOverlayLines: [],
  customOverlayLines: [
    {
      name: 'B',
      remark: 'old remark',
    },
  ],
  autoInlineLines: [
    {
      name: 'Inline A',
      amount: 1,
    },
  ],
  lazyDefaultInlineLines: buildLazyInlineRows(),
  lazyAutoGrowLines: buildLazyInlineRows(),
  lazyConstrainedLines: buildLazyInlineRows(),
  lazyConfirmInlineLines: buildLazyInlineRows(),
  confirmInlineLines: [
    {
      name: 'Confirm A',
      amount: 2,
    },
  ],
  apiGatedInlineLines: [
    {
      name: 'API A',
      amount: 3,
    },
  ],
  operationConfigLines: [
    {
      code: 'OC-A',
      name: 'Operation A',
      owner: 'Owner A',
      status: 'draft',
      amount: 4,
      remark: 'custom buttons',
    },
    {
      code: 'OC-B',
      name: 'Operation B',
      owner: 'Owner B',
      status: 'ready',
      amount: 5,
      remark: 'second row',
    },
  ],
  operationFallbackLines: [
    {
      name: 'Fallback A',
      amount: 6,
      inputTableOperation: {
        state: 'business-field',
        __ouroborosInputTableOperationContext: true,
      },
    },
  ],
  operationImmediateLines: [
    {
      name: 'Immediate A',
      amount: 8,
    },
  ],
  operationGuardLines: [
    {
      name: 'Guard A',
      amount: 7,
    },
  ],
  explicitColumnsTogglerLines: buildColumnsTogglerRows('CT'),
  columnsTogglerTopLeftLines: buildColumnsTogglerRows('TL'),
  columnsTogglerTopRightLines: buildColumnsTogglerRows('TR'),
  horizontalOverflowLines: buildHorizontalOverflowRows(),
  navigationAggregateLines: [
    {
      code: 'A',
      amount: 1,
    },
    {
      code: 'B',
      amount: 2,
    },
    {
      code: 'TOTAL',
      amount: '0',
      sources: 'A,B',
    },
  ],
}

const harnessSchema = {
  type: 'page',
  title: 'Input Table Overlay Smoke Harness',
  body: [
    {
      type: 'button',
      label: '打开仪表类型弹窗复现',
      level: 'primary',
      className: 'open-meter-type-dialog-overflow-repro',
      actionType: 'dialog',
      dialog: {
        title: '编辑仪表类型',
        size: 'xl',
        body: {
          type: 'form',
          mode: 'horizontal',
          wrapWithPanel: false,
          className: 'meter-type-dialog-overflow-repro-form',
          data: {
            typeCode: 'elect',
            typeName: '电表',
            metricCodes: buildHorizontalOverflowRows(),
            sortOrder: 0,
            enabled: true,
          },
          body: [
            {
              type: 'input-text',
              name: 'typeCode',
              label: '类型编码',
            },
            {
              type: 'input-text',
              name: 'typeName',
              label: '类型名称',
            },
            {
              type: 'input-table',
              name: 'metricCodes',
              label: '采集项',
              className: 'meter-type-dialog-metric-input-table',
              addable: true,
              editable: true,
              removable: true,
              showIndex: true,
              showFooterAddBtn: true,
              columns: [
                {
                  name: 'metricCode',
                  label: '采集项',
                  type: 'select',
                  width: 420,
                  options: [
                    {
                      label: '总有功电能',
                      value: 'electricity.total.active.energy',
                    },
                  ],
                },
                {
                  name: 'metricName',
                  label: '采集项名称',
                  type: 'tpl',
                  width: 420,
                },
                {
                  name: 'category',
                  label: '分类',
                  type: 'tpl',
                  width: 420,
                },
                {
                  name: 'unit',
                  label: '单位',
                  type: 'tpl',
                  width: 420,
                },
                {
                  name: 'dataType',
                  label: '数据类型',
                  type: 'tpl',
                  width: 420,
                },
              ],
            },
            {
              type: 'input-number',
              name: 'sortOrder',
              label: '排序号',
            },
            {
              type: 'switch',
              name: 'enabled',
              label: '启用',
            },
          ],
        },
      },
    },
    {
      type: 'form',
      name: HARNESS_FORM_NAME,
      id: HARNESS_FORM_NAME,
      wrapWithPanel: false,
      submitOnChange: true,
      onChange: (values) => updateLatestHarnessValues(values),
      body: [
        {
          type: 'input-table',
          name: 'defaultOverlayLines',
          label: '默认列派生：add dialog / edit drawer',
          className: 'input-table-overlay-default',
          addable: true,
          editable: true,
          needConfirm: true,
          showFooterAddBtn: true,
          addMode: 'dialog',
          editMode: 'drawer',
          addDialogProps: {
            title: '新增明细 Dialog',
            size: 'lg',
            closeOnEsc: false,
          },
          editDrawerProps: {
            title: '编辑明细 Drawer',
            size: 'xl',
            position: 'right',
          },
          columns: [
            {
              name: 'name',
              label: '名称',
              type: 'input-text',
              quickEdit: {
                required: true,
              },
            },
            {
              name: 'amount',
              label: '金额',
              type: 'tpl',
              tpl: '${amount}',
              quickEdit: {
                type: 'input-number',
                min: 0,
              },
              quickEditOnUpdate: {
                type: 'input-number',
                min: 10,
              },
            },
            {
              name: 'hiddenRemark',
              label: '不进入弹层',
              type: 'input-text',
              quickEdit: false,
            },
          ],
        },
        {
          type: 'input-table',
          name: 'mixedModeOverlayLines',
          label: '混合模式：add dialog / edit inline',
          className: 'input-table-overlay-mixed-mode',
          addable: true,
          editable: true,
          needConfirm: false,
          showFooterAddBtn: true,
          addMode: 'dialog',
          editMode: 'inline',
          addDialogProps: {
            title: '混合模式新增 Dialog',
          },
          columns: [
            {
              name: 'name',
              label: '名称',
              type: 'input-text',
              quickEdit: {
                required: true,
              },
            },
          ],
        },
        {
          type: 'input-table',
          name: 'customOverlayLines',
          label: '显式表单项：add drawer / edit dialog',
          className: 'input-table-overlay-custom',
          addable: true,
          editable: true,
          needConfirm: true,
          showFooterAddBtn: true,
          addMode: 'drawer',
          editMode: 'dialog',
          addDrawerProps: {
            title: '新增明细 Drawer',
            position: 'left',
          },
          editDialogProps: {
            title: '编辑明细 Dialog',
            size: 'md',
          },
          addFormItems: [
            {
              type: 'input-text',
              name: 'name',
              label: '新增名称',
              required: true,
            },
          ],
          editFormItems: [
            {
              type: 'textarea',
              name: 'remark',
              label: '编辑备注',
            },
          ],
          columns: [
            {
              name: 'name',
              label: '名称',
              type: 'input-text',
              quickEdit: true,
            },
            {
              name: 'remark',
              label: '备注',
              type: 'input-text',
              quickEdit: true,
            },
          ],
        },
        {
          type: 'input-table',
          name: 'autoInlineLines',
          label: '默认 inline：即时生效',
          className: 'input-table-auto-inline-default',
          addable: true,
          editable: true,
          removable: true,
          showFooterAddBtn: true,
          confirmBtnLabel: '保存',
          cancelBtnLabel: '取消',
          deleteBtnLabel: '删除',
          columns: [
            {
              name: 'name',
              label: '名称',
            },
            {
              name: 'amount',
              label: '金额',
              type: 'input-number',
              quickEdit: {
                type: 'input-number',
                required: true,
                min: 0,
              },
            },
          ],
        },
        {
          type: 'input-table',
          name: 'lazyDefaultInlineLines',
          label: '默认 inline + needConfirm 默认 + lazyRenderAfter：即时生效',
          className: 'input-table-default-inline-lazy',
          addable: true,
          editable: true,
          removable: true,
          showIndex: true,
          showFooterAddBtn: true,
          lazyRenderAfter: 4,
          tableContentClassName: 'input-table-default-inline-lazy-scroll',
          confirmBtnLabel: '保存',
          cancelBtnLabel: '取消',
          deleteBtnLabel: '删除',
          columns: [
            {
              name: 'name',
              label: '名称',
              type: 'input-text',
              quickEdit: {
                required: true,
              },
            },
            {
              name: 'amount',
              label: '金额',
              type: 'input-number',
              quickEdit: {
                type: 'input-number',
                required: true,
                min: 0,
              },
            },
            {
              name: 'remark',
              label: '备注',
              type: 'input-text',
              quickEdit: true,
            },
          ],
        },
        {
          type: 'input-table',
          id: 'lazyAutoGrowInputTable',
          name: 'lazyAutoGrowLines',
          label: '尺寸配置：内容撑开高度',
          className: 'input-table-content-sizing-auto-grow',
          addable: false,
          editable: false,
          showIndex: true,
          lazyRenderAfter: 4,
          maxHeight: 'none',
          overflow: 'visible',
          columns: [
            {
              name: 'name',
              label: '名称',
              type: 'input-text',
            },
            {
              name: 'amount',
              label: '金额',
              type: 'input-number',
            },
            {
              name: 'remark',
              label: '备注',
              type: 'input-text',
            },
          ],
        },
        {
          type: 'input-table',
          id: 'lazyConstrainedInputTable',
          name: 'lazyConstrainedLines',
          label: '尺寸配置：限制最大高度',
          className: 'input-table-content-sizing-constrained',
          addable: false,
          editable: false,
          showIndex: true,
          lazyRenderAfter: 4,
          maxHeight: 180,
          overflow: 'auto',
          columns: [
            {
              name: 'name',
              label: '名称',
              type: 'input-text',
            },
            {
              name: 'amount',
              label: '金额',
              type: 'input-number',
            },
            {
              name: 'remark',
              label: '备注',
              type: 'input-text',
            },
          ],
        },
        {
          type: 'input-table',
          name: 'lazyConfirmInlineLines',
          label: 'inline + needConfirm = true + lazyRenderAfter：保存后生效',
          className: 'input-table-confirm-inline-lazy',
          addable: true,
          editable: true,
          removable: true,
          needConfirm: true,
          showIndex: true,
          showFooterAddBtn: true,
          lazyRenderAfter: 4,
          tableContentClassName: 'input-table-confirm-inline-lazy-scroll',
          confirmBtnLabel: '保存',
          cancelBtnLabel: '取消',
          deleteBtnLabel: '删除',
          columns: [
            {
              name: 'name',
              label: '名称',
              type: 'input-text',
              quickEdit: {
                required: true,
              },
            },
            {
              name: 'amount',
              label: '金额',
              type: 'input-number',
              quickEdit: {
                type: 'input-number',
                required: true,
                min: 0,
              },
            },
            {
              name: 'remark',
              label: '备注',
              type: 'input-text',
              quickEdit: true,
            },
          ],
        },
        {
          type: 'input-table',
          name: 'confirmInlineLines',
          label: '保存式 inline：无 API，点保存后生效',
          className: 'input-table-confirm-inline-no-api',
          addable: true,
          editable: true,
          needConfirm: true,
          addMode: 'inline',
          editMode: 'inline',
          showFooterAddBtn: true,
          confirmBtnLabel: '保存',
          cancelBtnLabel: '取消',
          columns: [
            {
              name: 'name',
              label: '名称',
              type: 'input-text',
              quickEdit: {
                required: true,
              },
            },
            {
              name: 'amount',
              label: '金额',
              type: 'input-number',
              quickEdit: {
                type: 'input-number',
                min: 0,
              },
            },
          ],
        },
        {
          type: 'input-table',
          name: 'apiGatedInlineLines',
          label: '行级 API：needConfirm=false 仍显式保存',
          className: 'input-table-api-gated-inline',
          addable: true,
          editable: true,
          needConfirm: false,
          showFooterAddBtn: true,
          confirmBtnLabel: '保存',
          cancelBtnLabel: '取消',
          addApi: {
            url: '/api/mock-lines',
            method: 'post',
          },
          updateApi: {
            url: '/api/mock-lines/${id}',
            method: 'put',
          },
          columns: [
            {
              name: 'name',
              label: '名称',
              type: 'input-text',
              quickEdit: {
                required: true,
              },
            },
            {
              name: 'amount',
              label: '金额',
              type: 'input-number',
              quickEdit: {
                type: 'input-number',
                min: 0,
              },
            },
          ],
        },
        {
          type: 'input-table',
          name: 'navigationAggregateLines',
          label: 'LTS 增强：方向键跨行录入 / 行内聚合',
          className: 'input-table-lts-enhancements',
          addable: false,
          editable: true,
          needConfirm: false,
          arrowRowNavigation: {
            columns: ['amount'],
          },
          rowAggregate: {
            valueField: 'amount',
            keyPaths: ['code'],
            sourcesPaths: ['sources'],
          },
          columns: [
            {
              name: 'code',
              label: '编码',
              type: 'input-text',
              quickEdit: true,
            },
            {
              name: 'amount',
              label: '金额',
              type: 'input-number',
              quickEdit: true,
            },
            {
              name: 'sources',
              label: '来源',
              type: 'input-text',
              quickEdit: true,
            },
          ],
        },
        {
          type: 'input-table',
          name: 'operationConfigLines',
          label: '操作配置：新增位置 / 自定义操作按钮',
          className: 'input-table-operation-config',
          addable: true,
          copyable: true,
          editable: true,
          removable: true,
          needConfirm: true,
          addMode: 'inline',
          editMode: 'inline',
          showFooterAddBtn: true,
          addButtonPosition: 'top-right',
          footerAddBtn: {
            label: '配置顶部新增',
          },
          operationButtons: [
            {
              label: '普通插入',
              actionType: 'add',
              level: 'link',
              testid: 'normal-add',
            },
            {
              label: '普通编辑',
              actionType: 'edit',
              level: 'link',
              testid: 'normal-edit',
            },
            {
              label: '普通复制',
              actionType: 'copy',
              level: 'link',
              testid: 'normal-copy',
            },
            {
              label: '普通删除',
              actionType: 'delete',
              level: 'link',
              testid: 'normal-delete',
            },
          ],
          addingOperationButtons: [
            {
              label: '新增保存',
              actionType: 'save',
              level: 'primary',
              testid: 'adding-save',
            },
            {
              label: '新增取消',
              actionType: 'cancel',
              level: 'link',
              testid: 'adding-cancel',
            },
          ],
          editingOperationButtons: [
            {
              label: '编辑保存',
              actionType: 'save',
              level: 'primary',
              testid: 'editing-save',
            },
            {
              label: '编辑取消',
              actionType: 'cancel',
              level: 'link',
              testid: 'editing-cancel',
            },
          ],
          columns: [
            {
              name: 'code',
              label: '编码',
              type: 'input-text',
              quickEdit: true,
            },
            {
              name: 'name',
              label: '名称',
              type: 'input-text',
              quickEdit: {
                required: true,
              },
            },
            {
              name: 'owner',
              label: '负责人',
              type: 'input-text',
              quickEdit: true,
            },
            {
              name: 'status',
              label: '状态',
              type: 'input-text',
              quickEdit: true,
            },
            {
              name: 'amount',
              label: '金额',
              type: 'input-number',
              quickEdit: {
                type: 'input-number',
                required: true,
                min: 0,
              },
            },
            {
              name: 'remark',
              label: '备注',
              type: 'input-text',
              quickEdit: true,
            },
          ],
        },
        {
          type: 'input-table',
          name: 'operationFallbackLines',
          label: '操作配置：普通态覆盖 / 非操作列动作',
          className: 'input-table-operation-fallback',
          addable: true,
          editable: true,
          removable: true,
          needConfirm: true,
          valueField: 'name',
          addMode: 'inline',
          editMode: 'inline',
          confirmBtnLabel: '保存',
          cancelBtnLabel: '取消',
          operationButtons: [
            {
              label: '只改普通态编辑',
              actionType: 'edit',
              level: 'link',
              testid: 'normal-only-edit',
            },
          ],
          columns: [
            {
              name: 'name',
              label: '名称',
              type: 'input-text',
              quickEdit: {
                required: true,
              },
            },
            {
              name: 'amount',
              label: '金额',
              type: 'input-number',
              quickEdit: {
                type: 'input-number',
                min: 0,
              },
            },
            {
              type: 'button',
              actionType: 'delete',
              payload: {
                name: 'No matching row',
              },
              level: 'link',
              label: '单元删除动作',
              quickEdit: false,
            },
          ],
        },
        {
          type: 'input-table',
          name: 'operationImmediateLines',
          label: '操作配置：常驻 inline 不需要编辑按钮',
          className: 'input-table-operation-immediate',
          addable: false,
          childrenAddable: true,
          editable: true,
          removable: true,
          needConfirm: false,
          operationButtons: [
            {
              label: '不应显示编辑',
              actionType: 'edit',
              level: 'link',
              testid: 'immediate-edit',
            },
            {
              label: '即时删除',
              actionType: 'delete',
              level: 'link',
              testid: 'immediate-delete',
            },
            {
              label: '即时添加子项',
              actionType: 'sub-add',
              level: 'link',
              testid: 'immediate-sub-add',
            },
          ],
          columns: [
            {
              name: 'name',
              label: '名称',
            },
            {
              name: 'amount',
              label: '金额',
              type: 'input-number',
              quickEdit: {
                type: 'input-number',
                min: 0,
              },
            },
          ],
        },
        {
          type: 'input-table',
          name: 'operationGuardLines',
          label: '操作配置：内置 actionType 约束',
          className: 'input-table-operation-guards',
          addable: true,
          editable: false,
          removable: true,
          needConfirm: true,
          minLength: 1,
          maxLength: 1,
          operationButtons: [
            {
              label: '限制新增',
              actionType: 'add',
              level: 'link',
              testid: 'guard-add',
            },
            {
              label: '限制删除',
              actionType: 'delete',
              level: 'link',
              testid: 'guard-delete',
            },
          ],
          columns: [
            {
              name: 'name',
              label: '名称',
              type: 'input-text',
              quickEdit: true,
            },
            {
              name: 'amount',
              label: '金额',
              type: 'input-number',
              quickEdit: true,
            },
          ],
        },
        {
          type: 'input-table',
          name: 'explicitColumnsTogglerLines',
          label: '列设置：显式开启',
          className: 'input-table-columns-toggler-explicit',
          addable: false,
          editable: false,
          columnsTogglable: true,
          columns: buildColumnsTogglerColumns(),
        },
        {
          type: 'input-table',
          name: 'columnsTogglerTopLeftLines',
          label: '列设置 + 左上新增',
          className: 'input-table-columns-toggler-top-left',
          addable: true,
          editable: false,
          columnsTogglable: true,
          addButtonPosition: 'top-left',
          footerAddBtn: {
            label: '左上新增',
          },
          columns: buildColumnsTogglerColumns(),
        },
        {
          type: 'input-table',
          name: 'columnsTogglerTopRightLines',
          label: '列设置 + 右上新增',
          className: 'input-table-columns-toggler-top-right',
          addable: true,
          editable: false,
          columnsTogglable: true,
          addButtonPosition: 'top-right',
          footerAddBtn: {
            label: '右上新增',
          },
          columns: buildColumnsTogglerColumns(),
        },
      ],
    },
    {
      type: 'form',
      mode: 'horizontal',
      wrapWithPanel: false,
      className: 'input-table-horizontal-overflow-form',
      data: {
        horizontalOverflowLines: buildHorizontalOverflowRows(),
      },
      body: [
        {
          type: 'input-table',
          name: 'horizontalOverflowLines',
          label: '采集项',
          className: 'input-table-horizontal-overflow',
          addable: true,
          editable: true,
          removable: true,
          showIndex: true,
          showFooterAddBtn: true,
          columns: [
            {
              name: 'metricCode',
              label: '采集项',
              type: 'select',
              width: 420,
              options: [
                {
                  label: '总有功电能',
                  value: 'electricity.total.active.energy',
                },
              ],
            },
            {
              name: 'metricName',
              label: '采集项名称',
              type: 'tpl',
              width: 420,
            },
            {
              name: 'category',
              label: '分类',
              type: 'tpl',
              width: 420,
            },
            {
              name: 'unit',
              label: '单位',
              type: 'tpl',
              width: 420,
            },
            {
              name: 'dataType',
              label: '数据类型',
              type: 'tpl',
              width: 420,
            },
          ],
        },
      ],
    },
  ],
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function updateLatestHarnessValues(values) {
  if (!values || typeof values !== 'object' || Array.isArray(values)) {
    return
  }

  latestHarnessValues = cloneValue(values)
}

function getHarnessForm(scopeRef) {
  return (
    scopeRef?.getComponentByName?.(HARNESS_FORM_NAME) ||
    scopeRef?.getComponentById?.(HARNESS_FORM_NAME) ||
    null
  )
}

function readHarnessValues(scopeRef) {
  const form = getHarnessForm(scopeRef)
  if (form?.getValues) {
    updateLatestHarnessValues(form.getValues())
  }

  return cloneValue(latestHarnessValues)
}

function updateSnapshot(scopeRef) {
  const values = readHarnessValues(scopeRef)
  snapshotElement.textContent = values
    ? JSON.stringify(values, null, 2)
    : 'Harness form is not ready.'
}

function createHarnessDebugApi(scopeRef) {
  return {
    ready: false,
    getValues() {
      return readHarnessValues(scopeRef)
    },
    async validate() {
      return getHarnessForm(scopeRef)?.validate?.()
    },
    reset() {
      const form = getHarnessForm(scopeRef)
      updateLatestHarnessValues(initialHarnessData)
      form?.setValues?.(cloneValue(initialHarnessData), true)
      updateSnapshot(scopeRef)
    },
    getNotifications() {
      return cloneValue(notifications)
    },
  }
}

async function waitForHarnessForm(scopeRef, timeoutMs = 5000) {
  const startAt = Date.now()

  while (Date.now() - startAt <= timeoutMs) {
    const form = getHarnessForm(scopeRef)
    if (form?.getValues) {
      return form
    }
    await new Promise((resolve) => window.setTimeout(resolve, 100))
  }

  return null
}

async function mountHarness() {
  statusElement.textContent = 'Rendering input-table overlay harness...'

  const rendered = await renderAmisSchema(
    editorRoot,
    harnessParams.has('validation') ? buildValidationHarnessSchema() : harnessSchema,
    {
      data: cloneValue(initialHarnessData),
    },
    {
      notify(type, message, conf) {
        notifications.push({ type, message })
        toast[type](message, conf)
      },
      fetcher: async (api) => {
        if (api?.url?.startsWith?.('/api/mock-lines')) {
          return {
            ok: true,
            data: cloneValue(api.data || {}),
          }
        }

        return {
          ok: false,
          msg: `Unexpected harness api: ${api?.url || 'unknown'}`,
        }
      },
    }
  )

  const scopeRef = rendered.getScopeRef()
  await waitForHarnessForm(scopeRef)
  updateLatestHarnessValues(initialHarnessData)

  const harnessApi = createHarnessDebugApi(scopeRef)
  window.__INPUT_TABLE_OVERLAY_PLAYWRIGHT_HARNESS__ = harnessApi

  updateSnapshot(scopeRef)
  const poller = window.setInterval(() => updateSnapshot(scopeRef), 150)
  window.addEventListener('beforeunload', () => window.clearInterval(poller), {
    once: true,
  })

  harnessApi.ready = true
  statusElement.textContent = 'Input-table overlay harness ready'
}

mountHarness().catch((error) => {
  statusElement.textContent = `Input-table overlay harness failed: ${error.message}`
  snapshotElement.textContent = `Harness failed: ${error.message}`
})
