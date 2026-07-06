# nomifun-app

> 路径: `crates/backend/nomifun-app/`

## 功能

**应用组装层（application assembly crate）**，整个后端系统的入口和胶水代码。

- 将所有领域 crate（约 30 个 nomifun-*）组装成完整 Axum HTTP 服务器
- 通过 AppServices 实现依赖注入（DI）
- 构建路由器（Router），配置中间件栈（安全头、CSRF、认证、信任解析、CORS）
- 提供 nomicore 二进制入口和 Tauri 嵌入式库入口
- 管理 CLI 子命令（MCP stdio 桥、doctor、tools、call、agent 等）
- 管理桌面双监听器架构（loopback + LAN）

## 核心类型

| 类型 | 说明 |
|------|------|
| `AppConfig` | 应用配置: host/port/data_dir/work_dir/auth_policy |
| `AppServices` | 核心服务容器（~30 个字段） |
| `ModuleStates` | 模块路由状态集合（~22 个 RouterState） |
| `DesktopServer` | 桌面进程内服务器（loopback + LAN 双监听器） |

## 路由

组装各领域 crate 路由，挂载点：/health, /ws, /api/auth/*, /api/system/*, /api/conversations/*, /api/agents/*, /api/fs/*, /api/mcp/*, /api/extensions/*, /api/channels/*, /api/cron/*, /api/requirements/*, /api/idmm/*, /api/companions/*, /api/knowledge/*, /api/webhooks/*, /api/orchestrator/*, /api/secrets/*, /api/terminals/*, /api/office/*, /api/shell/*, /api/assistants/*, /mcp, /mcp-agent, /v1

## 依赖

**Workspace 内（28个nomifun-*）**: nomifun-common, nomifun-assets, nomifun-db, nomifun-api-types, nomifun-realtime, nomifun-auth, nomifun-system, nomifun-file, nomifun-office, nomifun-shell, nomifun-ai-agent, nomifun-mcp, nomifun-conversation, nomifun-extension, nomifun-channel, nomifun-cron, nomifun-requirement, nomifun-idmm, nomifun-knowledge, nomifun-orchestrator, nomifun-companion, nomifun-public-agent, nomifun-gateway, nomifun-public, nomifun-webhook, nomifun-secret, nomifun-terminal, nomifun-assistant, nomifun-runtime, nomifun-net
**可选**: nomi-computer, nomi-browser, nomi-browser-engine, nomi-config, nomi-tools, nomi-types

## 被依赖

被 2 个 crate 依赖: apps/desktop(Tauri壳), apps/web
