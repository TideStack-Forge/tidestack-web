import {
  modelHash,
  persistableModel,
} from 'ouroboros-amis-runtime/renderers/rpc-model-editor/rpcModelEditorState'
let saved = persistableModel({
  name: 'example',
  title: '示例接口',
  type: 'OpenApi',
  isEnabled: true,
  request: { method: 'GET', url: 'http://localhost/echo', parameters: [] },
})
let modified = false
let lockState = 'UNLOCKED'
let history = []
window.__rpcHarness = { calls: [], commitFailure: false }
export const Client = {
  request: async (method, url, data, config) => {
    window.__rpcHarness.calls.push({ method, url, data, config })
    let value
    if (url.endsWith('/status'))
      value = { lockState, versionState: modified ? 'CHANGED' : 'NOTCHANGED' }
    else if (url.endsWith('/release-lock')) lockState = 'UNLOCKED'
    else if (url.endsWith('/lock')) lockState = 'OWNED'
    else if (url.endsWith('/commit')) {
      if (window.__rpcHarness.commitFailure) {
        window.__rpcHarness.commitFailure = false
        return { data: { code: -1, msg: '模拟提交失败' } }
      }
      modified = false
      lockState = 'UNLOCKED'
      history = [{ id: 'commit-1', message: data.commitMsg }]
      value = true
    } else if (url.endsWith('/change-log')) {
      value = history
    } else if (url.endsWith('/test/init-form'))
      value = {
        revision: 'r1',
        modelHash: await modelHash(saved),
        testable: true,
        ready: true,
        maxDurationMs: 100,
        variables: [
          {
            name: 'input',
            suggestedType: 'string',
            required: true,
            sensitive: false,
            references: ['request.body'],
          },
          {
            name: 'password',
            suggestedType: 'string',
            required: false,
            sensitive: true,
            references: ['request.header'],
          },
        ],
        configItems: [{ name: 'host', hasDefault: true }],
      }
    else if (url.endsWith('/test')) {
      if (window.__rpcHarness.holdTest) {
        await new Promise((resolve) => {
          window.__rpcHarness.finishTest = resolve
        })
      }
      value = {
        testId: 't1',
        success: true,
        durationMs: 15,
        attemptCount: 1,
        request: { method: 'GET', url: saved.request.url },
        response: { status: 200, body: { text: '{"ok":true}' } },
        attempts: [],
        authenticationCalls: [],
      }
    } else if (method === 'get') value = structuredClone(saved)
    else {
      saved = structuredClone(data)
      modified = true
      lockState = 'OWNED'
      value = structuredClone(saved)
    }
    return { data: { code: 0, data: value } }
  },
}
