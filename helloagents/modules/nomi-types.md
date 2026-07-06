# nomi-types

> 路径: `crates/agent/nomi-types/`

## 功能

纯数据类型 crate，为整个 Nomi agent 体系提供**与 LLM 提供商无关的共享数据类型**。不包含任何业务逻辑或 HTTP 路由，只定义核心数据结构。

## 核心类型

| 模块 | 核心类型 | 说明 |
|------|---------|------|
| llm.rs | `LlmRequest`, `LlmEvent`, `ThinkingConfig` | LLM 请求结构及流式事件枚举（TextDelta/ToolUse/ThinkingDelta/Done/Error） |
| message.rs | `Message`, `ContentBlock`, `Role`, `StopReason`, `TokenUsage` | 对话消息与内容块（Text/ToolUse/ToolResult/Thinking/Image 五种变体） |
| tool.rs | `ToolDef`, `ToolResult`, `ToolImage`, `JsonSchema` | 工具定义与执行结果 |
| compact.rs | `CompactTrigger`, `CompactMetadata` | 上下文压缩元数据 |
| file_state.rs | `FileState` | 文件缓存状态（Read/Edit/Write 工具去重与过期检查） |
| skill_types.rs | `EffortLevel`, `PlanModeTransition`, `ContextModifier` | 技能执行相关类型 |
| spawner.rs | `SubAgentConfig`, `ForkOverrides`, `SubAgentResult`, `Spawner` trait | 子 agent 配置与执行 |

## 路由

无。纯类型定义 crate。

## 依赖

**外部**: serde, serde_json, async-trait, chrono
**Workspace 内**: 无（零内部依赖，是叶子节点）

## 被依赖

被 10 个 workspace crate 依赖：nomi-tools, nomi-skills, nomi-providers, nomi-mcp, nomi-config, nomi-computer, nomi-browser, nomi-agent, nomi-a11y, nomifun-ai-agent, nomifun-app(可选), nomifun-gateway(可选)
