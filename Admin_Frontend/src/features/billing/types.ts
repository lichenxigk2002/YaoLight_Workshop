/** 配额流水来源类型：支付失败补发 / 管理员赠送 */
export type QuotaLedgerSourceType = 'payment_recovery' | 'admin_gift';

export interface QuotaLedgerEntry {
  id: string;
  user_id: string;
  user_display?: string;
  delta: number;
  balance_after: number;
  source_type: QuotaLedgerSourceType;
  source_id: string;
  operator_id: string;
  operator_display?: string;
  remark: string;
  created_at: string;
}

export interface RecoverQuotaPayload {
  order_id: string;
  user_id: string;
  quota_delta: number;
  reason: string;
}

export interface GrantQuotaPayload {
  user_id: string;
  quota_delta: number;
  remark: string;
  campaign_id?: string;
}

export interface QuotaLedgerParams {
  page?: number;
  page_size?: number;
  user_id?: string;
  source_type?: QuotaLedgerSourceType;
  start_date?: string;
  end_date?: string;
}

export interface QuotaLedgerPage {
  list: QuotaLedgerEntry[];
  total: number;
  page: number;
  page_size: number;
}

export interface QuotaSummary {
  recovery_count: number;
  gift_count: number;
  total_count: number;
  user_count: number;
}

export interface AdminOrder {
  id: number;
  order_id: string;
  user_id: number;
  user_username?: string;
  user_email?: string;
  user_no?: number;
  package_id: string;
  package_name: string;
  amount: number;
  stardust: number;
  status: string;
  payment_method: string;
  alipay_trade_no?: string;
  created_at: string;
  paid_at?: string | null;
}

export interface AdminTokenTransaction {
  id: number;
  user_id: number;
  user_username?: string;
  user_email?: string;
  user_no?: number;
  amount: number;
  type: string;
  related_id: string;
  description: string;
  provider: string;
  model_name: string;
  model_mode: string;
  model_id?: number | null;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  audio_tokens: number;
  cost: number;
  currency: string;
  created_at: string;
}

export interface AdminOrderQuery {
  page?: number;
  page_size?: number;
  order_id?: string;
  user_id?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
}

export interface AdminTokenTxQuery {
  page?: number;
  page_size?: number;
  user_id?: string;
  type?: string;
  provider?: string;
  model_name?: string;
  start_date?: string;
  end_date?: string;
  scope?: 'usage' | 'balance';
}
