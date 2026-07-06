# nomifun-conversation

> 路径: `crates/backend/nomifun-conversation/`

## 功能

**会话核心模块**，负责会话 CRUD、消息流管理、流式事件中继、确认系统、消息中间件、模型故障转移等。

核心能力：
- 会话 CRUD（创建/读取/更新/删除/重置/克隆）
- 消息流管理与流式事件中继（StreamRelay）
- 确认系统：工具调用人工审批/自动审批
- 消息中间件：剥离 `<think>` 标签、检测嵌入式 Cron 命令
- 模型故障转移（Failover）
- MCP 服务器选择与状态管理
- 知识库挂载、技能解析

## 核心类型

| 类型 | 说明 |
|------|------|
| `ConversationService` | 核心服务 |
| `StreamRelay` | 流式事件消费与 WS 转发 + 持久化 |
| `MessageMiddleware` | 后处理管道（strip think + cron 检测） |
| `FailoverSwitch` | 故障转移结果 |
| `TurnClaim` | 轮次占位令牌 |

## 路由

**主路由**: POST /api/conversations, GET /api/conversations, GET/PATCH/DELETE /api/conversations/{id}, POST /api/conversations/{id}/reset, GET/POST /api/conversations/{id}/messages, POST /api/conversations/{id}/cancel, POST /api/conversations/{id}/steer, GET/POST /api/conversations/{id}/confirmations/{callId}/confirm 等
**辅助路由**: POST /api/conversations/{id}/side-question, GET/PUT /api/conversations/{id}/mode, GET/PUT /api/conversations/{id}/model, POST /api/conversations/{id}/clear-context 等

## 依赖

**Workspace 内**: nomifun-common, nomifun-db, nomifun-api-types, nomifun-realtime, nomifun-auth, nomifun-ai-agent, nomifun-extension, nomifun-file, nomifun-knowledge, nomifun-mcp, nomifun-runtime

## 被依赖

被 8 个 crate 依赖: nomifun-app, nomifun-cron, nomifun-orchestrator, nomifun-companion, nomifun-idmm, nomifun-channel, nomifun-gateway, nomifun-requirement
