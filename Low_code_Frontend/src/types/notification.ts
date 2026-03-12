/**
 * 站内通知类型
 */
export interface Notification {
  id: number;
  user_id: number;
  type: string;
  category?: string;
  title: string;
  content?: string;
  is_read: boolean;
  read_at?: string;
  action_url?: string;
  related_resource_type?: string;
  related_resource_id?: number;
  metadata?: Record<string, any> | null;
  expires_at?: string | null;
  created_at: string;
}

export interface NotificationListResponse {
  list: Notification[];
  total: number;
}

export interface NotificationUnreadCountResponse {
  count: number;
}

export interface NotificationConsentResult {
  notification: Notification;
  consent_status: string;
}
