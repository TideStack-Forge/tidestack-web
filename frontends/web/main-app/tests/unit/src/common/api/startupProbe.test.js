import { describe, expect, test } from 'vitest'
import {
  classifyStartupProbe,
  STARTUP_STAGE_KEYS,
} from '../../../../../src/common/api/startupProbe'

function response(status, data) {
  return { status, data }
}

describe('startup probe classification', () => {
  test('classifies missing http responses as network connected retry state', () => {
    const result = classifyStartupProbe(false)

    expect(result).toMatchObject({
      kind: 'network-link-unreachable',
      stage: STARTUP_STAGE_KEYS.NETWORK_LINK,
      available: false,
      retrying: true,
    })
  })

  test('classifies proxy and gateway failures as service started', () => {
    expect(
      classifyStartupProbe(
        response(502, { code: 502, status: 502, msg: 'Bad Gateway', data: null })
      )
    ).toMatchObject({
      kind: 'backend-link-unavailable',
      stage: STARTUP_STAGE_KEYS.BACKEND_LINK,
    })
    expect(
      classifyStartupProbe(
        response(504, { code: 504, status: 504, msg: 'Gateway Timeout', data: null })
      )
    ).toMatchObject({
      kind: 'backend-link-unavailable',
      stage: STARTUP_STAGE_KEYS.BACKEND_LINK,
    })
  })

  test('classifies an unspecified 503 as a runtime failure', () => {
    const result = classifyStartupProbe(
      response(503, { code: 503, status: 503, msg: '', data: null })
    )

    expect(result).toMatchObject({
      kind: 'service-runtime-error',
      stage: STARTUP_STAGE_KEYS.SERVICE_AVAILABLE,
      available: false,
      retrying: true,
      failed: true,
    })
  })

  test('classifies detailed bootstrapping body as service bootstrap progress', () => {
    const result = classifyStartupProbe(
      response(503, {
        code: 503,
        status: 503,
        msg: '服务正在启动，请稍候',
        data: null,
        startupState: 'BOOTSTRAPPING',
        startupPhase: 'metadata-refreshing',
        module: 'metadata',
        progressMessage: '正在刷新元数据模型',
      })
    )

    expect(result).toMatchObject({
      kind: 'service-bootstrap',
      stage: STARTUP_STAGE_KEYS.SERVICE_BOOTSTRAP,
      serverErrorMessage: '正在刷新元数据模型',
      startupState: 'BOOTSTRAPPING',
      startupPhase: 'metadata-refreshing',
      module: 'metadata',
      progressMessage: '正在刷新元数据模型',
      failed: false,
    })
  })

  test('classifies explicit lifecycle startup failure as final stage error', () => {
    const result = classifyStartupProbe(
      response(500, {
        code: 500,
        status: 500,
        msg: '服务启动失败',
        data: null,
        startupState: 'FAILED',
        startupPhase: 'model-refreshing',
        failureSource: 'ouroboros-lifecycle',
        failureType: 'IllegalStateException',
        failureMessage: '模型刷新失败，请查看服务端日志',
      })
    )

    expect(result).toMatchObject({
      kind: 'service-bootstrap-failed',
      stage: STARTUP_STAGE_KEYS.SERVICE_AVAILABLE,
      available: false,
      retrying: true,
      failed: true,
      serverErrorMessage: '模型刷新失败，请查看服务端日志',
      startupState: 'FAILED',
      failureSource: 'ouroboros-lifecycle',
      failureType: 'IllegalStateException',
      failureMessage: '模型刷新失败，请查看服务端日志',
    })
  })

  test('honors explicit failed lifecycle state even on HTTP 503', () => {
    const result = classifyStartupProbe(
      response(503, {
        code: 503,
        status: 503,
        msg: '服务正在启动，请稍候',
        data: null,
        startupState: 'FAILED',
        failureMessage: '旧后端错误字段不再驱动阶段跳转',
      })
    )

    expect(result).toMatchObject({
      kind: 'service-bootstrap-failed',
      stage: STARTUP_STAGE_KEYS.SERVICE_AVAILABLE,
      available: false,
      retrying: true,
      failed: true,
    })
  })

  test('classifies ready startup state as service available even on coarse code', () => {
    const result = classifyStartupProbe(
      response(200, {
        code: 200,
        status: 200,
        msg: '',
        data: null,
        startupState: 'READY',
      })
    )

    expect(result).toMatchObject({
      kind: 'service-available',
      stage: STARTUP_STAGE_KEYS.SERVICE_AVAILABLE,
      available: true,
      retrying: false,
      failed: false,
      startupState: 'READY',
    })
  })

  test('classifies code zero web app info responses as service available', () => {
    const result = classifyStartupProbe(
      response(200, { code: 0, status: 0, msg: '', data: { appName: 'Ouroboros' } })
    )

    expect(result).toMatchObject({
      kind: 'service-available',
      stage: STARTUP_STAGE_KEYS.SERVICE_AVAILABLE,
      available: true,
      retrying: false,
      failed: false,
    })
  })

  test('classifies spring boot response errors as final stage service runtime errors', () => {
    const result = classifyStartupProbe(
      response(200, { code: 50001, status: 50001, msg: '配置加载失败', data: null })
    )

    expect(result).toMatchObject({
      kind: 'service-runtime-error',
      stage: STARTUP_STAGE_KEYS.SERVICE_AVAILABLE,
      available: false,
      retrying: true,
      message: '配置加载失败',
      serverErrorMessage: '配置加载失败',
    })
  })

  test('classifies detailed spring boot error bodies as final stage runtime errors', () => {
    const result = classifyStartupProbe(
      response(500, {
        code: 500,
        status: 500,
        msg: '服务启动失败',
        data: null,
        startupState: 'FAILED',
        failureSource: 'spring-error-dispatch',
        failureType: 'NullPointerException',
        failureMessage: '配置对象为空',
      })
    )

    expect(result).toMatchObject({
      kind: 'service-bootstrap-failed',
      stage: STARTUP_STAGE_KEYS.SERVICE_AVAILABLE,
      failed: true,
      serverErrorMessage: '配置对象为空',
      failureSource: 'spring-error-dispatch',
      failureType: 'NullPointerException',
      failureMessage: '配置对象为空',
    })
  })
})
