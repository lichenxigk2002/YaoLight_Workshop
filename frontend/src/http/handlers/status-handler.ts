import { HttpError } from '../core/error';
import { HTTP_STATUS } from '../core/status';
import { Response, adaptAxiosResponse } from '../core/types';
import { AxiosResponse } from 'axios';

/**
 * HTTP 状态码处理器
 */
export class StatusHandler {
  /**
   * 处理 HTTP 响应
   */
  static async handle<T>(response: AxiosResponse<T>, url: string): Promise<T> {
    const adaptedResponse = adaptAxiosResponse(response);
    const status = adaptedResponse.status;

    if (status >= 100 && status < 200) {
      return this.handleInformational(adaptedResponse, url);
    }
    if (status >= 200 && status < 300) {
      return this.handleSuccess(adaptedResponse, url);
    }
    if (status >= 300 && status < 400) {
      return this.handleRedirect(adaptedResponse, url);
    }
    if (status >= 400 && status < 500) {
      return this.handleClientError(adaptedResponse, url);
    }
    if (status >= 500) {
      return this.handleServerError(adaptedResponse, url);
    }

    throw new HttpError('未知的HTTP状态码', status, url);
  }

  /**
   * 处理信息性状态码 (1xx)
   */
  private static async handleInformational<T>(response: Response, url: string): Promise<T> {
    switch (response.status) {
      case HTTP_STATUS.CONTINUE:
      case HTTP_STATUS.SWITCHING_PROTOCOLS:
      case HTTP_STATUS.PROCESSING:
        return null as any;
      default:
        throw new HttpError('未处理的信息性状态码', response.status, url);
    }
  }

  /**
   * 处理成功状态码 (2xx)
   */
  private static async handleSuccess<T>(response: Response, url: string): Promise<T> {
    try {
      switch (response.status) {
        case HTTP_STATUS.OK:
          // 检查响应体是否为空
          const contentLength = response.headers['content-length'];
          if (contentLength === '0' || !response.data) {
            return null as T;
          }
          // 检查响应类型
          const contentType = response.headers['content-type'] || response.headers['Content-Type'];
          if (contentType && contentType.includes('application/json')) {
            // 如果 data 已经是对象，直接返回
            if (typeof response.data === 'object') {
              return response.data as T;
            }
            // 如果是字符串，尝试解析 JSON
            if (typeof response.data === 'string') {
              try {
                return JSON.parse(response.data) as T;
              } catch (e) {
                return response.data as T;
              }
            }
            return response.data as T;
          } else {
            // 如果不是JSON，返回原始数据
            return response.data as T;
          }
        case HTTP_STATUS.CREATED:
        case HTTP_STATUS.ACCEPTED:
          return response.data as T;
        case HTTP_STATUS.NO_CONTENT:
          return null as T;
        case HTTP_STATUS.PARTIAL_CONTENT:
          return this.handlePartialContent(response);
        default:
          return response.data as T;
      }
    } catch (error) {
      throw new HttpError(
        '响应数据解析错误',
        response.status,
        url,
        { originalError: error }
      );
    }
  }

  /**
   * 处理部分内容 (206)
   */
  private static async handlePartialContent<T>(response: Response): Promise<T> {
    const contentRange = response.headers['content-range'] || response.headers['Content-Range'];
    const data = response.data;

    // 如果 data 是对象，添加 range 信息
    if (typeof data === 'object' && data !== null) {
      return {
        ...data,
        range: contentRange,
      } as T;
    }

    return {
      data,
      range: contentRange,
    } as T;
  }

  /**
   * 处理重定向状态码 (3xx)
   */
  private static async handleRedirect<T>(response: Response, url: string): Promise<T> {
    const location = response.headers['location'] || response.headers['Location'];

    switch (response.status) {
      case HTTP_STATUS.MOVED_PERMANENTLY:
      case HTTP_STATUS.FOUND:
      case HTTP_STATUS.SEE_OTHER:
      case HTTP_STATUS.TEMPORARY_REDIRECT:
      case HTTP_STATUS.PERMANENT_REDIRECT:
        throw new HttpError(
          '需要重定向',
          response.status,
          url,
          { redirectUrl: location }
        );
      case HTTP_STATUS.NOT_MODIFIED:
        return null as T;
      default:
        throw new HttpError('未处理的重定向状态码', response.status, url);
    }
  }

  /**
   * 处理客户端错误状态码 (4xx)
   */
  private static async handleClientError<T>(response: Response, url: string): Promise<T> {
    const errorData = this.getErrorData(response);

    const errorMessages: Record<number, string> = {
      [HTTP_STATUS.BAD_REQUEST]: '错误的请求',
      [HTTP_STATUS.UNAUTHORIZED]: '未授权',
      [HTTP_STATUS.FORBIDDEN]: '禁止访问',
      [HTTP_STATUS.NOT_FOUND]: '资源未找到',
      [HTTP_STATUS.METHOD_NOT_ALLOWED]: '方法不允许',
    };

    const message = errorData?.message || errorMessages[response.status] || '客户端错误';

    throw new HttpError(message, response.status, url, errorData);
  }

  /**
   * 处理服务器错误状态码 (5xx)
   */
  private static async handleServerError<T>(response: Response, url: string): Promise<T> {
    const errorData = this.getErrorData(response);

    const errorMessages: Record<number, string> = {
      [HTTP_STATUS.INTERNAL_SERVER_ERROR]: '服务器内部错误',
      [HTTP_STATUS.BAD_GATEWAY]: '网关错误',
      [HTTP_STATUS.SERVICE_UNAVAILABLE]: '服务不可用',
      [HTTP_STATUS.GATEWAY_TIMEOUT]: '网关超时',
    };

    const message = errorData?.message || errorMessages[response.status] || '服务器错误';

    throw new HttpError(message, response.status, url, errorData);
  }

  /**
   * 获取错误数据的辅助方法
   */
  private static getErrorData(response: Response): any {
    try {
      // 如果 data 是对象，直接返回
      if (typeof response.data === 'object' && response.data !== null) {
        return response.data;
      }
      // 如果是字符串，尝试解析 JSON
      if (typeof response.data === 'string') {
        try {
          return JSON.parse(response.data);
        } catch {
          return { message: response.data };
        }
      }
      return {};
    } catch {
      return {};
    }
  }
}

