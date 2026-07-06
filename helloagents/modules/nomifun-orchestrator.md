# nomifun-orchestrator

> 路径: `crates/backend/nomifun-orchestrator/`

## 功能

**智能编排核心模块**，多 Agent 编队的任务 DAG 规划、调度、执行和生命周期管理。

核心能力：
- 编队 (Fleet) CRUD
- 工作区 (Workspace) CRUD
- Run 控制面：创建/规划/审批/暂停/恢复/取消
- LLM 规划：目标自动拆解为任务 DAG
- 有界并行执行引擎（RunEngine）
- Worker 执行：每个任务在新 Nomi 会话上执行
- 能力路由打分：为任务选择最合适的编队成员
- 实时 WebSocket 事件推送

## 核心类型

| 类型 | 说明 |
|------|------|
| `FleetService` / `WorkspaceService` | 编队/工作区 CRUD |
| `RunService` | Run 控制面 |
| `RunEngine` | 有界并行执行循环 |
| `LlmPlanProducer` / `PlanProducer` trait | LLM 规划接口 |
| `WorkerRunner` trait | Worker 执行接口 |

## 路由

前缀 `/api/orchestrator/`：fleets, workspaces, runs（create/list/cancel/replan/adjust/approve/pause/resume）, runs/{id}/tasks/{task_id}（steer/assignment/rerun/adopt/spec/config）

## 依赖

**Workspace 内**: nomifun-common, nomifun-db, nomifun-api-types, nomifun-auth, nomifun-realtime, nomifun-ai-agent, nomifun-conversation

## 被依赖

被 2 个 crate 依赖: nomifun-app, nomifun-gateway
