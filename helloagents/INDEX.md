# Nomifun 知识库索引

> 版本: 0.2.4 | 更新: 2026-07-06

## 项目概览

Nomifun 是一个基于 Tauri 的 AI Agent 平台，采用 Rust workspace 架构，分为 Agent 层和 Backend 层两大核心模块群。

## 模块索引

### Agent 层 (`crates/agent/`)

| 模块 | 说明 | 详情 |
|------|------|------|
| nomi-types | 基础类型定义 | [nomi-types.md](modules/nomi-types.md) |
| nomi-protocol | 通信协议 | [nomi-protocol.md](modules/nomi-protocol.md) |
| nomi-compact | 紧凑数据格式 | [nomi-compact.md](modules/nomi-compact.md) |
| nomi-config | 配置管理 | [nomi-config.md](modules/nomi-config.md) |
| nomi-providers | LLM 提供商 | [nomi-providers.md](modules/nomi-providers.md) |
| nomi-tools | 工具框架 | [nomi-tools.md](modules/nomi-tools.md) |
| nomi-mcp | MCP 协议 | [nomi-mcp.md](modules/nomi-mcp.md) |
| nomi-skills | 技能系统 | [nomi-skills.md](modules/nomi-skills.md) |
| nomi-memory | 记忆系统 | [nomi-memory.md](modules/nomi-memory.md) |
| nomi-agent | Agent 核心 | [nomi-agent.md](modules/nomi-agent.md) |
| nomi-computer | 计算机控制 | [nomi-computer.md](modules/nomi-computer.md) |
| nomi-a11y | 无障碍辅助 | [nomi-a11y.md](modules/nomi-a11y.md) |
| nomi-browser-engine | 浏览器引擎 | [nomi-browser-engine.md](modules/nomi-browser-engine.md) |
| nomi-browser | 浏览器控制 | [nomi-browser.md](modules/nomi-browser.md) |
| nomi-cli | 命令行接口 | [nomi-cli.md](modules/nomi-cli.md) |

### Backend 层 (`crates/backend/`)

| 模块 | 说明 | 详情 |
|------|------|------|
| nomifun-ai-agent | AI Agent 服务 | [nomifun-ai-agent.md](modules/nomifun-ai-agent.md) |
| nomifun-api-types | API 类型定义 | [nomifun-api-types.md](modules/nomifun-api-types.md) |
| nomifun-app | 应用管理 | [nomifun-app.md](modules/nomifun-app.md) |
| nomifun-assets | 资源管理 | [nomifun-assets.md](modules/nomifun-assets.md) |
| nomifun-assistant | 助手服务 | [nomifun-assistant.md](modules/nomifun-assistant.md) |
| nomifun-auth | 认证鉴权 | [nomifun-auth.md](modules/nomifun-auth.md) |
| nomifun-channel | 通道管理 | [nomifun-channel.md](modules/nomifun-channel.md) |
| nomifun-common | 公共工具 | [nomifun-common.md](modules/nomifun-common.md) |
| nomifun-companion | 伴生服务 | [nomifun-companion.md](modules/nomifun-companion.md) |
| nomifun-conversation | 对话管理 | [nomifun-conversation.md](modules/nomifun-conversation.md) |
| nomifun-cron | 定时任务 | [nomifun-cron.md](modules/nomifun-cron.md) |
| nomifun-db | 数据库层 | [nomifun-db.md](modules/nomifun-db.md) |
| nomifun-extension | 扩展系统 | [nomifun-extension.md](modules/nomifun-extension.md) |
| nomifun-file | 文件服务 | [nomifun-file.md](modules/nomifun-file.md) |
| nomifun-gateway | 网关服务 | [nomifun-gateway.md](modules/nomifun-gateway.md) |
| nomifun-idmm | IDMM 服务 | [nomifun-idmm.md](modules/nomifun-idmm.md) |
| nomifun-knowledge | 知识库服务 | [nomifun-knowledge.md](modules/nomifun-knowledge.md) |
| nomifun-mcp | MCP 服务 | [nomifun-mcp.md](modules/nomifun-mcp.md) |
| nomifun-office | Office 服务 | [nomifun-office.md](modules/nomifun-office.md) |
| nomifun-orchestrator | 编排器 | [nomifun-orchestrator.md](modules/nomifun-orchestrator.md) |
| nomifun-public | 公共 API | [nomifun-public.md](modules/nomifun-public.md) |
| nomifun-public-agent | 公共 Agent | [nomifun-public-agent.md](modules/nomifun-public-agent.md) |
| nomifun-realtime | 实时通信 | [nomifun-realtime.md](modules/nomifun-realtime.md) |
| nomifun-requirement | 需求管理 | [nomifun-requirement.md](modules/nomifun-requirement.md) |
| nomifun-runtime | 运行时 | [nomifun-runtime.md](modules/nomifun-runtime.md) |
| nomifun-secret | 密钥管理 | [nomifun-secret.md](modules/nomifun-secret.md) |
| nomifun-shell | Shell 服务 | [nomifun-shell.md](modules/nomifun-shell.md) |
| nomifun-system | 系统服务 | [nomifun-system.md](modules/nomifun-system.md) |
| nomifun-terminal | 终端服务 | [nomifun-terminal.md](modules/nomifun-terminal.md) |
| nomifun-webhook | Webhook 服务 | [nomifun-webhook.md](modules/nomifun-webhook.md) |
