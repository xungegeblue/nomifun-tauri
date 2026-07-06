# nomifun-webhook

> 路径: `crates/backend/nomifun-webhook/`

## 功能

**Webhook CRUD + 需求完成通知**模块。

- Webhook CRUD：出站 webhook 管理（Lark/Slack/HTTP），per-tag 设置
- 需求完成通知：CompletionNotifierImpl，需求到终态时自动发送卡片通知

## 核心类型

| 类型 | 说明 |
|------|------|
| `WebhookService` | 业务逻辑核心 |
| `WebhookSender` trait | 异步发送接口 |
| `DefaultWebhookSender` | 支持 Lark 交互卡片 + Slack 文本 + 通用 HTTP JSON |
| `CompletionNotifierImpl` | 实现 CompletionNotifier trait |

## 路由

前缀 `/api/webhooks/`：list, create, get, update, delete, test
前缀 `/api/tags/{tag}/settings`：get, upsert

## 依赖

**Workspace 内**: nomifun-common, nomifun-db, nomifun-net, nomifun-api-types, nomifun-auth, nomifun-requirement

## 被依赖

被 1 个 crate 依赖: nomifun-app
