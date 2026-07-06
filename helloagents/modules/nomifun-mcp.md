# nomifun-mcp

> 路径: `crates/backend/nomifun-mcp/`

## 功能

**MCP 服务器管理核心业务模块**，负责：

- MCP 服务器 CRUD 配置管理（增删改查、开关、批量导入）
- 多 Agent CLI 配置发现（扫描 Claude/Gemini/Qwen/Codex/CodeBuddy/Nomi/Nomifun/Opencode）
- MCP 连接测试（Stdio/HTTP/SSE 三种传输协议 JSON-RPC 2.0 握手）
- OAuth 2.0 PKCE 认证（完整生命周期：端点发现→授权→回调→Token交换/刷新/登出）
- ACP 会话 MCP 注入（将 MCP 配置转换为 ACP 格式）

## 核心类型

| 类型 | 说明 |
|------|------|
| `McpServer` | 领域层 MCP 服务器模型 |
| `McpServerTransport` | 传输配置: Stdio / Sse / Http |
| `McpTool` | 工具描述 |
| `McpAgentAdapter` trait | Agent CLI 适配器接口 |
| `AcpSessionMcpServer` | ACP 会话 MCP 格式 |
| `McpConfigService` | CRUD 服务 |
| `McpSyncService` | Agent 配置发现服务 |
| `McpConnectionTestService` | 连接测试服务 |
| `McpOAuthService` | OAuth PKCE 服务 |

## 路由

前缀 `/api/mcp/`：servers(CRUD+toggle+import), test-connection, agent-configs, oauth(check-status/login/logout/authenticated)

## 依赖

**Workspace 内**: nomifun-runtime, nomifun-common, nomifun-db, nomifun-api-types, nomifun-net

## 被依赖

被 4 个 crate 依赖: nomifun-gateway, nomifun-conversation, nomifun-app, nomifun-ai-agent
