# 星尘 (Stardust) 充值系统实现方案

为满足快速上线充值功能的需求，建议采用 **"模拟支付 + 订单系统"** 的 MVP (最小可行性产品) 方案。前期暂不接入真实的支付宝/微信支付（涉及企业资质和复杂的签名调试），而是提供一个演示用的支付流程，确保前后端逻辑闭环。

## 1. 后端实现 (Low_code_Backend)

### 1.1 数据模型设计
我们需要新增 `Order` (订单) 模型，并扩展现有的 `TokenTransaction` 类型。

*   **Order 表**: 记录充值请求
    *   `ID`: 订单号 (UUID)
    *   `UserID`: 关联用户
    *   `Amount`: 支付金额 (CNY)
    *   `StardustCount`: 购买的星尘数量
    *   `Status`: 状态 (`pending` 待支付, `paid` 已完成, `cancelled` 已取消)
    *   `PaymentMethod`: 支付方式 (默认 `mock`)

*   **TokenTransaction 表**:
    *   新增 `Type` 枚举值: `recharge` (充值)

### 1.2 新增 API 接口
将创建新的 `payment` 模块：

1.  **`GET /api/payment/packages`**: 获取充值套餐列表
    *   *示例*: `[{ price: 9.9, stardust: 10000 }, { price: 49.9, stardust: 60000 }]`
2.  **`POST /api/payment/create-order`**: 创建充值订单
    *   输入: `package_id`
    *   输出: `order_id`, `pay_url` (模拟支付页面链接)
3.  **`POST /api/payment/mock-pay`**: (仅开发/演示用) 模拟支付回调
    *   输入: `order_id`
    *   逻辑: 验证订单 -> 更新订单状态为 `paid` -> **给用户增加星尘余额** -> 记录 `recharge` 类型流水。

## 2. 前端实现 (Low_code_Frontend)

### 2.1 账单页面 (Billing) 改造
*   在“星尘余额”卡片右侧添加醒目的 **“充值” (Recharge)** 按钮。

### 2.2 充值弹窗组件
点击充值后弹出模态框：
*   **套餐选择**: 展示 3-4 个预设的星尘包（如 "入门包", "开发者包", "企业包"）。
*   **支付方式**: 显示“模拟支付”（后续可扩展支付宝/微信）。
*   **支付确认**: 点击后调用创建订单接口，并模拟跳转或直接弹窗提示“支付成功”。

### 2.3 状态同步
*   充值成功后，自动刷新顶部的“星尘余额”和底部的“账单/流水表格”。

---

## 3. 执行计划

1.  **后端**: 创建 `Order` 模型与数据库迁移。
2.  **后端**: 实现 `PaymentController` 和 `PaymentService` (含充值到账逻辑)。
3.  **前端**: 开发 `RechargeModal` 组件与套餐展示 UI。
4.  **前端**: 对接充值 API 并联调。
