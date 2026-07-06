# nomifun-extension

> 路径: `crates/backend/nomifun-extension/`

## 功能

**扩展系统核心模块**，负责：

- 扩展清单解析与校验（nomi-extension.json，支持 camelCase/snake_case、$file: 引用）
- 扩展注册中心：加载、启用/禁用、贡献解析、热重载、WS 事件广播
- 扩展 Hub：在线安装/更新/卸载
- Skill 管理：内置/用户/外部技能扫描、导入、导出、symlink、assistant rule/skill CRUD
- 生命周期钩子：onInstall/onUninstall/onActivate/onDeactivate（带超时）
- 文件监视与热重载
- 权限与风险评估：Safe/Moderate/Dangerous

## 核心类型

| 类型 | 说明 |
|------|------|
| `ExtensionManifest` | 扩展清单 |
| `ExtContributes` | 贡献声明: acp_adapters/mcp_servers/assistants/agents/skills/themes/channel_plugins 等 |
| `LoadedExtension` | 已加载扩展 = manifest + directory + source + state |
| `ExtensionRegistry` | 核心注册中心（Arc<RwLock<RegistryInner>>） |
| `ResolvedContributions` | 所有已启用扩展的解析后贡献汇总 |
| `RiskLevel` | Safe / Moderate / Dangerous |

## 路由

**Extension**: /api/extensions/*（列出/启用/禁用/资源/i18n/permissions/risk-level）
**Hub**: /api/hub/*（列表/安装/更新/卸载/check-updates）
**Skill**: /api/skills/*（22个端点：列表/导入/导出/删除/扫描/发现/rule/skill CRUD）

## 依赖

**Workspace 内**: nomifun-common, nomifun-api-types, nomifun-db, nomifun-realtime, nomifun-runtime

## 被依赖

被 7 个 crate 依赖: nomifun-gateway, nomifun-app, nomifun-assistant, nomifun-conversation, nomifun-companion, nomifun-ai-agent, nomifun-channel
