import { beforeEach, describe, expect, test, vi } from 'vitest'

const registerAction = vi.fn()
const openOrSwitchTab = vi.fn()
const openTab = vi.fn()

vi.mock('amis-core', () => ({
  registerAction,
}))

vi.mock('#ouroboros-host/common/tabs', () => ({
  default: {
    openOrSwitchTab,
    openTab,
  },
}))

const { OpenOrSwitchTab } = await import('../../../../../../../ouroboros-amis-runtime/src/actions/OpenOrSwitchTab.js')
const { OpenTab } = await import('../../../../../../../ouroboros-amis-runtime/src/actions/OpenTab.js')

describe('tab open actions', () => {
  beforeEach(() => {
    registerAction.mockClear()
    openOrSwitchTab.mockReset()
    openTab.mockReset()
  })

  test('openOrSwitchTab translates receiveActions into a callback bridge', async () => {
    const actionRunner = new OpenOrSwitchTab()
    const onAction = vi.fn()
    let receiveCallback: ((payload: unknown) => void) | undefined

    openOrSwitchTab.mockImplementation(async (_url, options) => {
      receiveCallback = options.callback
      return 'tab-1'
    })

    await actionRunner.run(
      {
        args: {
          url: '/dev/demo/approval-workflow-definition/add',
          receiveActions: [
            {
              actionType: 'setValue',
              componentName: 'edit-business-model-form',
              args: {
                value: {
                  workflow: {
                    processId: '${definitionId}',
                  },
                },
              },
            },
          ],
        },
      },
      {
        props: {
          onAction,
        },
      }
    )

    expect(typeof receiveCallback).toBe('function')
    receiveCallback?.({ definitionId: 'purchase-approval' })
    expect(onAction).toHaveBeenCalledWith(
      '',
      expect.objectContaining({
        actionType: 'setValue',
        componentName: 'edit-business-model-form',
      }),
      { definitionId: 'purchase-approval' }
    )
  })

  test('openOrSwitchTab preserves params used by outer definitionId bootstrap', async () => {
    const actionRunner = new OpenOrSwitchTab()

    openOrSwitchTab.mockResolvedValue('tab-3')

    await actionRunner.run(
      {
        args: {
          url: '/dev/demo/approval-workflow-definition/add',
          params: {
            definitionId: 'purchase-approval',
            formType: 'business-model',
            formKey: 'demo.purchase',
          },
        },
      },
      {
        props: {
          onAction: vi.fn(),
        },
      }
    )

    expect(openOrSwitchTab).toHaveBeenCalledWith(
      '/dev/demo/approval-workflow-definition/add?definitionId=purchase-approval&formType=business-model&formKey=demo.purchase',
      expect.any(Object)
    )
  })

  test('openTab still falls back to reloadOnReceive when receiveActions are absent', async () => {
    const actionRunner = new OpenTab()
    const onAction = vi.fn()
    let receiveCallback: ((payload: unknown) => void) | undefined

    openTab.mockImplementation(async (_url, options) => {
      receiveCallback = options.callback
      return 'tab-2'
    })

    await actionRunner.run(
      {
        args: {
          url: '/dev/demo/approval-workflow-definition/demo-flow',
          reloadOnReceive: true,
        },
      },
      {
        props: {
          onAction,
        },
      }
    )

    receiveCallback?.({ saved: true })
    expect(onAction).toHaveBeenCalledWith('', { actionType: 'reload' })
  })
})
