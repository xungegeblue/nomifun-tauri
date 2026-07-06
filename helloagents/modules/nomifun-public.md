# nomifun-public

> 路径: `crates/backend/nomifun-public/`

## 功能

**Remote 前门**（外部伙伴入口），将平台能力注册中心（nomifun-gateway::Registry）投影到网络可达的、companion-token 认证的端点。

提供两个适配器：
- MCP Streamable-HTTP 适配器（/mcp）— 供 MCP 协议客户端
- REST /v1 适配器 — 供人/脚本直接 HTTP 调用

## 核心类型

| 类型 | 说明 |
|------|------|
| `RemoteMcpHandler` | rmcp ServerHandler 实现，持有 GatewayDeps |
| `RemoteCompanion` | token 中间件验证后的 companion ID |
| `RestState` | REST 路由状态 |

## 路由

**MCP**（/mcp）：Streamable-HTTP 协议，companion_token 认证
**REST**（/v1）：GET /tools, POST /tools/{name}, POST /tools/{name}/stream, GET /openapi.json

## 依赖

**Workspace 内**: nomifun-gateway（Registry/GatewayDeps/Surface/ToolSpec）, nomifun-auth（CompanionTokenValidator）

## 被依赖

被 1 个 crate 依赖: nomifun-app
