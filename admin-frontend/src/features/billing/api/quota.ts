import http from '@/api/http';
import { translateCurrent } from '@/i18n/runtime';
import type {
  GrantQuotaPayload,
  AdminOrder,
  AdminOrderQuery,
  BillingPackage,
  BillingPackagePayload,
  AdminTokenTransaction,
  AdminTokenTxQuery,
  BillingUserOption,
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
  const { data } = await http.post<ApiEnvelope<Record<string, unknown>>>('/admin/billing/quotas/recover', {
    order_id: payload.order_id,
    user_id: payload.user_id,
    quota_delta: payload.quota_delta,
    reason: payload.reason,
  });

  if (data.code !== 200 || !data.data) {
    throw new Error(data.message || translateCurrent('billing.errorRecoverFailed'));
  }

  return toLedgerEntry(data.data);
}

export async function grantQuota(payload: GrantQuotaPayload): Promise<QuotaLedgerEntry> {
  const { data } = await http.post<ApiEnvelope<Record<string, unknown>>>('/admin/billing/quotas/grant', {
    user_id: payload.user_id,
    quota_delta: payload.quota_delta,
    remark: payload.remark,
    campaign_id: payload.campaign_id ?? '',
  });

  if (data.code !== 200 || !data.data) {
    throw new Error(data.message || translateCurrent('billing.errorGrantFailed'));
  }

  return toLedgerEntry(data.data);
}

export async function getQuotaLedger(params: QuotaLedgerParams): Promise<QuotaLedgerPage> {
  const { data } = await http.get<
    ApiEnvelope<{ list: Record<string, unknown>[]; total: number; page: number; page_size: number }>
  >('/admin/billing/quotas/ledger', {
    params: {
      page: params.page,
      page_size: params.page_size,
      user_id: params.user_id,
      source_type: params.source_type,
      start_date: params.start_date,
      end_date: params.end_date,
    },
  });

  if (data.code !== 200 || !data.data) {
    throw new Error(data.message || translateCurrent('billing.errorLedgerFailed'));
  }

  const payload = data.data;
  return {
    list: (payload.list ?? []).map(toLedgerEntry),
    total: payload.total ?? 0,
    page: payload.page ?? 1,
    page_size: payload.page_size ?? 10,
  };
}

export async function getQuotaSummary(): Promise<QuotaSummary> {
  const { data } = await http.get<ApiEnvelope<QuotaSummary>>('/admin/billing/quotas/summary');

  if (data.code !== 200 || !data.data) {
    throw new Error(data.message || translateCurrent('billing.errorSummaryFailed'));
  }

  return data.data;
}

export async function getBillingPackages(): Promise<BillingPackage[]> {
  const { data } = await http.get<ApiEnvelope<{ list: BillingPackage[] }>>('/admin/billing/packages');

  if (data.code !== 200 || !data.data) {
    throw new Error(data.message || translateCurrent('billing.errorPackagesFailed'));
  }

  return data.data.list ?? [];
}

export async function createBillingPackage(payload: BillingPackagePayload): Promise<BillingPackage> {
  const { data } = await http.post<ApiEnvelope<BillingPackage>>('/admin/billing/packages', payload);

  if (data.code !== 200 || !data.data) {
    throw new Error(data.message || translateCurrent('billing.errorPackageSaveFailed'));
  }

  return data.data;
}

export async function updateBillingPackage(id: string, payload: BillingPackagePayload): Promise<BillingPackage> {
  const { data } = await http.put<ApiEnvelope<BillingPackage>>(`/admin/billing/packages/${id}`, payload);

  if (data.code !== 200 || !data.data) {
    throw new Error(data.message || translateCurrent('billing.errorPackageSaveFailed'));
  }

  return data.data;
}

export async function updateBillingPackageStatus(id: string, status: BillingPackage['status']): Promise<BillingPackage> {
  const { data } = await http.patch<ApiEnvelope<BillingPackage>>(`/admin/billing/packages/${id}/status`, { status });

  if (data.code !== 200 || !data.data) {
    throw new Error(data.message || translateCurrent('billing.errorPackageStatusFailed'));
  }

  return data.data;
}

export async function deleteBillingPackage(id: string): Promise<void> {
  const { data } = await http.delete<ApiEnvelope<{ id: string }>>(`/admin/billing/packages/${id}`);

  if (data.code !== 200) {
    throw new Error(data.message || translateCurrent('billing.errorPackageDeleteFailed'));
  }
}

export async function searchBillingUsers(keyword?: string, limit = 20): Promise<BillingUserOption[]> {
  const { data } = await http.get<ApiEnvelope<BillingUserOption[]>>('/admin/billing/users/options', {
    params: {
      keyword: keyword?.trim() || undefined,
      limit,
    },
  });

  if (data.code !== 200 || !Array.isArray(data.data)) {
    throw new Error(data.message || translateCurrent('billing.formUserSearchFailed'));
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
    throw new Error(data.message || translateCurrent('billing.errorOrdersFailed'));
  }

  return data.data;
}

export async function getAdminTokenTransactions(
  params: AdminTokenTxQuery,
): Promise<PagedResponse<AdminTokenTransaction>> {
  const { data } = await http.get<ApiEnvelope<PagedResponse<AdminTokenTransaction>>>(
    '/admin/billing/token-transactions',
    {
      params,
    },
  );

  if (data.code !== 200 || !data.data) {
    throw new Error(data.message || translateCurrent('billing.errorTokenFailed'));
  }

  return data.data;
}
