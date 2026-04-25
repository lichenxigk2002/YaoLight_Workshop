export type InteractionResourceType = 'workflow_template' | 'workflow' | 'project_asset' | 'knowledge' | 'task' | string;

export interface LikeSummary {
  count: number;
  liked: boolean;
}

export interface CommentUser {
  id: number;
  username: string;
  avatarUrl?: string | null;
}

export interface CommentReactionSummary {
  emoji: string;
  count: number;
  reacted: boolean;
}

export interface CommentItem {
  id: number;
  resourceType: string;
  resourceId: number;
  parentId?: number;
  user: CommentUser;
  content: string;
  location?: string | null;
  deviceModel?: string | null;
  reactions: CommentReactionSummary[];
  replies: CommentItem[];
  createdAt: string;
  updatedAt: string;
  canDelete: boolean;
}

export interface CommentsResponse {
  items: CommentItem[];
  total: number;
}

export interface CreateCommentPayload {
  parentId?: number;
  content: string;
  location?: string;
  deviceModel?: string;
}
