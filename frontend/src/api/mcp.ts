import http from '@/http';
import type {
  CreateMCPTokenRequest,
  CreatedMCPToken,
  MCPCallLogPage,
  MCPAccessSettings,
  MCPToken,
} from '@/types/mcp';

export const mcpApi = {
  getSettings: () =>
    http.get<MCPAccessSettings>('/mcp/settings'),

  listTokens: () =>
    http.get<MCPToken[]>('/mcp/tokens'),

  createToken: (data: CreateMCPTokenRequest) =>
    http.post<CreatedMCPToken>('/mcp/tokens', data),

  revokeToken: (id: number) =>
    http.delete(`/mcp/tokens/${id}`),

  deleteTokenRecord: (id: number) =>
    http.delete(`/mcp/tokens/${id}/record`),

  listCallLogs: (params?: { page?: number; pageSize?: number; tool_name?: string; status?: string }) =>
    http.get<MCPCallLogPage>('/mcp/call-logs', params),
};
