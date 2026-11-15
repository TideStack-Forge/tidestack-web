import { beforeEach, expect, test, vi } from 'vitest'

const i18nMocks = vi.hoisted(() => {
  const state = {
    messages: {},
  }
  const manager = {
    getLocaleData: vi.fn(() => ({ messages: state.messages })),
    tn: vi.fn((namespace, key, fallback) => {
      return state.messages[namespace]?.[key] ?? state.messages.common?.[key] ?? fallback
    }),
  }

  return { manager, state }
})

vi.mock('../../../../../src/common/i18n/index.ts', () => ({
  i18nService: {
    getManager: () => i18nMocks.manager,
  },
}))

const { processAmisSchema } = await import('../../../../../src/common/i18n/amis.ts')

beforeEach(() => {
  i18nMocks.manager.getLocaleData.mockClear()
  i18nMocks.manager.tn.mockClear()
  i18nMocks.state.messages = {}
})

test('processAmisSchema uses localeKeys for property-specific keys', () => {
  const schemaId = '/system-setting/user-management/change-password'
  i18nMocks.state.messages = {
    common: {
      'changePassword.oldPassword': 'Old password',
      'changePassword.validation.oldPasswordRequired': 'Enter old password',
      'changePassword.newPassword': 'New password',
      'changePassword.validation.newPasswordMinLength':
        'Password must be longer than six characters',
      'userMenu.changePassword': 'Change password',
      cancel: 'Cancel',
    },
    [schemaId]: {
      'changePassword.notice.passwordUpdated': 'Use the new password next time.',
    },
  }
  const schema = {
    type: 'form',
    body: [
      {
        type: 'input-password',
        localeKeys: {
          label: 'changePassword.oldPassword',
          'validationErrors.minLength':
            'changePassword.validation.oldPasswordRequired',
        },
        name: 'credentials',
        label: '旧密码',
        validationErrors: {
          minLength: '请输入旧密码',
        },
      },
      {
        type: 'input-password',
        localeKeys: {
          label: 'changePassword.newPassword',
          'validationErrors.minLength':
            'changePassword.validation.newPasswordMinLength',
        },
        name: 'newPassword',
        label: '新密码',
        validationErrors: {
          minLength: '密码必须大于六位',
        },
      },
      {
        type: 'alert',
        localeKeys: {
          body: 'changePassword.notice.passwordUpdated',
        },
        body: '密码更新后，请使用新密码重新登录。',
      },
    ],
    actions: [
      {
        type: 'button',
        localeKeys: {
          label: 'cancel',
        },
        label: '取消',
      },
      {
        type: 'submit',
        localeKeys: {
          label: 'userMenu.changePassword',
        },
        label: '修改密码',
      },
    ],
  }

  const translated = processAmisSchema(schemaId, schema)

  expect(translated.body[0].label).toBe('Old password')
  expect(translated.body[0].validationErrors.minLength).toBe('Enter old password')
  expect(translated.body[1].label).toBe('New password')
  expect(translated.body[1].validationErrors.minLength).toBe(
    'Password must be longer than six characters'
  )
  expect(translated.body[2].body).toBe('Use the new password next time.')
  expect(translated.actions[0].label).toBe('Cancel')
  expect(translated.actions[1].label).toBe('Change password')
  expect(i18nMocks.manager.tn).toHaveBeenCalledWith(
    schemaId,
    'changePassword.oldPassword',
    '旧密码'
  )
})

test('processAmisSchema keeps legacy localeKey direct lookup semantics', () => {
  const schemaId = '/legacy-schema'
  i18nMocks.state.messages = {
    [schemaId]: {
      'legacy.directLabel': 'Legacy direct label',
    },
  }
  const schema = {
    type: 'form',
    body: [
      {
        type: 'input-text',
        localeKey: 'legacy.directLabel',
        name: 'legacyLabel',
        label: '旧逻辑标签',
      },
    ],
  }

  const translated = processAmisSchema(schemaId, schema)

  expect(translated.body[0].label).toBe('Legacy direct label')
  expect(i18nMocks.manager.tn).toHaveBeenCalledWith(
    schemaId,
    'legacy.directLabel',
    '旧逻辑标签'
  )
})
