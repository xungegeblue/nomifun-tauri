# nomifun-terminal

> 路径: `crates/backend/nomifun-terminal/`

## 功能

**交互式终端会话管理**，核心后端模块。

核心能力：
- PTY 管理：跨平台伪终端（Unix PTY / Windows ConPTY）
- 会话生命周期：创建/列表/删除/重启/回退到 shell
- 输出流广播：PTY 输出经 WS 实时推送 + 进程内 fan-out
- Scrollback 持久化：256KB 有界缓冲 + 5s 去抖写入
- 平台能力注入（Enhancement）：Claude/Codex CLI 注入知识搜索 MCP、需求 MCP、lifecycle hooks
- Agent 识别与调度：resolve_agent_family → Claude/Codex/Gemini
- Lifecycle Server：in-process HTTP 服务器，接收 CLI hooks 回调
- 知识库集成：创建/重启时同步 knowledge mounts
- 自动标题：LLM 生成会话标题
- 工作区浏览

## 核心类型

| 类型 | 说明 |
|------|------|
| `TerminalService` | 核心服务，DashMap<PtyHandle> |
| `PtyHandle` | 活跃 PTY 句柄: master/writer/killer/scrollback/broadcast |
| `TerminalDriver` trait | AutoWork 驱动接口 |
| `TerminalLifecycleServer` | In-process HTTP 服务器（POST /hook） |
| `AgentCli` | 枚举: Claude / Codex / Gemini |

## 路由

前缀 `/api/terminals/`：list, create, get, update, delete, input, resize, kill, relaunch, relaunch-shell, workspace

## 依赖

**Workspace 内**: nomifun-common, nomifun-db, nomifun-api-types, nomifun-realtime, nomifun-auth, nomifun-runtime, nomifun-knowledge, nomifun-file

## 被依赖

被 5 个 crate 依赖: nomifun-requirement, nomifun-ai-agent, nomifun-app, nomifun-idmm, nomifun-gateway
