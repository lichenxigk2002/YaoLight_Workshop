/**
 * HTTP 错误类
 */
export class HttpError extends Error {
  public readonly status: number;
  public readonly url: string;
  public readonly extra?: any;

  constructor(message: string, status: number, url: string, extra?: any) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.url = url;
    this.extra = extra;

    // 保持与 Error 类的原型链
    Object.setPrototypeOf(this, HttpError.prototype);
  }

  /**
   * 获取错误信息
   */
  getErrorMessage(): string {
    return this.message;
  }

  /**
   * 是否为客户端错误 (4xx)
   */
  isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }

  /**
   * 是否为服务器错误 (5xx)
   */
  isServerError(): boolean {
    return this.status >= 500;
  }

  /**
   * 是否为未授权错误
   */
  isUnauthorized(): boolean {
    return this.status === 401;
  }

  /**
   * 是否为禁止访问错误
   */
  isForbidden(): boolean {
    return this.status === 403;
  }
}

// 导出别名以保持兼容性
export const httpError = HttpError;

