import http from '@/http';

/**
 * 充值套餐
 */
export interface StardustPackage {
  id: string;
  name: string;
  price: number;
  stardust: number;
  tag?: string;
  description?: string;
}

/**
 * 创建订单请求
 */
export interface CreateOrderRequest {
  packageId: string;
  method?: 'alipay_pc' | 'alipay_qr' | 'mock';
}

/**
 * 创建订单响应
 */
export interface CreateOrderResponse {
  orderId: string;
  payUrl?: string; // 支付宝跳转链接（PC支付）
  qrCode?: string; // 二维码内容（扫码支付）
}

/**
 * 订单状态
 */
export interface OrderStatus {
  orderId: string;
  status: 'pending' | 'paid' | 'cancelled' | 'failed';
  amount: number;
  currency: 'CNY';
  stardust: number;
  paidAt?: string; // ISO8601 时间
}

/**
 * 支付 API
 */
export const paymentApi = {
  /**
   * 获取充值套餐列表
   */
  getPackages: () => http.get<StardustPackage[]>('/payment/packages'),

  /**
   * 创建支付订单
   */
  createOrder: (data: CreateOrderRequest) =>
    http.post<CreateOrderResponse>('/payment/orders', data),

  /**
   * 查询订单状态
   */
  getOrderStatus: (orderId: string) =>
    http.get<OrderStatus>(`/payment/orders/${orderId}/status`),

  /**
   * 模拟支付（仅开发环境）
   */
  mockPay: (orderId: string) =>
    http.post(`/payment/orders/${orderId}/mock-pay`),
};

