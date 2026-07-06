# nomifun-gateway

> 路径: `crates/backend/nomifun-gateway/`

## 功能

**Nomi Desktop 的网关 MCP 工具服务器**，进程内 HTTP 服务器，将桌面能力暴露给 agent 会话。

核心能力：
- 远程 IM/伴侣线程通过 nomicore mcp-gateway-stdio 桥接器连接本网关
- 工具调用作为 POST /tool 请求转发
- 全局 Capability Registry（135+ 个能力），JSON Schema 生成、权限门控、异步处理

## 核心类型

| 类型 | 说明 |
|------|------|
| `GatewayDeps` | 所有网关工具运行所需服务依赖集合（~30个字段） |
| `CallerCtx` | 调用者身份上下文: conversation_id, user_id, companion_id, channel_platform |
| `GatewayMcpServer` | 进程内 HTTP MCP 服务器实例 |
| `Registry` | 全局能力注册表（OnceLock 单例，BTreeMap<&str, Capability>） |
| `Capability` / `CapabilityMeta` | 能力：元数据 + input_schema + Handler |
| `DangerTier` | 操作危险等级: Read / Write / Destructive / Sensitive |
| `Surface` | 调用来源: Desktop / Channel / Remote |
| `ToolSpec` | 暴露给 MCP 客户端的工具规格 |

## 路由

**HTTP**: POST /tool（统一工具调用入口，Bearer token 认证）
**逻辑层（22个caps_*模块）**: caps_agent, caps_autowork, caps_browser, caps_channel, caps_companion, caps_computer, caps_confirmation, caps_conversation, caps_cron, caps_files, caps_idmm, caps_knowledge, caps_mcp, caps_memory, caps_orchestrator, caps_provider, caps_requirement, caps_system, caps_terminal 等

## 依赖

**Workspace 内**: nomifun-common, nomifun-api-types, nomifun-conversation, nomifun-cron, nomifun-requirement, nomifun-companion, nomifun-ai-agent, nomifun-db, nomifun-terminal, nomifun-idmm, nomifun-knowledge, nomifun-assistant, nomifun-orchestrator, nomifun-system, nomifun-channel, nomifun-file, nomifun-shell, nomifun-mcp, nomifun-extension
**可选**: nomi-browser, nomi-computer, nomifun-secret, nomi-types, nomi-config, nomi-tools

## 被依赖

被 2 个 crate 依赖: nomifun-app, nomifun-public
