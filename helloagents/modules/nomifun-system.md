# nomifun-system

> 路径: `crates/backend/nomifun-system/`

## 功能

**系统管理服务层**，负责：

- Provider（模型提供商）CRUD，API Key 加密存储
- 模型列表拉取（16+ 平台）
- API 协议探测（OpenAI/Anthropic/Gemini）
- 系统设置读写
- 客户端偏好（通用 key-value）
- Bedrock 连接测试
- 版本更新检查（GitHub Releases）
- 工厂重置、工作目录设置

## 核心类型

| 类型 | 说明 |
|------|------|
| `ProviderService` | Provider CRUD |
| `ModelFetchService` | 模型拉取 |
| `ProtocolDetectionService` | 协议探测 |
| `SettingsService` | 系统设置 |
| `ClientPrefService` | 客户端偏好 |
| `VersionCheckService` | 版本检查 |
| `ProviderDeletionCoordinator` trait | 删除协调器接口 |

## 路由

前缀 `/api/`：settings(GET/PATCH), settings/client(GET/PUT), providers(CRUD+fetch-models+detect-protocol), system/info, system/check-update, system/factory-reset, system/work-dir, bedrock/test-connection

## 依赖

**Workspace 内**: nomifun-auth, nomifun-common, nomifun-db, nomifun-net, nomifun-api-types

## 被依赖

被 3 个 crate 依赖: nomifun-gateway, nomifun-shell, nomifun-app
