# nomifun-cron

> 路径: `crates/backend/nomifun-cron/`

## 功能

**定时任务调度引擎**，定时/周期性触发 AI Agent 执行任务。

核心能力：
- 三种调度模式：一次性(At)、固定间隔(Every)、Cron 表达式(Cron，支持时区)
- 任务执行：通过 Agent 会话发送消息，支持复用/新建会话
- Skill 管理：维护 SKILL.md，支持自动建议
- 生命周期事件 WS 广播
- 系统恢复：唤醒后重新调度，标记错过的任务
- 重试机制、孤立任务清理

## 核心类型

| 类型 | 说明 |
|------|------|
| `CronJob` | 核心领域模型 |
| `CronSchedule` | 调度策略: At / Every / Cron |
| `ExecutionMode` | Existing / NewConversation |
| `CronScheduler` | DashMap<String, JoinHandle> 管理所有定时器 |
| `CronBusyGuard` | 并发保护 |

## 路由

前缀 `/api/cron/`：jobs(CRUD+run/runs/conversations/skill), internal/system-resume

## 依赖

**Workspace 内**: nomifun-common, nomifun-db, nomifun-api-types, nomifun-realtime, nomifun-conversation, nomifun-ai-agent, nomifun-auth

## 被依赖

被 2 个 crate 依赖: nomifun-app, nomifun-gateway
