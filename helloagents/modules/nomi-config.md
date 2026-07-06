# nomi-config

> 路径: `crates/agent/nomi-config/`

## 功能

**配置层核心 crate**，负责运行时配置的定义、解析和合并。

核心能力：
- 从全局配置 (`~/.config/nomi/config.toml`) 和项目配置 (`.nomi.toml`) 加载并合并
- Provider 别名解析、Profile 继承、API Key 解析（CLI > config > env var > OAuth）
- 多 Provider 兼容性适配（Anthropic/OpenAI/Bedrock/Vertex）
- OAuth 2.0 Device Authorization Flow 认证
- Hook 系统（工具前后置钩子）
- 上下文压缩、文件缓存、日志、Plan Mode、Shell 等子配置
- 特性标志注册表（灰度发布）

## 核心类型

| 类型 | 说明 |
|------|------|
| `Config` | 解析后的运行时配置 |
| `ConfigFile` | TOML 文件原始反序列化结构 |
| `CliArgs` | CLI 参数输入 |
| `ProviderType` | 枚举: Anthropic / OpenAI / Bedrock / Vertex |
| `ProviderConfig` | 单个 provider 配置（api_key, base_url, compat） |
| `ProfileConfig` | 命名 profile，支持 `extends` 继承链 |
| `ProviderCompat` | Provider 兼容性层（字段名映射、消息合并、schema 清洗） |
| `ToolsConfig` | 工具确认、allow_list、persistent_shell、write_root 等 |
| `HooksConfig` / `HookDef` / `HookEngine` | Hook 系统（pre_tool_use / post_tool_use / stop） |
| `CompactConfig` | 上下文压缩配置 |
| `OAuthCredentials` / `OAuthManager` | OAuth 2.0 Device Flow 实现 |
| `Features` / `Feature` / `FeatureSpec` | 特性标志注册表 |
| `ShellInfo` | 平台感知的 shell 命令构建器 |

## 路由

无。纯配置/库 crate。OAuthManager 使用 reqwest 发起出站 HTTP 请求，不定义路由。

## 依赖

**外部**: serde, serde_json, toml, reqwest, tokio, chrono, dirs, glob, anyhow, thiserror, tracing
**Workspace 内**: nomi-types, nomi-compact

## 被依赖

被 13 个 crate 依赖: nomi-cli, nomi-agent, nomi-tools, nomi-skills, nomi-providers, nomi-memory, nomi-mcp, nomi-computer, nomi-browser, nomifun-gateway, nomifun-app, nomifun-ai-agent
