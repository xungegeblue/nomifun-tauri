# nomi-cli

> 路径: `crates/agent/nomi-cli/`

## 功能

**Nomi AI 代理的命令行入口**（二进制 crate，`[[bin]] name = "nomi"`），提供两种运行模式：

- **交互式 REPL 模式**（默认）：终端中与 AI 代理多轮对话
- **JSON 流式模式**（`--json-stream`）：通过 stdin/stdout JSON 协议与宿主客户端（如 Tauri 桌面应用）通信，支持工具审批、动态添加 MCP 服务器、运行时配置变更

辅助功能：OAuth 登录/登出、配置文件初始化、会话列表/恢复、skills 路径查询。

## 核心类型

| 类型 | 说明 |
|------|------|
| `Cli` | 基于 clap::Parser 的命令行参数（provider, api_key, model, max_tokens, json_stream, resume 等约 20 个字段） |
| `PendingConfig` | 待应用的配置变更（model, thinking, thinking_budget, effort, compaction） |

协议命令（stdin 输入）：Message / ToolApprove / ToolDeny / AddMcpServer / SetConfig / SetMode / Stop / Ping / InitHistory

## 路由

无。CLI 工具，不启动 HTTP 服务器。JSON 流式模式通过 stdin/stdout 管道通信。

## 依赖

**Workspace 内**: nomi-agent, nomi-compact, nomi-config, nomi-memory, nomi-providers, nomi-tools, nomi-mcp, nomi-protocol, nomi-skills
**外部**: tokio, anyhow, clap, tracing, tracing-subscriber

## 被依赖

无。终端二进制 crate，不被其他 crate 依赖。
