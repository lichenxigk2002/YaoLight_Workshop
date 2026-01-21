// 统一导出所有类型定义
export * from './api';
export * from './ai';
export * from './alkaid';
export * from './user';
export * from './workflow';

// 为了向后兼容，保留旧的类型名称别名
export type PaginationParams = import('./api').PageRequest;
export type PaginationResponse<T> = import('./api').PageResponse<T>;
