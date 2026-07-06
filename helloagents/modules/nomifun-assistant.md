# nomifun-assistant

> 路径: `crates/backend/nomifun-assistant/`

## 功能

**用户自定义助手(Assistant)全生命周期管理**，核心能力：

- 三源合并查询：built-in（内嵌预设）+ user（用户自建）+ extension（扩展贡献）
- CRUD 操作：用户自建助手创建/更新/删除
- 状态覆盖(Override)：enabled / sort_order / last_used_at / preset_agent_type
- 批量导入（幂等 insert-only）
- Rule/Skill 文件调度：按来源分发 rule 和 skill 文件读写
- Avatar 资源服务
- 标签(Tag)管理：内嵌种子标签 + 用户自建标签
- 默认 Agent 推断：根据已启用 provider 列表智能推断

## 核心类型

| 类型 | 说明 |
|------|------|
| `BuiltinAssistantRegistry` | 内嵌助手内存注册表 |
| `AssistantService` | 核心业务服务 |
| `AvatarAsset` | 头像资源(bytes + extension) |

## 路由

前缀 `/api/assistants`：list, create, update, delete, set_state, avatar, import
前缀 `/api/assistant-tags`：list, create, update, delete

## 依赖

**Workspace 内**: nomifun-common, nomifun-api-types, nomifun-db, nomifun-extension

## 被依赖

被 2 个 crate 依赖: nomifun-app, nomifun-gateway
