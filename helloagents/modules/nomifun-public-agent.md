# nomifun-public-agent

> 路径: `crates/backend/nomifun-public-agent/`

## 功能

**对外伙伴 / Public Companion 域**：面向陌生人的企业级客服 Agent。与桌面伙伴完全独立——独立数据目录、独立配置模型。

核心能力：Q&A + 基于知识库的接地检索 (grounded retrieval)，所有危险工具关闭。

## 核心类型

| 类型 | 说明 |
|------|------|
| `PublicAgentConfig` | 单个对外伙伴完整配置 |
| `PublicAgentRegistry` | 内存花名册 + 持久化序列号水位线 |
| `AuditEntry` / `AuditPage` | 审计记录与分页 |
| `PublicAgentService` | 门面服务 |

## 路由

前缀 `/api/public-agents/`：list, create, get, patch, delete, audit(get/delete)

## 依赖

**Workspace 内**: nomifun-common, nomifun-api-types, nomifun-auth, nomifun-ai-agent

## 被依赖

被 1 个 crate 依赖: nomifun-app
