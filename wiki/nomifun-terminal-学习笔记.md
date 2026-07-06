# nomifun-terminal 学习笔记

> Node.js 开发者视角，以 nomifun-tauri 项目为教材学习 Rust。

---

## 一、整体架构：终端是怎么在浏览器里跑起来的

```
┌──────────────────────────────────────────────────────┐
│ 前端 xterm.js                                        │
│                                                      │
│  ┌──────────────────────────────────────────────┐    │
│  │ xterm.js Terminal                            │    │
│  │ - 解析 ANSI 转义序列（颜色/光标/清屏/动画）       │    │
│  │ - 维护 80xN 字符网格（本地）                    │    │
│  │ - 光标闪烁（纯前端，不走网络）                  │    │
│  │ - 用户键盘输入 → onData 回调                   │    │
│  └──────────────────────────────────────────────┘    │
│       ▲ 输出 (WebSocket base64)                      │
│       │ 输入 (HTTP POST base64)                       │
└───────┼──────────────────────────────────────────────┘
        │
┌───────┼──────────────────────────────────────────────┐
│ 后端 Rust                                             │
│       │                     │                         │
│  TerminalService           TerminalService            │
│       │ 收到输出             │ 收到输入                │
│       ▼                     ▼                         │
│  on_output 回调      input(id, base64_data)           │
│       │              ├─ base64 decode                 │
│       ▼              ├─ DashMap.get(id) 找 PTY        │
│  EventEmitter        └─ handle.write(bytes)           │
│  .emit_output()              │                        │
│       │                      ▼                        │
│       ▼                 PTY master → slave             │
│  BroadcastEventBus            │                        │
│  .broadcast(msg)              ▼                        │
│       │               bash/claude 进程 stdin           │
│       ▼                                                │
│  桥接任务(while let)                                   │
│  → WebSocketManager                                   │
│  → per-conn send_loop                                 │
│  → WebSocket.send()                                   │
└───────────────────────────────────────────────────────┘
```

一句话：**xterm.js = 显示器，Rust PTY = 真终端，WebSocket = 视频线，HTTP POST = 键盘线。**

---

## 二、为什么需要 PTY（伪终端）

### 管道 vs PTY

| | 管道 (pipe) | PTY (伪终端) |
|---|---|---|
| 程序感知 | "我不是在终端里" | "我有一个真终端" |
| ANSI 颜色 | ❌ 丢失 | ✅ 保留 |
| 光标控制 | ❌ 不支持 | ✅ 支持 |
| 进度条/动画 | ❌ 失效 | ✅ 正常 |
| Ctrl+C 等信号 | ❌ | ✅ |
| claude/codex 兼容 | ❌ 拒绝工作 | ✅ 正常 |

### PTY 的两端

```
master 端（主端）→ TerminalService 持有，用于读写
slave 端（从端）→ 分配给子进程（bash/powershell/claude）

master ←→ slave ←→ 子进程
 ↑                 ↑
 我们操作         shell 以为连了真终端
```

---

## 三、输入流程：用户打字 → shell 执行

```
xterm.js 用户按 "ls\n"
   │
   ▼ HTTP POST /api/terminals/{id}/input
   │ body: { "data_b64": "bHMK" }    ← base64("ls\n")
   │
   ▼ TerminalService::input()
   │
   ├─ BASE64.decode(data_b64) → [0x6C, 0x73, 0x0A]
   ├─ self.live.get(&id) → PtyHandle（DashMap 查找）
   └─ handle.write(&bytes)
        │
        ├─ writer.lock() → write_all(bytes) → flush()
        └─ master → slave → bash 收到 "ls\n"
                              │
                          bash 执行 ls，输出结果
                              │
                          slave → master → reader 线程读到
                              │
                          → 进入输出流程 ↓
```

关键代码（service.rs 743-755 行）：

```rust
pub async fn input(&self, id: i64, data_b64: &str) -> Result<(), TerminalError> {
    let bytes = BASE64.decode(data_b64)?;
    let handle = self.live.get(&id)   // 从 HashMap 找 PTY
        .ok_or_else(|| TerminalError::NotFound(...))?;
    handle.write(&bytes)?;
    Ok(())
}
```

为什么用 base64？终端输出可能包含二进制、NULL 字节、ANSI 控制码——base64 保证 JSON 传输不出问题。

---

## 四、输出流程：shell 输出 → 前端渲染

### 4.1 核心链路（4 步到位）

```
pty.rs:166              service.rs:455        events.rs:22+50       realtime/broadcaster.rs
    │                       │                      │                      │
on_output(chunk) ──→ emitter.emit_output ──→ self.broadcast ──→ tx.send(event)
   (闭包调用)        (包装 base64)      ("terminal.output", json)  (tokio broadcast)
```

### 4.2 逐步拆解

**第 1 步 — reader 线程读 PTY 输出（pty.rs:154-171）：**

```rust
std::thread::spawn(move || {
    let mut buf = [0u8; 8192];
    loop {
        match reader.read(&mut buf) {     // 从 master 端读字节
            Ok(n) => {
                let chunk = buf[..n].to_vec();
                append_scrollback(&scrollback, &chunk);   // 存滚动历史
                let _ = out_tx.send(chunk.clone());       // 广播给 AutoWork
                on_output(chunk);                          // ← 回调！推前端
            }
            _ => break,
        }
    }
});
```

**第 2 步 — on_output 闭包（service.rs:455-457）：**

```rust
let emitter_out = self.emitter.clone();
let on_output = move |chunk: Vec<u8>| {
    emitter_out.emit_output(id, BASE64.encode(&chunk));
    //                       ↑ 终端ID   ↑ 字节→base64
};
```

**第 3 步 — EventEmitter（events.rs:21-22 + 42-51）：**

```rust
// 公开入口
pub fn emit_output(&self, id: i64, data_b64: String) {
    self.broadcast("terminal.output", &TerminalOutputEvent { id, data_b64 });
}

// 私有方法：序列化 + 真正发广播
fn broadcast<T: Serialize>(&self, event_name: &str, payload: &T) {
    let value = serde_json::to_value(payload).unwrap();
    self.broadcaster.broadcast(WebSocketMessage::new(event_name, value));
    //   ↑ 这里真正调 BroadcastEventBus → tokio broadcast tx.send()
}
```

**第 4 步 — 桥接任务（app/router/routes.rs:63-69）：**

```rust
let mut event_rx = services.event_bus.subscribe();
let ws_manager = services.ws_manager.clone();
tokio::spawn(async move {
    while let Ok(event) = event_rx.recv().await {
        ws_manager.broadcast_all(event);   // 遍历所有 WebSocket 连接，逐个推送
    }
});
```

### 4.3 为什么中间要加"广播 + 桥接任务"两层？

直接 `on_output` → WebSocket 不行吗？不行，因为：

1. **多个消费者**：终端输出可能要推给多个浏览器标签页 + AutoWork Agent 等多个订阅者
2. **解耦**：reader 线程不应该知道 WebSocket 的存在
3. **不阻塞**：慢消费者（网络卡了）不能拖死 reader 线程 → shell 进程

---

## 五、滚动缓冲：断线重连

```
reader 每次读到输出
    │
    ├─→ WebSocket 实推（实时）
    └─→ scrollback 滚动缓冲（内存环形缓冲区，存最近 256KB）
            │
            ├─ 每 5 秒 flush 到数据库（tokio::spawn 定时任务）
            └─ 子进程退出时最终 flush（on_exit）
                   │
                   ▼
            前端断开重连 → 从数据库读历史 → 再建 WebSocket 继续实时流
```

---

## 六、学到的 Rust 概念清单

| 概念 | 项目中的实例 |
|------|-------------|
| **PTY** | `portable-pty` crate，创建伪终端 |
| **闭包 (closure)** | `move \|chunk\| { emitter.emit_output(...) }` |
| **所有权 (ownership)** | `move` 把 emitter 所有权抢进闭包 |
| **Trait** | `EventBroadcaster` trait → `BroadcastEventBus` 实现 |
| **Arc（原子引用计数）** | `Arc<dyn EventBroadcaster>` — 多线程共享 |
| **DashMap** | `self.live: DashMap<i64, PtyHandle>` — 线程安全 HashMap |
| **tokio::spawn** | 异步任务（flush 定时器、send_loop） |
| **std::thread::spawn** | 真 OS 线程（PTY reader/waiter，因为 read 是同步阻塞的） |
| **tokio::sync::broadcast** | 一发多收（PTY 输出广播） |
| **tokio::sync::mpsc** | 多发一收（每连接一个通道 → send_loop） |
| **serde_json** | 序列化为 JSON |
| **base64** | 编码二进制数据，保证 JSON 传输安全 |

---

## 七、一句话总结

**nomifun-terminal 做的事情就是：在浏览器里给你一个真 shell。** PTY 负责执行命令，broadcast 负责分发输出，WebSocket 负责推到前端，HTTP 负责接收输入。Rust 没有 GC，所有资源的传递都要显式管理（所有权/借用/Arc），但这个"啰嗦"换来的是——绝不 crash、绝不内存泄漏、并发不出 bug。

---

## 八、待深入学习

- [ ] `crates/backend/nomifun-realtime/` — WebSocket 广播系统的完整实现
- [ ] `ui/src/renderer/pages/terminal/` — 前端 xterm.js 集成细节
- [ ] `crates/backend/nomifun-terminal/src/driver.rs` — AutoWork 如何程序化操控终端
- [ ] `crates/backend/nomifun-terminal/src/enhance.rs` — CLI 启动增强（注入 MCP + 钩子）
