export interface AdminContentComment {
  id: number;
  resourceType: string;
  resourceId: number;
  resourceTitle?: string | null;
  parentId?: number | null;
  userId: number;
  username: string;
  avatarUrl?: string | null;
  content: string;
  status: 'visible' | 'hidden' | 'deleted' | string;
  location?: string | null;
  deviceModel?: string | null;
  moderationReason?: string | null;
  moderatedBy?: number | null;
  moderatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface AdminContentCommentListResponse {
  list: AdminContentComment[];
  total: number;
  page: number;
  pageSize: number;
}
