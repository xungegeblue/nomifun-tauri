# nomifun-requirement

> 路径: `crates/backend/nomifun-requirement/`

## 功能

**需求平台核心后端模块**，提供需求 CRUD + AutoWork 编排器。

核心能力：
- Requirement CRUD：增删改查、状态流转、标签管理、看板视图、附件管理
- AutoWork 编排器：为绑定会话自动认领待处理需求，注入提示词驱动 AI 代理执行
- 需求状态机：Pending → InProgress → Done/Failed/NeedsReview/Cancelled
- 失败重试（最多 3 次）、标签暂停/恢复、Lease 机制
- IDMM 集成、MCP 服务器（requirement_complete/requirement_update_status）

## 核心类型

| 类型 | 说明 |
|------|------|
| `RequirementService` | 业务逻辑核心 |
| `Orchestrator` | AutoWork 编排器，per-target 工作循环 + lease sweeper |
| `AutoWorkHandle` | 单个 AutoWork 循环句柄 |
| `RequirementMcpServer` | 进程内 HTTP MCP 服务器 |
| `IdmmHandle` trait | IDMM 集成 seam |
| `CompletionNotifier` trait | 需求终态通知 |

## 路由

前缀 `/api/requirements/`：list, create, tags, tag-bindings, board, batch-delete, claim, autowork, {id}(CRUD+status+complete)

## 依赖

**Workspace 内**: nomifun-common, nomifun-db, nomifun-api-types, nomifun-file, nomifun-realtime, nomifun-conversation, nomifun-ai-agent, nomifun-terminal, nomifun-auth

## 被依赖

被 4 个 crate 依赖: nomifun-app, nomifun-gateway, nomifun-idmm, nomifun-webhook
