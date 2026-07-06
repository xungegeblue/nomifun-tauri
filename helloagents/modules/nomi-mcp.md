# nomi-mcp

> 路径: `crates/agent/nomi-mcp/`

## 功能

**MCP (Model Context Protocol) 客户端实现**，负责连接 MCP 服务器、发现工具和资源、调用远程工具。

核心能力：
- 连接多个 MCP 服务器（Stdio / SSE / Streamable HTTP 三种传输）
- 执行 MCP 握手（initialize + notifications/initialized）
- 发现并列举工具（tools/list）和资源（resources/list、resources/read）
- 调用远程工具（tools/call），支持文本和图像多模态返回
- 将 MCP 工具代理为本地 `nomi_tools::Tool` trait 实现

## 核心类型

| 类型 | 说明 |
|------|------|
| `McpManager` | 管理多个 MCP 服务器连接的核心入口 |
| `McpServer` (内部) | 单个已连接的服务器（transport + tools + supports_resources） |
| `McpCallOutput` / `McpImageOut` | 工具调用的结构化输出（文本和图像分离） |
| `McpTransport` trait | 传输抽象（request / notify / close） |
| `StdioTransport` | 子进程 stdin/stdout 通信，支持自动 respawn |
| `SseTransport` | SSE 事件流 + HTTP POST |
| `StreamableHttpTransport` | 纯 HTTP POST，支持可选 SSE 流式响应 |
| `McpToolProxy` | 将 MCP 远程工具包装为本地 Tool trait 实现 |
| `McpError` | 统一错误类型 |

## 路由

无。纯客户端库，作为 MCP 客户端向外发起连接。

## 依赖

**外部**: tracing, tokio, serde, serde_json, async-trait, thiserror, reqwest, futures
**Workspace 内**: nomi-types, nomi-protocol, nomi-tools, nomi-config

## 被依赖

被 4 个 crate 依赖: nomi-agent, nomi-cli, nomi-skills, nomifun-ai-agent
