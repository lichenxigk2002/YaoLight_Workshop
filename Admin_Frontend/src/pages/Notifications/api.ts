import http from '@/api/http';
import { translateCurrent } from '@/i18n/runtime';

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

function unwrap<T>(payload: ApiEnvelope<T>, fallback: string): T {
  if (payload.code !== 200 || payload.data === undefined || payload.data === null) {
    throw new Error(payload.message || fallback);
  }
  return payload.data;
}

export interface AdminNotificationSummary {
  total_notifications: number;
  read_notifications: number;
  unread_notifications: number;
  expiring_soon: number;
  distinct_users: number;
  total_jobs: number;
  failed_deliveries: number;
  active_templates: number;
  read_rate: number;
}

export interface AdminNotificationItem {
  id: number;
  user_id: number;
  user_username?: string;
  user_email?: string;
  user_no?: number;
  type: string;
  category?: string | null;
  title: string;
  content?: string | null;
  is_read: boolean;
  read_at?: string | null;
  action_url?: string | null;
  expires_at?: string | null;
  created_at: string;
}

export interface AdminNotificationListPage {
  list: AdminNotificationItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface AdminNotificationListQuery {
  page?: number;
  page_size?: number;
  keyword?: string;
  type?: string;
  category?: string;
  user_id?: number;
  is_read?: boolean;
}

export interface AdminNotificationJob {
  id: number;
  name?: string | null;
  channel: string;
  type: string;
  category?: string | null;
  status: string;
  template_id?: number | null;
  template_name?: string | null;
  requested_by: number;
  requested_by_username?: string | null;
  recipient_count: number;
  success_count: number;
  failed_count: number;
  read_count: number;
  read_rate: number;
  title: string;
  created_at: string;
  finished_at?: string | null;
}

export interface AdminNotificationJobListPage {
  list: AdminNotificationJob[];
  total: number;
  page: number;
  page_size: number;
}

export interface AdminNotificationJobListQuery {
  page?: number;
  page_size?: number;
  keyword?: string;
  status?: string;
  template_id?: number;
}

export interface AdminNotificationDelivery {
  id: number;
  send_job_id: number;
  notification_id?: number | null;
  user_id: number;
  username_snapshot?: string | null;
  email_snapshot?: string | null;
  status: string;
  failure_reason?: string | null;
  sent_at?: string | null;
  read_at?: string | null;
  created_at: string;
}

export interface AdminNotificationDeliveryListPage {
  list: AdminNotificationDelivery[];
  total: number;
  page: number;
  page_size: number;
}

export interface AdminNotificationTemplate {
  id: number;
  name: string;
  description?: string | null;
  type: string;
  category?: string | null;
  title_template: string;
  content_template?: string | null;
  action_url_template?: string | null;
  is_active: boolean;
  created_by: number;
  created_by_username?: string | null;
  updated_at: string;
}

export interface AdminNotificationTemplateListPage {
  list: AdminNotificationTemplate[];
  total: number;
  page: number;
  page_size: number;
}

export interface AdminNotificationTemplatePayload {
  name: string;
  description?: string;
  type?: string;
  category?: string;
  title_template: string;
  content_template?: string;
  action_url_template?: string;
  is_active: boolean;
}

export interface SendAdminNotificationPayload {
  name?: string;
  recipient_ids: number[];
  template_id?: number;
  template_variables?: Record<string, string>;
  title?: string;
  content?: string;
  type?: string;
  category?: string;
  action_url?: string;
  expires_at?: string;
}

export interface SendAdminNotificationResult {
  send_job_id: number;
  sent_count: number;
  failed_count: number;
  recipient_ids: number[];
  type: string;
  category?: string | null;
  action_url?: string | null;
  template_id?: number | null;
  template_name?: string | null;
  expires_at?: string | null;
  requested_at: string;
  has_failures: boolean;
  job_status: string;
}

export interface AdminNotificationStatusCount {
  status: string;
  count: number;
}

export interface AdminNotificationTemplatePerformance {
  template_id: number;
  template_name: string;
  job_count: number;
  delivery_count: number;
  failed_count: number;
  read_count: number;
  read_rate: number;
}

export interface AdminNotificationFailureReasonSummary {
  reason: string;
  count: number;
}

export interface AdminNotificationAnalytics {
  overview: AdminNotificationSummary;
  job_status_breakdown: AdminNotificationStatusCount[];
  template_performance: AdminNotificationTemplatePerformance[];
  failure_reasons: AdminNotificationFailureReasonSummary[];
}

export async function getAdminNotificationSummary(): Promise<AdminNotificationSummary> {
  const { data } = await http.get<ApiEnvelope<AdminNotificationSummary>>('/admin/notifications/summary');
  return unwrap(data, translateCurrent('notifications.errors.loadSummary'));
}

export async function getAdminNotifications(params: AdminNotificationListQuery): Promise<AdminNotificationListPage> {
  const { data } = await http.get<ApiEnvelope<AdminNotificationListPage>>('/admin/notifications', { params });
  return unwrap(data, translateCurrent('notifications.errors.loadLog'));
}

export async function getAdminNotificationJobs(params: AdminNotificationJobListQuery): Promise<AdminNotificationJobListPage> {
  const { data } = await http.get<ApiEnvelope<AdminNotificationJobListPage>>('/admin/notifications/jobs', { params });
  return unwrap(data, translateCurrent('notifications.errors.loadJobs'));
}

export async function getAdminNotificationDeliveries(
  sendJobId: number,
  params: { page?: number; page_size?: number; status?: string },
): Promise<AdminNotificationDeliveryListPage> {
  const { data } = await http.get<ApiEnvelope<AdminNotificationDeliveryListPage>>(
    `/admin/notifications/jobs/${sendJobId}/deliveries`,
    { params },
  );
  return unwrap(data, translateCurrent('notifications.errors.loadDeliveries'));
}

export async function getAdminNotificationTemplates(params: {
  page?: number;
  page_size?: number;
  keyword?: string;
  is_active?: boolean;
}): Promise<AdminNotificationTemplateListPage> {
  const { data } = await http.get<ApiEnvelope<AdminNotificationTemplateListPage>>('/admin/notifications/templates', {
    params,
  });
  return unwrap(data, translateCurrent('notifications.errors.loadTemplates'));
}

export async function createAdminNotificationTemplate(
  payload: AdminNotificationTemplatePayload,
): Promise<AdminNotificationTemplate> {
  const { data } = await http.post<ApiEnvelope<AdminNotificationTemplate>>('/admin/notifications/templates', payload);
  return unwrap(data, translateCurrent('notifications.errors.createTemplate'));
}

export async function updateAdminNotificationTemplate(
  templateId: number,
  payload: AdminNotificationTemplatePayload,
): Promise<AdminNotificationTemplate> {
  const { data } = await http.put<ApiEnvelope<AdminNotificationTemplate>>(
    `/admin/notifications/templates/${templateId}`,
    payload,
  );
  return unwrap(data, translateCurrent('notifications.errors.updateTemplate'));
}

export async function getAdminNotificationAnalytics(): Promise<AdminNotificationAnalytics> {
  const { data } = await http.get<ApiEnvelope<AdminNotificationAnalytics>>('/admin/notifications/analytics');
  return unwrap(data, translateCurrent('notifications.errors.loadAnalytics'));
}

export async function sendAdminNotification(payload: SendAdminNotificationPayload): Promise<SendAdminNotificationResult> {
  const { data } = await http.post<ApiEnvelope<SendAdminNotificationResult>>('/admin/notifications/send', payload);
  return unwrap(data, translateCurrent('notifications.errors.send'));
}
