/**
 * 项目相关类型定义
 */

/**
 * 项目信息
 */
export interface Project {
  id: number;
  name: string;
  description?: string;
  userId: number;
  status: string; // 'active' | 'archived'
  createdAt: string;
  updatedAt: string;
}

/**
 * 创建项目请求
 */
export interface CreateProjectRequest {
  name: string;
  description?: string;
}

/**
 * 更新项目请求
 */
export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  status?: string;
}

