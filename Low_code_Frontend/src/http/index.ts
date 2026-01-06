import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { message } from 'antd';
import type { ApiResponse } from '@/types/api';

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
    console.log('API基础URL:', this.baseURL);

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
        console.log('发送请求:', config.url, config.method?.toUpperCase());

        // 从 localStorage 获取 token
        const token = this.getToken();
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        return config;
      },
      (error: AxiosError) => {
        console.error('请求配置错误:', error);
        return Promise.reject(error);
      }
    );

    // 响应拦截器
    this.instance.interceptors.response.use(
      (response: AxiosResponse<ApiResponse>) => {
        console.log('API响应数据:', response.data);

        const { code, message: responseMessage, data } = response.data;

        // 处理业务状态码
        if (code === 40001) {
          // 未授权，跳转登录
          message.error('登录已过期，请重新登录');
          this.clearToken();
          window.location.href = '/login';
          return Promise.reject(new Error('未授权'));
        } else if (code !== 200 && code !== 0) {
          // 其他业务错误
          message.error(responseMessage || '请求失败');
          return Promise.reject(new Error(responseMessage || '请求失败'));
        }

        // 返回数据
        return data;
      },
      (error: AxiosError<ApiResponse>) => {
        console.error('API请求错误:', error);

        // 处理 HTTP 状态码错误
        if (error.response) {
          const { status, data } = error.response;

          switch (status) {
            case 400:
              message.error(data?.message || '请求参数错误');
              break;
            case 401:
              message.error('未授权，请重新登录');
              this.clearToken();
              window.location.href = '/login';
              break;
            case 403:
              message.error('没有权限访问');
              break;
            case 404:
              message.error('请求的资源不存在');
              break;
            case 500:
              message.error(data?.message || '服务器错误');
              break;
            case 502:
              message.error('网关错误');
              break;
            case 503:
              message.error('服务不可用');
              break;
            default:
              message.error(data?.message || `请求失败 (${status})`);
          }
        } else if (error.code === 'ECONNABORTED') {
          // 超时错误
          message.error('请求超时，请稍后重试');
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
    try {
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        const authData = JSON.parse(authStorage);
        return authData.state?.token || null;
      }
    } catch (e) {
      console.warn('获取 token 失败:', e);
    }
    return null;
  }

  /**
   * 清除 token
   */
  private clearToken(): void {
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
      console.error('文件下载失败:', error);
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
