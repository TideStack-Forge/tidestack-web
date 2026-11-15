const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const DEFAULT_METRICS_PATH = path.join(
  process.cwd(),
  'test-results',
  'amis-main-thread-performance',
  'raw-check-metrics.json'
)
const DEFAULT_REPORT_PATH = path.join(
  process.cwd(),
  '..',
  '..',
  '..',
  '.codestable',
  'issues',
  '2026-07-23-amis-table-lazy-row-regression',
  'raw-check-performance-analysis.md'
)

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function percentile(values, ratio) {
  if (!values.length) {
    return 0
  }
  const sorted = values.slice().sort((left, right) => left - right)
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * ratio) - 1)
  )
  return sorted[index]
}

function summarize(values) {
  const cleanValues = values.filter((value) => Number.isFinite(value))
  return {
    count: cleanValues.length,
    median: percentile(cleanValues, 0.5),
    p95: percentile(cleanValues, 0.95),
    max: cleanValues.length ? Math.max(...cleanValues) : 0,
  }
}

function round(value) {
  return Math.round((Number(value) || 0) * 100) / 100
}

function ms(value) {
  return `${round(value)}ms`
}

function number(value) {
  return String(round(value))
}

function durationBetween(snapshot, startName, endName) {
  const start = snapshot.marks?.find((mark) => mark.name === startName)
  const end = snapshot.marks?.find(
    (mark) => mark.name === endName && (!start || mark.time >= start.time)
  )
  return start && end ? end.time - start.time : 0
}

function windowOf(snapshot, name) {
  return (
    snapshot.performanceAttribution?.windows?.[name] ||
    snapshot.performanceAttribution?.[name] ||
    null
  )
}

function collectWindowCategories(snapshots, windowName) {
  const categories = new Map()
  for (const snapshot of snapshots) {
    const window = windowOf(snapshot, windowName)
    for (const item of window?.attribution?.byCategory || []) {
      const current = categories.get(item.category) || {
        category: item.category,
        count: 0,
        totalDurationMs: 0,
        maxDurationMs: 0,
      }
      current.count += item.count || 0
      current.totalDurationMs += item.totalDurationMs || 0
      current.maxDurationMs = Math.max(current.maxDurationMs, item.maxDurationMs || 0)
      categories.set(item.category, current)
    }
  }

  return Array.from(categories.values())
    .map((item) => ({
      ...item,
      avgDurationMs: item.count ? item.totalDurationMs / item.count : 0,
    }))
    .sort((left, right) => right.totalDurationMs - left.totalDurationMs)
}

function collectTopBuckets(snapshots, windowName, limit = 10) {
  const buckets = new Map()
  for (const snapshot of snapshots) {
    const window = windowOf(snapshot, windowName)
    for (const item of window?.attribution?.topBuckets || []) {
      const current = buckets.get(item.key) || {
        key: item.key,
        category: item.category,
        detail: item.detail,
        count: 0,
        totalDurationMs: 0,
        maxDurationMs: 0,
      }
      current.count += item.count || 0
      current.totalDurationMs += item.totalDurationMs || 0
      current.maxDurationMs = Math.max(current.maxDurationMs, item.maxDurationMs || 0)
      buckets.set(item.key, current)
    }
  }

  return Array.from(buckets.values())
    .map((item) => ({
      ...item,
      avgDurationMs: item.count ? item.totalDurationMs / item.count : 0,
    }))
    .sort((left, right) => right.totalDurationMs - left.totalDurationMs)
    .slice(0, limit)
}

function phaseBounds(snapshot, windowName) {
  const window = windowOf(snapshot, windowName)
  return window?.status === 'ok' ? window : null
}

function mstDurationsForWindow(snapshot, windowName) {
  const window = phaseBounds(snapshot, windowName)
  if (!window) {
    return []
  }
  const starts = new Map()
  const durations = []
  for (const mark of snapshot.marks || []) {
    if (mark.name === 'mst-action-start') {
      starts.set(mark.detail?.token, mark)
      continue
    }
    if (mark.name !== 'mst-action-end') {
      continue
    }
    const start = starts.get(mark.detail?.token)
    if (!start) {
      continue
    }
    if (start.time < window.startTime || start.time > window.endTime) {
      continue
    }
    durations.push({
      actionName: mark.detail?.actionName || 'unknown',
      durationMs: mark.time - start.time,
    })
  }
  return durations
}

function summarizeMstByWindow(snapshots, windowName) {
  const groups = new Map()
  for (const snapshot of snapshots) {
    for (const item of mstDurationsForWindow(snapshot, windowName)) {
      const current = groups.get(item.actionName) || {
        actionName: item.actionName,
        count: 0,
        totalDurationMs: 0,
        maxDurationMs: 0,
      }
      current.count += 1
      current.totalDurationMs += item.durationMs
      current.maxDurationMs = Math.max(current.maxDurationMs, item.durationMs)
      groups.set(item.actionName, current)
    }
  }

  return Array.from(groups.values())
    .map((item) => ({
      ...item,
      avgDurationMs: item.count ? item.totalDurationMs / item.count : 0,
    }))
    .sort((left, right) => right.totalDurationMs - left.totalDurationMs)
}

function reactCommitsForWindow(snapshot, windowName) {
  const window = phaseBounds(snapshot, windowName)
  if (!window) {
    return []
  }
  return (snapshot.marks || [])
    .filter(
      (mark) =>
        mark.name === 'react-commit' &&
        mark.time >= window.startTime &&
        mark.time <= window.endTime
    )
    .map((mark) => ({
      actualDuration: Number(mark.detail?.actualDuration || 0),
      baseDuration: Number(mark.detail?.baseDuration || 0),
    }))
}

function summarizeReactByWindow(snapshots, windowName) {
  const commits = snapshots.flatMap((snapshot) =>
    reactCommitsForWindow(snapshot, windowName)
  )
  return {
    commitCount: commits.length,
    actualDuration: summarize(commits.map((commit) => commit.actualDuration)),
    baseDuration: summarize(commits.map((commit) => commit.baseDuration)),
    totalActualDurationMs: commits.reduce(
      (sum, commit) => sum + commit.actualDuration,
      0
    ),
  }
}

function table(headers, rows) {
  if (!rows.length) {
    return '_无记录_'
  }
  return [
    `| ${headers.join(' |')} |`,
    `| ${headers.map(() => '---').join(' |')} |`,
    ...rows.map((row) => `| ${row.join(' |')} |`),
  ].join('\n')
}

function summarizeField(snapshots, reader) {
  return summarize(snapshots.map(reader))
}

function renderSummaryStat(summary) {
  return `median ${ms(summary.median)} / p95 ${ms(summary.p95)} / max ${ms(summary.max)}`
}

function getCategory(categories, name) {
  return categories.find((item) => item.category === name) || {
    category: name,
    count: 0,
    totalDurationMs: 0,
    maxDurationMs: 0,
    avgDurationMs: 0,
  }
}

function categoryRows(categories, limit = 12) {
  return categories.slice(0, limit).map((item) => [
    item.category,
    String(item.count),
    ms(item.totalDurationMs),
    ms(item.avgDurationMs),
    ms(item.maxDurationMs),
  ])
}

function bucketRows(buckets) {
  return buckets.map((item) => [
    item.category,
    item.detail?.schemaType ||
      item.detail?.rendererName ||
      item.detail?.columnType ||
      item.detail?.lookupName ||
      '-',
    item.detail?.columnName || item.detail?.lookupName || '-',
    String(item.count),
    ms(item.totalDurationMs),
    ms(item.maxDurationMs),
  ])
}

function runRows(snapshots) {
  return snapshots.map((snapshot) => [
    snapshot.runId,
    String(snapshot.rowCount),
    String(snapshot.visibleBusinessRowCount),
    ms(durationBetween(snapshot, 'scenario-start', 'ready')),
    ms(snapshot.postResponseResponsiveness?.durationMs || 0),
    ms(snapshot.maxLongTaskMs || 0),
    ms(snapshot.maxFrameGapMs || 0),
    String(snapshot.tableStoreState?.materializationRowCreateCount || 0),
    String(snapshot.tableStoreState?.materializationPublishCount || 0),
    String(snapshot.verticalSeekMaterializationDelta?.rowCreateDelta ?? '-'),
    String(snapshot.verticalReturnMaterializationDelta?.rowCreateDelta ?? '-'),
  ])
}

function shellCoverageRows(snapshots) {
  return snapshots.map((snapshot) => {
    const coverage = snapshot.visibleRowShellCoverage || {}
    return [
      snapshot.runId,
      String(coverage.rowCount ?? '-'),
      String(coverage.minCellCount ?? '-'),
      String(coverage.maxCellCount ?? '-'),
      String(coverage.rowsWithoutCells ?? '-'),
      String(coverage.placeholderRowCount ?? '-'),
      String(coverage.placeholderRowsWithoutCellPlaceholder ?? '-'),
      String(coverage.emptyBlocksOutsideCells ?? '-'),
    ]
  })
}

function renderMstRows(rows) {
  return rows.slice(0, 12).map((item) => [
    item.actionName,
    String(item.count),
    ms(item.totalDurationMs),
    ms(item.avgDurationMs),
    ms(item.maxDurationMs),
  ])
}

function renderReactSummary(summary) {
  return `${summary.commitCount} commits / actual ${renderSummaryStat(summary.actualDuration)} / total actual ${ms(summary.totalActualDurationMs)}`
}

function sumCategories(...items) {
  return items.reduce(
    (sum, item) => ({
      category: item.category || sum.category,
      count: sum.count + (item.count || 0),
      totalDurationMs: sum.totalDurationMs + (item.totalDurationMs || 0),
      maxDurationMs: Math.max(sum.maxDurationMs, item.maxDurationMs || 0),
      avgDurationMs:
        sum.count + (item.count || 0)
          ? (sum.totalDurationMs + (item.totalDurationMs || 0)) /
            (sum.count + (item.count || 0))
          : 0,
    }),
    {
      category: items.find((item) => item.category)?.category || 'combined',
      count: 0,
      totalDurationMs: 0,
      maxDurationMs: 0,
      avgDurationMs: 0,
    }
  )
}

function renderReport(metrics, metricsPath) {
  const snapshots = (metrics.snapshots || []).filter(
    (snapshot) => snapshot.fixtureProfile === 'raw-check'
  )
  if (!snapshots.length) {
    throw new Error('raw-check metrics did not contain raw-check snapshots')
  }

  const firstScreenCategories = collectWindowCategories(snapshots, 'firstScreen')
  const verticalSeekCategories = collectWindowCategories(snapshots, 'verticalSeek')
  const verticalReturnCategories = collectWindowCategories(snapshots, 'verticalReturn')
  const horizontalSweepCategories = collectWindowCategories(
    snapshots,
    'horizontalSweep'
  )
  const firstScreenTop = collectTopBuckets(snapshots, 'firstScreen')
  const verticalSeekTop = collectTopBuckets(snapshots, 'verticalSeek')
  const verticalReturnTop = collectTopBuckets(snapshots, 'verticalReturn')
  const firstScreenDuration = summarizeField(snapshots, (snapshot) =>
    snapshot.postResponseResponsiveness?.durationMs || 0
  )
  const readyDuration = summarizeField(snapshots, (snapshot) =>
    durationBetween(snapshot, 'scenario-start', 'ready')
  )
  const maxLongTask = summarizeField(snapshots, (snapshot) => snapshot.maxLongTaskMs || 0)
  const maxFrameGap = summarizeField(snapshots, (snapshot) => snapshot.maxFrameGapMs || 0)
  const seekLongTask = summarizeField(
    snapshots,
    (snapshot) => snapshot.verticalSeekResponsiveness?.maxLongTaskMs || 0
  )
  const returnLongTask = summarizeField(
    snapshots,
    (snapshot) => snapshot.verticalReturnResponsiveness?.maxLongTaskMs || 0
  )
  const nativeRender = getCategory(firstScreenCategories, 'table-native-render-cell')
  const measuredTotalCellRender = getCategory(firstScreenCategories, 'table-render-cell-total')
  const totalCellRender = measuredTotalCellRender.count
    ? measuredTotalCellRender
    : nativeRender
  const rendererLookup = sumCategories(
    getCategory(firstScreenCategories, 'renderer-registry-lookup'),
    getCategory(firstScreenCategories, 'schema-resolve-renderer')
  )
  const rendererByName = getCategory(firstScreenCategories, 'renderer-by-name-lookup')
  const schemaFilter = getCategory(firstScreenCategories, 'schema-filter')
  const translate = getCategory(firstScreenCategories, 'translate')
  const firstScreenReact = summarizeReactByWindow(snapshots, 'firstScreen')
  const seekReact = summarizeReactByWindow(snapshots, 'verticalSeek')
  const returnReact = summarizeReactByWindow(snapshots, 'verticalReturn')
  const seekRowCreates = snapshots.map(
    (snapshot) => snapshot.verticalSeekMaterializationDelta?.rowCreateDelta || 0
  )
  const returnRowCreates = snapshots.map(
    (snapshot) => snapshot.verticalReturnMaterializationDelta?.rowCreateDelta || 0
  )
  const shellCoverageIssues = snapshots.filter((snapshot) => {
    const coverage = snapshot.visibleRowShellCoverage || {}
    return (
      coverage.rowsWithoutCells ||
      coverage.placeholderRowsWithoutCellPlaceholder ||
      coverage.emptyBlocksOutsideCells ||
      coverage.minCellCount !== coverage.maxCellCount
    )
  })
  const hasRepeatedRowStoreCreation =
    seekRowCreates.some(Boolean) || returnRowCreates.some(Boolean)
  const instrumentationStatus =
    snapshots[0].performanceAttribution?.instrumentationStatus || []
  const failedInstrumentation = instrumentationStatus.filter((item) => !item.installed)

  return `# raw-check 表格懒渲染性能分析报告

生成时间：${new Date().toISOString()}

## 性能问题描述

本次分析针对 raw-check 形态的 AMIS 宽表：200 行、58 个业务列，开启选择列后每行 59 个 cell。列形态对齐线上 raw-check：57 个 static-text/date/datetime 静态列、43 个检测列带 classNameExpr、1 个右固定 operation 列。目标是拆清楚首屏加载和按需渲染阶段的主线程成本，重点验证快速滚动后是否出现 MST RowStore 反复创建、已渲染行反复重渲染、AMIS 渲染器查找/本地化/Schema 过滤等开销异常。

## 测量与分析方法

- 复用现有 \`amis-main-thread-performance\` Playwright 基座，新增 \`PERF_SAMPLE_SET=raw-check\`，不另建平行表格实现。
- 数据接口由本地 route 返回 200 条 raw-check 夹具数据，schema 仍走 CRUD/Table 的真实 AMIS 渲染链。
- 用 React Profiler、PerformanceObserver longtask、requestAnimationFrame frame gap、MST middleware、Table/SchemaRenderer/factory/translate 包装器共同采样。
- 归因测点记录的是包裹函数的 inclusive duration，类别之间可能嵌套，不能简单相加为墙钟耗时。

## 测量实验设计

| 维度 | 设计 |
| --- | --- |
| 样本 | raw-check CRUD，200 行，58 个业务列，选择列开启后每行 59 个 cell |
| 列复杂度 | 57 个 static-text/date/datetime 静态列、43 个检测列带 classNameExpr、1 个右固定 operation 列 |
| 阶段 | 首屏：\`fetcher-resolved → ready\`；按需渲染：\`vertical-seek\`、\`vertical-return\`、\`horizontal-sweep\` |
| 重复次数 | ${metrics.env?.runs || snapshots.length} run |
| 运行方式 | \`PERF_SAMPLE_SET=raw-check PERF_MODE=record PERF_RUNS=${metrics.env?.runs || snapshots.length} npx playwright test tests/integration/amis-main-thread-performance --config=playwright.config.js --project=chromium --workers=1 --retries=0\` |
| 原始指标 | \`${path.relative(process.cwd(), metricsPath)}\` |

## 测量过程描述

1. Playwright 打开本地性能 harness。
2. 安装本地 raw-check API route，返回 200 条夹具数据。
3. 渲染 CRUD/Table，等待 fetcher resolved、TableStore 数据完整、首行可见、首屏 ready。
4. 触发纵向滚动到 85% 位置，再回到顶部，记录按需渲染与回跳响应。
5. 触发横向滚动到底再回到左侧，记录固定列/宽表横向成本。
6. 汇总 React commit、long task、frame gap、MST action、Table/SchemaRenderer/factory/translate 归因数据。

## 测量数据记录

### 单次运行记录

${table(
  [
    'runId',
    '行数',
    '可见行',
    'scenario→ready',
    'fetcher→ready',
    '最大长任务',
    '最大帧间隔',
    'RowStore 创建',
    '发布批次',
    '下滑新增创建',
    '回顶新增创建',
  ],
  runRows(snapshots)
)}

### 行 shell / placeholder 覆盖

${table(
  [
    'runId',
    '行 shell',
    '最小 cell',
    '最大 cell',
    '无 cell 行',
    '占位行',
    '占位缺 cell',
    'cell 外空块',
  ],
  shellCoverageRows(snapshots)
)}

### 首屏总体指标

| 指标 | 结果 |
| --- | --- |
| scenario-start → ready | ${renderSummaryStat(readyDuration)} |
| fetcher-resolved → ready | ${renderSummaryStat(firstScreenDuration)} |
| 最大 Long Task | ${renderSummaryStat(maxLongTask)} |
| 最大 Frame Gap | ${renderSummaryStat(maxFrameGap)} |
| React commit | ${renderReactSummary(firstScreenReact)} |

### 按需渲染总体指标

| 阶段 | 最大 Long Task | 说明 |
| --- | --- | --- |
| vertical-seek | ${renderSummaryStat(seekLongTask)} | 从顶部滚到 85% 位置 |
| vertical-return | ${renderSummaryStat(returnLongTask)} | 从下方回到顶部，验证已渲染区域是否复用 |
| vertical-seek React | ${renderReactSummary(seekReact)} | 滚动触发的 React commit |
| vertical-return React | ${renderReactSummary(returnReact)} | 回到已访问区域的 React commit |

### 首屏归因类别

${table(
  ['类别', '次数', '累计耗时', '平均耗时', '最大单次'],
  categoryRows(firstScreenCategories)
)}

### vertical-seek 归因类别

${table(
  ['类别', '次数', '累计耗时', '平均耗时', '最大单次'],
  categoryRows(verticalSeekCategories)
)}

### vertical-return 归因类别

${table(
  ['类别', '次数', '累计耗时', '平均耗时', '最大单次'],
  categoryRows(verticalReturnCategories)
)}

### horizontal-sweep 归因类别

${table(
  ['类别', '次数', '累计耗时', '平均耗时', '最大单次'],
  categoryRows(horizontalSweepCategories)
)}

### 首屏 Top 归因桶

${table(
  ['类别', '类型/渲染器', '列/键', '次数', '累计耗时', '最大单次'],
  bucketRows(firstScreenTop)
)}

### 滚动 Top 归因桶

${table(
  ['类别', '类型/渲染器', '列/键', '次数', '累计耗时', '最大单次'],
  bucketRows(verticalSeekTop.concat(verticalReturnTop).slice(0, 10))
)}

### MST action 归因

首屏：

${table(
  ['action', '次数', '累计耗时', '平均耗时', '最大单次'],
  renderMstRows(summarizeMstByWindow(snapshots, 'firstScreen'))
)}

vertical-seek：

${table(
  ['action', '次数', '累计耗时', '平均耗时', '最大单次'],
  renderMstRows(summarizeMstByWindow(snapshots, 'verticalSeek'))
)}

vertical-return：

${table(
  ['action', '次数', '累计耗时', '平均耗时', '最大单次'],
  renderMstRows(summarizeMstByWindow(snapshots, 'verticalReturn'))
)}

## 测量数据分析

- 首屏主路径耗时：\`fetcher-resolved → ready\` 为 ${renderSummaryStat(firstScreenDuration)}；这段包含数据进入 TableStore、首批行 shell/cell 渲染、React commit 与浏览器绘制等待。
- 行 shell / placeholder 覆盖：${shellCoverageIssues.length ? `发现 ${shellCoverageIssues.length} 次覆盖异常，需要继续追查固定列/选择列错位或空块来源。` : `共 ${snapshots.length} 次运行，每行均为 59 个 cell，无无 cell 行、无缺 cell 占位、无 cell 外空块；说明当前沙箱能覆盖选择列/固定列下的占位结构正确性。`}
- React commit 成本更接近这次的渲染主账：首屏 ${renderReactSummary(firstScreenReact)}，vertical-seek ${renderReactSummary(seekReact)}，vertical-return ${renderReactSummary(returnReact)}。这些 commit 后续还会触发浏览器 DOM/style/layout/paint，因此比局部函数包裹耗时更能解释用户看到的卡顿。
- 总 cell 渲染包裹耗时：\`${totalCellRender.category}\` 首屏累计 ${ms(totalCellRender.totalDurationMs)}，调用 ${totalCellRender.count} 次；其中走 AMIS 原生 \`renderCell\` 的累计 ${ms(nativeRender.totalDurationMs)}，调用 ${nativeRender.count} 次。这个包装器只覆盖 renderCell 的局部同步函数成本，不包含 React reconcile/commit，也不包含浏览器 DOM/style/layout/paint。raw-check 真实列主要是 \`static-text\` / \`static-date\` / \`static-datetime\`，因此这组数据更能代表 AMIS 原生静态列路径，而不是自定义 schema 组件路径。
- AMIS 动态渲染器路径：\`renderer-registry-lookup\` 首屏累计 ${ms(rendererLookup.totalDurationMs)}，\`renderer-by-name-lookup\` 累计 ${ms(rendererByName.totalDurationMs)}；若这两项占比低，说明主要瓶颈不在注册表查找本身。
- Schema 过滤路径：\`schema-filter\` 首屏累计 ${ms(schemaFilter.totalDurationMs)}，它反映 AMIS 原生 schema filter 与本基座扩展 filter 的合计成本。
- 本地化路径：\`translate\` 首屏累计 ${ms(translate.totalDurationMs)}，调用 ${translate.count} 次；如果调用次数高但累计耗时低，本地化不是首要瓶颈。
- MST 重复创建检查：纵向下滑新增 RowStore 创建 ${seekRowCreates.join(', ')}，回顶新增 RowStore 创建 ${returnRowCreates.join(', ')}；${hasRepeatedRowStoreCreation ? '存在交互期新增创建，需要继续追查 TableStore 生命周期。' : '未观察到交互期反复创建 RowStore，反复卡顿更可能来自按需 cell/React/DOM 渲染。'}

## 性能根因分析

- 根因 1：首屏长任务主要来自 200×59 cell 规模下的 React commit 和浏览器 DOM/style/layout/paint。renderCell 局部函数成本很小，但它后面挂着大量 React 和浏览器工作。
- 根因 2：43 个检测列带 classNameExpr，不能在不保留表达式、样式、placeholder、固定列、选择列行为的前提下简单当成完全纯文本 cell 跳过渲染链路。
- 根因 3：本次测量未观察到 vertical-seek / vertical-return 阶段重复创建 RowStore；交互期滚动成本更像 LazyRow/LazyCell 触发后的 React/browser work，而不是 MST materialization 反复发生。
- 根因 4：renderer lookup、schema filter、本地化在这个 raw-check 静态列样本里不是主瓶颈。它们已经被独立测点量化，后续只有在真实扩展列占比升高时才值得优先优化。
${failedInstrumentation.length ? `\n- 测点限制：以下包装器未安装成功，相关数据可能缺失：${failedInstrumentation.map((item) => item.target).join(', ')}。` : ''}

## 性能优化建议

1. 先保留 Table2/LazyRow 风格的行 shell 常驻机制，禁止回到已渲染区域时退回空白占位。
2. 评估 static-text/date/datetime 的列级轻量路径：在保留 classNameExpr、placeholder、固定列和选择列正确性的前提下，减少每个静态 cell 的 React/DOM 组件层级。
3. 如果 \`schema-filter\` 或 \`renderer-registry-lookup\` 在真实数据中占比升高，优先做列级 renderer/schema 预解析缓存，不做 per-cell 动态查找。
4. 如果滚动阶段 long task 仍偏高，调小 LazyRow/LazyCell 共用队列的单帧 workUnits，或用首批实测耗时动态估算每帧 row/cell 数，而不是扩大同步渲染批次。
5. 增加一个长期 gate：raw-check 200 行回顶阶段 RowStore 创建增量必须为 0，最大 long task 单独设阈值，防止“已渲染区域反复卡”的问题回归。
`
}

function main() {
  const metricsPath = path.resolve(process.argv[2] || DEFAULT_METRICS_PATH)
  const reportPath = path.resolve(process.argv[3] || DEFAULT_REPORT_PATH)
  const metrics = readJson(metricsPath)
  const report = renderReport(metrics, metricsPath)
  fs.mkdirSync(path.dirname(reportPath), { recursive: true })
  fs.writeFileSync(reportPath, report.replace(/\n/g, os.EOL))
  console.log(reportPath)
}

main()
