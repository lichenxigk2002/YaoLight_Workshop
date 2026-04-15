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

export interface UserOrderItem {
  orderId: string;
  packageName: string;
  amount: number;
  stardust: number;
  status: 'pending' | 'paid' | 'cancelled' | 'failed';
  paymentMethod: 'alipay_pc' | 'alipay_qr' | 'mock';
  paidAt?: string;
  createdAt: string;
}

export interface UserOrderListResponse {
  list: UserOrderItem[];
  total: number;
}

/** 订单详情（含继续支付链接，仅待支付时有 payUrl/qrCode） */
export interface UserOrderDetail extends UserOrderItem {
  expiresAt?: string;
  payUrl?: string;
  qrCode?: string;
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
   * 获取当前用户的订单列表
   */
  getMyOrders: (params: { page: number; pageSize: number }) =>
    http.get<UserOrderListResponse>('/payment/orders', { params }),

  /**
   * 获取订单详情（含继续支付链接，仅待支付时返回 payUrl）
   */
  getOrderDetail: (orderId: string) =>
    http.get<UserOrderDetail>(`/payment/orders/${orderId}/detail`),

  /**
   * 取消订单（仅待支付可取消）
   */
  cancelOrder: (orderId: string) =>
    http.post(`/payment/orders/${orderId}/cancel`),

  /**
   * 删除订单（仅待支付或已取消可删）
   */
  deleteOrder: (orderId: string) =>
    http.delete(`/payment/orders/${orderId}`),

  /**
   * 模拟支付（仅开发环境）
   */
  mockPay: (orderId: string) =>
    http.post(`/payment/orders/${orderId}/mock-pay`),
};

