# nomifun-realtime

> 路径: `crates/backend/nomifun-realtime/`

## 功能

**WebSocket 连接管理、事件广播和消息路由**模块。

核心能力：
- WebSocket 升级处理（HTTP 升级为 WS，含 JWT 提取验证）
- 连接生命周期管理（注册/移除、30s 心跳 ping、60s 超时断开、token 过期检测）
- 消息广播与单播
- 事件总线（基于 tokio::sync::broadcast 的发布-订阅）
- 消息路由（MessageRouter trait，内置处理 pong 和 subscribe-show-open）
- 文件/目录选择器桥接

## 核心类型

| 类型 | 说明 |
|------|------|
| `ConnectionId(u64)` | 连接唯一标识 |
| `WsOutbound` | 出站消息: Text(String) / Close |
| `WebSocketManager` | 核心连接管理器，DashMap 存储 |
| `EventBroadcaster` trait | 广播接口 |
| `BroadcastEventBus` | 基于 tokio broadcast channel 的实现 |
| `MessageRouter` trait | 路由接口: route(conn_id, name, data) |
| `WsHandlerState` | 升级处理器共享状态 |

## 路由

提供 `ws_upgrade_handler`，需由上层挂载到路由（如 `/ws`）。具体注册在 nomifun-app。

## 依赖

**外部**: axum, tokio, dashmap, futures-util, serde_json, tracing
**Workspace 内**: nomifun-api-types

## 被依赖

被 15 个 crate 依赖: nomifun-app, nomifun-terminal, nomifun-file, nomifun-requirement, nomifun-extension, nomifun-assistant, nomifun-orchestrator, nomifun-knowledge, nomifun-office, nomifun-idmm, nomifun-companion, nomifun-conversation, nomifun-channel, nomifun-ai-agent, nomifun-cron
