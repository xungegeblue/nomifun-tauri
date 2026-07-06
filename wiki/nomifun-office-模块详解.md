# nomifun-office 模块详解

## 一句话定位

> Office 文档预览引擎 —— 通过 `officecli`（npm 工具）启动本地 HTTP 服务渲染 Word/Excel/PPT，前端通过反向代理查看。**纯后端 HTTP 服务，不注册到 Gateway（不给 AI 调用）。**

---

## 依赖

| 依赖 | 用途 |
|---|---|
| **calamine** | 解析 Excel 文件（.xlsx/.ods），读单元格数据、合并区域 |
| **reqwest** | HTTP 客户端——Star Office 检测 + 反向代理 |
| **which** | 查系统 PATH 里有没有 pandoc / officecli |
| **sha1** | 计算目标文件 hash，做快照目录隔离 |
| **dashmap** | 并发 HashMap，管理多个预览 session |
| tokio / axum / serde 等 | 异步运行时 + HTTP 路由 + 序列化（内部 crate） |

无外部平台依赖。

---

## 5 个核心功能

### 1. watch_manager — 文档预览生命周期

```
用户请求预览 Word
      │
      ▼
POST /api/word-preview/start { file_path: "/a.docx" }
      │
      ▼
OfficecliWatchManager::start()
      │
      ├── 1. 检查是否已有活跃 session（缓存复用）
      │
      ├── 2. 分配端口（随机可用端口）
      │
      ├── 3. 起进程: officecli watch /a.docx --port 12345
      │     └─ 如果 officecli 没装 → npm install -g officecli → 再试
      │
      ├── 4. 轮询 150 次 × 100ms → 等端口 ready
      │
      └── 5. 返回 URL: /api/office-watch-proxy/12345
              │
              └─ WebSocket 广播状态: starting → ready / installing / error
```

**三种文档**：Word、Excel、PPT（PPT 用独立的 ppt-proxy）

**自动安装 officecli**：

```rust
// try_start() — 第 125 行
Err(OfficeError::OfficecliNotFound) => {
    self.broadcast_status(doc_type, PreviewState::Installing, None);
    self.spawner.install_officecli().await?;  // npm install -g officecli
    self.spawner.spawn_officecli(resolved, port, doc_type).await?  // 再试
}
```

```rust
// install_officecli() — 第 303 行
async fn install_officecli(&self) -> Result<(), OfficeError> {
    let mut builder = CmdBuilder::clean_cli("npm");
    builder.args(["install", "-g", "officecli"]);
    // ...
}
```

**自动更新**：每 24h 检查一次 officecli 版本更新（仅 PPT 触发）

### 2. conversion — 格式转换

```
Word  → Markdown   调用 pandoc 命令行
Excel → JSON       calamine 库直接解析（无需外部工具）
PPT   → JSON       调用 officecli ppt2json
```

### 3. snapshot — 预览快照

```
保存快照 → 存为 .md 文件 → 记入 index.json
列出快照 → 读 index.json → 按时间排序
读取内容 → 根据 snapshot_id 读 .md 文件
上限 50  → 超了自动删最旧的
```

按文件 hash 做目录隔离，不同文件不串。

### 4. star_office — 服务发现

扫描本地端口找 Star Office 服务（本地运行的 AI 状态面板）：

```
已知端口: 19000, 18791
扫描半径: ±24 → 每个端口扫 49 个候选
并发度:   最多 6 个同时探测
检查逻辑: GET /health + GET /status + 页面关键词匹配
缓存策略: 命中 → 20s TTL，未命中 → 1.5s TTL
```

### 5. proxy — 反向代理

officecli 在 `localhost:12345` 起的是纯 HTTP 服务。前端要访问，需要反向代理：

```
浏览器请求 /api/office-watch-proxy/12345/index.html
      │
      ▼
代理转发到 http://127.0.0.1:12345/index.html
      │
      ├── 注入导航守卫脚本（拦截 location.assign / history.pushState）
      ├── 重写 Location 响应头
      ├── 过滤 hop-by-hop headers
      └── 返回给浏览器
```

---

## 路由一览

| 路由 | 功能 |
|---|---|
| `POST /api/word-preview/start` | 开始预览 Word |
| `POST /api/word-preview/stop` | 停止预览 Word |
| `POST /api/excel-preview/start` | 开始预览 Excel |
| `POST /api/excel-preview/stop` | 停止预览 Excel |
| `POST /api/ppt-preview/start` | 开始预览 PPT |
| `POST /api/ppt-preview/stop` | 停止预览 PPT |
| `POST /api/preview-history/list` | 列出快照 |
| `POST /api/preview-history/save` | 保存快照 |
| `POST /api/preview-history/get-content` | 读取快照内容 |
| `POST /api/star-office/detect` | 检测 Star Office 服务 |
| `POST /api/document/convert` | 文档格式转换 |
| `GET /api/ppt-proxy/{port}` | PPT 代理 |
| `GET /api/office-watch-proxy/{port}` | Word/Excel 代理 |

---

## 启动/停止流程细节

### start_preview（routes.rs 第 103 行）

```rust
async fn start_preview(
    state: OfficeRouterState,
    body: Json<StartPreviewRequest>,   // { file_path, workspace? }
    doc_type: DocType,                  // Word / Excel / Ppt
) -> Result<ApiResponse<PreviewUrlResponse>> {

    // 1. 参数校验 + 路径白名单检查
    let validated_path = validate_office_path(&state, &req.file_path, ...)?;

    // 2. 真正干活
    let result = state.watch_manager.start(&validated_path, doc_type).await;

    // 3. 返回代理 URL 或错误
    match result {
        Ok(port) => { url: "/api/office-watch-proxy/{port}" },
        Err(e)  => { url: "", error: "..." },
    }
}
```

### 调用关系

```
路由层
  ├── start_word_preview()  ─┐
  ├── start_excel_preview() ─┤  都调同一个
  └── start_ppt_preview()   ─┘  start_preview()
                                    │
                                    ▼
                              watch_manager.start()
                                    │
                                    ├── 缓存检查（同文件同类型 → 复用端口）
                                    ├── allocate_port()
                                    ├── spawn_officecli()（没装 → install）
                                    ├── poll_port_ready()（150 × 100ms）
                                    ├── 存入 DashMap sessions
                                    └── 返回 port
```

---

## 桌面端 vs Web 端

nomifun-office 是后端 HTTP 服务模块，**不绑定浏览器**。桌面端也是 WebView 界面调它的 HTTP API。

| | 桌面端 | Web 端 |
|---|---|---|
| nomifun-office 在哪 | 本地进程 | 服务器进程 |
| officecli 在哪 | 本地 | 服务器 |
| 能不能用 | ✅ 能用 | ✅ 能用（前提服务器装了 officecli） |
| 延迟 | 低（本地） | 取决于网络 |

---

## 为什么没注册到 Gateway？

nomifun-office 是给**人看**的（渲染文档预览），不是给 **AI 调用**的。

```
AI Agent                         前端（浏览器/WebView）
   │                                  │
   │ MCP/REST                         │ HTTP
   ▼                                  ▼
Gateway Registry                  axum Router
   │                                  │
   ├── nomi_fs_read_file              ├── POST /api/word-preview/start
   ├── nomi_agent_run                 ├── POST /api/excel-preview/start
   └── ...                            └── GET  /api/office-watch-proxy/{port}
```

AI 要读文件内容用 `nomi_fs_read_file` 就够了，不需要起 officecli 渲染。

---

## 数据流全景

```
前端（浏览器/WebView）
   │
   │  POST /api/word-preview/start
   ▼
axum Router → routes.rs → watch_manager.rs
   │
   ├── tokio::process::Command("officecli watch ...")
   │
   ├── DashMap 存 session { key: "word:/a.docx", port: 12345, process }
   │
   └── WebSocket 广播状态 → nomifun-realtime

前端拿到 URL → GET /api/office-watch-proxy/12345
   │
   ▼
proxy.rs → reqwest → http://127.0.0.1:12345
   │
   └── 注入导航守卫 + 重写 headers → 返回浏览器
```

---

## 核心文件

| 文件 | 功能 |
|---|---|
| `routes.rs` | HTTP 路由处理，`start_preview` / `stop_preview` |
| `watch_manager.rs` | 进程生命周期管理，自动安装/更新 officecli |
| `conversion.rs` | Word/Excel/PPT 格式转换 |
| `snapshot.rs` | 预览快照的保存/列表/读取 |
| `star_office.rs` | 本地 Star Office 服务发现 |
| `proxy.rs` | 反向代理 officecli HTTP 服务 |
| `types.rs` | DocType 枚举、请求/响应结构体 |
| `error.rs` | 错误类型定义 |
