import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { message } from '@/utils/antdGlobal';
import { useAuthStore } from '@/store/auth';
import type { ApiResponse } from '@/types/api';
import { StatusHandler } from './handlers';
import { HttpError } from './core/error';
import { HTTP_STATUS } from './core/status';

/**
 * HTTP 请求配置
 */
interface HttpConfig extends AxiosRequestConfig {
  showError?: boolean; // 是否显示错误提示
  showLoading?: boolean; // 是否显示加载状态
}

/**
 * HTTP 工具类
 */
class HttpClient {
  private instance: AxiosInstance;
  private readonly baseURL: string;

  constructor() {
    // 从环境变量获取 API 基础 URL
    this.baseURL = import.meta.env.VITE_BASE_URL || '/api';

    // 创建 axios 实例
    this.instance = axios.create({
      baseURL: this.baseURL,
      timeout: 10000, // 10秒超时
      timeoutErrorMessage: '请求超时，请刷新页面重新尝试',
      withCredentials: true, // 允许携带cookie
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // 初始化拦截器
    this.initInterceptors();
  }

  /**
   * 初始化拦截器
   */
  private initInterceptors(): void {
    // 请求拦截器
    this.instance.interceptors.request.use(
      (config) => {
        // 从 localStorage 获取 token
        const token = this.getToken();
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        return config;
      },
      (error: AxiosError) => {
        return Promise.reject(error);
      }
    );

    // 响应拦截器
    this.instance.interceptors.response.use(
      async (response: AxiosResponse<ApiResponse>) => {
        const url = response.config?.url || '';

        try {
          // 二进制下载（如 PDF）：直接返回完整 response，便于 download() 使用 data 与 headers
          if (response.config.responseType === 'blob') {
            return response;
          }

          // 使用 StatusHandler 处理 HTTP 状态码
          let responseData = await StatusHandler.handle(response, url);

          // 检查响应数据格式
          if (responseData && typeof responseData === 'object' && 'success' in responseData && 'results' in responseData) {
            return responseData;
          }

          // 标准 ApiResponse 格式处理
          if (!responseData || typeof responseData !== 'object' || !('code' in responseData)) {
            return responseData;
          }

          const { code, message: responseMessage, data } = responseData as ApiResponse;

          // 处理业务状态码
          if (code === 40001) {
            // 未授权，跳转登录
            message.error('登录已过期，请重新登录');
            this.clearToken();
            window.location.href = '/login';
            return Promise.reject(new Error('未授权'));
          } else if (code !== 200 && code !== 0) {
            // 其他业务错误
            console.error('业务错误:', { code, message: responseMessage, url });
            message.error(responseMessage || '请求失败');
            return Promise.reject(new Error(responseMessage || '请求失败'));
          }

          // 返回数据
          return data;
        } catch (error) {
          // 如果 StatusHandler 抛出错误，这里会被捕获
          // 但正常情况下，HTTP 2xx 状态码不会抛出错误
          // 这里主要是为了安全起见
          if (error instanceof HttpError) {
            throw error;
          }
          throw error;
        }
      },
      async (error: AxiosError<ApiResponse>) => {
        const url = error.config?.url || '';

        // 调试日志
        if (error.config?.url?.includes('/workflows/execute')) {
          console.error('工作流执行请求错误:', {
            url: error.config.url,
            code: error.code,
            message: error.message,
            response: error.response,
            timeout: error.config.timeout,
          });
        }

        // 处理 HTTP 状态码错误
        if (error.response) {
          try {
            // 使用 StatusHandler 处理 HTTP 错误状态码
            await StatusHandler.handle(error.response, url);
          } catch (httpError) {
            // StatusHandler 会抛出 HttpError
            if (httpError instanceof HttpError) {
              // 根据错误类型显示不同的错误消息
              const errorMessage = httpError.getErrorMessage();

              // 特殊处理 401 未授权
              if (httpError.isUnauthorized()) {
                message.error('未授权，请重新登录');
                this.clearToken();
                window.location.href = '/login';
              } else if (httpError.isForbidden()) {
                message.error('没有权限访问');
              } else {
                // 其他错误显示错误消息
                message.error(errorMessage);
              }

              // 如果是重定向错误，记录重定向 URL
              if (httpError.extra?.redirectUrl) {
                console.warn('需要重定向到:', httpError.extra.redirectUrl);
              }
            } else {
              // 如果不是 HttpError，使用默认错误处理
              message.error('请求失败');
            }
          }
        } else if (error.code === 'ECONNABORTED') {
          // 超时错误
          const timeout = error.config?.timeout || 10000;
          message.error(`请求超时（${timeout / 1000}秒），请稍后重试或检查网络连接`);
        } else if (error.message === 'Network Error') {
          // 网络错误
          message.error('网络错误，请检查网络连接');
        } else {
          message.error(error.message || '请求失败');
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * 获取 token
   */
  private getToken(): string | null {
    const memoryToken = useAuthStore.getState().token;
    if (memoryToken) {
      return memoryToken;
    }

    try {
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        const authData = JSON.parse(authStorage);
        return authData.state?.token || null;
      }
    } catch (e) {
      // 获取 token 失败
    }
    return null;
  }

  /**
   * 清除 token
   */
  private clearToken(): void {
    useAuthStore.getState().logout();
    localStorage.removeItem('auth-storage');
  }

  /**
   * GET 请求
   * @param url 请求地址
   * @param params 请求参数
   * @param config 请求配置
   */
  get<T = any>(url: string, params?: object, config?: HttpConfig): Promise<T> {
    return this.instance.get(url, {
      params,
      ...config,
    });
  }

  /**
   * POST 请求
   * @param url 请求地址
   * @param data 请求数据
   * @param config 请求配置
   */
  post<T = any>(url: string, data?: object, config?: HttpConfig): Promise<T> {
    return this.instance.post(url, data, config);
  }

  /**
   * PUT 请求
   * @param url 请求地址
   * @param data 请求数据
   * @param config 请求配置
   */
  put<T = any>(url: string, data?: object, config?: HttpConfig): Promise<T> {
    return this.instance.put(url, data, config);
  }

  /**
   * DELETE 请求
   * @param url 请求地址
   * @param params 请求参数
   * @param config 请求配置
   */
  delete<T = any>(url: string, params?: object, config?: HttpConfig): Promise<T> {
    return this.instance.delete(url, {
      params,
      ...config,
    });
  }

  /**
   * PATCH 请求
   * @param url 请求地址
   * @param data 请求数据
   * @param config 请求配置
   */
  patch<T = any>(url: string, data?: object, config?: HttpConfig): Promise<T> {
    return this.instance.patch(url, data, config);
  }

  /**
   * 上传文件
   * @param url 请求地址
   * @param formData 表单数据
   * @param config 请求配置
   */
  upload<T = any>(url: string, formData: FormData, config?: HttpConfig): Promise<T> {
    return this.instance.post(url, formData, {
      ...config,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  /**
   * 下载文件
   * @param url 请求地址
   * @param params 请求参数
   * @param filename 文件名
   */
  async download(url: string, params?: object, filename?: string): Promise<void> {
    try {
      const response = await this.instance.get(url, {
        params,
        responseType: 'blob',
      });

      // 创建下载链接
      const blob = new Blob([response.data]);
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename || this.getFilenameFromResponse(response) || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      message.error('文件下载失败');
      throw error;
    }
  }

  /**
   * 从响应头获取文件名
   */
  private getFilenameFromResponse(response: AxiosResponse): string | null {
    const contentDisposition = response.headers['content-disposition'];
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (filenameMatch && filenameMatch[1]) {
        return filenameMatch[1].replace(/['"]/g, '');
      }
    }
    return null;
  }

  /**
   * 获取 axios 实例（用于特殊场景）
   */
  getInstance(): AxiosInstance {
    return this.instance;
  }
}

// 创建并导出 HTTP 客户端实例
const http = new HttpClient();

export default http;
