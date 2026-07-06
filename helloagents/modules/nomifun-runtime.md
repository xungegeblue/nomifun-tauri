# nomifun-runtime

> 路径: `crates/backend/nomifun-runtime/`

## 功能

**内嵌 bun 运行时的解析与管理层**，纯基础设施。

核心能力：
- 构建时嵌入 bun 二进制（zstd 压缩，受 NOMIFUN_EMBED_BUN 环境变量控制）
- 运行时解压与缓存（跨进程互斥锁）
- bun 路径解析：NOMIFUN_BUN_PATH > 内嵌解压 > which("bun")
- 子进程管理：Builder 封装 tokio::process::Command，kill_on_drop、进程树清理、环境变量隔离
- PATH 增强：bun 目录 + 常见工具链目录注入
- 跨平台进程树清理安全网（Windows Job Object / Linux PDEATHSIG / macOS kqueue watchdog）

## 核心类型

| 类型 | 说明 |
|------|------|
| `Builder` | 子进程构建器: inner(Command), mode(Default/CleanCli), hand_off |
| `Mode` | Default(长驻 agent, stdio 继承) / CleanCLI(短命 CLI, stdio piped) |
| `EmbeddedBun` trait | 内嵌 bun 访问抽象 |
| `ProductionEmbed` | 生产实现，读取 build.rs 生成的 bun_meta.rs |

## 路由

无。纯基础设施层。

## 依赖

**外部**: tokio, serde, serde_json, thiserror, tracing, sha2, hex, zstd, which, dirs, fs2
**Workspace 内**: 无（叶子节点）

## 被依赖

被 12 个 crate 依赖: nomifun-app, nomifun-terminal, nomifun-shell, nomifun-extension, nomifun-conversation, nomifun-mcp, nomifun-ai-agent, nomifun-office, nomi-browser-engine, nomifun-channel(可选), apps/web, apps/desktop
