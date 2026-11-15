function resolvePerformanceMode(env = process.env) {
  const mode = env.PERF_MODE || 'record'
  const sampleSet = env.PERF_SAMPLE_SET || 'smoke'
  const runs = Number(env.PERF_RUNS || 1)

  if (!['record', 'gate'].includes(mode)) {
    throw new Error(`Unsupported PERF_MODE: ${mode}`)
  }
  if (
    ![
      'smoke',
      'calibrate',
      'diagnose',
      'attribution',
      'schedule-poc',
      'identity-poc',
      'form-real',
      'poc',
      'scroll-baseline',
      'gate',
      'raw-check',
    ].includes(sampleSet)
  ) {
    throw new Error(`Unsupported PERF_SAMPLE_SET: ${sampleSet}`)
  }
  if (sampleSet === 'smoke' && runs !== 1) {
    throw new Error('PERF_SAMPLE_SET=smoke requires PERF_RUNS=1')
  }
  if (sampleSet === 'calibrate' && (mode === 'gate' || runs < 20)) {
    throw new Error('PERF_SAMPLE_SET=calibrate requires record mode and >=20 runs')
  }
  if (sampleSet === 'diagnose' && (mode !== 'record' || runs < 1)) {
    throw new Error('PERF_SAMPLE_SET=diagnose requires record mode and >=1 run')
  }
  if (sampleSet === 'attribution' && (mode !== 'record' || runs < 1)) {
    throw new Error(
      'PERF_SAMPLE_SET=attribution requires record mode and >=1 run'
    )
  }
  if (sampleSet === 'schedule-poc' && (mode !== 'record' || runs < 1)) {
    throw new Error(
      'PERF_SAMPLE_SET=schedule-poc requires record mode and >=1 run'
    )
  }
  if (sampleSet === 'identity-poc' && (mode !== 'record' || runs < 1)) {
    throw new Error(
      'PERF_SAMPLE_SET=identity-poc requires record mode and >=1 run'
    )
  }
  if (sampleSet === 'form-real' && (mode !== 'record' || runs < 1)) {
    throw new Error(
      'PERF_SAMPLE_SET=form-real requires record mode and >=1 run'
    )
  }
  if (sampleSet === 'poc' && (mode !== 'record' || runs !== 5)) {
    throw new Error('PERF_SAMPLE_SET=poc requires record mode and PERF_RUNS=5')
  }
  if (sampleSet === 'scroll-baseline' && (mode !== 'record' || runs !== 5)) {
    throw new Error(
      'PERF_SAMPLE_SET=scroll-baseline requires record mode and PERF_RUNS=5'
    )
  }
  if (sampleSet === 'gate' && (mode !== 'gate' || runs !== 5)) {
    throw new Error('PERF_SAMPLE_SET=gate requires PERF_MODE=gate and PERF_RUNS=5')
  }
  if (sampleSet === 'raw-check' && (mode !== 'record' || runs < 1)) {
    throw new Error('PERF_SAMPLE_SET=raw-check requires record mode and >=1 run')
  }

  return {
    mode,
    sampleSet,
    runs,
  }
}

module.exports = {
  resolvePerformanceMode,
}
