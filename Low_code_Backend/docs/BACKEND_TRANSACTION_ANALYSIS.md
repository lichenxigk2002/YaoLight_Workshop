# 后端事务深度解析（面试向）

> 面向前端开发者：理解本毕业项目中后端数据库事务的现状、风险与改进方向，便于在面试中清晰表述。

---

## 一、技术栈与数据访问方式

- **ORM**：GORM（`gorm.io/gorm`）
- **数据库**：PostgreSQL
- **连接方式**：全局单例 `database.DB *gorm.DB`，在 `infrastructure/database/database.go` 中初始化，各模块通过 `database.DB` 或注入的 `*gorm.DB` 做读写。

所有写操作都是**单条 SQL 级别的调用**（如 `Create`、`Updates`、`Save`、`Delete`），没有在业务代码中显式开启**数据库事务**（Transaction）。

---

## 二、项目中「Transaction」一词的两种含义

面试时容易混淆，建议分清楚：

| 含义 | 说明 | 在项目中的体现 |
|------|------|----------------|
| **业务上的「交易/流水」** | 星尘/Token 的变动记录 | 表 `token_transactions`，模型 `userModels.TokenTransaction`，用于记录注册赠送、AI 扣费、充值等流水 |
| **数据库事务（Transaction）** | 保证多步读写「要么全成功，要么全失败」的机制 | **当前项目中没有使用**，没有 `db.Begin()`、`db.Transaction()`、`tx.Commit()`、`tx.Rollback()` 等 |

代码里出现的 `transaction := userModels.TokenTransaction{...}` 和 `database.DB.Create(&transaction)` 是在**插入一条流水记录**，并不是在开启或使用数据库事务。

---

## 三、当前实现：没有使用数据库事务

在整个后端代码中：

- **没有** `db.Begin()`、`db.BeginTx()`
- **没有** `db.Transaction(fn)` 这类事务闭包
- **没有** 对 `*gorm.DB` 的 `Commit()` / `Rollback()` 调用

因此，所有「多步写」的流程都是**多次独立的数据库操作**。若某一步失败，前面已经提交的步骤**不会自动回滚**，存在**数据不一致**的可能。

---

## 四、典型多步写场景与一致性风险

下面这些场景都是「多张表或多次写」在一个业务动作里完成，适合用事务包裹，但当前实现没有用。

### 4.1 用户注册（用户 + 注册赠送流水）

**位置**：`modules/user/services/auth_service.go` → `Register`

**流程**：

1. `s.userRepo.Create(user)` → 插入 `users`，并给用户 200 万星尘。
2. `database.DB.Create(&transaction)` → 插入 `token_transactions` 一条「注册赠送」流水。

**风险**：若步骤 2 失败（如 DB 短暂不可用），用户已经创建且余额已是 200 万，但**没有对应流水记录**。对账、审计会不完整；若后面按「有流水才认」的规则做事，可能产生业务歧义。

**面试可答**：  
「注册时我们会写用户表和流水表。目前没有用事务，所以如果写流水失败，会出现用户已存在但缺少赠送流水的情况。要改进的话，会把创建用户和写入流水放在同一个数据库事务里。」

---

### 4.2 支付回调：订单状态 + 用户余额

**位置**：`modules/payment/services/payment_service.go` → `HandleAlipayNotify`

**流程**：

1. 验签、查订单、校验金额与状态。
2. `s.orderRepo.Update(order)` → 订单状态改为已支付、写入支付时间等。
3. `user.TokenBalance += order.Stardust`，`s.userRepo.Update(user)` → 用户星尘余额增加。
4. （代码里已有 TODO）创建 `TokenTransaction` 充值流水。

**风险**：若步骤 3 失败，则**订单已标记为已支付，但用户星尘没增加**，属于严重的数据不一致。若步骤 4 将来实现但不在事务里，也可能出现「余额加了、流水没写上」的情况。

**面试可答**：  
「支付回调里会先更新订单状态，再更新用户余额，后续还会补流水。这几步目前是顺序执行，没有用事务。我们意识到若更新用户余额失败，会出现订单已支付但用户没收到星尘的问题，所以从设计上这里应该用事务把订单更新、用户余额更新和流水写入放在一起，要么全成功要么全回滚。」

---

### 4.3 AI 扣费（扣余额 + 写流水）

**位置**：`modules/workflow/services/ai_node.go`、`workflow_executor_stream.go` 等

**流程**：先扣用户星尘（或先算费），再 `database.DB.Create(&transaction)` 写入一条扣费流水。

**风险**：若写流水失败，用户余额已经扣减，流水缺失，对账和排查会困难。若先写流水再扣余额，顺序反过来也有类似一致性问题。

**面试可答**：  
「AI 调用会扣用户星尘并写一条扣费流水。目前这两步没有放在同一事务里，存在扣了费但流水没记上的可能。生产环境会建议用事务保证扣减和流水同时成功或同时回滚。」

---

## 五、若引入事务，在 GORM 中的常见写法

面试时可能会被问到「你们用 GORM 的话，事务怎么用？」可以按下面两种方式说明（不要求背代码，理解思路即可）。

### 5.1 推荐：闭包形式（自动 Commit/Rollback）

```go
err := database.DB.Transaction(func(tx *gorm.DB) error {
    if err := tx.Create(&user).Error; err != nil {
        return err // 返回错误则自动 Rollback
    }
    if err := tx.Create(&transaction).Error; err != nil {
        return err
    }
    return nil // 返回 nil 则自动 Commit
})
```

- 优点：不用手写 `Commit`/`Rollback`，避免忘记回滚。
- 适合：当前项目里「注册」「支付回调」「扣费+流水」等场景。

### 5.2 手动 Begin / Commit / Rollback

```go
tx := database.DB.Begin()
defer func() {
    if r := recover(); r != nil {
        tx.Rollback()
    }
}()
if err := tx.Create(&user).Error; err != nil {
    tx.Rollback()
    return err
}
if err := tx.Create(&transaction).Error; err != nil {
    tx.Rollback()
    return err
}
return tx.Commit().Error
```

- 适合：需要在一个请求里多次使用 `tx`、或事务边界更复杂的场景。
- 注意：要在所有错误路径和 panic 路径上 Rollback，否则会长时间占用连接。

---

## 六、面试中如何表述（小结）

1. **技术栈**：后端用 Go + GORM + PostgreSQL，数据访问通过全局 `database.DB` 或注入的 `*gorm.DB`。
2. **事务现状**：当前**没有使用数据库事务**；代码里的 `TokenTransaction` 是**业务上的流水表**，不是 DB 事务。
3. **风险点**：注册（用户+流水）、支付回调（订单+用户余额）、AI 扣费（余额+流水）等都是多步写，目前顺序执行，存在**部分成功、部分失败**导致的不一致。
4. **改进方向**：在这些多步写场景中用 GORM 的 `db.Transaction(...)`（或手动 Begin/Commit/Rollback）把相关写操作包成**一个事务**，保证原子性。
5. **你的角色**：作为前端，了解这些是为了更好地和后端协作（联调、排查「钱/余额不对」类问题）、能说清楚系统在一致性问题上的设计即可，不必深入实现细节。

按以上几点组织成自己的话，即可在面试中清晰、有条理地说明项目后端与事务相关的情况。
