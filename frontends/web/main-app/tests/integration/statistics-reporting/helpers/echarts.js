const { expect } = require('@playwright/test')

async function waitForEChartsSettled(
  page,
  { rootSelector = 'body', minimumInstances = 1, requireSeriesData = false } = {}
) {
  await expect
    .poll(
      () =>
        page.evaluate(
          ({ rootSelector, minimumInstances, requireSeriesData }) => {
            const root = document.querySelector(rootSelector)
            if (!root || !window.echarts) {
              return false
            }

            const chartElements = [
              ...(root.matches('[_echarts_instance_]') ? [root] : []),
              ...root.querySelectorAll('[_echarts_instance_]'),
            ]
            const instances = chartElements
              .map((element) => window.echarts.getInstanceByDom(element))
              .filter(Boolean)

            if (instances.length < minimumInstances) {
              return false
            }

            return instances.every((instance) => {
              const animation = instance.getZr()?.animation
              const animationFinished =
                typeof animation?.isFinished !== 'function' || animation.isFinished()
              const displayList = instance.getZr()?.storage?.getDisplayList?.() || []
              if (!animationFinished || displayList.length === 0) {
                return false
              }
              if (!requireSeriesData) {
                return true
              }

              const series = instance.getOption()?.series || []
              return series.some(
                (item) => Array.isArray(item.data) && item.data.length > 0
              )
            })
          },
          { rootSelector, minimumInstances, requireSeriesData }
        ),
      {
        message: `ECharts did not finish rendering in ${rootSelector}`,
        timeout: 10_000,
      }
    )
    .toBe(true)
}

module.exports = { waitForEChartsSettled }
