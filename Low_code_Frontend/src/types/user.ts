/**
 * 用户相关类型定义
 */

/**
 * 用户信息
 */
export interface User {
  id: number;
  username: string;
  email: string;
  phone?: string | null;
  avatar_url?: string | null;
  real_name?: string | null;
  role: string;
  status: string; // 'active' | 'inactive' | 'suspended'
  last_login_at?: string | null;
  login_count?: number;
  created_at: string;
  updated_at: string;
}

/**
 * 登录请求
 */
export interface LoginRequest {
  username: string;
  password: string;
}

/**
 * 登录响应
 */
export interface LoginResponse {
  token: string;
  user: User;
}

/**
 * 注册请求
 */
export interface RegisterRequest {
  username: string;
  password: string;
  email: string;
  phone?: string;
}

/**
 * 修改密码请求
 */
export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}

/**
 * 更新用户信息请求
 */
export interface UpdateUserRequest {
  username?: string;
  email?: string;
  phone?: string;
  avatar?: string;
}

