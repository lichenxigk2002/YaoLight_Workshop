import { AxiosResponse } from 'axios';

/**
 * 适配 Axios 的 Response 类型
 */
export interface Response<T = any> {
  status: number;
  statusText: string;
  data: T;
  headers: Record<string, string>;
  config?: any;
}

/**
 * 将 AxiosResponse 转换为 Response
 */
export function adaptAxiosResponse<T = any>(axiosResponse: AxiosResponse<T>): Response<T> {
  // 将 AxiosHeaders 转换为普通对象
  // 兼容不同版本的 Axios headers 实现
  const headers: Record<string, string> = {};

  try {
    // 方法1: 尝试使用 forEach（如果支持）
    if (typeof axiosResponse.headers.forEach === 'function') {
      axiosResponse.headers.forEach((value: any, key: string) => {
        // 处理值可能是数组的情况（AxiosHeaders 可能返回数组）
        const headerValue = Array.isArray(value) ? value[0] : value;
        headers[key] = String(headerValue);
      });
    } else {
      // 方法2: 尝试直接访问（如果是普通对象）
      if (typeof axiosResponse.headers === 'object' && axiosResponse.headers !== null) {
        // 使用 Object.keys 遍历
        Object.keys(axiosResponse.headers).forEach((key) => {
          const value = (axiosResponse.headers as any)[key];
          // 处理值可能是数组的情况
          const headerValue = Array.isArray(value) ? value[0] : value;
          headers[key] = String(headerValue);
        });
      }
    }
  } catch (error) {
    // 如果转换失败，使用空对象
    console.warn('转换 Axios headers 失败:', error);
  }

  return {
    status: axiosResponse.status,
    statusText: axiosResponse.statusText,
    data: axiosResponse.data,
    headers,
    config: axiosResponse.config,
  };
}

