# nomifun-db

> 路径: `crates/backend/nomifun-db/`

## 功能

**SQLite 数据库持久层**，提供：

- 数据库初始化与生命周期管理（文件型/内存型 SQLite，WAL 模式，foreign keys）
- 数据库迁移（sqlx::migrate!()，跨进程文件锁 MigrateLockGuard，UNIQUE 冲突重试）
- 损坏恢复与 pre-baseline 重建
- Repository 模式：为每个业务领域定义 trait 接口（IXxxRepository）+ SQLite 实现
- 数据模型（Row 结构体）：与数据库表一一对应
- 统一错误类型 DbError，自动转换为 AppError

## 核心类型

**25 个 Repository Trait**: IAssistantRepository, IConversationRepository, IChannelRepository, IProviderRepository, IKnowledgeRepository, IMcpServerRepository, ICronRepository, IAcpSessionRepository, IRemoteAgentRepository, IConnectorCredentialRepository, IOAuthTokenRepository, IWebhookRepository, ITerminalRepository, IUserRepository, IRequirementRepository, ISkillTagRepository, ITagSettingRepository, IAgentMetadataRepository, IAttachmentRepository, IClientPreferenceRepository, ICompanionTokenRepository, IIdmmInterventionRepository, ISettingsRepository, IFleetRepository, IRunRepository

**Model 层**: AssistantRow, ConversationRow, MessageRow, ChannelPluginRow, Provider, KnowledgeBaseRow, McpServerRow, CronJobRow, AcpSessionRow, RemoteAgentRow, WebhookRow, TerminalSessionRow, User, RequirementRow, FleetRow, OrchRunRow 等

**核心**: Database(SqlitePool), DbError(Query/Migration/NotFound/Conflict/Init)

## 路由

无。纯数据库层。

## 依赖

**外部**: sqlx(migrate), async-trait, fs2, serde, serde_json, thiserror, tracing
**Workspace 内**: nomifun-common

## 被依赖

被 19 个 crate 依赖: nomifun-app, nomifun-gateway, nomifun-assistant, nomifun-conversation, nomifun-channel, nomifun-ai-agent, nomifun-orchestrator, nomifun-knowledge, nomifun-mcp, nomifun-cron, nomifun-system, nomifun-terminal, nomifun-auth, nomifun-webhook, nomifun-extension, nomifun-shell, nomifun-companion, nomifun-idmm, nomifun-requirement
