import http from '@/api/http';
import type { AdminContentComment, AdminContentCommentListResponse } from '@/types/contentComments';

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

async function unwrap<T>(promise: Promise<{ data: ApiEnvelope<T> }>): Promise<T> {
  const response = await promise;
  if (response.data.code !== 200) {
    throw new Error(response.data.message || '请求失败');
  }
  return response.data.data;
}

export interface ListAdminContentCommentsParams {
  keyword?: string;
  status?: string;
  resource_type?: string;
  resource_id?: number;
  user_id?: number;
  page?: number;
  page_size?: number;
}

export function listAdminContentComments(params: ListAdminContentCommentsParams) {
  return unwrap<AdminContentCommentListResponse>(http.get('/admin/content-comments', { params }));
}

export function moderateAdminContentComment(id: number, data: { action: 'hide' | 'restore' | 'delete'; reason?: string }) {
  return unwrap<AdminContentComment>(http.patch(`/admin/content-comments/${id}/moderation`, data));
}
