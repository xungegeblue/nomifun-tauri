# nomifun-auth

> 路径: `crates/backend/nomifun-auth/`

## 功能

**认证与安全基础设施模块**，涵盖：

- JWT 认证：签发、验证、黑名单、密钥轮转
- 密码管理：bcrypt 哈希、定时验证（防时序攻击）
- 本地信任机制：桌面端 webview（免登录）vs 远程 LAN 浏览器（需登录）
- Companion Token 验证：按 companion 绑定的 token 验证
- CSRF 防护中间件
- 速率限制：三层限流（auth/api/authenticated-action）
- 安全头中间件
- QR 登录：一次性 token 生成与消费
- 完整认证路由
- 输入校验：用户名和密码强度

## 核心类型

| 类型 | 说明 |
|------|------|
| `JwtService` | JWT 签发/验证/黑名单/密钥轮转服务 |
| `TokenPayload` | JWT claims: user_id, username, iat, exp |
| `AuthError` | 认证错误枚举 |
| `CurrentUser` | 中间件注入的已认证用户 |
| `AuthPolicy` | 认证策略: NoAuth / Required / TrustLocalToken |
| `CompanionTokenValidator` | companion token 验证器 |
| `QrTokenStore` | QR token 一次性存储 |

## 路由

**公开路由**: POST /login, POST /api/auth/setup, POST /api/auth/qr-login, GET /api/auth/status
**已认证路由**: POST /logout, GET /api/auth/user, POST /api/auth/change-password, GET /api/ws-token
**仅本地路由**: GET/POST /api/auth/internal/users/*, POST /api/webui/change-password 等

## 依赖

**外部**: jsonwebtoken(v9), bcrypt, axum, tower, dashmap, sha2, base64
**Workspace 内**: nomifun-common, nomifun-db, nomifun-api-types

## 被依赖

被 16 个 crate 依赖: nomifun-app, nomifun-companion, nomifun-conversation, nomifun-cron, nomifun-idmm, nomifun-knowledge, nomifun-office, nomifun-orchestrator, nomifun-public, nomifun-public-agent, nomifun-requirement, nomifun-secret(可选), nomifun-system, nomifun-terminal, nomifun-ai-agent, nomifun-webhook
