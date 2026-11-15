import { afterEach, expect, test, vi } from 'vitest'

const { mockClientGet, mockDispatch, mockRemoveReplayEvent } = vi.hoisted(() => ({
  mockClientGet: vi.fn(),
  mockDispatch: vi.fn(),
  mockRemoveReplayEvent: vi.fn(),
}))

const mockReadGetters = vi.fn(() => ({
  tabsList: [],
}))

vi.mock('@/utils/http', () => ({
  Client: {
    get: mockClientGet,
  },
}))

vi.mock('@/store/storeFacade', () => ({
  dispatch: mockDispatch,
  readGetters: mockReadGetters,
}))

vi.mock('@/common/eventBus', () => ({
  EventBus: {
    removeReplayEvent: mockRemoveReplayEvent,
  },
  ReplayScope: {
    SESSION: 'SESSION',
  },
}))

const {
  resolveDevWorkspaceAppName,
  syncDevWorkspaceMenuForRoute,
} = await import('../../../../src/layouts/devWorkspaceMenuSync.ts')

afterEach(() => {
  mockClientGet.mockReset()
  mockDispatch.mockReset()
  mockRemoveReplayEvent.mockReset()
  mockReadGetters.mockReset()
  mockReadGetters.mockReturnValue({
    tabsList: [],
  })
})

test('resolveDevWorkspaceAppName extracts the current dev app and skips non-workspace routes', () => {
  expect(resolveDevWorkspaceAppName('/dev/logicflowsmoke/approval-workflow-definition')).toBe('logicflowsmoke')
  expect(resolveDevWorkspaceAppName('/dev/logicflowsmoke/approval-workflow-definition?id=1')).toBe('logicflowsmoke')
  expect(resolveDevWorkspaceAppName('/dev/apps')).toBeNull()
  expect(resolveDevWorkspaceAppName('/system-setting/approval-workflow-definition')).toBeNull()
})

test('syncDevWorkspaceMenuForRoute fetches the latest workspace menu and clears stale replay cache', async () => {
  const menuData = {
    main: [{ fullName: 'BusinessLogic.ApprovalWorkflowDefinition', icon: 'icon-approval-workflow' }],
    secondary: [],
  }
  mockClientGet.mockResolvedValue({
    data: {
      code: 0,
      data: menuData,
    },
  })

  await expect(syncDevWorkspaceMenuForRoute('/dev/logicflowsmoke/approval-workflow-definition')).resolves.toBe(true)

  expect(mockClientGet).toHaveBeenCalledWith(
    '/api/dev/logicflowsmoke/dev-workspace-menu',
    {},
    { isSilent: true }
  )
  expect(mockDispatch).toHaveBeenCalledWith('user/updateMenu', menuData)
  expect(mockRemoveReplayEvent).toHaveBeenCalledWith('updateMenu', 'SESSION')
})

test('syncDevWorkspaceMenuForRoute refreshes the current tab icon when the cached tab still uses the stale icon', async () => {
  const menuData = {
    main: [{
      fullName: 'BusinessLogic',
      children: [{
        fullName: 'BusinessLogic.ApprovalWorkflowDefinition',
        url: '/dev/logicflowsmoke/approval-workflow-definition',
        icon: 'icon-approval-workflow',
      }],
    }],
    secondary: [],
  }
  mockClientGet.mockResolvedValue({
    data: {
      code: 0,
      data: menuData,
    },
  })
  mockReadGetters.mockReturnValue({
    tabsList: [{
      id: 'tab-1',
      path: '/dev/logicflowsmoke/approval-workflow-definition',
      fullPath: '/dev/logicflowsmoke/approval-workflow-definition',
      title: '审批流',
      icon: 'icon-switch',
    }],
  })

  await expect(syncDevWorkspaceMenuForRoute('/dev/logicflowsmoke/approval-workflow-definition')).resolves.toBe(true)

  expect(mockDispatch).toHaveBeenNthCalledWith(1, 'user/updateMenu', menuData)
  expect(mockDispatch).toHaveBeenNthCalledWith(2, 'tabs/changeTab', {
    id: 'tab-1',
    path: '/dev/logicflowsmoke/approval-workflow-definition',
    fullPath: '/dev/logicflowsmoke/approval-workflow-definition',
    title: '审批流',
    icon: 'icon-approval-workflow',
  })
})

test('syncDevWorkspaceMenuForRoute skips routes outside the dev workspace', async () => {
  await expect(syncDevWorkspaceMenuForRoute('/system-setting/approval-workflow-definition')).resolves.toBe(false)

  expect(mockClientGet).not.toHaveBeenCalled()
  expect(mockDispatch).not.toHaveBeenCalled()
  expect(mockRemoveReplayEvent).not.toHaveBeenCalled()
})

test('syncDevWorkspaceMenuForRoute leaves the current menu untouched when the request fails', async () => {
  mockClientGet.mockResolvedValue({
    data: {
      code: -1,
      data: null,
    },
  })

  await expect(syncDevWorkspaceMenuForRoute('/dev/logicflowsmoke/approval-workflow-definition')).resolves.toBe(false)

  expect(mockDispatch).not.toHaveBeenCalled()
  expect(mockRemoveReplayEvent).not.toHaveBeenCalled()
})
