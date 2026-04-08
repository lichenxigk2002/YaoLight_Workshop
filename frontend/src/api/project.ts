import http from '@/http';
import type { PageRequest, PageResponse } from '@/types/api';
import type { Project, CreateProjectRequest, UpdateProjectRequest } from '@/types/project';

/**
 * 项目 API
 */
export const projectApi = {
  /**
   * 获取项目列表（分页）
   */
  getProjectList: (params?: PageRequest) =>
    http.get<PageResponse<Project>>('/projects', params),

  /**
   * 获取项目详情
   */
  getProjectById: (id: number) =>
    http.get<Project>(`/projects/${id}`),

  /**
   * 创建项目
   */
  createProject: (data: CreateProjectRequest) =>
    http.post<Project>('/projects', data),

  /**
   * 更新项目
   */
  updateProject: (id: number, data: UpdateProjectRequest) =>
    http.put<Project>(`/projects/${id}`, data),

  /**
   * 删除项目
   */
  deleteProject: (id: number) =>
    http.delete(`/projects/${id}`),
};

