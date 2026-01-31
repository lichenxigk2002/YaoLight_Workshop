import http from '@/http';
import type { PageRequest, PageResponse } from '@/types/api';
import type {
  User,
  TokenTransaction,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  ChangePasswordRequest,
  UpdateUserRequest,
} from '@/types/user';

/**
 * 用户 API
 */
export const userApi = {
  /**
   * 登录
   */
  login: (data: LoginRequest) =>
    http.post<LoginResponse>('/auth/login', data),

  /**
   * 注册
   */
  register: (data: RegisterRequest) =>
    http.post<User>('/auth/register', data),

  /**
   * 发送邮箱验证码
   */
  sendVerificationCode: (email: string) =>
    http.post('/auth/send-code', { email }),

  /**
   * 邮箱验证码登录
   */
  emailLogin: (email: string, code: string) =>
    http.post<LoginResponse>('/auth/email-login', { email, code }),

  /**
   * 发送注册验证码
   */
  sendRegisterCode: (email: string) =>
    http.post('/auth/send-register-code', { email }),

  /**
   * 邮箱验证码注册
   */
  emailRegister: (email: string, code: string) =>
    http.post<LoginResponse>('/auth/email-register', { email, code }),

  /**
   * 修改用户名
   */
  updateUsername: (username: string) =>
    http.put('/users/username', { username }),

  /**
   * 登出
   */
  logout: () =>
    http.post('/auth/logout'),

  /**
   * 获取当前用户信息
   */
  getCurrentUser: () =>
    http.get<User>('/users/current'),

  /**
   * 获取 GitHub/Google 绑定状态
   */
  getOAuthBindings: () =>
    http.get<{ github: boolean; google: boolean }>('/users/oauth-bindings'),

  /**
   * 发起绑定第三方，返回跳转 URL
   */
  requestOAuthBind: (provider: 'github' | 'google') =>
    http.post<{ redirectUrl: string }>('/users/oauth-bindings/request', { provider }),

  /**
   * 解绑指定第三方
   */
  unbindOAuth: (provider: 'github' | 'google') =>
    http.delete(`/users/oauth-bindings/${provider}`),

  /** 发送账号注销验证码（发到当前邮箱） */
  sendDeactivateCode: () => http.post<{ code: number; message: string }>('/auth/send-deactivate-code'),
  /** 确认注销：验证码 + 输入用户名确认 */
  confirmDeactivate: (data: { code: string; confirmText: string }) =>
    http.post<{ code: number; message: string }>('/auth/confirm-deactivate', data),

  /** 发送绑定邮箱验证码（发到新邮箱，当前未绑定时用） */
  sendEmailBindCode: (newEmail: string) =>
    http.post<{ code: number; message: string }>('/auth/send-email-bind-code', { newEmail }),
  /** 发送换绑邮箱验证码（发到当前邮箱） */
  sendEmailChangeCode: () => http.post<{ code: number; message: string }>('/auth/send-email-change-code'),
  /** 确认换绑/绑定：验证码 + 新邮箱 */
  confirmEmailChange: (data: { code: string; newEmail: string }) =>
    http.post<{ code: number; message: string }>('/auth/confirm-email-change', data),

  /** 发送解绑邮箱验证码（发到当前邮箱） */
  sendEmailUnbindCode: () => http.post<{ code: number; message: string }>('/auth/send-email-unbind-code'),
  /** 确认解绑邮箱：验证码 */
  confirmEmailUnbind: (data: { code: string }) =>
    http.post<{ code: number; message: string }>('/auth/confirm-email-unbind', data),

  /**
   * 获取通知偏好（各类型开关）
   */
  getNotificationPreferences: () =>
    http.get<Record<string, boolean>>('/users/notification-preferences'),

  /**
   * 更新通知偏好
   */
  updateNotificationPreferences: (prefs: Record<string, boolean>) =>
    http.put('/users/notification-preferences', prefs),

  getTokenTransactions: (params?: { page?: number; pageSize?: number }) =>
    http.get<{ list: TokenTransaction[]; total: number; page: number; pageSize: number }>('/users/token-transactions', params),

  /**
   * 获取用户列表（分页）
   */
  getUserList: (params: PageRequest) =>
    http.get<PageResponse<User>>('/users', params),

  /**
   * 获取用户详情
   */
  getUserById: (id: number) =>
    http.get<User>(`/users/${id}`),

  /**
   * 创建用户
   */
  createUser: (data: Omit<User, 'id' | 'createdAt' | 'updatedAt'>) =>
    http.post<User>('/users', data),

  /**
   * 更新用户信息
   */
  updateUser: (id: number, data: UpdateUserRequest) =>
    http.put<User>(`/users/${id}`, data),

  /**
   * 删除用户
   */
  deleteUser: (id: number) =>
    http.delete(`/users/${id}`),

  /**
   * 批量删除用户
   */
  deleteUsers: (ids: number[]) =>
    http.post('/users/batch-delete', { ids }),

  /**
   * 修改密码
   */
  changePassword: (data: ChangePasswordRequest) =>
    http.post('/users/change-password', data),

  /**
   * 上传头像
   */
  uploadAvatar: (file: File) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return http.upload<{ url: string }>('/users/avatar', formData);
  },
};
