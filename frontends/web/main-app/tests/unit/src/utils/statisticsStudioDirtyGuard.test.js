const assert = require('node:assert/strict')
const path = require('node:path')
const { requireMirroredSrcModule } = require(path.join(process.cwd(), 'tests/unit/helpers/mainAppTestKit'))

const {
  clearStatisticsStudioDirty,
  getStatisticsStudioLeaveMessage,
  hasStatisticsStudioDirtyChanges,
  isStatisticsDatasetStudioPath,
  markStatisticsStudioDirty,
  shouldConfirmStatisticsStudioRouteLeave,
} = requireMirroredSrcModule(__filename, './statisticsStudioDirtyGuard')

test('statistics studio dirty guard only blocks route leave for dirty studio pages', () => {
  clearStatisticsStudioDirty()
  assert.equal(hasStatisticsStudioDirtyChanges(), false)
  assert.equal(isStatisticsDatasetStudioPath('/dev/demo/analytics/datasets/demo.sales/studio'), true)
  assert.equal(shouldConfirmStatisticsStudioRouteLeave(
    { path: '/dev/demo/analytics/datasets/demo.sales/studio', fullPath: '/dev/demo/analytics/datasets/demo.sales/studio' },
    { path: '/dev/demo/statistics-reporting', fullPath: '/dev/demo/statistics-reporting' }
  ), false)

  markStatisticsStudioDirty()
  assert.equal(hasStatisticsStudioDirtyChanges(), true)
  assert.equal(shouldConfirmStatisticsStudioRouteLeave(
    { path: '/dev/demo/analytics/datasets/demo.sales/studio', fullPath: '/dev/demo/analytics/datasets/demo.sales/studio' },
    { path: '/dev/demo/statistics-reporting', fullPath: '/dev/demo/statistics-reporting' }
  ), true)
  assert.equal(shouldConfirmStatisticsStudioRouteLeave(
    { path: '/dev/demo/analytics/datasets/demo.sales/studio', fullPath: '/dev/demo/analytics/datasets/demo.sales/studio' },
    { path: '/dev/demo/analytics/datasets/demo.sales/studio', fullPath: '/dev/demo/analytics/datasets/demo.sales/studio?tab=schema' }
  ), false)
  assert.match(getStatisticsStudioLeaveMessage(), /未保存/)
})

test('statistics studio dirty guard clears anonymous dirty state for non-studio debug pages', () => {
  clearStatisticsStudioDirty()
  markStatisticsStudioDirty('/debug/statistics-sql-editor')
  assert.equal(hasStatisticsStudioDirtyChanges(), true)

  clearStatisticsStudioDirty('/debug/statistics-sql-editor')
  assert.equal(hasStatisticsStudioDirtyChanges(), false)
})
