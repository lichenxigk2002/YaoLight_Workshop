/**
 * 用户相关类型定义
 */

/**
 * 用户信息
 */
export interface User {
  id: number;
  user_no?: number; // 随机用户编号（非自增）
  username: string;
  email: string;
  phone?: string | null;
  avatar_url?: string | null;
  real_name?: string | null;
  role: string;
  status: string; // 'active' | 'inactive' | 'suspended'
  last_login_at?: string | null;
  login_count?: number;
  token_balance?: number;
  created_at: string;
  updated_at: string;
  /** 是否已设置密码（邮箱验证码注册未设置时为 false，可在此处设置密码） */
  has_password?: boolean;
}

/** 头像历史项（用于头像历史列表） */
export interface UserAvatarHistory {
  id: number;
  user_id: number;
  avatar_url: string;
  created_at: string;
}

export interface TokenTransaction {
  id: number;
  user_id: number;
  amount: number;
  type: string;
  related_id?: string | null;
  description?: string | null;
  provider?: string | null;
  model_name?: string | null;
  display_name?: string | null;
  model_mode?: string | null;
  model_id?: number | null;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  cost?: number;
  currency?: string;
  created_at: string;
}

/** 账单周期：日 / 月 / 季 / 年 */
export type BillPeriod = 'day' | 'month' | 'quarter' | 'year';

/** 账单汇总请求参数 */
export interface BillSummaryParams {
  period: BillPeriod;
  year: number;
  month?: number; // 1-12 月；quarter 时为 1-4 表示第几季
  day?: number;   // 1-31，period=day 时必填
}

/** 账单汇总响应 */
export interface BillSummary {
  period: BillPeriod;
  start_at: string;
  end_at: string;
  total_income: number;
  total_expense: number;
  transaction_count: number;
}

/** Token使用统计 */
export interface TokenUsageStats {
  cost: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

/** 模型维度统计 */
export interface ModelTokenStats {
  provider: string;
  model_name: string;
  display_name?: string | null;
  today: TokenUsageStats;
  total: TokenUsageStats;
}

/** 整体统计响应 */
export interface TokenStats {
  today: TokenUsageStats;
  total: TokenUsageStats;
  models: ModelTokenStats[];
}

/** 筛选选项响应 */
export interface TransactionOptions {
  items: {
    provider: string;
    models: string[];
  }[];
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
  inviteCode?: string; // 选填，邀请码
}

/**
 * 修改密码请求（已设置密码时必填 oldPassword；未设置密码时仅填 newPassword）
 */
export interface ChangePasswordRequest {
  oldPassword?: string;
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
