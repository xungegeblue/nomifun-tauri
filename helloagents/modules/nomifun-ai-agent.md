# nomifun-ai-agent

> 路径: `crates/backend/nomifun-ai-agent/`

## 功能

**AI Agent 生命周期管理核心模块**，负责：

- Agent 工厂与实例构建：根据 AgentType（Acp/Nomi/OpenClaw/Nanobot/Remote）创建实例
- Agent 任务调度：AgentInstance 统一调度入口，实现 IAgentTask trait
- Agent 注册表：从 DB hydrate 元数据，探测 PATH 可用性
- 流式事件协议：AgentStreamEvent 统一广播格式
- 技能/能力管理：AcpSkillManager
- 知识库集成：LiveKnowledgeCompleter/RetrievalSink/WritebackSink
- HTTP 路由：agent 列表/CRUD 与远程 agent 管理
- Agent 层 seam re-export：其他 crate 通过此 crate 访问 nomi-agent/nomi-config/nomi-types

## 核心类型

| 类型 | 说明 |
|------|------|
| `AgentInstance` | 五种 agent 闭集枚举分发器 |
| `IAgentTask` | 统一 10 方法 async trait（send_message, cancel, kill 等） |
| `AgentStreamEvent` | 流式事件枚举（20+ 变体） |
| `AgentRegistry` | Agent 元数据目录进程内快照 |
| `AgentFactoryDeps` | Agent 工厂依赖聚合 |
| `NomiResolvedConfig` | Nomi 引擎完整解析配置 |

## 路由

**Agent 路由**: GET /api/agents, POST /api/agents/refresh, POST /api/agents/health-check, PATCH /api/agents/{id}/enabled, POST/PUT/DELETE /api/agents/custom/*
**Remote Agent 路由**: GET/POST /api/remote-agents, GET/PUT/DELETE /api/remote-agents/{id}, POST /api/remote-agents/test-connection, POST /api/remote-agents/{id}/handshake

## 依赖

**Workspace 后端（11个）**: nomifun-auth, nomifun-common, nomifun-db, nomifun-mcp, nomifun-runtime, nomifun-extension, nomifun-knowledge, nomifun-terminal, nomifun-api-types, nomifun-net, nomifun-secret
**Workspace Agent 层（8个）**: nomi-agent, nomi-types, nomi-protocol, nomi-config, nomi-mcp, nomi-providers, nomi-memory, nomi-redact
**可选**: nomi-browser-engine, nomi-browser(browser-use feature)

## 被依赖

被 10 个 crate 依赖: nomifun-app, nomifun-conversation, nomifun-cron, nomifun-channel, nomifun-companion, nomifun-orchestrator, nomifun-gateway, nomifun-public-agent, nomifun-requirement, nomifun-idmm
