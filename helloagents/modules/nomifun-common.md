# nomifun-common

> 路径: `crates/backend/nomifun-common/`

## 功能

**后端共享基础库**，提供跨 crate 复用的原语：错误类型、枚举、ID 生成、加解密、时间戳、分页、构建通道管理、工厂重置、生命周期钩子等。是后端 crate 间最底层的公共依赖层。

## 核心类型

| 模块 | 关键类型 | 说明 |
|------|---------|------|
| error | `AppError` | 统一应用错误枚举（15变体），实现 IntoResponse 可直接作为 axum 响应 |
| enums | `AgentType`, `ConversationStatus`, `MessageType`, `ProtocolType`, `RemoteAgentProtocol`, `McpSource` 等 | 核心领域枚举 |
| types | `EnvVar`, `CommandSpec`, `ProviderWithModel`, `Confirmation` | 环境变量/命令规格/模型选择/工具确认 |
| id | `generate_id()`, `generate_prefixed_id()` | UUID v7 + 带前缀短 ID（16字符base32体，可排序） |
| crypto | `encrypt_string()`, `decrypt_string()` | AES-256-GCM 加解密 |
| pagination | `PaginatedResult<T>` | 通用分页结果 |
| channel | `channel()`, `dir_suffix()` | 编译期构建通道（stable/dev/beta/canary） |
| factory_reset | `ResetMarker`, `ResetScope` | 工厂重置标记与执行 |
| hooks | `OnConversationDelete`, `OnTerminalDelete`, `RequirementCreator` | 跨 crate 生命周期钩子 trait |
| dir_config | `DirConfig` | 启动前工作目录持久化 |
| provider_usage | `ProviderUsage`, `ProviderInUseDetails` | Provider 被引用情况 |
| vision_registry | `VisionUnsupportedRegistry` | 记录不支持图片输入的 (provider, model) |

## 路由

无。仅提供 AppError（实现 IntoResponse），路由定义在上层 crate 中。

## 依赖

**外部**: thiserror, serde, serde_json, uuid, aes-gcm, async-trait, axum, base64, getrandom, semver, tracing
**Workspace 内**: 无（叶子节点）

## 被依赖

被 30 个 crate 依赖，几乎是全部业务 crate：nomifun-app, nomifun-gateway, nomifun-api-types, nomifun-db, nomifun-auth, nomifun-conversation, nomifun-ai-agent, nomifun-system, nomifun-shell, nomifun-secret, nomifun-requirement, nomifun-public-agent, nomifun-knowledge, nomifun-cron, nomifun-idmm, nomifun-orchestrator, nomifun-assistant, nomifun-office, nomifun-assets, nomifun-companion, nomifun-extension, nomifun-file, nomifun-mcp, nomifun-channel, nomifun-webhook, nomifun-terminal, nomi-browser-engine
