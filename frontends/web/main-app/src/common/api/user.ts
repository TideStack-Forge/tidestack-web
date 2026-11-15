import { Client } from '@/utils/http'
import type { ApiResponse } from '@/utils/http'

/** 登录入参 */
export interface LoginPayload {
  username: string
  password: string
}

/** 修改密码入参（如字段与后端定义不一致可调整） */
export interface ModifyPasswordPayload {
  oldPassword: string
  newPassword: string
  [k: string]: any
}

/** 你可根据项目实际定义更具体的类型 */
export type UserInfo = any
export type MenuTree = any
export type Authorities = any
export type LoginResult = any

const userApi = {
  /**
   * 平台用户名密码登录
   * 外部认证协议登录请使用 src/common/api/auth.ts
   * 返回标准化后的业务响应对象 { code, status, msg, data }
   */
  async login(data: LoginPayload): Promise<ApiResponse<LoginResult>> {
    const res = await Client.post('/api/auth/login', data, {
      isSilent: true,
      skipAuth: true,
    })
    return res.data
  },

  /**
   * 获取用户信息
   */
  async getUserInfo(): Promise<ApiResponse<UserInfo>> {
    const res = await Client.get('/api/sys/user/info', {}, { isSilent: true })
    return res.data
  },

  /**
   * 获取用户菜单
   */
  async getUserMenus(): Promise<ApiResponse<MenuTree>> {
    const res = await Client.get('/api/authored-menu-tree', {}, { isSilent: true })
    return res.data
  },

  /**
   * 修改密码
   */
  async modifyPassword(data: ModifyPasswordPayload): Promise<ApiResponse<any>> {
    const res = await Client.patch('/api/sys/user/modify-password', data)
    return res.data
  },

  /**
   * 删除 token（注销）
   */
  async revokeToken(): Promise<ApiResponse<any>> {
    const res = await Client.post('/api/auth/revoke-token')
    return res.data
  },

  /**
   * 获取权限点
   */
  async getAuthorities(): Promise<ApiResponse<Authorities>> {
    const res = await Client.get('/api/auth/authorities', {}, { isSilent: true })
    return res.data
  },

  async getUserSetting(): Promise<ApiResponse<any>> {
    const res = await Client.get('/api/user-setting', {}, { isSilent: true })
    return res.data
  },

  async saveUserWidth(settingName: string, width: number): Promise<ApiResponse<any>> {
    const res = await Client.patch(
      '/api/user-setting',
      {
        settingName,
        settingValue: width,
        isAutoLoad: true,
      },
      {
        isSilent: true,
      }
    )
    return res.data
  },
}

export default userApi
