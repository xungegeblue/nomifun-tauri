# nomifun-idmm 并发架构与通讯机制

> IDMM 的 tokio 并发模型、每会话一对一架构、channel 通讯拓扑、触发链详解。

---

## 一、核心结论

| 问题 | 答案 |
|------|------|
| 用 tokio 了吗？ | 是，每个会话至少 2 个 tokio task（probe 1 个 + supervisor 1 个） |
| 是不同线程吗？ | tokio task 是绿色协程，不是 OS 线程，全跑在 tokio runtime 上 |
| 多对一还是一对一？ | **一对一**——每会话独立 supervisor，互不通讯 |
| 通讯机制？ | probe→supervisor 用 `mpsc::channel`；agent/terminal→probe 用 `broadcast::channel`；supervisor→会话用直接 API 调用 |
| 检测手段？ | Conversation：订阅 agent 事件流；Terminal：订阅 PTY 字节流 + lifecycle 事件；两者都用 `tokio::select!` 多路复用 |

---

## 二、为什么必须一对一？

`IdmmConfig` 是 **per-session 配置**——每个会话可以独立设置：

```
IdmmConfig
  ├─ fault_watch（故障值守）
  │    ├─ enabled: bool         ← 开关
  │    ├─ tier: RuleOnly / RulePlusModel  ← 档位
  │    ├─ wake_action: Retry / Failover / FailoverThenRetry
  │    ├─ bypass_model          ← 旁路模型（可 per-session 覆盖）
  │    ├─ budget                ← 每小时干预上限 + 最小间隔
  │    └─ max_retries / scan_interval / scan_scope ...
  │
  └─ decision_watch（决策值守）
  │    ├─ enabled: bool         ← 开关
  │    ├─ tier: RuleOnly / RulePlusModel
  │    ├─ strategy
  │    │    ├─ tendency: Conservative / Balanced / Aggressive
  │    │    ├─ on_blocked: PreferContinue / PreferPause / MustAsk
  │    │    ├─ categories
  │    │    │    ├─ option_decision（prefer_recommended / allow_unmarked_pick / never_destructive）
  │    │    │    ├─ open_question（mode / max_answer_chars）
  │    │    │    └─ permission（only_safe_value / escalate_risky）
  │    │    └─ freeform_policy   ← 自由文本策略指引
  │    ├─ answer_open_questions  ← 纯问答开关
  │    └─ bypass_model / budget / scan_interval ...
  │
  存储位置：conversation.extra.idmm 或 terminal_sessions.idmm（JSON）
```

因为每个会话的配置可能完全不同（一个开了 RuleOnly 故障值守，另一个开了 RulePlusModel 决策值守 + Aggressive 倾向），所以**不可能用一个统一接收者处理所有会话**——必须一对一。

---

## 三、全局架构

```
IdmmManager (全局单例, Arc<IdmmInner>)
  │
  ├─ DashMap<IdmmKey, SupervisorHandle>    ← 每个会话一个 entry
  │    ├─ (Conversation, "123") → tokio::spawn(run_supervisor)  → JoinHandle + cancel flag
  │    ├─ (Conversation, "456") → tokio::spawn(run_supervisor)
  │    ├─ (Terminal, "789")     → tokio::spawn(run_supervisor)
  │    └─ ...
  │
  ├─ DashMap<IdmmKey, Arc<SupervisorShared>>  ← 每个会话的状态（跨 handle 存活）
  │
  ├─ ConfigReader trait                       ← 读 per-session 配置
  │
  └─ ProbeFactory trait                       ← 按 kind 创建 probe
```

**IdmmKey = (IdmmTargetKind, String)**：因为 conversation 和 terminal 的整数 id 可能重复（conv#5 ≠ term#5），所以用复合键避免踩踏。

---

## 四、每会话的 tokio task 拓扑

每个会话至少 **2 个 tokio task**：

```
┌─── tokio task ①: probe.observe() ──────────────────────────┐
│                                                              │
│  tokio::select! {                                            │
│    // 源 A：agent 事件流（broadcast channel）               │
│    // 源 B：idle 定时器（tokio interval）                    │
│    // 源 C：PTY 字节流（broadcast channel）                 │
│    // 源 D：terminal lifecycle（broadcast channel）          │
│  }                                                           │
│                                                              │
│  检测信号 → tx.send(signal) → mpsc channel                  │
└──────────────────────────────────────────────────────────────┘
                            │
                            │ mpsc::channel(64)
                            │ (probe 是 sender, supervisor 是 receiver)
                            ▼
┌─── tokio task ②: run_supervisor (while loop) ──────────────┐
│                                                              │
│  rx.recv().await → 拿到信号                                  │
│     │                                                        │
│     ├─ Working/Done → 更新状态，不干预                       │
│     ├─ Cancelled → suppressed_after_cancel = true            │
│     ├─ Stall → policy.on_stall() → PolicyStep               │
│     │     ├─ Rule(action)  → probe.inject(action)           │
│     │     ├─ Sidecar       → call LLM → probe.inject()     │
│     │     └─ Halt          → break 退出循环                  │
│     │                                                        │
│     └─ emit_intervention() → DB 审计记录                    │
│                                                              │
│  sleep(scan_interval) → 下一轮                               │
└──────────────────────────────────────────────────────────────┘
```

两个 task 之间**零共享状态**（SupervisorShared 通过 Arc 共享，但由 DashMap 管理，不属于 task 间通讯）。

---

## 五、通讯机制详解

### 1. Probe → Supervisor：`mpsc::channel(64)`

每个 probe 的 `observe()` 创建一个 **tokio mpsc channel**（容量 64）：

- **Sender**：probe 内部的 tokio task（检测到信号后 `tx.send(signal)`)
- **Receiver**：supervisor 的 while 循环（`rx.recv().await` 异步阻塞等待）

```
probe.observe()
  │
  ├─ 创建 (tx, rx) = mpsc::channel(64)
  ├─ tokio::spawn { ... tx.send(signal) ... }  ← probe 产出的 tokio task
  └─ return rx                                   ← supervisor 的 loop 里用
```

虽然 mpsc 是 multi-producer single-consumer，但实际 probe 只有一个 sender task，所以是 **single-producer single-consumer**。supervisor 的 `rx.recv().await` 是异步阻塞的——没信号时挂起等待，不消耗 CPU。

### 2. Agent/Terminal → Probe：`broadcast::channel`

会话自身的事件通过 **`tokio::sync::broadcast`** 推送：

| 会话类型 | 广播源 | 内容 |
|----------|--------|------|
| Conversation | `subscribe()` → `broadcast::Receiver<AgentStreamEvent>` | agent 事件流（Error/Finish/Permission/AcpPermission 等） |
| Terminal | `subscribe_output(id)` → `broadcast::Receiver<Vec<u8>>` | PTY 输出字节流 |
| Terminal | `subscribe_lifecycle(id)` → `broadcast::Receiver<LifecycleEvent>` | terminal 生命周期事件 |

broadcast 是**多对多**——一个 agent/terminal 可以有多个 subscriber。IDMM 的 probe 只是其中一个 subscriber。

### 3. Supervisor → 会话：直接 API 调用

supervisor 决定干预后，调 `probe.inject(action)`：

| Probe 类型 | inject 方式 |
|-----------|------------|
| ConversationProbe | conversation service API（`confirm()` / `send_message()`） |
| TerminalProbe | `driver.write_input(id, bytes)` 往 PTY 写字节 |

这不是 channel 通讯——是直接的函数调用/API 调用。

### 4. Supervisor → DB：审计记录

干预后写入 `idmm_interventions` 表。**fail-open**：DB 写入失败只 warn，不阻塞决策路径。

---

## 六、ConversationProbe 的信号源

```rust
tokio::select! {
    // 源1：agent 事件流（broadcast channel）
    ev = sub.recv() => {
        match ev {
            Error(code)           → ProviderError / AgentError（取决于 is_provider_fault）
            Finish(Cancelled)     → Cancelled
            Finish(other)         → 检查 turn_text 有无决策 → Decision / Done
            Permission(val)       → Decision（工具权限，老路径）
            AcpPermission(req)    → Decision（工具权限，新 ACP 路径）
            其他                  → Working
        }
        tx.send(signal)
    }

    // 源2：idle 定时器（tokio interval）
    _ = ticker.tick() => {
        检查是否有活动
        → 无活动 → tx.send(Idle)
    }
}
```

**远程路由保护**：如果 conversation 被路由到远程人类（channel/companion），IDMM 不自动回答。

**on-arm 恢复**：`observe()` 只订阅未来事件。如果 IDMM 开启时 agent 已经在等回答了，Probe 用 `pendingSignal()` 从 DB 最近消息 + task_manager 的 pending confirmations 恢复历史决策信号。

---

## 七、TerminalProbe 的信号源

```rust
tokio::select! {
    // 源1：PTY 输出字节流（broadcast channel）
    chunk = out.recv() => {
        detector.feed(bytes)
        → 匹配 provider-error 签名 → ProviderError
        → 匹配编号选项模式 → Decision
        → 自回显保护：跳过 recent_injections 队列里的行
        tx.send(signal)
    }

    // 源2：terminal 生命周期事件（broadcast channel）
    lifecycle_ev = lifecycle_rx.recv() => {
        → Exited / 其他
        tx.send(signal)
    }

    // 源3：存活检查定时器（每 2s）
    _ = ticker.tick() => {
        driver.is_alive()?
        → false → Exited
        → true → 继续观察
    }
}
```

---

## 八、完整通讯拓扑图

```
                    ┌─── tokio task ───────────────────────────┐
                    │                                          │
  Agent Stream      │  ConversationProbe.observe()            │
  (broadcast) ─────┤──► sub.recv()                            │
                    │     │ map → signal                       │
                    │     └──► tx.send(signal) ──────┐         │
                    │                                 │         │
  Idle Timer        │  ticker.tick()                  │         │
  (tokio interval) ─┤──► ───────────────── tx.send()┘         │
                    │                                          │
                    └──────────────────────────────────────────┘
                                      │
                                      │ mpsc channel (64)
                                      │
                                      ▼
                    ┌─── tokio task ───────────────────────────┐
                    │                                          │
                    │  run_supervisor (while loop)             │
                    │                                          │
                    │  rx.recv() ───► signal                   │
                    │     │                                    │
                    │     ├─ Working/Done → on_progress()      │
                    │     ├─ Cancelled → on_user_cancel()      │
                    │     ├─ Stall → policy.on_stall()         │
                    │     │     ├─ Rule(action)                │
                    │     │     │  └──► probe.inject()         │
                    │     │     │       └──► conversation API  │──► 会话
                    │     │     ├─ Sidecar                    │
                    │     │     │  └──► call LLM ─► probe.inject()
                    │     │     └─ Halt → break               │
                    │     │                                    │
                    │     └──► emit_intervention() ──► DB     │
                    │                                          │
                    └──────────────────────────────────────────┘
```

---

## 九、触发链详解

### Conversation 路径（故障场景）

```
1. Agent 调 LLM → LLM 返回 429
2. Agent 内部生成 AgentStreamEvent::Error(RateLimited)
3. Agent 的 broadcast channel 推送 event 给所有 subscriber
4. ConversationProbe 的 tokio task 收到 → map_agent_event() → SessionSignal::ProviderError
5. tx.send(ProviderError) → mpsc channel
6. Supervisor 的 rx.recv() 收到 ProviderError
7. policy.on_stall() → Rule(Retry) 或 Sidecar 或 Halt
8. probe.inject(Retry) → conversation service 重试请求
```

### Conversation 路径（决策场景）

```
1. Agent 输出文本含编号选项："请选择：1) 方案A  2) 方案B"
2. Agent turn 结束 → AgentStreamEvent::Finish(turn_text)
3. Agent 的 broadcast channel 推送 Finish event
4. ConversationProbe 收到 → 检查 turn_text → detect_chat_decision()
   → 发现 ≥2 编号选项 + 选择意图 → DecisionPrompt(Options)
5. tx.send(Decision) → mpsc channel
6. Supervisor 收到 → policy.on_stall() → 选推荐 / 选安全项 / Sidecar / Halt
7. probe.inject(AnswerChoice(0)) → conversation 发 "1"
```

### Terminal 路径（故障场景）

```
1. CLI agent 输出 "Error: rate limit exceeded" 到 PTY
2. TerminalDriver 的 broadcast channel 推送字节给 subscriber
3. TerminalProbe 的 tokio task 收到 → detector.feed(bytes)
4. detector 匹配 provider-error 签名 → ProviderError
5. tx.send(ProviderError) → mpsc channel
6. Supervisor 处理 → policy → Rule(Retry)
7. probe.inject() → driver.write_input("continue\n")
8. CLI agent 收到 "continue" 输入 → 重新尝试
```

---

## 十、生命周期管理

### ensure（启动监督）

```rust
async fn ensure(&self, kind: IdmmTargetKind, target_id: &str) {
    // 1. 检查是否已有活跃 supervisor
    if self.is_supervising(kind, target_id) { return; }

    // 2. 读 per-session 配置
    let cfg = self.config_reader.read(kind, target_id).await;
    if !cfg.any_enabled() { return; }  // 两个值守都关 → 不启动

    // 3. 创建 probe
    let probe = self.factory.build(kind, target_id);

    // 4. 获取共享状态
    let shared = self.shared_for(kind, target_id);

    // 5. tokio::spawn 启动 supervisor task
    let join = tokio::spawn(run_supervisor(probe, cfg, deps, shared, cancel));

    // 6. 存入 handles map
    self.handles.insert(key, SupervisorHandle { cancel, join, generation });
}
```

### stop（停止监督）

```rust
fn stop(&self, kind: IdmmTargetKind, target_id: &str) {
    // 直接从 handles map 移除 → JoinHandle 被 drop → task 取消
    self.handles.remove(&(kind, target_id.to_string()));
}
```

### 自然退出（SupervisorCleanup）

supervisor task 正常退出时，`SupervisorCleanup` 的 `Drop` 实现自动从 handles map 移除自己（带 generation 匹配，防止误删新 supervisor）。这解决了"死 supervisor 占坑导致 ensure 无法 re-arm"的问题。

### generation 机制

每个 supervisor 有一个递增的 `generation` 号。`SupervisorCleanup` 只删除 generation 匹配的 entry——如果 supervisor 自然退出后用户又重新开了 IDMM，新 supervisor 有更高的 generation，旧 cleanup 不会误删新 entry。

---

## 十一、共享状态

`SupervisorShared` 跨 handle 存活（即使 supervisor task 退出了，shared 状态仍保留在 DashMap 里），供 API 查询：

```rust
pub struct SupervisorShared {
    intervening: AtomicBool,          // 是否正在干预中
    count: AtomicU32,                 // 干预总次数
    last_signal: Mutex<Option<String>>, // 最近信号
    last_intervention_at: Mutex<Option<i64>>, // 最近干预时间
}
```

API 通过 `IdmmState` 把这些暴露给前端（状态点显示 Armed/Intervening/Off）。

---

## 十二、总结

IDMM 的并发架构可以一句话概括：

> **每个会话是一个独立的 while(true) 循环 tokio task，通过 mpsc channel 从 probe 拿信号，通过 broadcast channel 从会话拿事件，通过直接 API 调用往会话注入动作。一对一，互不干扰。**

```
会话 A 的 supervisor task:
  probe_A.observe() → rx_A.recv() → policy_A.on_stall() → probe_A.inject()

会话 B 的 supervisor task:
  probe_B.observe() → rx_B.recv() → policy_B.on_stall() → probe_B.inject()

两个 task 之间零通讯，各跑各的 while 循环
各用自己的 IdmmConfig（per-session 配置）
各用自己的 PolicyState（退避/retries/nudges）
各自己的 BudgetConfig（独立预算）
```
