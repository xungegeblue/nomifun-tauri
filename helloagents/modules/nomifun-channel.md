# nomifun-channel

> 路径: `crates/backend/nomifun-channel/`

## 功能

**外部 IM 渠道集成模块**，将多个 IM 平台接入 AI Agent 系统（Telegram/Lark/飞书/DingTalk/WeChat/WeCom/Slack/Discord/Matrix/Mattermost/Twitch/Nostr/QQ Bot）。

核心能力：
- Plugin 系统：每种 IM 平台实现 ChannelPlugin trait
- Pairing 握手：6 位配对码 + 桌面端审批
- Per-session 消息转发与流式回复中继
- Companion / Public Agent 绑定
- Watchdog 健康检查（自动重启）
- 扩展插件支持

## 核心类型

| 类型 | 说明 |
|------|------|
| `PluginType` | 12 种平台枚举 |
| `ChannelPlugin` trait | 核心 trait: initialize/start/stop/send_message/edit_message |
| `ChannelManager` | Plugin 生命周期管理器（DashMap + 加密配置 + watchdog） |
| `ChannelOrchestrator` | 消息生命周期编排器 |
| `ActionExecutor` | 入站消息路由：鉴权 → 动作 → AI 分发 |
| `PairingService` | 配对码生成/审批/过期清理 |
| `ChannelMessageService` | 桥接消息到 Conversation+AI Agent |

## 路由

前缀 `/api/channel/`：plugins(enable/disable/delete/test), pairings(approve/reject), users(revoke), sessions, settings(sync/companion/public-agent), weixin/login/start

## 依赖

**Workspace 内**: nomifun-common, nomifun-db, nomifun-api-types, nomifun-realtime, nomifun-conversation, nomifun-ai-agent, nomifun-extension

## 被依赖

被 2 个 crate 依赖: nomifun-app, nomifun-gateway
