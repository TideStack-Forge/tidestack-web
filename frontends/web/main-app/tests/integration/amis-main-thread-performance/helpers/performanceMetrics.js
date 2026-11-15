function createChecksum(input) {
  const text = typeof input === 'string' ? input : JSON.stringify(input)
  let hash = 0
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0
  }
  return `${text.length}:${hash.toString(16)}`
}

function waitForPaints(count = 2) {
  return new Promise((resolve) => {
    let remaining = count
    function step() {
      remaining -= 1
      if (remaining <= 0) {
        resolve()
        return
      }
      window.requestAnimationFrame(step)
    }
    window.requestAnimationFrame(step)
  })
}

const TRACE_MARK_NAMES = new Set([
  'body-ready',
  'busy-first-paint',
  'click',
  'amis-action-start',
  'amis-action-end',
  'fetcher-entered',
  'fetcher-resolved',
  'ready',
  'request-adaptor-start',
  'request-adaptor-end',
  'scenario-start',
  'shell-first-paint',
  'submit-complete',
  'horizontal-sweep-start',
  'horizontal-sweep-end',
  'vertical-seek-start',
  'vertical-seek-settled',
  'vertical-return-start',
  'vertical-return-settled',
])

export function createPerformanceMetrics() {
  let marks = []
  let longTasks = []
  let frameGaps = []
  let frameIntervals = []
  let lastFrameTime = null
  let rafId = null
  let longTaskObserver = null

  function mark(name, detail = {}) {
    const entry = {
      name,
      time: window.performance.now(),
      detail,
    }
    marks.push(entry)
    if (TRACE_MARK_NAMES.has(name)) {
      window.performance.mark(`${detail.scenarioId || 'amis'}:${name}`)
    }
    return entry
  }

  function startFrameLoop() {
    function frame(timestamp) {
      if (lastFrameTime != null) {
        frameGaps.push(timestamp - lastFrameTime)
        frameIntervals.push({
          startTime: lastFrameTime,
          endTime: timestamp,
          duration: timestamp - lastFrameTime,
        })
      }
      lastFrameTime = timestamp
      rafId = window.requestAnimationFrame(frame)
    }
    rafId = window.requestAnimationFrame(frame)
  }

  function startLongTaskObserver() {
    if (!('PerformanceObserver' in window)) {
      return
    }
    try {
      longTaskObserver = new PerformanceObserver((list) => {
        longTasks.push(
          ...list.getEntries().map((entry) => ({
            startTime: entry.startTime,
            duration: entry.duration,
            name: entry.name,
          }))
        )
      })
      longTaskObserver.observe({ type: 'longtask', buffered: true })
    } catch (error) {
      mark('longtask-observer-unavailable', { message: error.message })
    }
  }

  function reset() {
    marks = []
    longTasks = []
    frameGaps = []
    frameIntervals = []
    lastFrameTime = null
    window.performance.clearMarks()
    window.performance.clearMeasures()
  }

  function start() {
    stop()
    startFrameLoop()
    startLongTaskObserver()
  }

  function stop() {
    if (rafId != null) {
      window.cancelAnimationFrame(rafId)
      rafId = null
    }
    longTaskObserver?.disconnect()
    longTaskObserver = null
  }

  function snapshot(extra = {}) {
    return {
      ...extra,
      marks: marks.slice(),
      longTasks: longTasks.slice(),
      frameGaps: frameGaps.slice(),
      frameIntervals: frameIntervals.slice(),
      maxFrameGapMs: frameGaps.length ? Math.max(...frameGaps) : 0,
      maxLongTaskMs: longTasks.length
        ? Math.max(...longTasks.map((task) => task.duration))
        : 0,
      longTaskOver100Count: longTasks.filter((task) => task.duration > 100).length,
    }
  }

  function summarizeWindow(startName, endName) {
    const start = marks.find((entry) => entry.name === startName)
    const end = marks.find(
      (entry) => entry.name === endName && (!start || entry.time >= start.time)
    )
    if (!start || !end) {
      return {
        status: 'missing',
        startName,
        endName,
      }
    }

    const windowLongTasks = longTasks.filter(
      (task) =>
        task.startTime < end.time &&
        task.startTime + task.duration > start.time
    )
    const windowFrameIntervals = frameIntervals.filter(
      (interval) =>
        interval.startTime >= start.time && interval.startTime < end.time
    )
    return {
      status: 'ok',
      startName,
      endName,
      startTime: start.time,
      endTime: end.time,
      durationMs: end.time - start.time,
      maxLongTaskMs: windowLongTasks.length
        ? Math.max(...windowLongTasks.map((task) => task.duration))
        : 0,
      longTaskCount: windowLongTasks.length,
      maxFrameGapMs: windowFrameIntervals.length
        ? Math.max(...windowFrameIntervals.map((interval) => interval.duration))
        : 0,
      frameIntervalCount: windowFrameIntervals.length,
    }
  }

  return {
    createChecksum,
    mark,
    reset,
    snapshot,
    summarizeWindow,
    start,
    stop,
    waitForPaints,
  }
}

export { createChecksum, waitForPaints }
