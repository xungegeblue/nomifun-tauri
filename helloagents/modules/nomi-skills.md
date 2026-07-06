# nomi-skills

> 路径: `crates/agent/nomi-skills/`

## 功能

**技能系统核心模块**，管理命名提示片段（named prompt snippets）的完整生命周期。

核心能力：
- 技能发现与加载（文件系统用户级/项目级/管理级 + MCP 服务器）
- YAML Frontmatter 解析 + Markdown 正文处理
- 变量替换（$ARGUMENTS、命名参数、${NOMI_SKILL_DIR}、${NOMI_SESSION_ID}）
- Shell 命令执行（`` ```! `` 块级和 `` !` ` `` 行内）
- 条件技能激活（基于文件路径 glob 匹配）
- 权限检查（5 步决策链: deny/allow 规则、安全属性、auto_approve）
- Hook 集成（PreToolUse/PostToolUse/Stop 钩子）
- Fork 执行（通过 Spawner 在独立子代理中执行）
- 文件监听（notify watch channel 广播版本号）
- 内建技能（编译时注册，支持安全文件提取）
- Prompt 格式化（三级降级策略）

## 核心类型

| 类型 | 说明 |
|------|------|
| `SkillMetadata` | 标准化后的技能元数据（20+ 字段） |
| `FrontmatterData` | YAML frontmatter 原始反序列化目标 |
| `ParsedMarkdown` | 解析后的 Markdown（frontmatter + body） |
| `ExecutionContext` | 枚举: Inline / Fork |
| `SkillSource` | 枚举: User / Project / Managed / Bundled / Mcp / Legacy |
| `ConditionalSkillManager` | 条件技能管理器（休眠/激活状态机） |
| `SkillPermissionChecker` | 权限检查器（5 步决策链） |
| `SkillWatcher` | 基于 notify 的技能目录文件监听器 |
| `RuntimeDiscovery` | 运行时动态发现 `.nomi/skills/` 目录 |

## 路由

无。纯库 crate，通过 MCP 协议获取技能资源。

## 依赖

**外部**: tracing, serde, serde_json, serde_yaml, tokio, futures, async-trait, thiserror, glob, dirs, regex, notify, unicode-width
**Workspace 内**: nomi-types, nomi-config, nomi-mcp

## 被依赖

被 2 个 crate 依赖: nomi-agent, nomi-cli
