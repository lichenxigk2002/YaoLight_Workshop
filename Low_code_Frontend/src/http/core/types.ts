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
  const headers: Record<string, string> = {};
  axiosResponse.headers.forEach((value: string, key: string) => {
    headers[key] = value;
  });

  return {
    status: axiosResponse.status,
    statusText: axiosResponse.statusText,
    data: axiosResponse.data,
    headers,
    config: axiosResponse.config,
  };
}

