# WebSocket + tokio 使用说明

> 以 `nomifun-realtime` 模块为例，讲解为什么 WebSocket 需要异步运行时，以及 tokio 在其中的具体作用。

---

---

教程：https://rust-book.junmajinlong.com/ch100/00.html

## 1. 为什么 WebSocket 需要异步运行时

WebSocket 有四个特性，决定了它**必须用异步运行时**：

| 特性 | 同步（阻塞）的问题 | 异步（tokio）的解法 |
|------|-------------------|-------------------|
| 长连接 | 连接一直保持，阻塞一个线程 | 一个 task 占几 KB，轻量 |
| 双向通信 | read 阻塞时 send 不出去 | send/recv 拆成两个 task 并行 |
| 高并发 | 每连接一个 OS 线程，1000 连接 = 8GB 内存 | 每连接一个 async task，1000 连接 = 几 MB |
| 定时任务 | 没有内置定时器 | `interval` 做心跳 |

### Node.js vs Rust 的区别

```js
// Node.js：V8 自带事件循环，ws 库直接用
const ws = new WebSocket('ws://localhost:8080');
ws.on('message', cb);  // 注册回调，事件循环帮你看
ws.send('hello');       // 直接发
```

```rust
// Rust：没有事件循环，必须用 tokio 提供一个
#[tokio::main]
async fn main() {
    // tokio 启动事件循环 + 线程池
    // 所有 .await 都依赖这个运行时
}
```

**核心区别**：Node.js 的 V8 引擎天生有事件循环，Rust 没有，必须用 tokio 创建。

---

## 2. 不用 tokio 会怎样

```rust
// 用标准库（阻塞式）
use std::net::TcpListener;

let listener = TcpListener::bind("0.0.0.0:3000")?;
loop {
    let (socket, _) = listener.accept()?;  // ← 阻塞！卡在这里等连接
    handle_socket(socket)?;                 // ← 又阻塞！处理时没法接下一个
}
// 一个连接就把整个程序卡住了
```

```rust
// 用 tokio（异步式）
let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await?;
loop {
    let (socket, _) = listener.accept().await?;  // ← 异步等，不卡
    tokio::spawn(async move {                     // ← 开独立 task
        handle_socket(socket).await;
    });                                           // ← 立刻回去接下一个
}
```

---

## 3. tokio 核心组件一览

| 组件 | 作用 | Node.js 等价 |
|------|------|-------------|
| `runtime` | 事件循环 + 线程池 | V8 + libuv |
| `spawn` | 开异步任务 | `setImmediate` |
| `JoinHandle` | 任务句柄（可 abort） | 无 |
| `mpsc` | 多生产者单消费者 channel | 队列 |
| `broadcast` | 多生产者多消费者 channel | `EventEmitter` |
| `oneshot` | 一次性 channel | `Promise` |
| `Mutex` | 异步互斥锁 | 不需要（单线程） |
| `RwLock` | 异步读写锁 | 不需要 |
| `interval` | 周期定时器 | `setInterval` |
| `sleep` | 单次延时 | `setTimeout` |
| `timeout` | 超时控制 | `Promise.race` |
| `AsyncRead/Write` | 异步文件/流 IO | `fs.promises` |
| `TcpListener` | TCP 监听 | `net.Server` |
| `select!` | 等最快的 future | `Promise.race`（但会自动取消） |
| `join!` | 等全部完成 | `Promise.all` |
| `try_join!` | 全成功才算成功 | `Promise.all` + try/catch |

---

## 4. nomifun-realtime 用了哪些 tokio 组件

### 4.1 spawn — 每条连接的发送 task

**问题**：WebSocket 的 `ws_sender` 是独占的（`&mut`），不能在接收循环里同时发。

**解决**：开一个独立 task 专门负责发。

```rust
// handler.rs handle_socket()
let (tx, mut rx) = mpsc::channel::<WsOutbound>(64);

let send_task = tokio::spawn(async move {     // ← spawn 开独立 task
    while let Some(msg) = rx.recv().await {   // 从 channel 取消息
        match ws_sender.send(msg).await {
            Ok(_) => {}
            Err(_) => break,                  // ws 断了，退出
        }
    }
});
```

```
recv_loop（主 task）          send_loop（spawn 出的 task）
  ↓                              ↓
  从 WS 读消息                   从 channel 取消息
  处理 pong / 路由               发到 WS
  互不阻塞                       互不阻塞
```

### 4.2 JoinHandle — 控制 send_loop 生命周期

**问题**：recv_loop 先退了（连接断了），要通知 send_loop 也别等了。

**解决**：用 `abort()` 杀掉 send_loop task。

```rust
// handler.rs recv_loop 结束后
send_task.abort();  // ← 用 JoinHandle 杀掉 send_loop
self.manager.remove_client(conn_id);
```

Node.js 做不到杀掉一个 `setImmediate`，Rust 的 `JoinHandle.abort()` 可以。

### 4.3 mpsc — 发消息的管道

**问题**：多个地方（广播函数、心跳、业务模块）想往同一条 WS 发消息，但 `ws_sender` 只有一个。

**解决**：mpsc channel —— 多个 tx 塞消息，一个 send_loop 取。

```rust
// types.rs
pub struct ClientInfo {
    pub tx: mpsc::Sender<WsOutbound>,  // 每个连接持有一个发送端
    // ...
}

// manager.rs broadcast_all() — 广播时遍历所有连接
for entry in self.connections.iter() {
    entry.value().tx.try_send(WsOutbound::Message(json));  // ← 塞消息
}

// handler.rs send_loop — 只有一个接收端
while let Some(msg) = rx.recv().await {  // ← 取消息
    ws_sender.send(msg).await;
}
```

```
广播函数(tx) ─┐
心跳模块(tx) ─┤──→ [mpsc channel 64] ──→ send_loop(rx) ──→ ws.send()
业务模块(tx) ─┘
```

### 4.4 interval — 心跳定时器

**问题**：需要周期性检查所有连接的死活，踢掉超时的。

**解决**：`interval` 每 30s 触发一次。

```rust
// manager.rs start_heartbeat()
let mut tick = tokio::time::interval(Duration::from_secs(30));
loop {
    tick.tick().await;  // ← 每 30s 触发
    self.heartbeat_tick().await;  // 检查超时 → 检查 token → 发 ping
}
```

心跳三步优先级：
1. **超时检查** — `last_ping` 距今 > 60s → 发 Close + 移除
2. **Token 过期** — token 校验失败 → 发 auth-expired + Close + 移除
3. **发 ping** — 正常连接发心跳

### 4.5 select! — send_loop 里的多路等待

**问题**：send_loop 要同时等两件事——channel 来新消息（要发）和 ws 连接断了（要退出）。

**解决**：`select!` 同时等两个 future，谁先 ready 走谁。

```rust
// handler.rs send_loop
loop {
    tokio::select! {
        // 路径 A：channel 来了消息 → 发出去
        msg = rx.recv() => {
            match msg {
                Some(msg) => { ws_sender.send(msg).await.ok(); }
                None => break,  // channel 关了
            }
        }
        // 路径 B：ws 接收端关闭了 → 退出
        _ = ws_receiver_closed() => {
            break;
        }
    }
}
```

如果只用 `rx.recv().await`，就没法知道连接什么时候断。

---

## 5. 5 个组件解决 5 个问题

| 问题 | 用什么 | 怎么解决 |
|------|--------|---------|
| ws_sender 独占，不能多个地方同时发 | **mpsc** | 多个 tx 塞消息，一个 send_loop 取 |
| send_loop 要独立跑，不阻塞 recv_loop | **spawn** | 开一个独立 task |
| 连接断了要杀 send_loop | **JoinHandle** | `abort()` 杀掉 |
| 要周期性检查连接死活 | **interval** | 30s tick 一次 |
| send_loop 要同时等消息和连接关闭 | **select!** | 两个 future 同时等，谁先走谁 |

---

## 6. channel 详解

### 6.1 mpsc — 多生产者单消费者

```rust
let (tx, mut rx) = tokio::sync::mpsc::channel::<String>(64);
let tx2 = tx.clone();  // tx 可以 clone，多个人发

tokio::spawn(async move { tx.send("hello").await; });
tokio::spawn(async move { tx2.send("world").await; });

while let Some(msg) = rx.recv().await {  // 只有一个接收者
    println!("{}", msg);
}
```

```
tx1 ─┐
tx2 ─┤──→ [■■■■ 64] ──→ rx（唯一消费者）
tx3 ─┘
```

### 6.2 broadcast — 多生产者多消费者

```rust
let (tx, _) = tokio::sync::broadcast::channel::<String>(256);
let mut rx1 = tx.subscribe();  // 订阅者1
let mut rx2 = tx.subscribe();  // 订阅者2

tx.send("hello".into()).ok();  // 发一次

rx1.recv().await;  // "hello"
rx2.recv().await;  // "hello" ← 都收到了
```

```
tx ──→ [■■■■ 256] ──→ rx1（订阅者1）
                   ──→ rx2（订阅者2）
                   ──→ rx3（订阅者3）
```

**mpsc vs broadcast**：
- mpsc = 快递柜，一个快递员取
- broadcast = 广播电台，每个收音机都能听

### 6.3 oneshot — 一次性 channel

```rust
let (tx, rx) = tokio::sync::oneshot::channel::<String>();

tokio::spawn(async move {
    let result = do_work().await;
    tx.send(result).unwrap();  // 只能发一次
});

let result = rx.await.unwrap();  // 只能收一次
```

Node.js 类比：`new Promise(resolve => { ... })`，resolve 一次就结束。

---

## 7. select! vs join! vs try_join!

```rust
// select! — 等最快的，其余取消
tokio::select! {
    val = future_a() => println!("A 先完成"),
    val = future_b() => println!("B 先完成"),
}
// 走了一个分支后，另一个 future 被 drop（取消）

// join! — 等全部完成，不取消
let (a, b, c) = tokio::join!(task_a(), task_b(), task_c());

// try_join! — 全成功才算成功，任一失败就停
let result = tokio::try_join!(task_a(), task_b());
// 全部成功 → Ok((a, b))
// 任一失败 → Err(第一个错误)，其余取消
```

| 宏 | 等谁 | 取消 | Node.js 等价 |
|---|------|------|-------------|
| `select!` | 最快的一个 | 取消没选中的 | `Promise.race` |
| `join!` | 全部 | 不取消 | `Promise.all` |
| `try_join!` | 全部（全成功） | 失败即取消 | `Promise.all` + try/catch |

---

## 8. 完整数据流

```
前端发起 WS 连接
  ↓
axum（底层 tokio TcpListener）accept → 升级为 WebSocket
  ↓
handle_socket:
  ├── mpsc channel 创建 (tx, rx)
  ├── spawn send_loop task（持有 ws_sender + rx）
  ├── 注册连接到 manager（存 tx）
  └── recv_loop（主 task，持有 ws_receiver）
       ├── Text("pong") → update_last_ping
       ├── Text(msg) → MessageRouter.route()
       └── Close → break → abort send_loop → remove_client

心跳 task（interval 30s）:
  ├── 遍历所有连接
  ├── 超时(>60s) → Close + remove
  ├── Token过期 → auth-expired + Close + remove
  └── 正常 → 发 ping

业务模块广播:
  emitter.broadcast(event)
    → manager.broadcast_all()
      → 遍历 connections
        → 每个连接的 tx.try_send(WsOutbound::Message)
          → channel
            → send_loop 的 rx.recv() 收到
              → ws_sender.send() 发给前端
```
