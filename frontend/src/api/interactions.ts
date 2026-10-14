import http from '@/http';
import type {
  CommentsResponse,
  CreateCommentPayload,
  InteractionResourceType,
  LikeSummary,
  CommentReactionSummary,
} from '@/types/interactions';

const resourcePath = (resourceType: InteractionResourceType, resourceId: number) =>
  `/interactions/resources/${encodeURIComponent(resourceType)}/${resourceId}`;

export const interactionApi = {
  getLikeSummary: (resourceType: InteractionResourceType, resourceId: number) =>
    http.get<LikeSummary>(`${resourcePath(resourceType, resourceId)}/like`),

  toggleLike: (resourceType: InteractionResourceType, resourceId: number) =>
    http.post<LikeSummary>(`${resourcePath(resourceType, resourceId)}/like`),

  listComments: (resourceType: InteractionResourceType, resourceId: number) =>
    http.get<CommentsResponse>(`${resourcePath(resourceType, resourceId)}/comments`),

  createComment: (resourceType: InteractionResourceType, resourceId: number, payload: CreateCommentPayload) =>
    http.post<CommentsResponse>(`${resourcePath(resourceType, resourceId)}/comments`, payload),

  deleteComment: (commentId: number) =>
    http.delete(`/interactions/comments/${commentId}`),

  toggleCommentReaction: (commentId: number, emoji: string) =>
    http.post<CommentReactionSummary>(`/interactions/comments/${commentId}/reactions`, { emoji }),
};
