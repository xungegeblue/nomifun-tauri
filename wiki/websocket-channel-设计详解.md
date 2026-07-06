# WebSocket + tokio channel 设计详解

> 为什么需要两个 channel（broadcast + mpsc）？它们解决的是两个完全独立的问题。

---

## 1. 先纠正：broadcast vs mpsc 的实际角色

| channel 类型 | 实际角色 | 这个系统里的用途 |
|---|---|---|
| **broadcast** | 一对多（一个发，多个收） | 业务事件 → 所有在线客户端 |
| **mpsc** | 多对一（多个发，一个收） | 多人要往同一个 WebSocket 写消息 |

> 注意：broadcast 不是"多对多"，是**一个 sender 发，多个 receiver 收**。

---

## 2. 问题1：业务事件要推给所有客户端

```
业务模块（orchestrator）发出：requirement.updated
                                    ↓
              所有在线客户端都要收到这个消息
              客户端1、客户端2、客户端3...
```

这是**一对多**，broadcast 正好解决：

```rust
// broadcaster.rs
pub struct BroadcastEventBus {
    tx: broadcast::Sender<WebSocketMessage<Value>>,
}

// 发一次，所有订阅者都收到
impl EventBroadcaster for BroadcastEventBus {
    fn broadcast(&self, event: WebSocketMessage<Value>) {
        let _ = self.tx.send(event);
    }
}
```

每个 WebSocket 连接启动时订阅一次，拿到自己的 receiver：

```rust
// 每个连接创建时
let mut rx = event_bus.subscribe();
// rx 是独立的，每个连接一个，互不影响
```

---

## 3. 问题2：多人要往同一个 WebSocket 写消息

这是 mpsc 要解决的问题。先搞清楚**为什么多人要写同一个 WebSocket**。

一个 WebSocket 连接，这些地方都要给它发消息：
- 业务广播事件（通过 broadcast receiver 收到后，要转发给这个连接）
- 心跳 task 要发 ping
- 单播回复（只给这个客户端发的消息）

但 WebSocket 的 sender **不是 Clone 的**，只能被一个 task 持有：

```rust
let (ws_sender, ws_receiver) = socket.split();
// ws_sender 只有一个，不能 clone 给多个 task
// 错误做法：把 ws_sender 传给心跳 task + 广播 handler → 编译报错
```

所以必须把所有要写的消息**收集到一个地方，统一写**：

```
多处要写消息 ──► mpsc channel ──► send_loop（唯一消费者）──► WebSocket
```

这就是**多对一**，mpsc 正好解决：

```rust
// handler.rs — 建连时创建 mpsc channel
let (tx, rx) = mpsc::channel::<WsOutbound>(64);
// tx 可以 clone，多个地方都能发
// rx 只有一个，send_loop 独占

// 把 tx 存进 manager，心跳/广播都能拿到
let conn_id = state.manager.add_client(token, tx);

// send_loop 跑在独立 task，独占 rx
let send_handle = tokio::spawn(send_loop(conn_id, rx, ws_sender));
```

心跳 task 通过 manager 往 mpsc 塞消息：

```rust
// manager.rs — 心跳发 ping
pub fn send_to(&self, conn_id: ConnectionId, msg: WebSocketMessage<Value>) {
    let text = serde_json::to_string(&msg).unwrap();
    // 内部：找到对应连接的 tx，try_send 塞进 mpsc
    client.tx.try_send(WsOutbound::Text(text));
}
```

---

## 4. 完整消息流向（两个 channel 怎么配合）

```
业务模块发事件
      │
      ▼
┌──────────────┐
│broadcast ch  │  ← 一对多：一个发，所有连接都收到
│(EventBroad-  │
│ caster)      │
└──────┬───────┘
       │
       │ 每个连接都有一个 broadcast receiver
       │
  ┌────┴────────┬────────┐
  ▼             ▼        ▼
连接1         连接2     连接3
broadcast     broadcast  broadcast
rx            rx         rx
  │             │         │
  │ 收到事件     │         │
  ▼             ▼         ▼
mpsc           mpsc      mpsc
tx.send()      tx.send()  tx.send()
  │             │         │
  ▼             ▼         ▼
┌──────┐     ┌──────┐   ┌──────┐
│mpsc  │     │mpsc  │   │mpsc  │  ← 多对一
│channel│     │channel│   │channel│
│rx     │     │rx     │   │rx     │
└──┬───┘     └──┬───┘   └──┬───┘
   │             │           │
   ▼             ▼           ▼
send_loop      send_loop    send_loop  ← tokio::spawn 独立 task
(唯一消费者)    (唯一消费者)  (唯一消费者)
   │             │           │
   ▼             ▼           ▼
WebSocket      WebSocket    WebSocket  ← 真正写出去
```

**总结 flow**：
1. 业务模块 → `broadcast`（一对多，一次发全员）
2. 每个连接收到 broadcast → 塞进自己的 `mpsc`（缓冲，解耦）
3. `send_loop`（独立 task）→ 从 mpsc 取消息 → 写 WebSocket

---

## 5. 为什么不能用 broadcast 代替 mpsc？

有人会想：broadcast 也能一对多，能不能让多个 sender 直接往 WebSocket 写？

不行，因为：
- WebSocket sender 不是 `Clone`，没法给多个 task 用
- 即使能 Clone，多个 task 同时写 WebSocket 会**消息交错**，协议出错

mpsc 的**唯一消费者**特性正好保证：同一时刻只有一个 task 在写 WebSocket，不会乱。

---

## 6. 为什么不能用 mpsc 代替 broadcast？

有人会想：broadcast 的"一对多"能不能用 mpsc + 手动遍历所有连接实现？

可以，但麻烦且低效：

```rust
// 不用 broadcast，手动实现"一对多"
for (conn_id, client) in connections.iter() {
    client.tx.send(msg.clone()).await;  // 要给每个连接 clone 一次消息
}
```

而 broadcast 是：
- 消息只序列化一次
- 内核层面（epoll/kqueue）批量唤醒所有 receiver
- 代码简洁：`bus.broadcast(event)` 一行

---

## 7. 一句话总结设计逻辑

```
broadcast = "一条消息，所有人都要"
            用在：业务事件推送（一对多扇出）

mpsc = "多人要写同一个 WebSocket，但不能直接写"
       用在：每连接的消息缓冲（多对一汇合）
             保证同一时刻只有一个 task 写 WebSocket

两个 channel 解决的是两个完全不同维度的问题，
不是一个替代另一个的关系。
```

---

## 8. 两个 channel 的对比

| | broadcast | mpsc |
|---|---|---|
| 发消息方 | 一个或多个 | 多个 |
| 收消息方 | 多个 | 一个（唯一消费者） |
| 本系统用途 | 业务事件 → 所有客户端 | 多源 → 同一 WebSocket |
| 为什么用这个 | 一对多扇出，代码简洁 | WebSocket sender 不 Clone，需要缓冲 |
| 不用会怎样 | 手动遍历所有连接发消息 | 多个 task 竞争写 WebSocket，消息乱序 |
