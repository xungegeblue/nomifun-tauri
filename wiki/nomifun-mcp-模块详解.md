# nomifun-mcp 模块详解

> MCP 服务器全生命周期管理 —— 添加/编辑/删除/测试外部 MCP 服务，同步 Agent CLI 配置，OAuth 认证，注入到 ACP Session。

---

## 一句话定位

**MCP 服务器管理中枢**：管理员在 UI 上添加 MCP 服务器 → 存 DB → 创建 ACP Session 时注入 → ACP 后端自动连接 → AI 看到一体化的工具列表。

---

## 依赖

| 依赖 | 用途 |
|---|---|
| **oauth2** | OAuth PKCE 认证流程（授权码 + PKCE 挑战） |
| **dashmap** | 并发 HashMap —— `agent_locks`（按 Agent 类型串行化扫描） |
| **reqwest** | HTTP 客户端 —— 连接测试 + OAuth token 交换 |
| **dirs** | 找 Agent CLI 配置文件路径（`~/.claude/` 等） |
| **toml** | 解析 Agent CLI 的 TOML 配置文件 |
| **open** | OAuth 登录时打开浏览器 |
| tokio / axum / serde 等 | 异步运行时 + HTTP 路由 + 序列化（内部 crate） |

---

## 6 大核心功能

### 1. McpConfigService — CRUD 管理

管理员在 UI 上添加 MCP 服务器配置，存 DB：

```
POST   /api/mcp/servers         添加（upsert by name）
GET    /api/mcp/servers         列表
GET    /api/mcp/servers/{id}    单条
PUT    /api/mcp/servers/{id}    编辑（不允许改名）
DELETE /api/mcp/servers/{id}    软删除
POST   /api/mcp/servers/{id}/toggle  开关
POST   /api/mcp/servers/import  批量导入
```

**三种传输方式**：

```rust
McpServerTransport::Stdio { command, args, env }   // 本地进程，如 npx @playwright/mcp@latest
McpServerTransport::Sse   { url, headers }         // HTTP SSE，如 https://api.example.com/sse
McpServerTransport::Http  { url, headers }         // Streamable HTTP
```

**智能拆分**：用户粘贴整行命令 `"npx @sentry/mcp-server@latest --org=demo"` → 自动拆成 `command: "npx"` + `args: ["@sentry/...", "--org=demo"]`

```rust
const SPLITTABLE_STDIO_LAUNCHERS: &[&str] = &[
    "npx", "pnpx", "bunx", "uvx", "uv", "node", "python", "python3", "deno"
];
```

### 2. McpConnectionTestService — 连接测试

```
POST /api/mcp/test-connection
  │
  ├── Stdio: 起子进程 → initialize → tools/list → 关闭
  ├── Sse/Http: HTTP 连接 → initialize → tools/list → 关闭
  │
  └── 返回: { success, tools: [...], error, needs_auth }
        │
        └── 自动 persist_test_result() 更新 DB（状态 + 工具列表）
```

### 3. McpSyncService — 多 Agent 同步

扫描本机安装的所有 AI Agent CLI，读出它们已有的 MCP 配置：

```
GET /api/mcp/agent-configs
  │
  ├── ClaudeAdapter    → 读 ~/.claude/claude_desktop_config.json
  ├── CodeBuddyAdapter → 读 CodeBuddy 配置
  ├── GeminiAdapter    → 读 Gemini CLI 配置
  ├── QwenAdapter      → 读 Qwen CLI 配置
  ├── CodexAdapter     → 读 Codex CLI 配置
  ├── NomiAdapter      → 读 Nomi 配置
  ├── NomifunAdapter   → 读 Nomifun 配置
  └── OpencodeAdapter  → 读 Opencode 配置
```

每个 Agent 独立扫描（`agent_locks` 按 source 串行化），没装的跳过。

```rust
// adapter.rs — 统一接口
pub trait McpAgentAdapter: Send + Sync {
    fn source(&self) -> McpSource;                                  // Claude / Gemini / Qwen / ...
    async fn is_installed(&self) -> Result<bool, McpError>;        // CLI 装了吗
    async fn detect_existing(&self) -> Result<Vec<DetectedServer>>; // 读已有 MCP 配置
    async fn install_server(&self, name, transport) -> Result<()>;  // 写 MCP 配置到 CLI
    async fn remove_server(&self, name) -> Result<()>;              // 从 CLI 删 MCP 配置
}
```

### 4. McpOAuthService — OAuth 认证

有些 MCP 服务器需要 OAuth 认证（如 Google API）：

```
POST /api/mcp/oauth/check-status  检查认证状态
POST /api/mcp/oauth/login         发起 PKCE 登录：打开浏览器 → 等回调 → 换 token
POST /api/mcp/oauth/logout        删除存储的 token
GET  /api/mcp/oauth/authenticated 列出已认证的服务器
```

**PKCE 流程**：

```
1. nomifun → 启动本地回调 HTTP 服务器（随机端口）
2. nomifun → 打开浏览器 → 用户在 Google 授权
3. Google → 回调 localhost → nomifun 收到 code
4. nomifun → 用 code 换 access_token + refresh_token
5. 存储 token 到本地文件（dirs::data_dir()/nomifun/oauth/）
```

### 5. Session Injection — ACP Session MCP 注入

创建 ACP Session 时，把启用的 MCP 服务器注入进去：

```rust
// session_injection.rs
pub fn build_session_mcp_servers(
    db_servers: &[McpServer],
    acp_caps: &AcpMcpCapabilities,  // ACP 后端能力声明
) -> Vec<AcpSessionMcpServer> {
    // 1. ImageGen（内置，ACP 能力声明里有就加）
    // 2. 用户启用的 MCP 服务器（enabled = true）
    // 3. 过滤：只加 ACP 能力声明里支持的
}
```

### 6. caps_mcp.rs（Gateway 层）— AI 可调用的 MCP 工具

AI 可以通过这些工具来管理 MCP：

```
nomi_mcp_list_servers          列出所有 MCP 服务器
nomi_mcp_get_server            获取单个详情
nomi_mcp_add_server            添加 MCP 服务器
nomi_mcp_edit_server           编辑
nomi_mcp_delete_server         删除
nomi_mcp_toggle_server         开关
nomi_mcp_test_connection       测试连接
nomi_mcp_get_agent_configs     扫描 Agent CLI
nomi_mcp_batch_import          批量导入
nomi_mcp_oauth_check_status    OAuth 状态
nomi_mcp_oauth_login           OAuth 登录
nomi_mcp_oauth_logout          OAuth 登出
nomi_mcp_list_authenticated    列出已认证
```

---

## 路由一览

| 路由 | 功能 |
|---|---|
| `GET /api/mcp/servers` | 列表 |
| `POST /api/mcp/servers` | 添加（upsert） |
| `GET /api/mcp/servers/{id}` | 单条 |
| `PUT /api/mcp/servers/{id}` | 编辑 |
| `DELETE /api/mcp/servers/{id}` | 删除 |
| `POST /api/mcp/servers/{id}/toggle` | 开关 |
| `POST /api/mcp/servers/import` | 批量导入 |
| `POST /api/mcp/test-connection` | 连接测试 |
| `GET /api/mcp/agent-configs` | 扫描 Agent CLI MCP 配置 |
| `POST /api/mcp/oauth/check-status` | OAuth 状态检查 |
| `POST /api/mcp/oauth/login` | OAuth 登录 |
| `POST /api/mcp/oauth/logout` | OAuth 登出 |
| `GET /api/mcp/oauth/authenticated` | 已认证列表 |

---

## 核心文件

| 文件 | 功能 |
|---|---|
| `service.rs` | CRUD 业务逻辑 + 命令拆分 |
| `routes.rs` | HTTP 路由处理 |
| `types.rs` | McpServer / McpServerTransport / McpTool 数据结构 |
| `adapter.rs` | McpAgentAdapter trait + DetectedServer |
| `adapters/` | 8 个 Agent CLI 适配器实现 |
| `sync_service.rs` | 多 Agent 扫描同步 |
| `connection_test/` | MCP 连接测试（起进程/HTTP 连接 → tools/list） |
| `oauth_service.rs` | OAuth PKCE 认证流程 |
| `session_injection.rs` | ACP Session MCP 注入 |
| `error.rs` | 错误类型定义 |

---

## 完整数据流

```
前端 UI
  │
  ├── 添加 MCP 服务器
  │   POST /api/mcp/servers → McpConfigService → DB (mcp_servers 表)
  │
  ├── 测试连接
  │   POST /api/mcp/test-connection → McpConnectionTestService
  │   → 起 stdio 进程 或 HTTP 连接 → tools/list → persist_test_result
  │
  ├── 同步 Agent CLI 配置
  │   GET /api/mcp/agent-configs → McpSyncService
  │   → 扫描所有 Agent CLI 配置文件 → 返回已有 MCP 列表
  │
  └── OAuth 登录
      POST /api/mcp/oauth/login → McpOAuthService
      → 打开浏览器 → 等回调 → 换 token → 存本地
```

---

## Agent 如何调用 MCP 工具

这是理解整个 MCP 系统最关键的部分。

### 完整链路（4 步）

```
┌─────────────────────────────────────────────────────────────────┐
│ Step 1: 用户添加 MCP 服务器（设置页）                            │
│                                                                 │
│  用户填: npx @playwright/mcp@latest，类型 stdio                 │
│       ↓                                                         │
│  nomifun-mcp/backend → 存 DB（mcp_servers 表）                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Step 2: 创建 ACP Session 时注入                                  │
│                                                                 │
│  session_injection.rs:                                          │
│    DB 里 enabled 的 MCP 配置                                    │
│    → 转成 AcpSessionMcpServer { type: "stdio", command:"npx",..}│
│       ↓                                                         │
│  acp_assembler.rs:                                              │
│    resolve_mcp_servers() 把所有 MCP 拼进 session/new 请求        │
│       ↓                                                         │
│  ACP Session/new payload:                                       │
│    { "mcpServers": [                                            │
│        {"type":"stdio","name":"playwright","command":"npx",...}, │
│        {"type":"stdio","name":"nomifun-gateway",...},            │
│        {"type":"http", "name":"ctx7", "url":"https://...",...}   │
│    ]}                                                            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Step 3: ACP 后端连接 MCP 服务器（nomi-mcp crate）               │
│                                                                 │
│  McpManager::connect_all(configs)                                │
│    对每个 MCP 服务器:                                            │
│      ├── 1. 创建 Transport（stdio/sse/http）                    │
│      ├── 2. initialize 握手                                     │
│      ├── 3. tools/list 发现工具                                 │
│      └── 4. 存入 servers HashMap                                │
│                                                                 │
│  McpManager::all_tools() → 返回所有服务器的所有工具              │
│    ["playwright_browser_navigate", "ctx7_search",                │
│     "nomi_agent_run", "nomi_fs_read_file", ...]                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Step 4: AI 调用工具                                              │
│                                                                 │
│  AI 决定调: "playwright_browser_navigate"                        │
│       ↓                                                         │
│  McpManager::call_tool("playwright", "browser_navigate", args)   │
│       ↓                                                         │
│  server.transport.request(json_rpc)                              │
│       │                                                         │
│       │  所有 transport 都实现同一个 trait，调用方式完全一样！    │
│       │                                                         │
│       ├── Stdio: 往子进程 stdin 写，从 stdout 读                │
│       ├── SSE: POST 到 endpoint URL，等 SSE 流回响应             │
│       └── Streamable HTTP: POST 请求，直接拿响应                │
│       ↓                                                         │
│  返回结果给 AI                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 核心架构图

```
                    ┌─────────────────────┐
                    │   管理员 UI          │
                    │   添加/编辑/测试 MCP │
                    └─────────┬───────────┘
                              │
                    ┌─────────▼───────────┐
                    │  nomifun-mcp        │
                    │  (CRUD + 连接测试)   │
                    └─────────┬───────────┘
                              │
                    ┌─────────▼───────────┐
                    │  DB (mcp_servers)    │
                    └─────────┬───────────┘
                              │
                    ┌─────────▼───────────┐
                    │  session_injection   │
                    │  把 enabled MCP 注入 │
                    │  ACP Session 请求    │
                    └─────────┬───────────┘
                              │
                    ┌─────────▼───────────┐
                    │  ACP 后端            │
                    │  (McpManager)        │
                    │  ├─ StdioTransport   │
                    │  ├─ SseTransport     │
                    │  └─ StreamableHttp    │
                    └─────────┬───────────┘
                              │
                    ┌─────────▼───────────┐
                    │  AI Agent 看到       │
                    │  统一工具列表         │
                    │  调哪个都一样         │
                    └─────────────────────┘
```

---

## 4 种传输模式对比

### 从 Agent（调用方）的角度：完全一样

所有 transport 实现同一个 trait：

```rust
#[async_trait]
pub trait McpTransport: Send + Sync {
    async fn request(&self, req: &JsonRpcRequest) -> Result<JsonRpcResponse, McpError>;
    async fn notify(&self, req: &JsonRpcRequest) -> Result<(), McpError>;
    async fn close(&self) -> Result<(), McpError>;
}
```

调用方只调 `transport.request(rpc)`，不关心底层是什么。

### 底层实现差异

| 传输模式 | 连接方式 | 通信方式 | 适用场景 |
|---------|---------|---------|---------|
| **Stdio** | 起子进程 | stdin 写请求 / stdout 读响应（管道） | 本地工具（npx/node/python） |
| **SSE** | GET SSE + POST | SSE 收服务端推送 + POST 发请求 | 远程服务，需要双向通信 |
| **Streamable HTTP** | HTTP POST | 每次请求一个 POST，响应直接返回 | 简单 HTTP API，无状态 |

### 连接时创建不同 transport，调用时完全统一

```rust
// manager.rs — 连接时根据类型创建不同 transport
let transport: Box<dyn McpTransport> = match config.transport {
    TransportType::Stdio => {
        // 起子进程：npx @playwright/mcp@latest
        // tokio::process::Command → stdin/stdout 管道
        Box::new(StdioTransport::spawn(command, args, env).await?)
    }
    TransportType::Sse => {
        // HTTP GET 建立 SSE 连接 → 拿到 endpoint URL
        // 后台 task 持续读 SSE 流 → 匹配请求 ID → oneshot channel 返回
        // POST 请求发到 endpoint URL
        Box::new(SseTransport::connect(url, headers).await?)
    }
    TransportType::StreamableHttp => {
        // 纯 HTTP POST，请求-响应模式
        // 带 Session ID header 维持会话
        Box::new(StreamableHttpTransport::connect(url, headers).await?)
    }
};

// ← 从这里开始，三种 transport 的使用方式完全一样！
transport.request(&init_req).await?;   // initialize
transport.notify(&notification).await?; // initialized
transport.request(&list_req).await?;   // tools/list
transport.request(&call_req).await?;   // tools/call ← AI 调用时走这里
```

### 对 AI 来说：完全透明

```
AI 看到的工具列表（扁平，不区分来源）：

nomi_fs_read_file          ← nomifun-gateway（内部 gateway）
nomi_agent_run             ← nomifun-gateway（内部 gateway）
playwright_browser_navigate ← MCP: playwright（stdio）
ctx7_search                 ← MCP: ctx7（HTTP）
...

AI 调哪个工具，底层路由到对应的 transport，AI 完全不用关心。
```

---

## 一句话总结

> **注册时**：不同 transport 填不同的配置字段（command vs url）  
> **运行时**：Agent 调用完全一样——都是 `transport.request(json_rpc)`，底层差异被 trait 封装了  
> **对 AI 来说**：所有 MCP 工具就是一个扁平的工具列表，不关心也看不见 transport 差异  
> **核心价值**：把分散的外部 MCP 服务器统一管理，注入到 ACP Session，让 AI 看到一体化的工具能力
