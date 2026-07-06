# nomi-tools

> 路径: `crates/agent/nomi-tools/`

## 功能

**内置工具集**，定义 Agent 可调用的所有核心工具及执行逻辑。

工具列表：
- **文件操作**: Read / Write / Edit / ApplyPatch
- **命令执行**: Bash / ExecCommand / WriteStdin
- **搜索**: Glob / Grep
- **LSP 导航**: Lsp（documentSymbol/definition/references/hover）
- **计划追踪**: UpdatePlan（codex 风格 todo）
- **工具搜索**: ToolSearch（延迟加载工具 schema）

基础设施：
- 文件缓存 (FileStateCache) — LRU 双驱逐（条目数 + 字节大小）
- PTY 会话管理 (Pty / PersistentShell / ProcessStore)
- 写入根路径安全守卫 (path_guard / sandbox)
- Git worktree 隔离 (Worktree)
- 原子写入 (atomic_write)
- 输出截断 (TruncationBudget)

## 核心类型

| 类型 | 说明 |
|------|------|
| `Tool` trait | 工具统一接口: name(), description(), input_schema(), execute(), category() |
| `ToolRegistry` | 工具注册表，管理所有 Box<dyn Tool>，支持按名称查找、白名单过滤 |
| `BashTool` | Shell 命令执行，支持持久 shell 和 macOS Seatbelt 沙箱 |
| `ReadTool` / `WriteTool` / `EditTool` / `ApplyPatchTool` | 文件读写编辑 |
| `GrepTool` / `GlobTool` | 内容搜索和文件名匹配 |
| `LspTool` / `LspClient` | LSP 代码导航 |
| `FileStateCache` | LRU 文件状态缓存 |
| `Pty` / `PersistentShell` / `ProcessStore` | PTY 会话管理 |

## 路由

无。纯库 crate，通过 Tool trait 的 execute() 方法提供功能。

## 依赖

**外部**: tokio, async-trait, serde, serde_json, base64, glob, lru, portable-pty, libc, tracing
**Workspace 内**: nomi-types, nomi-protocol, nomi-config

## 被依赖

被 8 个 crate 依赖: nomi-agent, nomi-cli, nomi-mcp, nomi-computer, nomi-browser, nomifun-app(可选), nomifun-gateway(可选), nomifun-ai-agent
