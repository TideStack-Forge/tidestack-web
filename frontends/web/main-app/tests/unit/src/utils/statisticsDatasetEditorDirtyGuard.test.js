const assert = require('node:assert/strict')
const path = require('node:path')
const { requireMirroredSrcModule } = require(path.join(process.cwd(), 'tests/unit/helpers/mainAppTestKit'))

const {
  clearStatisticsDatasetEditorDirty,
  getStatisticsDatasetEditorLeaveMessage,
  hasStatisticsDatasetEditorDirtyChanges,
  isStatisticsDatasetEditorPath,
  markStatisticsDatasetEditorDirty,
  shouldConfirmStatisticsDatasetEditorRouteLeave,
} = requireMirroredSrcModule(__filename, './statisticsDatasetEditorDirtyGuard')

test('statistics dataset editor dirty guard only blocks route leave for dirty editor pages', () => {
  clearStatisticsDatasetEditorDirty()
  assert.equal(hasStatisticsDatasetEditorDirtyChanges(), false)
  assert.equal(isStatisticsDatasetEditorPath('/dev/demo/dataset/demo.sales'), true)
  assert.equal(shouldConfirmStatisticsDatasetEditorRouteLeave(
    { path: '/dev/demo/dataset/demo.sales', fullPath: '/dev/demo/dataset/demo.sales' },
    { path: '/dev/demo/chart', fullPath: '/dev/demo/chart' }
  ), false)

  markStatisticsDatasetEditorDirty()
  assert.equal(hasStatisticsDatasetEditorDirtyChanges(), true)
  assert.equal(shouldConfirmStatisticsDatasetEditorRouteLeave(
    { path: '/dev/demo/dataset/demo.sales', fullPath: '/dev/demo/dataset/demo.sales' },
    { path: '/dev/demo/chart', fullPath: '/dev/demo/chart' }
  ), true)
  assert.equal(shouldConfirmStatisticsDatasetEditorRouteLeave(
    { path: '/dev/demo/dataset/demo.sales', fullPath: '/dev/demo/dataset/demo.sales' },
    { path: '/dev/demo/dataset/demo.sales', fullPath: '/dev/demo/dataset/demo.sales?tab=schema' }
  ), false)
  assert.equal(getStatisticsDatasetEditorLeaveMessage(), '当前数据集编辑器存在未保存改动，离开后未保存内容将会丢失。')
})

test('statistics dataset editor dirty guard clears anonymous dirty state for non-editor debug pages', () => {
  clearStatisticsDatasetEditorDirty()
  markStatisticsDatasetEditorDirty('/debug/dataset-sql-editor')
  assert.equal(hasStatisticsDatasetEditorDirtyChanges(), true)

  clearStatisticsDatasetEditorDirty('/debug/dataset-sql-editor')
  assert.equal(hasStatisticsDatasetEditorDirtyChanges(), false)
})
