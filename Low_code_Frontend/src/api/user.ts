import http from '@/http';
import type { PageRequest, PageResponse } from '@/types/api';
import type {
  User,
  UserAvatarHistory,
  TokenTransaction,
  BillSummary,
  BillSummaryParams,
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
   * 邮箱验证码登录（新用户自动注册时可传 inviteCode）
   */
  emailLogin: (email: string, code: string, inviteCode?: string) =>
    http.post<LoginResponse>('/auth/email-login', { email, code, inviteCode }),

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
  /** 发送换绑验证码到新邮箱（换绑时向新邮箱发验证码） */
  sendEmailChangeCodeToNew: (newEmail: string) =>
    http.post<{ code: number; message: string }>('/auth/send-email-change-code', { newEmail }),
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

  /** 流水：分页，可选时间范围 */
  getTokenTransactions: (params?: {
    page?: number;
    pageSize?: number;
    start_date?: string; // YYYY-MM-DD
    end_date?: string;   // YYYY-MM-DD
    provider?: string;
    model?: string;
  }) =>
    http.get<{ list: TokenTransaction[]; total: number; page: number; pageSize: number }>('/users/token-transactions', params),

  /** 获取Token统计数据 */
  getTokenStats: () =>
    http.get<import('@/types/user').TokenStats>('/users/token-transactions/stats'),

  /** 获取筛选选项（Provider/Model） */
  getTransactionOptions: () =>
    http.get<import('@/types/user').TransactionOptions>('/users/token-transactions/options'),

  /** 账单汇总：按日/月/季/年 */
  getBillSummary: (params: BillSummaryParams) => {
    const query: Record<string, string | number> = {
      period: params.period,
      year: params.year,
    };
    if (params.month != null) query.month = params.month;
    if (params.day != null) query.day = params.day;
    return http.get<BillSummary>('/users/bills/summary', query);
  },

  /** 导出账单 PDF：按当前周期，触发浏览器下载 */
  exportBillPDF: (params: BillSummaryParams) => {
    const query: Record<string, string | number> = {
      period: params.period,
      year: params.year,
    };
    if (params.month != null) query.month = params.month;
    if (params.day != null) query.day = params.day;
    return http.download('/users/bills/export', query);
  },

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

  /**
   * 获取头像历史列表
   */
  getAvatarHistory: () =>
    http.get<UserAvatarHistory[]>('/users/avatar/history'),

  /**
   * 将历史中的某张设为当前头像
   */
  useAvatar: (historyId: number) =>
    http.post('/users/avatar/use', { history_id: historyId }),

  /**
   * 删除一条头像历史
   */
  deleteAvatarHistory: (id: number) =>
    http.delete(`/users/avatar/history/${id}`),

  /** 获取邀请链接 */
  getInviteLink: () =>
    http.get<{ inviteCode: string; inviteUrl: string }>('/users/invite/link'),

  /** 获取邀请统计 */
  getInviteStats: () =>
    http.get<{ inviteCount: number }>('/users/invite/stats'),

  /** 获取邀请记录列表 */
  getInviteList: (params?: { page?: number; pageSize?: number }) =>
    http.get<{ list: InviteRecord[]; total: number; page: number; pageSize: number }>('/users/invite/list', params),
};

export interface InviteRecord {
  id: number;
  invitee_id: number;
  username: string;
  email: string;
  invite_code: string;
  created_at: string;
}

