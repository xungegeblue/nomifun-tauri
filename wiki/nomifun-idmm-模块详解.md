# nomifun-idmm 模块详解

> IDMM = Intelligent Decision-Making Mode（智能决策模式）—— 每会话监督器，在 agent 遇到 provider 故障、决策停滞、空闲超时等场景时自动介入，保持会话存活。

## 一、模块定位

`nomifun-idmm` 是 nomifun 后端的**自动驾驶保活系统**。Agent 运行时会遇到三种"卡住"的情况：

| 场景 | 例子 | 不干预的后果 |
|------|------|-------------|
| **Provider 故障** | API 限流 429、500、网络断开 | 会话死等，用户手动重试 |
| **决策停滞** | Agent 抛出编号选项问用户选哪个，但用户不在 | 会话挂起，任务中断 |
| **空闲超时** | Terminal PTY 长时间无输出 | 会话假死，资源浪费 |

IDMM 的职责：**检测这些情况 → 按策略决定怎么办 → 自动注入动作让会话继续跑**。

---

## 二、模块结构

| 文件 | 职责 |
|------|------|
| `signal.rs` | 信号/决策/动作的数据结构定义 |
| `config.rs` | 配置校验 + provider 故障分类 + 危险操作检测 + 取消选项检测 |
| `detector.rs` | PTY/chat 信号检测 + 中文编号兼容 |
| `probe.rs` | Probe trait + Terminal/Conversation 实现 |
| `prompt.rs` | 旁路模型的 system/user prompt 构建 + JSON 解析 |
| `sidecar.rs` | 旁路模型调用 + backup model 解析 |
| `policy.rs` | 信号→干预的规则引擎 + 升级阶梯 + 退避 + 预算 |
| `supervisor.rs` | 每会话监督循环 + 生命周期管理 |
| `routes.rs` | HTTP API 路由（启停/状态查询） |
| `service.rs` | 业务服务层 |
| `state.rs` | 共享状态 |
| `util.rs` | 工具函数 |

### 分层设计

```
signal / config / detector / prompt / util  →  纯函数（无副作用）
probe                                        →  抽象目标（Terminal / Conversation）
sidecar                                      →  调旁路模型
policy                                       →  升级阶梯（Rule → Sidecar → Halt）
supervisor                                   →  跑每会话循环
```

---

## 三、核心数据结构

### 3.1 SessionSignal — 会话状态信号

检测器产出的信号，描述会话当前状态：

| 变体 | 含义 |
|------|------|
| `Working` | 正常运行中 |
| `ProviderError` | Provider 报错（429/500 等） |
| `AgentError` | Agent 自身报错 |
| `Idle` | 空闲超时（PTY 无输出 / agent 无事件） |
| `Decision` | 检测到决策提示（编号选项） |
| `Done` | 任务完成 |
| `Cancelled` | 被取消 |
| `Exited` | 会话退出 |

### 3.2 WakeAction — 干预动作

策略层产出的动作，描述"怎么办"：

| 变体 | 含义 |
|------|------|
| `Retry` | 重试上一次请求 |
| `SendText(text)` | 注入文本（如回答开放问答、轻推 "continue"） |
| `AnswerChoice(idx)` | 选第 N 个选项 |
| `Confirm` | 确认（yes/y） |
| `Failover` | 切换到备用模型 |
| `Wait(secs)` | 等一会再检查 |
| `Stop` | 停止会话 |

### 3.3 DecisionPrompt — 决策提示

| 变体 | 含义 |
|------|------|
| `Options` | 编号选项列表 + 权限标记 + 推荐 |
| `OpenQuestion` | 纯问答（掷 D6 骰子决策模式） |

### 3.4 StallClass — 停滞分类

| 变体 | 用于 |
|------|------|
| `ProviderError` | 故障 lane |
| `Idle` | 空闲 |
| `Decision` | 选项决策 |
| `OpenQuestion` | 开放问答 |

---

## 四、两层架构

```
信号检测 (detector / probe)
         │
         ▼
    SessionSignal
         │
         ▼
  策略路由 (policy) ──→ Rule tier（无 LLM，规则匹配）
         │                    │
         │              ┌─────┘
         ▼              ▼
    Sidecar tier（旁路模型，LLM 决策）
         │
         ▼
    WakeAction → probe.inject() → 会话恢复
```

### Rule tier（快、免费、无 LLM）

纯函数、确定性。用 `is_destructive` / `is_cancel_option` / `is_provider_fault` 三个分类器做安全过滤，用四条规则路径做决策。搞不定的才升级到 sidecar。

### Sidecar tier（慢、花钱、但聪明）

调旁路 backup model 做决策，返回结构化 JSON：`{action, text, wait_secs, confidence, reason}`。旁路模型可以 per-watch 覆盖、回退全局默认、再回退会话自身模型。

---

## 五、检测器

### 5.1 TerminalProbe（Terminal 会话）

扫描 PTY 字节流，检测两类信号：

- **Provider-error 签名**：匹配 `429`、`rate limit`、`overloaded` 等关键词
- **决策提示**：编号选项模式

**自回显保护**：IDMM 自己注入的文本会在 PTY 里 echo 回来，检测器维护 `recent_injections` 队列，跳过自己注入的行，避免"自己触发自己"的死循环。

### 5.2 ConversationProbe（Chat 会话）

- `detect_chat_decision()`：保守检测——需要 ≥2 个编号选项 + 明确选择意图才认为是决策提示
- `detect_chat_open_question()`：检测纯问答（有问句但无选项）
- `map_agent_event()`：映射 agent 事件到信号（`Finish(Cancelled)` → `Cancelled`，非 `Done`）
- **路由判断**：`extra_marks_routed_conversation()` 判断 conversation 是否路由到远程人类（channel/companion），如果是 → IDMM 不自动回答

### 5.3 中文编号兼容

检测器支持中文编号格式：

| 格式 | 例子 |
|------|------|
| 顿号 | `1、` |
| 全角括号 | `（1/2）`、`［1-3］` |
| 全角右括号 | `1）` |
| 全角句点 | `1．` |
| 常规格式 | `1.` `1)` |

---

## 六、规则层详解

规则层实现在 `policy.rs`（核心规则引擎）和 `config.rs`（辅助分类器）两个文件里。

`PolicyState::on_stall()` 是总入口，收到信号后按两条车道分发：

- **Fault lane**：`ProviderError` / `AgentError` → 走 `on_fault()`
- **Decision lane**：`Idle` / `Decision` → 走 `on_decision()` 或 `on_open_question()`

每条车道有独立的配置（`fault_watch` / `decision_watch`）、独立的预算和冷却。

### 6.1 故障规则（`on_fault`）

```
ProviderError / AgentError 到达
    │
    ├─ retryable == Some(false)？
    │   └─ 是 → 不可重试 → 直接升级 sidecar 或 Halt
    │
    ├─ retries <= max_retries？
    │   ├─ use_failover_queue == true → Rule(Failover)  ← 切换备用模型
    │   └─ 否则 → Rule(Retry)                           ← 原模型重试
    │
    └─ retries 耗尽 → 升级 sidecar 或 Halt("provider_error_retries_exhausted")
```

**哪些错误算 provider 故障？**（`config.rs::is_provider_fault`）：

共 15 种 `AgentErrorCode`，全是单 vendor 故障：

- 认证失败、权限拒绝、欠费、配置错误
- 模型不存在、不支持的模型、endpoint 不存在
- 请求格式错误、上下文超长
- 限流（429）、超时、网络错误、空响应、网关错误
- 未知上游错误

### 6.2 决策规则（`on_decision`）

#### 6.2.1 工具权限决策（`permission`）

```
agent 请求工具调用权限
    │
    ├─ 有 safe_value（只读工具的 "allow once"）+ only_safe_value？
    │   └─ Rule(Confirm) ← 自动批准安全操作
    │
    └─ 无 safe_value（写/执行类危险工具）+ escalate_risky？
        └─ 升级 sidecar（让模型判断）或 Halt
```

规则层**只自动批准只读安全操作**，写/执行类一律不自动批准。`always_allow` 永远是 `false`——不会记住"以后都允许"。

#### 6.2.2 编号/文本选项决策（`Options`）

```
检测到编号选项（如 "1) 方案A  2) 方案B"）
    │
    ├─ mode != Auto？
    │   └─ 升级 sidecar 或 Halt（AskFirst/Off 不自动决策）
    │
    ├─ prefer_recommended + 有推荐项 + 非危险？
    │   └─ Rule(AnswerChoice(推荐项)) ← 自动选推荐
    │
    ├─ allow_unmarked_pick + 非 Conservative 倾向？
    │   └─ 选第一个安全选项（跳过 cancel 项和危险项）
    │       └─ Rule(AnswerChoice(第一个安全项))
    │
    └─ 都不满足 → 升级 sidecar 或 Halt
```

**安全过滤**（`first_safe_option`）：

- 跳过 `is_cancel_option()` 匹配的选项（取消/放弃/跳过/cancel/skip/abort/quit...）
- 跳过 `is_destructive()` 匹配的选项（除非 `never_destructive == false`）

**倾向控制**（`Tendency`）：

| 倾向 | 行为 |
|------|------|
| `Conservative` | 不自动选无标记选项，宁可升级/停下 |
| `Balanced` | 敢选第一个安全选项 |
| `Aggressive` | 敢选第一个安全选项 |

#### 6.2.3 开放问答（`OpenQuestion`）

```
检测到纯问答（有问句无选项，如 "你希望缓存怎么设计？"）
    │
    └─ 规则层永远不回答 → 升级 sidecar 或 Halt
```

**规则层绝不猜测开放性问题的答案**——这是硬规则。

### 6.3 空闲规则（`Idle`）

```
PTY/会话长时间无输出
    │
    ├─ work_in_progress == false？
    │   └─ Standby（任务已完成，正常等待下一条指令，不干预）
    │
    ├─ work_in_progress == true && retries <= max？
    │   └─ Rule(SendText("continue")) ← 注入 "continue" 轻推 agent
    │
    └─ nudge 次数耗尽 → 升级 sidecar 或 Halt("idle_nudges_exhausted")
```

关键区分：`Working` 后收到 `Done` → idle 是正常的（Standby）；`Working` 后没收到 `Done` 就 idle → 卡了（nudge）。

### 6.4 安全规则（`config.rs`，贯穿所有场景）

| 函数 | 作用 | 匹配签名 |
|------|------|---------|
| `is_destructive()` | 拦截危险操作 | `rm -rf`, `rm -fr`, `drop table`, `drop database`, `truncate`, `delete from`, `force push`, `push --force`, `push -f`, `reset --hard`, `git clean -`, `mkfs`, `dd if=`, `> /dev/` |
| `is_cancel_option()` | 识别取消选项 | 取消/放弃/跳过/稍后/暂不/退出/cancel/skip/abort/quit/go back/none of/do nothing... |
| `is_provider_fault()` | 分类 provider 故障 | 15 种 AgentErrorCode |

### 6.5 预算与冷却规则

| 规则 | 说明 |
|------|------|
| **每小时干预上限** | `max_interventions_per_hour`，超出 → `Halt("budget_exhausted")` |
| **最小间隔** | `min_interval_secs`，间隔内 → `Wait`（但不适用于 blocking decision） |
| **指数退避** | `BACKOFF_LADDER = [10s, 30s, 120s, 300s]`，每次干预后递增 |
| **预算独立** | fault watch 和 decision watch 各自独立计数，互不影响 |

**重要例外**：blocking decision（agent 卡住等回答）**不受 min_interval 限制**——否则会被静默丢弃导致死锁。

### 6.6 状态转换规则

| 事件 | 效果 |
|------|------|
| 收到 `Working` | 清除 cancel 抑制，退避重置为 0，但**不清**重试计数 |
| 收到 `Done` | 清除重试计数 + 退避 + cancel 抑制 |
| 用户 `Cancel` | 抑制所有后续 stall → `Standby`，直到新 `Working` 到来 |
| 退避递增 | 每次干预后 `backoff_step +1`，封顶 300s |

---

## 七、旁路模型层（Sidecar）

### 7.1 调用流程

```
Rule tier 搞不定 → 升级到 Sidecar
    │
    ├─ 解析 backup model（per-watch override → global default → 会话自身 model）
    ├─ 构建 prompt（prompt.rs）
    │   ├─ System: SIDECAR_SYSTEM（严格 JSON 输出契约）
    │   └─ User: build_user_prompt() / build_open_question_prompt()
    ├─ 调用旁路模型
    └─ 解析 JSON 结果（parse_decision，容错解析，容忍 code fence 和 prose）
```

### 7.2 输出契约

旁路模型必须返回结构化 JSON：

```json
{
  "action": "answer_choice | send_text | confirm | retry | wait | stop",
  "text": "可选，注入文本",
  "wait_secs": 30,
  "confidence": 0.8,
  "reason": "选择理由"
}
```

### 7.3 SidecarOutcome

| 变体 | 含义 |
|------|------|
| `decision` | 旁路模型给出决策 |
| `provider_failed` | 旁路模型自己也挂了 → 保守回退 `Retry` |
| `resolved` | 旁路模型判断不需要干预 |

---

## 八、Supervisor 监督循环

`supervisor.rs` 是核心运行时。

### 8.1 IdmmManager

- 管理每个活跃会话的监督任务
- 活计数器（有多少会话在被监督）
- 持续记忆（跨轮次的干预历史）
- 调度器（定时检查）

### 8.2 run_supervisor 循环

```
run_supervisor(session_id):
  loop {
    1. 从 probe 拿 SessionSignal
    2. 喂给 policy，得到 PolicyStep
    3. 根据 PolicyStep 执行：
       - Rule(action) → probe.inject(action)
       - Sidecar → 调旁路模型 → 解析结果 → probe.inject(action)
       - Halt → 停止监督
       - Benign → 不干预，继续观察
    4. 记录干预审计到 DB（idmm_interventions 表）
    5. 等待下一轮检查
  }
```

### 8.3 SupervisorShared

跟踪每个会话的运行时状态：

- `intervening` — 干预中标记
- `count` — 干预计数
- `last_signal` — 最后信号
- `last_intervention_at` — 最后干预时间

### 8.4 PolicyStep

| 变体 | 含义 |
|------|------|
| `Rule(WakeAction)` | 规则层决策，直接执行 |
| `Sidecar{class, detail}` | 升级到旁路模型 |
| `Halt(reason)` | 停止监督 |
| `Benign` | 不干预，继续观察 |

---

## 九、使用场景

### 9.1 故障值守（Fault Watch）

**场景**：Agent 跑着跑着，上游 LLM Provider 挂了。

| 情况 | 规则层 | 旁路模型层 |
|------|--------|-----------|
| 可重试 + retries 未耗尽 | `Retry`（指数退避）或 `Failover`（切备用模型） | — |
| 可重试 + retries 耗尽 | — | 升级到 sidecar |
| 不可重试 | 直接跳过规则层 | 升级到 sidecar 或 Halt |
| 旁路模型也挂了 | 保守回退 `Retry` | — |
| 预算耗尽 | `Halt("budget_exhausted")` | — |

### 9.2 决策值守（Decision Watch）

**场景**：Agent 遇到需要人做决定的地方，但人不在。

| 情况 | 规则层 | 旁路模型层 |
|------|--------|-----------|
| 有推荐选项 + 非危险 | `AnswerChoice(推荐)` | — |
| 无推荐 + allow_unmarked_pick + 非保守 | `AnswerChoice(第一个安全选项)` | — |
| 工具权限 + 只读安全操作 | `Confirm(safe_value)` | — |
| 工具权限 + 写/执行操作 | — | 升级 sidecar 或 Halt |
| 开放问答 | **永远不回答** → Halt | 升级 sidecar（如果 `answer_open_questions` 开了） |
| 空闲 + work_in_progress | `SendText("continue")` | nudge 耗尽后升级 sidecar |
| 空闲 + 已完成 | `Standby`（不干预） | — |

### 9.3 两个 Watch 独立开关

可以只开 fault watch（只管故障重试，不碰决策）、只开 decision watch（只管决策，故障不重试）、或都开。一个 watch 关闭时，它 lane 的信号直接变 `Standby`。

---

## 十、局限性与功能边界

### 10.1 故障值守的局限

1. **只认 15 种已知的 Provider 错误码**——`is_provider_fault()` 是白名单制。Provider 返回了不在列表里的新错误类型，IDMM 不认为这是 provider 故障
2. **Retry 只是重发请求**——不修改请求内容。上下文超长导致的失败，retry 多少次都一样
3. **Failover 依赖候选模型队列**——`use_failover_queue` 开了才有，队列里只有一个模型时 Failover 等于 Retry
4. **退避是会话级共享的**——`backoff_step` 跨 fault/decision 两个 lane 共享，一个 lane 的频繁干预会推高另一个 lane 的等待时间
5. **retries 跨轮次累积**——`Working` 信号不清除 retry 计数器，只有 `Done` 才会清

### 10.2 决策值守的局限

1. **开放问答规则层绝不回答**——没配旁路模型时，agent 问了开放问题就卡死
2. **决策检测依赖文本模式匹配**——`detect_chat_decision()` 需要 ≥2 个编号选项 + 选择意图。自然语言说"你觉得 A 好还是 B 好"但没编号格式，检测不到
3. **安全过滤是子串匹配**——`is_destructive()` 和 `is_cancel_option()` 用 `to_lowercase().contains()`。选项文本碰巧包含 "skip" 但意思不是取消（如 "skip verification" 是功能名），会被误判
4. **Conservative 倾向很保守**——不开 auto-pick + 没推荐项，几乎每个决策都会 Halt
5. **权限决策只自动批准 safe_value**——写/执行类工具一律不自动批准，`always_allow` 永远 `false`
6. **blocking decision 豁免 min_interval 但不豁免 per-hour cap**——频繁决策时 per-hour 上限到了直接 Halt
7. **旁路模型复用决策值守的策略**——fault lane 没有自己的 `DecisionStrategy`，升级到 sidecar 时用的是 decision watch 的策略

### 10.3 共同的功能边界

| 边界 | 说明 |
|------|------|
| **Halt = 彻底停止** | 不是"暂停"——直接 `break` 退出监督循环。用户需重新手动开启 IDMM 才能恢复 |
| **用户取消 > 一切** | `Cancelled` 触发 `suppressed_after_cancel = true`，所有后续 stall 变 `Standby`，直到新 `Working` |
| **远程路由不干预** | conversation 路由到远程人类（channel/companion）时，IDMM 不自动回答 |
| **自回显保护** | 检测器跳过 `recent_injections` 队列里的 echo 行，避免死循环 |
| **审计 fail-open** | DB 写入失败只 `warn`，不阻塞决策路径。IDMM 首要职责是保持会话存活 |
| **两个 watch 独立预算** | 各有独立的 `BudgetConfig`，一个 lane 耗尽不影响另一个 |

---

## 十一、完整流程图

```
Agent 会话启动
    │
    ▼
IDMM Supervisor 开始监督
    │
    ▼
┌──────────────────────────────────────┐
│  检测循环                              │
│  ┌─────────────────────────────────┐ │
│  │ Probe.observe() → SessionSignal │ │
│  └────────────┬────────────────────┘ │
│               │                       │
│               ▼                       │
│  ┌─────────────────────────────────┐ │
│  │ Policy.on_stall(signal)         │ │
│  │  ├─ Fault lane (on_fault)       │ │
│  │  └─ Decision lane               │ │
│  │      ├─ on_decision             │ │
│  │      ├─ on_open_question        │ │
│  │      └─ Idle                    │ │
│  └────────────┬────────────────────┘ │
│               │                       │
│       ┌───────┼───────┐               │
│       ▼       ▼       ▼               │
│    Rule    Sidecar   Halt             │
│       │       │       │               │
│       ▼       ▼       │               │
│  probe.inject()       │               │
│       │               │               │
│       ▼               ▼               │
│  会话恢复          监督停止            │
│       │                               │
│       ▼                               │
│  记录审计到 DB                        │
│       │                               │
│       ▼                               │
│  等待下一轮检查                        │
└──────────────────────────────────────┘
```

---

## 十二、总结

`nomifun-idmm` 本质上是 NomiFun 的**自动驾驶保活系统**：

> Agent 跑着跑着卡了 → IDMM 检测到 → 先用规则快速处理（重试/选取消/等待）→ 规则搞不定就调旁路模型做决策 → 还不行就停下 → 全程记审计日志

它让 agent 在无人值守时也能尽可能保持运行，而不是遇到一个 429 或一个选项提示就死等用户来点。**Halt 是最终兜底——宁可停下等人，也不瞎搞。**
