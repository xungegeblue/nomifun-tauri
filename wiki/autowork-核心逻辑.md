# AutoWork 核心逻辑

> nomifun-requirement 模块的自动编排机制：循环、事件处理、租约。
> 以 Node.js 开发者视角解读 Rust + tokio 实现。

---

## 一、AutoWork 是什么

AutoWork 是一个**持久循环编排器**，自动把"需求"（Requirement）喂给 AI Agent 执行，不需要人工干预。

```
用户选标签 "feature-x" + 选会话 #5 + 点"开启"
  ↓
POST /api/requirements/autowork  Body: { kind: "conversation", target_id: "5", enabled: true, tag: "feature-x" }
  ↓
Orchestrator::start()  →  run_loop()  →  持久循环
```

---

## 二、核心循环：run_loop

位置：`orchestrator.rs` 第 404-629 行

四步循环，**不会因为"没有任务了"而退出**：

```
┌──────────────────────────────────────────────────┐
│  loop {                                          │
│    ① claim_next      — 领一条 pending 需求        │
│    ② inject_and_wait  — 注入 prompt + 等执行完成   │
│    ③ finalize_if_needed — 标记 done/failed/review │
│    ④ 失败退避          — 连续失败指数退避           │
│  }                                               │
│  只有 3 种情况退出：用户取消 / 达上限 / 终端删除    │
└──────────────────────────────────────────────────┘
```

### 关键代码

```rust
loop {
    // 检查取消
    if cancelled.load(Ordering::SeqCst) { break; }

    // ① 领一条
    let claimed = deps.service.claim_next(tag, owner_id, kind, DEFAULT_LEASE_MS).await;
    match claimed {
        Ok(Some(req)) => req,           // 领到了
        Ok(None) => {                   // tag 空了 → 不退出，挂起等通知
            tokio::select! {
                _ = wake => {}           // 有新需求 → 唤醒
                _ = sleep(IDLE_POLL) => {} // 或定时轮询
            }
            continue;
        }
        Err(e) => { continue; }         // 临时错误 → 重试
    }

    // ② 注入 + 等待（按 kind 分两条路）
    let result = match kind {
        Conversation => inject_and_wait(...),
        Terminal => inject_and_wait_terminal(...),
    };

    // ③ finalize 已经在 inject_and_wait 内部调了

    // ④ 达上限检查
    if done_n >= max { break; }

    // ⑤ 失败退避
    match result {
        Done => consecutive_failures = 0,
        Errored | Busy => {
            consecutive_failures += 1;
            sleep(failure_backoff(n)).await;  // 1→2→4→8→16→30s
        }
    }
}
```

### 退出条件（只有 3 种）

| 条件 | 说明 |
|------|------|
| `cancelled` 标志为 true | 用户主动停止 |
| `done_n >= max_requirements` | 达到最大完成数上限 |
| Terminal 被删除 | 终端域专用 |

**tag 空了不退出**——挂起等 `wake` 通知，有新需求自动唤醒继续。

---

## 三、claim_next：原子认领

位置：`service.rs` → `sqlite_requirement.rs` 第 267 行

一条 SQL `UPDATE ... RETURNING` 原子完成 5 件事：

```sql
UPDATE requirements
SET status='in_progress',
    owner_session_id=?, owner_kind=?,     -- 谁领的
    claimed_at=?, started_at=COALESCE(started_at, ?),
    lease_expires_at=? + ?,               -- 租约过期时间
    attempt_count=attempt_count + 1        -- 尝试次数 +1
WHERE id = (
    SELECT id FROM requirements
    WHERE tag = ?                           -- 标签匹配
      AND status = 'pending'                -- 只领待办的
      AND NOT EXISTS (                      -- 标签没被暂停
          SELECT 1 FROM requirement_tags t WHERE t.tag = ? AND t.paused = 1
      )
    ORDER BY sort_seq ASC, priority DESC, created_at ASC
    LIMIT 1
)
RETURNING *
```

### 排序规则

| 优先级 | 字段 | 说明 |
|--------|------|------|
| 1 | `sort_seq ASC` | order_key 小的先（如 1 → 1.1 → 1.2 → 1.10 → 2） |
| 2 | `priority DESC` | 同序时高优先级先 |
| 3 | `created_at ASC` | 同优先级时先创建先 |

`order_key`（用户填的 "1.2"）通过 `to_sort_seq()` 转成 `sort_seq`（"00000001.00000002"），零填充 8 位保证字符串排序 = 数值排序。

---

## 四、事件处理：发布-订阅 + select!

### 4.1 发布-订阅模型

Agent（AI）和 AutoWork 循环之间通过 `tokio::sync::broadcast` channel 通信：

```
Agent (发布者)  ──emit event──→  broadcast channel  ──recv──→  run_loop (订阅者)
```

```rust
// 订阅：先拿 Receiver
let agent = deps.task_manager.get_or_build_task(conversation_id, options).await?;
let rx = agent.subscribe();  // ← Receiver<AgentStreamEvent>

// 发消息触发 Agent 干活
deps.conversation_service.send_message(&user_id, conversation_id, send_req, &deps.task_manager).await?;

// 等 Agent 完成
let outcome = wait_for_terminal_with_renewal(deps, ..., rx).await;
```

### 4.2 事件类型

```rust
enum AgentStreamEvent {
    Text(TextChunk),       // AI 正在输出文字（中间事件）
    Finish(FinishData),    // AI 说完了（终止事件）← 等的就是这个
    Error(ErrorData),      // AI 出错了（终止事件）
    // ... 其他
}

struct FinishData {
    stop_reason: Option<TurnStopReason>,
}

enum TurnStopReason {
    EndTurn,        // 正常结束 → Clean
    Cancelled,      // 用户取消 → Cancelled
    MaxTokens,      // token 超限 → Errored
    MaxTurnRequests,// 请求超限 → Errored
    Refusal,        // AI 拒绝 → Errored
}
```

### 4.3 两种监听方式的区别

#### 方式一：match rx.recv().await（只能等一个事件源）

```rust
// ❌ 只能等 rx，等不了闹钟
match rx.recv().await {
    Ok(Text(t)) => { /* 攒文字，继续等 */ }
    Ok(Finish(d)) => { /* 完成！退出 */ }
    Ok(Error(e)) => { /* 出错，退出 */ }
}
// 问题：等事件期间没法续租约 → 租约过期 → 任务被回收
```

#### 方式二：tokio::select!（同时等多个事件源）

```rust
// ✅ 同时等两个：续租约闹钟 + Agent 事件
tokio::select! {
    _ = renew.tick() => {
        // 闹钟响了（每 30s）→ 续租约
        deps.service.renew_lease(req_id, conv_id, DEFAULT_LEASE_MS).await;
    }
    ev = rx.recv() => {
        // Agent 发事件了
        match ev {
            Ok(Text(t)) => { /* 攒文字 */ }
            Ok(Finish(d)) => { /* 完成！return */ }
            Ok(Error(e)) => { /* 出错，return */ }
            Err(Closed) => { /* Agent 死了，return */ }
            _ => { /* 其他，继续 */ }
        }
    }
}
```

### 4.4 select! 的本质

`select!` = "同时等多个 future，谁先 ready 处理谁，其余的 drop（取消）"

```rust
// 伪代码
loop {
    if A.is_ready() { drop(B); 执行A; break; }
    if B.is_ready() { drop(A); 执行B; break; }
    park();  // 都没好 → 挂起，不占 CPU
}
```

#### 对比 Node.js

| 概念 | Node.js | Rust + tokio |
|------|---------|-------------|
| 同时等多个 | `Promise.race([p1, p2])` | `tokio::select! { p1 => ..., p2 => ... }` |
| 输的怎么处理 | **还在跑**，需手动清理（removeEventListener） | **自动 drop**（取消），无需清理 |
| 挂起机制 | 事件循环（libuv） | tokio 调度器 |
| 等事件 | `await new Promise(r => emitter.once('msg', r))` | `rx.recv().await` |

### 4.5 完整等待循环

```rust
async fn wait_for_terminal_with_renewal(..., mut rx: Receiver<AgentStreamEvent>) {
    let mut renew = interval(Duration::from_secs(30));
    renew.tick().await;  // 消掉第一次立即触发
    let mut note_buf = String::new();

    let fut = async {
        loop {
            tokio::select! {
                // 路径 A：每 30s 续租约
                _ = renew.tick() => {
                    deps.service.renew_lease(req_id, conv_id, DEFAULT_LEASE_MS).await;
                }
                // 路径 B：收 Agent 事件
                ev = rx.recv() => {
                    match ev {
                        Ok(Text(t)) => { note_buf.push_str(&t.content); continue; }
                        Ok(Finish(d)) => return turn_end_from(&d.stop_reason),
                        Ok(Error(d)) => {
                            // retryable + IDMM 监督 → 最多等 5 次恢复
                            if should_wait_for_recovery(...) { continue; }
                            return TurnEnd::Errored;
                        }
                        Err(Closed) => return TurnEnd::Errored,
                        Err(Lagged(_)) => continue,
                        _ => continue,
                    }
                }
            }
        }
    };

    // 外层超时保护
    let end = timeout(TURN_TIMEOUT, fut).await.unwrap_or(TurnEnd::Errored);
    let note = if end == TurnEnd::Clean { finalize_note(&note_buf) } else { None };
    (end, note)
}
```

#### 执行时间线

```
0s:   select! 挂起 → 等事件
5s:   Agent emit Text("分析中") → 走 B → 攒文字 → continue
5s:   select! 挂起 → 等事件
30s:  闹钟响 → 走 A → 续租约
30s:  select! 挂起 → 等事件
35s:  Agent emit Finish(EndTurn) → 走 B → return Clean！
```

---

## 五、租约机制

### 5.1 租约是什么

租约 = **"有保质期的锁"**，防止同一个任务被两个 Agent 同时执行。

```
认领任务 → 租约 120s → 每 30s 续约 → 一直干活
                                ↓
        Agent 崩了 / 超时 → 没人续约
                                ↓
        租约过期 → sweeper 60s 扫一次 → 回收
                                ↓
        status: in_progress → pending，清空 owner
                                ↓
        别的 Agent 可以重新认领
```

### 5.2 状态流转

| 状态 | 含义 | 谁能认领 |
|------|------|---------|
| `pending` | 待办 | 任何 Agent |
| `in_progress` + 租约有效 | 正在干 | 只有 owner |
| `in_progress` + 租约过期 | 挂了没续约 | sweeper 回收成 pending |

### 5.3 三个核心操作

```sql
-- ① 认领时设租约（claim_next）
SET status='in_progress',
    lease_expires_at = now + 120s

-- ② 续约（renew_lease，每 30s 调一次）
UPDATE requirements
SET lease_expires_at = now + 120s
WHERE id = ? AND owner_session_id = ? AND status = 'in_progress'

-- ③ sweeper 回收过期（每 60s 扫一次）
UPDATE requirements
SET status = 'pending', owner_session_id = NULL, lease_expires_at = NULL
WHERE status = 'in_progress' AND lease_expires_at < now
  AND NOT (owner 在活跃会话列表里)  -- 防止误回收正在续约的
```

### 5.4 为什么 select! 要同时等续租约 + 事件

```
没有 select! 的情况：
  rx.recv().await  ← 一直等事件，卡在这里
  ↓
  30s 过去了，没续租约
  ↓
  60s 过去了，sweeper 回收了任务
  ↓
  Agent 还在干，但任务已经被别人认领了 → 冲突

有 select! 的情况：
  select! 同时等 renew.tick() + rx.recv()
  ↓
  每 30s 闹钟响 → 续租约 → 继续等事件
  ↓
  Agent 完成时 → 收到 Finish → 退出
  ↓
  整个过程租约始终有效，任务不会被回收
```

---

## 六、双域隔离

AutoWork 支持两种执行环境，用复合键 `(kind, target_id)` 隔离：

| Kind | 执行环境 | 注入方式 | 等待方式 |
|------|---------|---------|---------|
| `Conversation` | AI 聊天会话 | `send_message` 发 prompt | 监听 `broadcast::Receiver<AgentStreamEvent>` |
| `Terminal` | 终端 PTY | bracketed-paste 注入命令 | 监听 lifecycle `TurnEnd` 事件 |

```rust
// 复合键，避免会话#5 和终端#5 互相踩踏
let conv5: TargetKey = (AutoWorkTargetKind::Conversation, "5".to_string());
let term5: TargetKey = (AutoWorkTargetKind::Terminal, "5".to_string());
assert_ne!(conv5, term5);
```

---

## 七、失败退避

连续失败时指数退避，防止快速烧光重试：

```rust
fn failure_backoff(consecutive: u32) -> Duration {
    let exp = consecutive.saturating_sub(1).min(5);
    let secs = (1u64 << exp).min(30);
    Duration::from_secs(secs)
}
```

| 连续失败次数 | 退避时间 |
|------------|---------|
| 1 | 1s |
| 2 | 2s |
| 3 | 4s |
| 4 | 8s |
| 5 | 16s |
| 6+ | 30s（封顶） |

- 成功（Done）→ 重置为 0
- 用户中断（UserInterrupted）→ 重置为 0（不算失败）
- 退避期间可被 `wake` 唤醒（有新需求 / 恢复标签）

---

## 八、API 入口对照

| API | 功能 | 和 AutoWork 的关系 |
|-----|------|-------------------|
| `POST /api/requirements/claim` | 手动认领一条 | 只领不执行，外部系统用 |
| `POST /api/requirements/autowork` | 开启/关闭 AutoWork | **主入口**，启动持久循环 |
| `GET /api/requirements/autowork/{kind}/{target_id}` | 查询 AutoWork 状态 | 看当前运行状态 |
| `POST /api/requirements/tags/{tag}/resume` | 恢复暂停的标签 | 重新启动被暂停的 AutoWork |
| `POST /api/requirements/{id}/complete` | 标记完成 | MCP 工具调用，Agent 主动声明完成 |

---

## 九、设计要点总结

1. **持久循环**：tag 空了不退出，挂起等通知，有新需求自动唤醒
2. **原子认领**：一条 SQL UPDATE...RETURNING 完成认领，无竞态
3. **租约防抢占**：120s 租约 + 30s 续约 + 60s sweeper，防止重复执行
4. **select! 并行等待**：同时等续租约 + Agent 事件，互不阻塞
5. **双域隔离**：`(kind, target_id)` 复合键，会话和终端互不干扰
6. **指数退避**：连续失败 1→2→4→8→16→30s，防止快速烧光重试
7. **用户中断不算失败**：cancel 暂停 tag 而非消耗重试次数
8. **IDMM 协同**：retryable 错误等 IDMM 恢复（最多 5 次），防止"代码乱套"
