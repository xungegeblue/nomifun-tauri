# nomifun-idmm

> 路径: `crates/backend/nomifun-idmm/`

## 功能

**IDMM (Intelligent Decision-Making Mode) — 智能值守/智能决策模块**。

为每个会话和终端提供自动监督，在 agent 遇到故障或决策停滞时自动恢复。

核心能力：
- 故障值守：检测 LLM provider 错误（429/500/503/超时），自动重试或故障转移
- 决策值守：检测 agent 选择题，自动选择或交由旁路模型决策
- 双层级策略：Rule 层（纯规则）+ RulePlusModel 层（规则优先，升级到旁路备份模型）
- 开放式问答：纯问答式问题仅由模型层回答

## 核心类型

| 类型 | 说明 |
|------|------|
| `SessionSignal` | 标准化监督信号: Working/ProviderError/Idle/Decision/Done 等 |
| `WakeAction` | 注入动作: Retry/SendText/AnswerChoice/Confirm/Failover/Wait/Stop |
| `IdmmManager` | 生命周期管理器，DashMap<IdmmKey, SupervisorHandle> |
| `SidecarClient` | 旁路备份模型调用器 |
| `SessionProbe` trait | 探针抽象: observe/inject/snapshot_context |

## 路由

前缀 `/api/idmm/`：set_idmm, settings(GET/PUT), activity(GET/DELETE), {kind}/{target_id}(GET/intervene/log)

## 依赖

**Workspace 内**: nomifun-common, nomifun-db, nomifun-api-types, nomifun-realtime, nomifun-conversation, nomifun-ai-agent, nomifun-terminal, nomifun-requirement, nomifun-auth

## 被依赖

被 2 个 crate 依赖: nomifun-app, nomifun-gateway
