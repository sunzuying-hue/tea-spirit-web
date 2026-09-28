# 茶有灵 Web

Vite + React 前端，第一版数据层面向 CloudBase PostgreSQL。

## 当前身份状态

- 已接入官方 `@cloudbase/js-sdk` 和环境 `tea-spirit-web-d8g3tqcm207d21843`。
- 第一版正式身份入口是 CloudBase Auth v2 手机号短信验证码，业务身份使用稳定 UID。
- 微信 OAuth 与 Apple 登录保留为可选扩展，不再是后端上线前置条件。
- `loginWithWeChat()` 仍明确返回 `WECHAT_OAUTH_NOT_CONFIGURED`，不会模拟成功。
- `loginAsDevUser()` 仅供 Vite 开发模式调试；生产构建不显示“开发体验”入口，也不会用本地身份代替正式登录。

## 数据迁移与安全

SQL 位于 `cloudbase/migrations/`，按编号执行。迁移只创建缺失对象，不删除表或已有数据。

PG 模式官方提供 `auth.uid()`，等价于 JWT 的 `sub`。`005_enable_rls.sql` 使用它与 `users.auth_uid` 比对，只允许用户访问自己的档案、茶灵与信笺。不要把 service key、AccessKey 或 SecretKey 放进前端。

真实登录用户的 `users`、`tea_spirits`、`letters` 均以 CloudBase 为最终数据真源。localStorage 只作为非关键 UI 缓存，不参与身份、成长时间、成熟结算、陪伴次数或成长信笺判定。

茶灵成长始终以真实 `obtained_at` 与当前时间差计算；数据库只保存真实时间，测试加速不得写入数据库。生命周期完成通过 `complete_tea_spirit()` 在一个事务内锁定茶灵、标记完成、增加陪伴次数并创建唯一 `event_key` 信笺。

未来扩展流程：

微信登录 → users → tea_spirits → 生命周期事件 → letters → notification_jobs → 微信订阅消息/短信 → 用户打开信笺 → 优惠券 → 到店核销 → 复访记录

`notification_jobs` 与后台云函数仅保留为后续主动通知基础设施；当前封闭测试不配置通知短信、不创建节日任务，也不实现真实优惠券或支付。
