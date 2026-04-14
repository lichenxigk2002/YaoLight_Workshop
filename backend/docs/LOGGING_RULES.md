# Backend Logging Rules

## Standard Format

All backend logs must go through `backend/infrastructure/logx/logx.go`.

Output format:

```text
2026-04-08T15:23:45.123+08:00 [error]-LCX-3009 支付宝参数签名失败: xxx
```

Format parts:

- Time: RFC3339-like Beijing time, UTF-8 output, fixed `+08:00`
- Level: `info` / `warn` / `error`
- Owner: always `LCX`
- Code: four-digit numeric code
- Message: human-readable Chinese or English text

## Required Usage

Prefer explicit coded logs for all new code:

```go
log.Infof(3002, "开始生成支付宝支付链接，orderID=%s method=%s", order.OrderID, order.PaymentMethod)
log.Warnf(3006, "ALIPAY_NOTIFY_URL 未配置，支付回调可能失败")
log.Errorf(3009, "支付宝参数签名失败: %v", err)
log.Fatalf(1008, "Failed to start server: %v", err)
```

Compatibility usage is allowed during migration:

```go
log.Printf("订单 %s 已支付，忽略重复通知", orderID)
```

Compatibility logs will still be routed through `logx`, and `logx` will:

- add standard timestamp and `LCX`
- infer a file-level code
- infer `warn` / `error` for common keywords like `warn`, `failed`, `错误`, `失败`, `警告`

## Numbering Ranges

Reserve codes by business domain first, then allocate sequentially inside the range.

- `1000-1099`: server bootstrap and process lifecycle
- `1100-1499`: infrastructure layer
- `2000-2299`: user, auth, account, invitation, transaction
- `2300-2399`: project, artifact, file-facing controllers
- `3000-3199`: payment and recharge
- `4000-4299`: workflow runtime and controllers
- `4300-4599`: workflow export and support utilities
- `4600-4899`: AI pricing and model providers
- `5000-5199`: crawler
- `6000-6299`: task and notification
- `7000-7999`: reserved for alkaid, rbac, node, system and future modules
- `9000-9999`: emergency temporary codes, should be cleaned before merge

## Allocation Rules

- One business event should have one stable code.
- Reuse the same code only for the same failure or milestone.
- Do not encode log level in the number itself; level is already in the prefix.
- When adding a new code, append within the nearest domain range instead of reusing old numbers.
- Hot paths should prefer explicit codes over compatibility `Printf`.

## Current File-Level Compatibility Codes

Legacy `Printf` / `Println` logs currently fall back to a fixed file code. The mapping lives in `backend/infrastructure/logx/logx.go`.

Current important mappings:

- `1000`: `backend/cmd/server/main.go`
- `1101`: `backend/infrastructure/config/config.go`
- `1111`: `backend/infrastructure/database/database.go`
- `1112`: `backend/infrastructure/database/sql_migrations.go`
- `1121`: `backend/infrastructure/middleware/admin_operation_log_middleware.go`
- `1131`: `backend/infrastructure/storage/cos.go`
- `1141`: `backend/infrastructure/redis/redis.go`
- `2001-2012`: user and auth related files
- `2301`: project controller
- `3000-3001`: payment service and controller compatibility logs
- `4001-4021`: workflow runtime/controller/export files
- `4601-4615`: AI pricing and provider files
- `5001-5002`: crawler files
- `6001-6101`: notification and task files

## Suggested Review Rule

Before merging:

- new files should import `logx`, not standard library `log`
- new important branches should use `Infof/Warnf/Errorf/Fatalf` with explicit code
- compatibility `Printf/Println` logs can remain temporarily, but should be converted when touching the same logic
