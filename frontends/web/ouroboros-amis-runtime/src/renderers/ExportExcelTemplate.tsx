import { Renderer } from 'amis'
import React from 'react'
// @ts-ignore
import { saveAs } from 'file-saver'

export default class ExportExcelTemplate extends React.Component<any, any> {
  handleClick(exportColumns: any, filename: any) {
    // 测试：首屏加载
    import('exceljs').then(async (E: any) => {
      const ExcelJS = E.default || E

      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('sheet', {
        properties: { defaultColWidth: 15 },
      })
      worksheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
      // 表头
      const transformedColumns = exportColumns.map((item: any) => {
        return {
          header: item || item?.label,
          width: item?.width || 10,
        }
      })
      worksheet.columns = transformedColumns

      const buffer = await workbook.xlsx.writeBuffer()

      if (buffer) {
        const blob = new Blob([buffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        })
        saveAs(blob, filename + '.xlsx')
      }
    })
  }

  render() {
    const { exportColumns, filename, render, ...rest } = this.props
    return render('custmExportExcelTemplate', {
      ...rest,
      type: 'button',
      onClick: this.handleClick.bind(this, exportColumns, filename),
    })
  }
}

Renderer({
  type: 'export-excel-template',
  autoVar: true,
})(ExportExcelTemplate as any)
