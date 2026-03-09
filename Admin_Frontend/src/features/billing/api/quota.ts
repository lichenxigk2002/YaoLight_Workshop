import http from '@/api/http';
import type {
  GrantQuotaPayload,
  AdminOrder,
  AdminOrderQuery,
  AdminTokenTransaction,
  AdminTokenTxQuery,
  QuotaLedgerEntry,
  QuotaLedgerPage,
  QuotaLedgerParams,
  QuotaSummary,
  RecoverQuotaPayload,
} from '../types';

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

function toLedgerEntry(raw: Record<string, unknown>): QuotaLedgerEntry {
  return {
    id: String(raw.id ?? ''),
    user_id: String(raw.user_id ?? ''),
    user_display: raw.user_display as string | undefined,
    delta: Number(raw.delta ?? 0),
    balance_after: Number(raw.balance_after ?? 0),
    source_type: (raw.source_type as QuotaLedgerEntry['source_type']) ?? 'admin_gift',
    source_id: String(raw.source_id ?? ''),
    operator_id: String(raw.operator_id ?? ''),
    operator_display: raw.operator_display as string | undefined,
    remark: String(raw.remark ?? ''),
    created_at: String(raw.created_at ?? ''),
  };
}

export async function recoverQuota(payload: RecoverQuotaPayload): Promise<QuotaLedgerEntry> {
  const { data } = await http.post<ApiEnvelope<Record<string, unknown>>>(
    '/admin/billing/quotas/recover',
    {
      order_id: payload.order_id,
      user_id: payload.user_id,
      quota_delta: payload.quota_delta,
      reason: payload.reason,
    },
  );
  if (data.code !== 200 || !data.data) {
    throw new Error(data.message || '补救配额失败');
  }
  return toLedgerEntry(data.data);
}

export async function grantQuota(payload: GrantQuotaPayload): Promise<QuotaLedgerEntry> {
  const { data } = await http.post<ApiEnvelope<Record<string, unknown>>>(
    '/admin/billing/quotas/grant',
    {
      user_id: payload.user_id,
      quota_delta: payload.quota_delta,
      remark: payload.remark,
      campaign_id: payload.campaign_id ?? '',
    },
  );
  if (data.code !== 200 || !data.data) {
    throw new Error(data.message || '赠送配额失败');
  }
  return toLedgerEntry(data.data);
}

export async function getQuotaLedger(params: QuotaLedgerParams): Promise<QuotaLedgerPage> {
  const { data } = await http.get<ApiEnvelope<{ list: Record<string, unknown>[]; total: number; page: number; page_size: number }>>(
    '/admin/billing/quotas/ledger',
    { params: { page: params.page, page_size: params.page_size, user_id: params.user_id, source_type: params.source_type, start_date: params.start_date, end_date: params.end_date } },
  );
  if (data.code !== 200 || !data.data) {
    throw new Error(data.message || '获取流水失败');
  }
  const d = data.data;
  return {
    list: (d.list ?? []).map(toLedgerEntry),
    total: d.total ?? 0,
    page: d.page ?? 1,
    page_size: d.page_size ?? 10,
  };
}

export async function getQuotaSummary(): Promise<QuotaSummary> {
  const { data } = await http.get<ApiEnvelope<QuotaSummary>>('/admin/billing/quotas/summary');
  if (data.code !== 200 || !data.data) {
    throw new Error(data.message || '获取配额统计失败');
  }
  return data.data;
}

interface PagedResponse<T> {
  list: T[];
  total: number;
  page: number;
  page_size: number;
}

export async function getAdminOrders(params: AdminOrderQuery): Promise<PagedResponse<AdminOrder>> {
  const { data } = await http.get<ApiEnvelope<PagedResponse<AdminOrder>>>('/admin/billing/orders', {
    params,
  });
  if (data.code !== 200 || !data.data) {
    throw new Error(data.message || '获取订单失败');
  }
  return data.data;
}

export async function getAdminTokenTransactions(params: AdminTokenTxQuery): Promise<PagedResponse<AdminTokenTransaction>> {
  const { data } = await http.get<ApiEnvelope<PagedResponse<AdminTokenTransaction>>>('/admin/billing/token-transactions', {
    params,
  });
  if (data.code !== 200 || !data.data) {
    throw new Error(data.message || '获取 Token 流水失败');
  }
  return data.data;
}
