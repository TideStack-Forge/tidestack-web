const CRUD_COLUMNS = Array.from({ length: 12 }, (_, index) => ({
  name: `field${index}`,
  label: `Field ${index}`,
  type: index % 4 === 0 ? 'tpl' : undefined,
}))

const INPUT_TABLE_COLUMNS = Array.from({ length: 8 }, (_, index) => ({
  name: `field${index}`,
  label: `Field ${index}`,
  type: index % 2 === 0 ? 'input-text' : 'input-number',
}))

const RAW_CHECK_BASE_COLUMNS = [
  ['companyName', '组织', 'static-text', '150px'],
  ['checkNo', '检验单号', 'static-text', '160px'],
  ['receiptDt', '单据日期', 'static-date', '130px'],
  ['customerNm', '供应商', 'static-text', '120px'],
  ['carNo', '车牌号', 'static-text', '120px'],
  ['materielNm', '物料名称', 'static-text', '100px'],
  ['potBatchCode', '罐次号', 'static-text', '100px'],
  ['nodeNoLabel', '运单状态', 'static-text', '100px'],
  ['checkTypeLabel', '检验类别', 'static-text', '100px'],
  ['checkDesc', '检验说明', 'static-text', '100px'],
  ['receiptStatusLabel', '单据状态', 'static-text', '100px'],
  ['checkResultLabel', '检验结果', 'static-text', '120px'],
  ['innerResultLabel', '内部判定结果', 'static-text', '100px'],
  ['checkDt', '检验时间', 'static-datetime', '190px'],
]

const RAW_CHECK_ANALYSIS_COLUMN_NAMES = [
  'C2',
  '丙烷',
  '丙烯',
  '丙烷+丙烯',
  '异丁烷',
  '正丁烷',
  '正丁烯',
  '异丁烯',
  '反丁烯',
  '顺丁烯',
  '新戊烷',
  '异戊烷',
  '正戊烷',
  '杂质',
  'C5及C5以上组分',
  '1,2丁二烯',
  '丁二烯',
  '1,3丁二烯',
  '丙炔',
  '总戊烯',
  '丁炔',
  '总炔烃',
  '总烯烃',
  '总和',
  '氮气',
  'CO',
  'CO2',
  '甲醇',
  'MTBE',
  '二甲醚',
  '总硫',
  '总氯',
  'H2S',
  '乙腈',
  'PH',
  '水',
  '外观',
  '液相编号',
  '气相编号',
  '甲醇编号',
  '二甲醚编号',
  '化验员',
  '取样人',
]

function createRawCheckScaleExpr(scaleKey) {
  return `\${${scaleKey} == '2' ? 'raw-check-cell-alert' : (${scaleKey} == '1' ? 'raw-check-cell-important' : '')}`
}

const RAW_CHECK_ANALYSIS_COLUMNS = RAW_CHECK_ANALYSIS_COLUMN_NAMES.map(
  (name, index) => {
    const scaleKey = `_rawCheckCellScale_${String(index + 1).padStart(4, '0')}`
    return {
      name,
      label: name,
      type: 'static-text',
      width: '100px',
      classNameExpr: createRawCheckScaleExpr(scaleKey),
    }
  }
)

const RAW_CHECK_COLUMNS = [
  ...RAW_CHECK_BASE_COLUMNS.map(([name, label, type, width]) => ({
    name,
    label,
    type,
    width,
    placeholder: '-',
  })),
  ...RAW_CHECK_ANALYSIS_COLUMNS.map((column) => ({
    ...column,
    placeholder: '-',
  })),
  {
    type: 'operation',
    label: '操作',
    fixed: 'right',
    width: 225,
    buttons: [
      {
        type: 'button',
        label: '详情',
        level: 'link',
        actionType: 'dialog',
        dialog: {
          title: '原料检验详情',
          body: '${checkNo}',
        },
      },
      {
        type: 'button',
        label: '编辑',
        level: 'link',
        actionType: 'dialog',
        dialog: {
          title: '编辑原料检验单',
          body: {
            type: 'form',
            wrapWithPanel: false,
            body: [
              {
                type: 'input-text',
                name: 'checkDesc',
                label: '检验说明',
              },
            ],
          },
        },
      },
      {
        type: 'button',
        label: '打印质检单',
        level: 'link',
      },
    ],
  },
]

function makeRow(rowIndex, columnCount) {
  return Array.from({ length: columnCount }).reduce(
    (row, _, columnIndex) => ({
      ...row,
      [`field${columnIndex}`]:
        columnIndex % 2 === 0
          ? `row-${rowIndex}-value-${columnIndex}`
          : rowIndex * 100 + columnIndex,
    }),
    {
      id: `row-${rowIndex}`,
      name: `Row ${rowIndex}`,
      createdAt: `2026-07-${String((rowIndex % 28) + 1).padStart(2, '0')}`,
    }
  )
}

function makeRows(rowCount, columnCount) {
  return Array.from({ length: rowCount }, (_, rowIndex) =>
    makeRow(rowIndex + 1, columnCount)
  )
}

function createRawCheckRow(rowIndex) {
  const result = rowIndex % 17 === 0 ? '不合格' : rowIndex % 5 === 0 ? '待判定' : '合格'
  const row = {
    id: `RAW-CHECK-${String(rowIndex).padStart(4, '0')}`,
    companyName: '滨州大有新能源',
    checkNo: `RM20328181${String(rowIndex).padStart(4, '0')}`,
    receiptDt: `2026-07-${String((rowIndex % 28) + 1).padStart(2, '0')}`,
    customerNm: rowIndex % 2 === 0 ? '尚合铭远（天津）商贸有限公司' : '山东能源化工有限公司',
    carNo: rowIndex % 2 === 0 ? '津CG3109' : '鲁M12345',
    materielNm: '混合碳四',
    potBatchCode: rowIndex % 3 === 0 ? `POT-${rowIndex}` : '-',
    nodeNoLabel: rowIndex % 4 === 0 ? '已入厂' : '已出厂',
    checkTypeLabel: rowIndex % 9 === 0 ? '重取' : '正常',
    checkDesc: rowIndex % 5 === 0 ? '复检样品' : '-',
    receiptStatusLabel: rowIndex % 6 === 0 ? '已审核' : '待审核',
    checkResultLabel: result,
    innerResultLabel: result === '不合格' ? '不合格' : '合格',
    checkDt: `2026-07-${String((rowIndex % 28) + 1).padStart(2, '0')} 16:${String(rowIndex % 60).padStart(2, '0')}:00`,
  }

  RAW_CHECK_ANALYSIS_COLUMN_NAMES.forEach((name, index) => {
    const scaleKey = `_rawCheckCellScale_${String(index + 1).padStart(4, '0')}`
    row[name] = index >= 37 ? `${name}-${rowIndex}` : `${((rowIndex * (index + 3)) % 997) / 10}`
    row[scaleKey] = rowIndex % 17 === 0 ? '2' : rowIndex % 5 === 0 ? '1' : '0'
  })

  return row
}

function createRawCheckRows(rowCount) {
  return Array.from({ length: rowCount }, (_, rowIndex) =>
    createRawCheckRow(rowIndex + 1)
  )
}

function createRealFormDetailRow(rowIndex) {
  const itemNo = `ITEM-${String(rowIndex).padStart(4, '0')}`
  const aggregateItemNos =
    rowIndex > 2 && rowIndex % 10 === 0
      ? [`ITEM-${String(rowIndex - 1).padStart(4, '0')}`]
      : []

  return {
    id: `DETAIL-${rowIndex}`,
    sortNum: rowIndex,
    itemNo: {
      id: itemNo,
      value: itemNo,
      itemNo,
      aggregateItemNos,
    },
    checkValue: String((rowIndex % 90) + 5),
    isPrint: '0',
    analysisMethod: 'METHOD-1',
    dataType: { code: '1', label: 'number' },
    lowerValue: '0',
    lowerOperate: { code: '1', label: '>=' },
    upperValue: '100',
    upperOperate: { code: '1', label: '<=' },
    fixValue: '5',
    checkType: { code: '1', label: 'fixed' },
    checkDesc: `detail-${rowIndex}`,
    innerCheckResult: { code: '0', label: 'pending' },
    fixResult: null,
  }
}

function createRealFormData(rowCount = 1000) {
  return {
    id: 'CHECK-0001',
    companyId: 'COMPANY-1',
    busiType: 'BUSINESS-1',
    detailId: 'DELIVERY-DETAIL-1',
    receiptDt: '2026-07-19',
    timePrice: 100,
    amount: 1000,
    receiptStatus: '0',
    checkResult: '0',
    detail: Array.from({ length: rowCount }, (_, index) =>
      createRealFormDetailRow(index + 1)
    ),
  }
}

function createApiResponse(data) {
  return {
    code: 0,
    status: 0,
    msg: '',
    data,
  }
}

function createCrudResponse(rowCount, totalCount = rowCount, options = {}) {
  const isRawCheck = options.fixtureProfile === 'raw-check'
  const items = isRawCheck
    ? createRawCheckRows(rowCount)
    : makeRows(rowCount, CRUD_COLUMNS.length)
  return createApiResponse({
    items,
    total: isRawCheck ? rowCount : totalCount,
  })
}

function createInputTableResponse(rowCount) {
  return createApiResponse({
    lines: makeRows(rowCount, INPUT_TABLE_COLUMNS.length),
  })
}

function createDialogFormSchema(rowCount = 500) {
  return {
    type: 'form',
    name: 'dialogForm',
    wrapWithPanel: false,
    data: {
      lines: makeRows(rowCount, INPUT_TABLE_COLUMNS.length),
    },
    body: [
      {
        type: 'input-table',
        name: 'lines',
        label: 'Dialog Lines',
        needConfirm: false,
        addable: false,
        columns: INPUT_TABLE_COLUMNS,
      },
    ],
  }
}

function createSubmitResponse(pathname, requestData) {
  if (pathname.includes('echo')) {
    return createApiResponse({
      submitted: requestData || null,
    })
  }
  return createApiResponse({})
}

function parsePostData(postData) {
  if (!postData) {
    return null
  }
  try {
    return JSON.parse(postData)
  } catch {
    return postData
  }
}

function readPositiveInt(searchParams, name, fallback) {
  const rawValue = searchParams?.get?.(name)
  const parsed = Number(rawValue)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function createRouteResponse(pathname, postData, searchParams) {
  if (pathname.includes('c0-crud')) {
    return createCrudResponse(20)
  }
  if (pathname.includes('c1-crud')) {
    const perPage = readPositiveInt(searchParams, 'perPage', 2000)
    return createCrudResponse(perPage, Math.max(perPage, 2000), {
      fixtureProfile: searchParams?.get?.('fixtureProfile') || 'crud',
    })
  }
  if (pathname.includes('c2-input-table')) {
    return createInputTableResponse(readPositiveInt(searchParams, 'rows', 1000))
  }
  if (pathname.includes('c4-submit') || pathname.includes('c4-echo')) {
    return createSubmitResponse(pathname, parsePostData(postData))
  }
  return createApiResponse({})
}

module.exports = {
  CRUD_COLUMNS,
  INPUT_TABLE_COLUMNS,
  RAW_CHECK_COLUMNS,
  createDialogFormSchema,
  createRealFormData,
  createRawCheckRows,
  createRouteResponse,
  makeRows,
}
