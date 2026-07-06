# nomifun-cron 模块详解

> 定时任务引擎：负责"什么时候触发"→"触发后怎么调 agent"→"结果回传与重新调度"

---

## 一、模块定位

`nomifun-cron` 是 NomiFun 后端的定时任务引擎。它让用户和 agent 都能创建定时任务，到点后自动唤醒 agent 执行指令。

核心能力：
- 三种调度模式：一次性（At）、固定间隔（Every）、cron 表达式（Cron）
- 两种执行模式：复用现有会话（Existing）、每次新建会话（NewConversation）
- 防并发、重试、补漏、事件通知

源码位置：`crates/backend/nomifun-cron/src/`

---

## 二、整体架构：三层分工

```
CronService（业务编排层）
  ├── CronScheduler（定时调度层）—— 负责"什么时候触发"
  ├── JobExecutor（执行层）        —— 负责"触发后怎么调 agent"
  └── CronEventEmitter（事件层）   —— 负责通知前端
```

| 组件 | 职责 | 关键字段 |
|------|------|---------|
| `CronScheduler` | 管理 tokio timer，到点触发回调 | `DashMap<String, JoinHandle>` + `TickCallback` |
| `JobExecutor` | 构建/复用 agent，发送消息 | `IWorkerTaskManager` + `AgentRegistry` + `ConversationService` |
| `CronService` | CRUD + tick 编排 + 结果处理 | `repo` + `scheduler` + `executor` + `emitter` |

---

## 三、核心数据结构（types.rs）

### CronJob —— 领域模型

```rust
pub struct CronJob {
    pub id: String,
    pub user_id: String,
    pub title: String,
    pub prompt: String,              // 任务指令
    pub schedule: CronSchedule,      // 调度模式
    pub execution_mode: ExecutionMode,
    pub target: TargetKind,
    pub agent_config: Option<CronAgentConfig>,
    pub conversation_id: Option<String>,  // Existing 模式绑定的会话
    pub enabled: bool,
    pub created_by: CreatedBy,       // User / Agent
    pub last_status: Option<JobStatus>,
    pub run_count: i64,
    pub next_run_at: Option<TimestampMs>,
    // ...
}
```

### CronSchedule —— 三种调度模式

```rust
pub enum CronSchedule {
    At(TimestampMs),                           // 一次性：指定时间戳
    Every { interval_ms: TimestampMs },        // 间隔循环：每隔 N 毫秒
    Cron { expression: String, timezone: Option<String> },  // cron 表达式
}
```

### ExecutionMode —— 两种执行模式

```rust
pub enum ExecutionMode {
    Existing,        // 复用 conversation_id 指向的现有会话
    NewConversation, // 每次触发都创建新会话
}
```

### TargetKind —— 执行目标

```rust
pub enum TargetKind {
    Agent,  // 仅支持 Agent（Terminal 已废弃）
}
```

### CronAgentConfig —— Agent 配置

```rust
pub struct CronAgentConfig {
    pub backend: String,              // acp / nomi / openclaw / nanobot
    pub name: Option<String>,
    pub cli_path: Option<String>,
    pub model_id: Option<String>,
    pub workspace: Option<String>,
    pub clear_context_each_run: bool,  // Existing 模式下每次清上下文
    pub inject_skills: Vec<String>,
    pub mode: Option<String>,
}
```

### JobStatus —— 执行结果

```rust
pub enum JobStatus {
    Ok,
    Error,
    Skipped,   // 跳过（如上次还没跑完）
    Missed,    // 错过（系统休眠期间）
}
```

---

## 四、定时调度层（scheduler.rs）

### 1. CronScheduler 结构

```rust
pub struct CronScheduler {
    timers: DashMap<String, JoinHandle<()>>,  // job_id → tokio task handle
    tick_callback: TickCallback,
}

pub type TickCallback = Arc<dyn Fn(String) + Send + Sync>;
// String = job_id
```

- 每个活跃 job 对应一个 tokio timer task，`JoinHandle` 存入 `DashMap`
- 取消时 `handle.abort()` 掉对应 timer

### 2. 三种 timer spawn 函数

```rust
// At：一次性 —— sleep 到指定时间戳，触发后自动取消
fn spawn_at_timer(job_id, at_ms, callback) {
    tokio::spawn(async move {
        tokio::time::sleep_until(Instant::from_millis(at_ms)).await;
        callback(job_id);
    });
}

// Every：固定间隔 —— interval 循环
fn spawn_every_timer(job_id, every_ms, callback) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_millis(every_ms));
        loop {
            interval.tick().await;
            callback(job_id);
        }
    });
}

// Cron：cron 表达式 —— 计算下次运行时间，sleep，触发后再算
fn spawn_cron_timer(job_id, expr, tz, callback) {
    tokio::spawn(async move {
        loop {
            let next = compute_next_run(&expr, &tz, now());
            tokio::time::sleep_until(next).await;
            callback(job_id);
        }
    });
}
```

### 3. cron 表达式处理

- `normalize_cron_expr()`：标准 5 字段 cron → 6 字段（补秒位），适配 cron crate
- `compute_next_run()`：算下次运行时间，支持时区
- `validate_schedule()`：校验表达式合法性

### 4. TickCallback —— 调度器到 Service 的桥梁

初始化时，`CronService` 把自己的 `tick` 方法包装成 `TickCallback` 注入 `CronScheduler`：

```rust
// 伪代码
let callback: TickCallback = Arc::new({
    let service = Arc::clone(&self);
    move |job_id: String| {
        let service = Arc::clone(&service);
        tokio::spawn(async move {
            service.tick(job_id).await;
        });
    }
});
scheduler.set_callback(callback);
```

timer 到点 → `callback(job_id)` → `CronService::tick(job_id)`

---

## 五、业务编排层（service.rs）

### CronService 结构

```rust
pub struct CronService {
    repo: Arc<dyn ICronRepository>,       // DB 操作
    scheduler: Arc<CronScheduler>,        // 定时调度
    executor: Arc<JobExecutor>,           // 执行 agent
    emitter: CronEventEmitter,            // 事件通知
    data_dir: PathBuf,
}
```

### 核心方法

| 方法 | 职责 |
|------|------|
| `init()` | 应用启动时调用，从 DB 加载所有 enabled 的 job，过滤孤儿 job，逐个 `schedule_job` |
| `add_job(job)` | 创建新 job → 写 DB → `scheduler.schedule_job` |
| `update_job(job)` | 更新 job → 写 DB → 取消旧 timer → 重新调度 |
| `remove_job(id)` | 取消 timer → 删 DB |
| `tick(job_id)` | timer 到点的入口：加载 job → 检查 enabled → 调 `executor.execute` |
| `handle_execution_result()` | 更新 DB（last_status / run_count / next_run_at）→ 记录历史 → reschedule → emit 事件 |
| `handle_system_resume()` | 系统休眠恢复后：检查 `next_run_at < now` 的 job，标记 missed，插 tips 消息提醒，重新调度 |

### PLACEHOLDER_PATTERNS —— 占位符检测

`service.rs` 里维护了一个占位符模式列表（如 `{{workspace}}`、`{{conversation_id}}`），用于检测 prompt 里未替换的占位符，避免 agent 收到原始模板字符串。

---

## 六、执行层（executor.rs）

### JobExecutor 结构

```rust
pub struct JobExecutor {
    task_manager: Arc<dyn IWorkerTaskManager>,    // agent 进程池
    agent_registry: Arc<AgentRegistry>,            // agent 类型注册表
    conversation_service: Arc<ConversationService>, // 会话管理
    event_broadcaster: Arc<EventBroadcaster>,       // 事件广播
}

const RETRY_INTERVAL_MS: TimestampMs = 30_000;      // 重试间隔 30 秒
const SKILL_SUGGEST_TURN_TIMEOUT_MS: u64 = 120_000; // skill suggest 超时 2 分钟
```

### 执行流程

```
JobExecutor::execute(job)
  │
  ├─ ① CronBusyGuard 检查（防并发）
  │    └─ 该 conversation 已在跑？→ Retrying（30s 后重试）or Skipped
  │
  ├─ ② prepare_saved_skill（读 skill 文件）
  ├─ ③ validate_workspace
  ├─ ④ resolve_conversation ← 决定用哪个会话
  │
  └─ ⑤ execute_inner(job, conv_id)
       ├─ task_manager.get_or_build_task(conv_id, options) → AgentInstance
       ├─ agent.clear_context()（可选，Existing 模式 + clear_context_each_run）
       ├─ build_prompt(job)（根据模式生成不同 prompt）
       └─ conversation_service.send_message(user_id, conv_id, req, &task_manager)
            └─→ 消息进入 agent，agent 开始工作
```

---

## 七、如何开启 Agent 会话（resolve_conversation）

### ExecutionMode::Existing（复用现有会话）

```
resolve_conversation(job)
  │
  ├─ conversation_id 为空？（lazy-bind 首次运行）
  │    └─ YES → create_new_conversation()  ← 第一次运行时创建，写回 job
  │
  └─ conversation_id 不为空
       ├─ verify_conversation_exists()  ← 检查 DB 里会话还在
       │    └─ 不存在了？→ create_new_conversation() 重新绑定
       └─ 复用这个 conversation_id
```

复用时的处理：
- `task_manager.get_or_build_task(conv_id, options)` —— agent 已存在就复用，不存在就新建
- 可选 `clear_context_each_run` —— 清掉 agent 上下文但保留可见消息记录
- prompt 用 `build_existing_conversation_prompt()`，格式 `[Scheduled Task Execution]` + 任务指令

### ExecutionMode::NewConversation（每次创建新会话）

```
resolve_conversation(job)
  │
  └─ create_new_conversation(job)  ← 每次都创建
       ├─ parse_agent_type()  ← 通过 AgentRegistry 解析（claude/gemini → Acp）
       ├─ resolve_model()     ← nomi 从 agent_config.backend 拿 provider_id
       ├─ build_conversation_extra()  ← 注入 agent_id/backend/workspace/skills/mode
       ├─ ConversationService::create()  ← 在 DB 创建会话行
       ├─ 如果没有 workspace → 创建临时目录
       └─ 返回新的 conversation_id
```

新会话的 prompt 两种：
- **有 saved skill** → `build_new_conversation_with_skill_prompt()`，告诉 agent 有 skill 文件已加载
- **无 saved skill** → `build_new_conversation_prompt_with_skill_suggest()`，让 agent 先创建 `SKILL_SUGGEST.md`（skill suggest 流程，超时 120s）

### 消息发送（两种模式统一）

```rust
let send_req = SendMessageRequest {
    content: prompt,                // 构建好的 cron prompt
    files: vec![],
    inject_skills: skill_names,     // 注入的 skill 列表
    hidden: true,                   // 对用户隐藏（cron 触发的）
    origin: Some("cron".into()),    // 标记来源
    channel_platform: None,
};

conversation_service.send_message(&user_id, conversation_id, send_req, &task_manager).await
```

`origin: "cron"` 和 `hidden: true` 确保这条消息在 UI 上标记为 cron 触发，不干扰正常对话流。

---

## 八、IWorkerTaskManager —— Agent 进程池管家

> 这是 cron 执行层依赖的关键组件，定义在 `nomifun-ai-agent/src/task_manager.rs`

### 它是什么

`IWorkerTaskManager` **不是会话管理器**，它是 **agent 进程池管家**。管的是活的 `AgentInstance`（agent 进程/连接实例），不是 DB 里的会话行。

### 核心结构

```rust
pub struct WorkerTaskManagerImpl {
    tasks: DashMap<String, TaskSlot>,   // conversation_id → agent 槽位
    factory: AgentFactory,              // 工厂函数（怎么造 agent）
}

type TaskSlot = Arc<OnceCell<AgentInstance>>;

// 工厂函数：BuildTaskOptions → 活的 agent
pub type AgentFactory =
    Arc<dyn Fn(BuildTaskOptions) -> BoxFuture<'static, Result<AgentInstance, AppError>> + Send + Sync>;
```

### AgentInstance 是什么

`AgentInstance` 是一个 enum，每个变体是不同的 agent 后端 manager：

```rust
pub enum AgentInstance {
    Acp(Arc<AcpAgentManager>),      // Claude CLI 进程
    Nomi(Arc<NomiAgentManager>),     // nomi 后端
    OpenClaw(Arc<OpenClawManager>),  // OpenClaw
    Nanobot(Arc<NanobotManager>),    // Nanobot
    Remote(Arc<RemoteAgentManager>), // 远程 agent
    Mock(Arc<dyn IMockAgent>),       // 测试用
}
```

每个 manager 持有实际的 agent 进程或连接（CLI 子进程 / WebSocket / HTTP）。

### 关键方法

```rust
#[async_trait]
pub trait IWorkerTaskManager: Send + Sync {
    // 查已有 agent
    fn get_task(&self, conversation_id: &str) -> Option<AgentInstance>;

    // 有就复用，没有就建 —— 核心方法
    async fn get_or_build_task(
        &self,
        conversation_id: &str,
        options: BuildTaskOptions,
    ) -> Result<AgentInstance, AppError>;

    // 杀掉 agent 进程
    fn kill(&self, conversation_id: &str, reason: Option<AgentKillReason>) -> Result<(), AppError>;
    fn kill_and_wait(...) -> Pin<Box<dyn Future<Output = ()> + Send>>;

    // 全部清除
    fn clear(&self);

    // 活跃数量
    fn active_count(&self) -> usize;

    // 回收空闲 agent（ACP + Finished + 超时）
    fn collect_idle(&self, idle_threshold_ms: TimestampMs) -> Vec<String>;
}
```

### OnceCell 的 single-flight 机制

`get_or_build_task` 的核心逻辑：

```rust
async fn get_or_build_task(&self, conversation_id: &str, options: BuildTaskOptions) {
    // 1. 拿到 per-conversation 的槽位（DashMap::entry 原子操作）
    let slot = self.tasks
        .entry(conversation_id.to_owned())
        .or_insert_with(|| Arc::new(OnceCell::new()))
        .clone();

    // 2. OnceCell::get_or_try_init 保证 factory 只跑一次
    //    并发调用者全部 await 同一个 future，拿到同一个实例
    let instance = slot.get_or_try_init(|| async {
        factory(options).await
    }).await?;

    Ok(instance.clone())
}
```

**效果**：10 个并发请求同时要同一个 conversation 的 agent，factory 只执行 1 次，不会 spawn 10 个 CLI 进程。失败时 cell 保持空，下次调用可以重试。

### 关键区分：会话 vs Agent 进程

| 概念 | 管理者 | 本质 | 生命周期 |
|------|--------|------|---------|
| **会话（Conversation）** | `ConversationService` | DB 里的一行记录 | 持久化，删 DB 才没了 |
| **Agent 进程（AgentInstance）** | `IWorkerTaskManager` | 活的进程/连接 | 内存中，kill/clear 就没了 |

cron 的完整流程需要两者配合：

```
1. ConversationService::create()      → 创建会话（DB 行）
2. task_manager.get_or_build_task()   → 拿到/构建 agent 进程
3. conversation_service.send_message() → 把消息通过 agent 发出去
```

---

## 九、防并发与重试机制

### CronBusyGuard

```rust
// 用 DashMap<String, bool> 跟踪每个 conversation 是否正在执行 cron
struct CronBusyGuard {
    busy: Arc<DashMap<String, bool>>,
}
```

逻辑：
- 执行前 `mark_busy(conv_id)` → 如果已 busy：
  - `retry_count < max_retries` → 返回 `Retrying`，30 秒后重试
  - `retry_count >= max_retries` → 返回 `Skipped`，跳过本次
- 执行后 `mark_free(conv_id)`

### 系统恢复（handle_system_resume）

系统休眠/重启后：
1. 检查 `next_run_at < now` 的 job
2. 标记为 `Missed`（**不自动补执行**）
3. 插入 tips 消息提醒用户"XX 任务在休眠期间错过了"
4. 重新调度

---

## 十、Agent 也可以创建 Cron Job

`CronService` 实现了 `ICronService` trait，支持 agent 通过中间件创建/管理 cron job：

```rust
// agent 在对话中说"每天 9 点跑一次代码审查"
// → response_middleware 拦截 → 调用 ICronService::create_job()
// → CronService::add_job() → schedule_job()
```

这条路径下：
- `created_by = Agent`
- `execution_mode = Existing`（绑定当前会话）
- `agent_config` 从当前会话行自动推导（backend / model / workspace 等）

---

## 十一、完整调用链路图

```
┌──────────────────────────────────────────────────────────────────┐
│                       CronScheduler                              │
│  DashMap<job_id, JoinHandle>  ←  tokio timer (at/every/cron)     │
│         │ tick_callback(job_id)                                  │
│         ▼                                                        │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ CronService::tick(job_id)                                   │ │
│  │   ├─ DB load job                                            │ │
│  │   ├─ 检查 enabled                                           │ │
│  │   ├─ JobExecutor::execute(job)                              │ │
│  │   │    ├─ CronBusyGuard (防并发)                             │ │
│  │   │    ├─ resolve_conversation                               │ │
│  │   │    │    ├─ Existing → 复用 or lazy-create                │ │
│  │   │    │    └─ NewConversation → ConversationService         │ │
│  │   │    │                        ::create() 新建会话           │ │
│  │   │    ├─ task_manager.get_or_build_task() → AgentInstance   │ │
│  │   │    │    └─ OnceCell single-flight 保证只 spawn 一次       │ │
│  │   │    ├─ build_prompt (Existing/NewConv + skill)            │ │
│  │   │    └─ conversation_service.send_message()                │ │
│  │   │         └─→ origin:"cron", hidden:true                   │ │
│  │   │         └─→ agent 收到消息，开始执行                       │ │
│  │   ├─ handle_execution_result                                 │ │
│  │   │    ├─ Success → reschedule + emit                        │ │
│  │   │    ├─ Retrying → 30s 后重试                               │ │
│  │   │    ├─ Skipped  → reschedule                              │ │
│  │   │    └─ Error    → reschedule + emit                       │ │
│  │   └─ CronEventEmitter → 前端 WebSocket                       │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

---

## 十二、DB ↔ Domain ↔ DTO 转换

`types.rs` 实现了三层模型转换：

```
DB 层（cron_job row）  ←→  Domain 层（CronJob）  ←→  DTO 层（API 响应）
```

- `CronJob::from_db(row)` → DB 行转领域模型
- `CronJob::to_db()` → 领域模型转 DB 行
- `CronJob::to_dto()` → 领域模型转 API 响应
- schedule / execution_mode / agent_config 等枚举在 DB 里存 JSON 字符串，转换时反序列化

---

## 十三、总结

| 问题 | 答案 |
|------|------|
| 定时任务如何调度？ | `CronScheduler` 用 tokio timer（sleep/interval/cron 计算），到点触发 `TickCallback` |
| 如何通知 agent 执行？ | `TickCallback` → `CronService::tick` → `JobExecutor::execute` → `task_manager.get_or_build_task` 拿 agent → `conversation_service.send_message` 发消息 |
| 通讯机制是什么？ | timer 到点触发 callback（函数指针）→ Service 编排 → Executor 调用 trait object（`IWorkerTaskManager` / `ConversationService`）→ agent 收到 `origin:"cron"` 的消息 |
| 如何开启 agent 会话？ | Existing 模式复用/懒创建绑定会话；NewConversation 模式每次 `ConversationService::create()` 新建。两者最终都走 `send_message` |

核心一句话：**scheduler 到点 → callback 触发 service::tick → executor 构建/复用 agent + 发消息 → agent 执行 → 结果回传 → 重新调度**。agent 不需要"知道"自己被 cron 调用了，它只是收到了一条 `origin: "cron"` 的消息，照常处理。
