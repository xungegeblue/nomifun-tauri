# nomi-protocol

> 路径: `crates/agent/nomi-protocol/`

## 功能

**JSON Stream 协议层**，定义宿主(Host)与 Agent 之间的通信协议。采用 JSON Lines 格式通过 stdin/stdout 双向通信。

## 核心类型

**命令端 (Host → Agent)** — commands.rs:
- `ProtocolCommand` 枚举: Message, Stop, ToolApprove, ToolDeny, InitHistory, SetMode, SetConfig, AddMcpServer, Ping
- `ApprovalScope` 枚举: Once, Always
- `SessionMode` 枚举: Default, AutoEdit, Yolo

**事件端 (Agent → Host)** — events.rs:
- `ProtocolEvent` 枚举: Ready, StreamStart, TextDelta, Thinking, ToolRequest, ToolRunning, ToolResult, ToolCancelled, StreamEnd, Error, Info, ConfigChanged, McpReady, Pong
- `ToolCategory` 枚举: Info, Edit, Exec, Mcp, Irreversible
- `ToolStatus` 枚举: Success, Error
- `OutputType` 枚举: Text, Diff, Image

**审批管理** — lib.rs:
- `ToolApprovalManager`: 基于 Mutex 的审批管理器（pending/auto_approved/session_mode）
- `ToolApprovalResult` 枚举: Approved, Denied

**I/O 层** — reader.rs / writer.rs:
- `spawn_stdin_reader()`: 异步 stdin → mpsc::UnboundedReceiver<ProtocolCommand>
- `ProtocolEmitter` trait / `ProtocolWriter`: 事件序列化输出到 stdout

## 路由

无。纯协议层，通信方式为 stdin/stdout JSON Lines。

## 依赖

**外部**: tracing, serde, serde_json, tokio
**Workspace 内**: 无（零内部依赖）

## 被依赖

被 7 个 workspace crate 依赖: nomi-agent, nomi-cli, nomi-tools, nomi-mcp, nomi-computer, nomi-browser, nomifun-ai-agent
