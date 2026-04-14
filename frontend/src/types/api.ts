/**
 * API 接口规范
 */

/**
 * 统一响应结构
 */
export interface ApiResponse<T = any> {
  code: number;    // 状态码：200 成功，40001 未授权，其他为失败
  message: string; // 消息提示
  data: T;         // 响应数据
}

/**
 * 分页请求参数
 */
export interface PageRequest {
  page: number;     // 当前页码
  pageSize: number; // 每页数量
}

/**
 * 分页响应数据
 */
export interface PageResponse<T> {
  list: T[];        // 数据列表
  total: number;    // 总数量
  page: number;     // 当前页码
  pageSize: number; // 每页数量
}
