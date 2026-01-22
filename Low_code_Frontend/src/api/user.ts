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
