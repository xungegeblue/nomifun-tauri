# nomifun-api-types

> 路径: `crates/backend/nomifun-api-types/`

## 功能

**HTTP 请求/响应 DTO 集中定义模块**，36 个子模块覆盖系统全部功能域。纯数据结构定义层，不含业务逻辑或路由。

## 核心类型（按领域）

| 领域 | 核心类型 |
|------|---------|
| 通用响应 | `ApiResponse<T>`, `ErrorResponse` |
| WebSocket | `WebSocketMessage<T>` |
| 会话/消息 | `CreateConversationRequest`, `SendMessageRequest`, `ConversationResponse`, `MessageResponse` |
| ACP | `DetectCliRequest/Response`, `AcpHealthCheckRequest/Response`, `SetModeRequest` |
| Agent | `AgentMetadata`, `AgentHandshake`, `AgentSource`, `AgentErrorCode` |
| 认证 | `LoginRequest/Response`, `AuthStatusResponse`, `UserInfoResponse` |
| Provider/模型 | `CreateProviderRequest`, `ProviderResponse`, `ModelInfo`, `ModelCapability` |
| 编排器 | `Fleet`, `FleetMember`, `Run`, `RunTask`, `CreateRunRequest` |
| 安全暴露 | `ExposureMode`, `ExposureClamp`, `SAFE_PUBLIC_SERVICE_TOOLS` |
| 其他 | channel, cron, extension, file, idmm, knowledge, mcp, office, requirement, skill, terminal, webhook |

## 路由

无。纯类型定义层。

## 依赖

**外部**: serde, serde_json
**Workspace 内**: nomifun-common

## 被依赖

被 23 个 crate 依赖，几乎覆盖全部后端业务 crate: nomifun-app, nomifun-ai-agent, nomifun-channel, nomifun-conversation, nomifun-auth, nomifun-mcp, nomifun-knowledge, nomifun-system, nomifun-assistant, nomifun-shell, nomifun-gateway, nomifun-cron, nomifun-file, nomifun-office, nomifun-extension, nomifun-terminal, nomifun-orchestrator, nomifun-secret(可选), nomifun-public-agent, nomifun-realtime, nomifun-companion, nomifun-requirement, nomifun-webhook, nomifun-idmm
