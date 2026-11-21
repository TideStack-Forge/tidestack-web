const assert = require('node:assert/strict')
const path = require('node:path')
const { requireMirroredSrcModule } = require(
  path.join(process.cwd(), 'tests/unit/helpers/mainAppTestKit')
)

const {
  clearStatisticsChartEditorDirty,
  getStatisticsChartEditorLeaveMessage,
  hasStatisticsChartEditorDirtyChanges,
  isStatisticsChartEditorPath,
  markStatisticsChartEditorDirty,
  shouldConfirmStatisticsChartEditorRouteLeave,
} = requireMirroredSrcModule(__filename, './statisticsChartEditorDirtyGuard')

test('chart editor dirty guard blocks only a dirty chart editor route', () => {
  clearStatisticsChartEditorDirty()
  assert.equal(isStatisticsChartEditorPath('/dev/demo/chart/demo.sales'), true)
  assert.equal(isStatisticsChartEditorPath('/dev/demo/chart/add'), true)
  assert.equal(isStatisticsChartEditorPath('/dev/demo/chart'), false)
  assert.equal(hasStatisticsChartEditorDirtyChanges(), false)

  markStatisticsChartEditorDirty('/dev/demo/chart/demo.sales')
  assert.equal(hasStatisticsChartEditorDirtyChanges('/dev/demo/chart/demo.sales'), true)
  assert.equal(
    shouldConfirmStatisticsChartEditorRouteLeave(
      { fullPath: '/dev/demo/chart/demo.sales' },
      { fullPath: '/dev/demo/chart' }
    ),
    true
  )
  assert.equal(
    shouldConfirmStatisticsChartEditorRouteLeave(
      { fullPath: '/dev/demo/chart/demo.sales' },
      { fullPath: '/dev/demo/chart/demo.sales?tab=data' }
    ),
    false
  )
  assert.match(getStatisticsChartEditorLeaveMessage(), /未保存/)

  clearStatisticsChartEditorDirty('/dev/demo/chart/demo.sales')
  assert.equal(hasStatisticsChartEditorDirtyChanges(), false)
})

test('chart editor dirty guard does not record unrelated paths', () => {
  clearStatisticsChartEditorDirty()
  markStatisticsChartEditorDirty('/dev/demo/dataset/demo.sales')
  assert.equal(hasStatisticsChartEditorDirtyChanges(), false)
})
