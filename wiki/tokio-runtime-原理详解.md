# tokio Runtime 原理详解

> 从一段简单代码出发，理解为什么 `sleep(1s).await` 需要事件循环、唤醒、分配机制。

---

## 0. 核心问题

```rust
fn main() {
    let rt = tokio::runtime::Runtime::new().unwrap();
    
    rt.block_on(async {
        println!("start");
        tokio::time::sleep(Duration::from_secs(1)).await;
        println!("tick");
    });
}
```

**问题：这么简单的代码，为什么需要事件循环、唤醒、分配？**

---

## 1. tokio runtime 是什么

tokio runtime = Node.js 的 V8 + libuv 的 Rust 版本。

```
Node.js                        tokio
──────────────────────────────────────────────
V8 引擎          ←→           Rust 编译器
libuv 事件循环   ←→           tokio 事件循环（epoll/kqueue/IOCP）
单线程           ←→           多线程线程池
任务队列          ←→           task 队列
Timer            ←→           interval / sleep
                  ←→           线程池（Node.js 没有的）
```

Node.js 的 V8 引擎天生有事件循环，你不用管。Rust 没有事件循环，必须用 tokio 创建一个。

`#[tokio::main]` 宏展开后等价于：

```rust
fn main() {
    // ① 创建 runtime
    let rt = tokio::runtime::Runtime::new().unwrap();
    
    // ② 在 runtime 上跑你的 async 代码
    rt.block_on(async {
        println!("start");
        tokio::time::sleep(Duration::from_secs(1)).await;
        println!("tick");
    });
    
    // ③ block_on 会阻塞直到 async 代码完成
    //    然后 runtime 销毁，进程结束
}
```

---

## 2. runtime 内部结构

```
┌──────────────────────────────────────────────┐
│              tokio Runtime                    │
│                                               │
│  ┌─────────────────────────────────────────┐ │
│  │          事件循环（Reactor）              │ │
│  │  epoll/kqueue/IOCP 监听所有 IO          │ │
│  │  socket 有数据 → 唤醒等待的 task         │ │
│  │  timer 到时间 → 唤醒 sleep/interval     │ │
│  └─────────────────────────────────────────┘ │
│                      ↓ 唤醒                   │
│  ┌─────────────────────────────────────────┐ │
│  │          任务调度器（Scheduler）         │ │
│  │  把 ready 的 task 分配给工作线程          │ │
│  └─────────────────────────────────────────┘ │
│                      ↓ 分配                   │
│  ┌──────┬──────┬──────┬──────┐               │
│  │线程1  │线程2  │线程3  │线程4  │  ← 工作线程  │
│  │task A │task C │task E │task G │  ← 轮流跑   │
│  │task B │task D │task F │task H │             │
│  └──────┴──────┴──────┴──────┘               │
│                                               │
│  默认线程数 = CPU 核心数                       │
│  每个 task 只占几 KB 内存                      │
└──────────────────────────────────────────────┘
```

---

## 3. 拆解 `sleep(1s).await` 发生了什么

```rust
rt.block_on(async {
    println!("start");                              // ① 同步，直接执行
    tokio::time::sleep(Duration::from_secs(1)).await; // ② 关键
    println!("tick");                                // ③ 1秒后才执行
});
```

### 如果没有事件循环（用标准库）

```rust
fn main() {
    println!("start");
    std::thread::sleep(Duration::from_secs(1));  // ← 整个线程卡死 1 秒
    println!("tick");
}
```

能跑，但**整个线程卡死 1 秒**。如果同时有 1000 个 task 都要 sleep，得开 1000 个线程——内存爆炸。

### 有了事件循环

```
println!("start")          → 直接执行

sleep(1s).await            → 不是真的"睡"，而是：
  ① 告诉事件循环："1秒后叫我"
  ② 当前 task 挂起（让出执行权）
  ③ 事件循环：好的，我记下了
  ④ 事件循环发现没有其他 task 要跑
  ⑤ 事件循环调用 epoll_wait/kqueue 等待（不占 CPU）
  ⑥ 1秒到了 → 事件循环被内核唤醒
  ⑦ 事件循环：嘿，该醒了
  ⑧ task 恢复，继续执行

println!("tick")           → 执行
```

---

## 4. 三个机制分别什么时候用到

### 4.1 事件循环 — 因为 `sleep` 需要有人"等"

```
sleep(1s).await 的本质：

  task 说："我要等 1 秒"
     ↓
  谁来等？ → 事件循环
  
  事件循环内部：
    注册一个 timer（1秒后触发）
    然后调用 epoll_wait(timeout=1s)  ← 阻塞等待，但不占 CPU
    1秒后内核唤醒 epoll_wait
    事件循环找到注册的 timer → 唤醒对应 task
```

如果没有事件循环，谁来帮你计时？只能 `std::thread::sleep` 真的把线程卡死。

### 4.2 唤醒 — 因为 `sleep` 完了要通知 task 继续

```
时间线：

0s:  task 执行到 sleep(1s).await → 挂起
     事件循环：没有其他 task，epoll_wait 等 1s

0.5s: （什么都没发生，线程在 sleep，不占 CPU）

1s:  内核 timer 到期 → 唤醒事件循环
     事件循环：查注册表 → "哦，这个 task 要醒了"
     事件循环：调 Waker::wake() → task 被放回就绪队列
     task 恢复执行 → println!("tick")
```

唤醒就是"定时器到了，告诉 task 该起来了"。

### 4.3 分配 — 因为可能有多个 task

单 task 时"分配"不明显，但加几个 task 就不一样了：

```rust
rt.block_on(async {
    tokio::spawn(async {
        tokio::time::sleep(Duration::from_secs(1)).await;
        println!("task A 醒了");
    });
    
    tokio::spawn(async {
        tokio::time::sleep(Duration::from_secs(2)).await;
        println!("task B 醒了");
    });
    
    tokio::time::sleep(Duration::from_secs(3)).await;
    println!("主 task 醒了");
});
```

```
0s:  三个 task 都注册了 timer（1s / 2s / 3s）
     事件循环：epoll_wait 等

1s:  task A 的 timer 到了 → 唤醒 A → 分配给线程1 → "task A 醒了"
     事件循环：epoll_wait 继续等

2s:  task B 的 timer 到了 → 唤醒 B → 分配给线程2 → "task B 醒了"

3s:  主 task 的 timer 到了 → 唤醒 → "主 task 醒了"
     block_on 返回，runtime 销毁
```

多线程模式下，唤醒后的 task 要分配给某个工作线程去跑。

---

## 5. 单 task 其实也用了全部机制

```rust
rt.block_on(async {
    println!("start");
    tokio::time::sleep(Duration::from_secs(1)).await;
    println!("tick");
});
```

```
sleep(1s).await 内部做了什么：

1. 创建一个 Sleep future
2. 向事件循环注册：1s 后唤醒我        ← 需要事件循环
3. 返回 Poll::Pending（"我还没好"）
4. 调度器把当前 task 挂起
5. 事件循环：没有其他 ready 的 task
6. 事件循环：epoll_wait(timeout=1s)  ← 阻塞等，不占 CPU
7. 1s 后内核唤醒                       ← 需要唤醒
8. 事件循环：找到 timer → 唤醒 task    ← 需要唤醒
9. 调度器：task ready → 分配给当前线程  ← 需要分配
10. task 恢复 → poll Sleep → Ready
11. println!("tick")
```

就算只有一个 task，事件循环也得帮它"等 timer"。

---

## 6. Node.js 等价代码对比

```js
async function main() {
    console.log('start');
    await new Promise(r => setTimeout(r, 1000));  // ← 跟 sleep(1s).await 一样
    console.log('tick');
}

main();
```

Node.js 做了一模一样的事：

```
setTimeout(r, 1000)
  → libuv 注册一个 1s 的 timer
  → 当前回调返回（让出执行权）
  → libuv 事件循环等
  → 1s 到了 → libuv 唤醒 → 调用 r()
  → Promise resolve → await 返回 → console.log('tick')
```

完全一样的机制，只是 Node.js 帮你包好了，你看不到。

---

## 7. runtime 的两种模式

```rust
// ① 当前线程（单线程，像 Node.js）
//    所有 task 在一个线程上跑
#[tokio::main(flavor = "current_thread")]
async fn main() { ... }

// ② 多线程（默认，tokio 特色）
//    task 在多个线程上调度
#[tokio::main(flavor = "multi_thread", worker_threads = 4)]
async fn main() { ... }
```

默认是多线程模式，所以 tokio 比 Node.js 多了"真正并行"的能力。

---

## 8. Node.js vs tokio 事件循环对比

### Node.js

```
┌──────────────────────────────────────────┐
│            Node.js 运行时                  │
│                                           │
│  ┌───────────────────────────────────┐   │
│  │        libuv 事件循环              │   │
│  │  epoll/kqueue 监听所有 IO          │   │
│  │  timer 队列                        │   │
│  │  callback 队列                     │   │
│  └───────────────────────────────────┘   │
│                      ↓                    │
│  ┌──────────┐                             │
│  │ 主线程    │  ← 只有一个线程！            │
│  │ 跑所有    │                             │
│  │ callback  │                             │
│  └──────────┘                             │
│                                           │
│  ┌──────────┐                             │
│  │线程池     │  ← libuv 的线程池            │
│  │(4个)     │    (DNS/FS等重IO)            │
│  └──────────┘                             │
└──────────────────────────────────────────┘
```

### tokio

```
┌──────────────────────────────────────────────┐
│              tokio Runtime                    │
│                                               │
│  ┌─────────────────────────────────────────┐ │
│  │          事件循环（Reactor）              │ │
│  │  epoll/kqueue/IOCP 监听所有 IO          │ │
│  │  timer 注册表                            │ │
│  └─────────────────────────────────────────┘ │
│                      ↓ 唤醒                   │
│  ┌─────────────────────────────────────────┐ │
│  │          任务调度器（Scheduler）         │ │
│  │  把 ready 的 task 分配给工作线程          │ │
│  └─────────────────────────────────────────┘ │
│                      ↓ 分配                   │
│  ┌──────┬──────┬──────┬──────┐               │
│  │线程1  │线程2  │线程3  │线程4  │  ← 工作线程  │
│  │task A │task C │task E │task G │             │
│  │task B │task D │task F │task H │             │
│  └──────┴──────┴──────┴──────┘               │
└──────────────────────────────────────────────┘
```

### 核心区别

| | Node.js | tokio |
|---|---|---|
| 事件循环 | libuv 提供 | tokio 自己实现 |
| 线程 | 1 个主线程 + 4 个 IO 线程 | N 个工作线程（= CPU 核心数） |
| 谁跑 callback | 主线程 | 所有工作线程 |
| 并发 | 单线程并发（事件循环切换） | 真正多线程并发 |
| 阻塞 | 一个 callback 阻塞会卡住全部 | 一个 task 阻塞只卡住一个线程 |

---

## 9. 厨师类比

```
Node.js = 一个厨师（主线程）+ 几个帮手（IO线程）
         厨师做所有菜，帮手只帮忙切菜洗碗
         厨师卡住了 → 整个厨房停了

tokio   = N 个厨师（工作线程）
         每个厨师都能做菜，共享一个订单系统（事件循环）
         一个厨师卡住了 → 其他厨师继续做
```

---

## 10. 总结

**`sleep(1s).await` 不是真的"睡觉"，而是"告诉事件循环 1 秒后叫我，我先让出 CPU"。**

- **事件循环**必须存在 → 总得有人帮你计时 + 到时间叫你
- **唤醒**必须存在 → timer 到了得通知 task 继续
- **分配**单 task 时不明显 → 多 task 时要把唤醒的 task 分配给工作线程

一句话：**tokio runtime 就是 Node.js 的 V8 + libuv 的 Rust 版本——提供事件循环 + 任务调度 + 线程池，让 async 代码能跑起来。区别是 Node.js 自带事件循环你不用管，Rust 必须手动启动。而且 tokio 是多线程的，Node.js 是单线程的。**

---

## 11. 异步运行时三合一：事件循环 + 任务调度 + 线程池

### 为什么需要运行时？裸线程不行吗？

**裸线程的问题**：一个 OS 线程绑一个任务，任务卡住（等 I/O）→ 线程跟着卡，白占资源。

```
裸线程模式（一个请求一个线程）：

请求1 → 线程1 → db.query() → 卡住等 100ms → 返回
请求2 → 线程2 → db.query() → 卡住等 100ms → 返回
...
请求1000 → 线程1000 → db.query() → 卡住等 100ms → 返回

问题：
  - 1000 个线程，每个 ~1MB 栈空间 → 1GB 内存
  - 1000 次上下文切换 → CPU 开销
  - 线程在等 I/O 时什么都没做，但线程本身被占住了
```

### 运行时怎么解决

```
tokio 运行时模式（几个线程跑很多任务）：

         ┌──────────────────────────────────┐
         │        事件循环（Reactor）         │
         │  epoll/kqueue 监听所有 IO         │
         │  socket 有数据 → 唤醒等待的 task  │
         │  timer 到时间 → 唤醒 sleep       │
         └──────────────────────────────────┘
                      ↓ 唤醒
         ┌──────────────────────────────────┐
         │       任务调度器（Scheduler）      │
         │  ready 的 task → 分配给工作线程    │
         │  pending 的 task → 不分配，不占线程 │
         └──────────────────────────────────┘
                      ↓ 分配
  ┌──────┬──────┬──────┬──────┐
  │线程1  │线程2  │线程3  │线程4  │  ← 只有 4 个线程
  │task A │task C │task E │task G │
  │task B │task D │task F │task H │
  └──────┴──────┴──────┴──────┘

1000 个并发请求 = 4 个工作线程
  task 等 I/O 时 → 让出线程，线程去跑别的 task
  I/O 回来了 → 事件循环唤醒 → 重新分配给某个线程
```

**关键**：等待时不占线程，不是"不占 CPU"。线程该忙还是忙，只是不空转干等。

### 三个组件各司其职

| 组件 | 职责 | 类比 |
|------|------|------|
| **事件循环** | 监听所有 I/O/timer，谁 ready 了通知谁 | 前台接单：记下哪个任务等什么 |
| **任务调度器** | 把 ready 的 task 分配给工作线程 | 调度员：空闲厨师接下一单 |
| **线程池** | 真正执行 task 的地方 | 厨师：干活的 |

少任何一个都不行：
- 没有事件循环 → 没人帮你等 I/O，只能 `std::thread::sleep` 卡死线程
- 没有调度器 → task 唤醒后没人管，不知道给谁跑
- 没有线程池 → task 在哪跑？没有执行者

---

## 12. tokio vs Node.js：核心区别再对比

### 裸线程同步（都不用）

```js
// Node.js 同步版本（一个请求占一个线程）
app.get('/user', (req, res) => {
  const user = db.querySync('SELECT ...')  // 线程卡这 100ms
  res.json(user)
})
// 1000 并发 = 1000 线程，内存爆炸
```

```rust
// Rust 裸线程版本
fn handle_request() {
  let user = db.query_sync("SELECT ...");  // 线程卡这 100ms
  // ...
}
// 1000 并发 = 1000 个 std::thread，内存爆炸
```

### Node.js 异步（单线程事件循环）

```js
// Node.js 异步版本
app.get('/user', async (req, res) => {
  const user = await db.query('SELECT ...')  // 让出线程
  res.json(user)
})
// 1000 并发 = 1 个主线程轮转
// 但：CPU 密集任务会卡死整个循环
```

```
Node.js:
  ┌─────────────┐
  │  主线程      │  ← 所有 callback 在这一个线程跑
  │  跑所有代码  │
  └─────────────┘
  ┌─────────────┐
  │ libuv 线程池 │  ← 只做重 I/O（DNS/FS）
  │  (4个)      │
  └─────────────┘

  特点：I/O 并发强，但 CPU 并行 = 0
  一个 callback 算 1 秒 → 整个循环卡 1 秒
```

### tokio 异步（多线程事件循环）

```rust
// tokio 异步版本
async fn handle_request() {
  let user = db.query("SELECT ...").await;  // 让出线程
  // ...
}
// 1000 并发 = N 个工作线程，task 在线程间调度
// 而且：CPU 密集任务可以真正并行
```

```
tokio:
  ┌──────┬──────┬──────┬──────┐
  │线程1  │线程2  │线程3  │线程4  │  ← N 个工作线程
  │task A │task C │task E │task G │     都能跑 task
  │task B │task D │task F │task H │
  └──────┴──────┴──────┴──────┘

  特点：I/O 并发强 + CPU 真正并行
  一个 task 算 1 秒 → 其他线程继续跑别的 task
```

### 一句话区别

```
Node.js = 单线程事件循环
         I/O 并发 ✅，CPU 并行 ❌（要 worker_threads 才行）

tokio   = 多线程事件循环
         I/O 并发 ✅，CPU 并行 ✅（天生多核）

本质：
  Node.js 的事件循环思路（等 I/O 时不占线程）
  + 多核并行（多个工作线程抢活干，work stealing）
  = tokio
```

### 为什么 tokio 比 Node.js 多了"真正并行"

```
Node.js 的事件循环是单线程的：

  时间线：
  ──────────────────────────────►
  task1: ████████(算CPU)██████
  task2:                      ████(等I/O好了，继续)

  task1 在算 CPU 时，task2 只能等
  即使有 8 核 CPU，也只用 1 核


tokio 的事件循环是多线程的：

  线程1: ████████(task1 算CPU)████████
  线程2:    ████(task2 等I/O)███████████
  线程3:          ██(task3)██
  线程4:  ████████(task4)███████████████

  task1 算 CPU 时，task2/3/4 在其他线程并行跑
  8 核 CPU 全部用上
```
