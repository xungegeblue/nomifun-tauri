# nomifun-idmm 代码逻辑详解（JS 写法）

> 用 Node.js/TypeScript 写法复述 IDMM 模块的核心逻辑，方便快速理解。

## 一、流程一句话

**每轮：看信号 → 判断怎么搞 → 执行动作 → 记日志 → 等下一轮**

## 二、流程图（最简版）

```
┌─────────────────────────────────────────────┐
│  while (true) {                              │
│                                              │
│    ① probe.observe()  →  拿到信号           │
│       (扫 PTY / 读 chat)                     │
│                                              │
│    ② onStall(信号)    →  策略决策            │
│       ├─ 故障？→ 重试/切模型/升级LLM/停     │
│       ├─ 选项？→ 选推荐/选安全项/升级LLM/停 │
│       ├─ 问答？→ 升级LLM/停                  │
│       ├─ 空闲？→ 推"continue"/升级LLM/停    │
│       └─ 正常？→ 不干预                      │
│                                              │
│    ③ probe.inject()  →  把动作注入会话      │
│       (往 PTY 写文本 / 往 chat 发消息)      │
│                                              │
│    ④ 写审计日志到 DB                         │
│                                              │
│    ⑤ sleep 一会儿，下一轮                    │
│  }                                            │
└─────────────────────────────────────────────┘
```

## 三、决策优先级

**先试规则（免费秒出）→ 搞不定调 LLM（花钱但有脑子）→ 还不行就停**

```
规则层（确定性，无 LLM）
  ├─ 429 → 重试（退避越来越久）
  ├─ 有推荐选项 → 选推荐
  ├─ 只读工具权限 → 自动批准
  ├─ 空闲 → 推 "continue"
  ├─ 危险操作 → 停
  └─ 其他 → 升级

旁路模型层（LLM 决策）
  ├─ 多选项没推荐 → 让 LLM 选
  ├─ 开放问答 → 让 LLM 答
  └─ 旁路也挂了 → 保守回退重试

Halt → 停，等人来
```

## 四、三条硬规则

1. **开放问答 → 规则层绝不回答**，只能升级 LLM 或停
2. **写/执行类工具 → 规则层绝不自动批准**，只能升级或停
3. **危险操作 → 直接停**，不试任何路径

---

## 五、核心数据结构（TypeScript 写法）

```typescript
// SessionSignal — 会话状态信号
enum SessionSignal {
  Working,
  ProviderError,    // 429/500 等
  AgentError,       // agent 自己报错
  Idle,             // PTY 沉默 / chat 无事件
  Decision,         // 检测到编号选项
  Done,
  Cancelled,
  Exited,
}

// WakeAction — 干预动作
type WakeAction =
  | { type: "retry" }
  | { type: "send_text", text: string }
  | { type: "answer_choice", index: number }
  | { type: "confirm" }
  | { type: "failover" }       // 切备用模型
  | { type: "wait", seconds: number }
  | { type: "stop" };

// DecisionPrompt — 决策提示的解析结果
type DecisionPrompt =
  | {
      kind: "options",
      text: string,
      options: string[],
      recommended?: number,    // 推荐项索引
      permission?: string,     // 工具权限类型
      safeValue?: string,      // 只读工具的安全值
    }
  | {
      kind: "open_question",   // 纯问答（无选项）
      text: string,
    };

// StallClass — 停滞分类
enum StallClass {
  ProviderError,
  Idle,
  Decision,
  OpenQuestion,
}

// PolicyStep — 策略输出
type PolicyStep =
  | { type: "rule", action: WakeAction }    // 规则层决策
  | { type: "sidecar", class: StallClass }  // 升级到旁路模型
  | { type: "halt", reason: string }        // 停止监督
  | { type: "benign" };                     // 不干预
```

---

## 六、三个分类器（config.rs → JS 写法）

```typescript
// ===== is_provider_fault =====
const PROVIDER_FAULT_CODES = new Set([
  "AuthFailed", "PermissionDenied", "BillingRequired", "ConfigError",
  "ModelNotFound", "UnsupportedModel", "EndpointNotFound",
  "InvalidRequest", "InvalidToolSchema", "ContextTooLarge",
  "RateLimited", "Timeout", "NetworkError", "EmptyResponse",
  "GatewayError", "UnknownUpstreamError",
]);

function isProviderFault(code: string): boolean {
  return PROVIDER_FAULT_CODES.has(code);
}

// ===== is_destructive =====
const DESTRUCTIVE_SIGS = [
  "rm -rf", "rm -fr", "drop table", "drop database", "truncate",
  "delete from", "force push", "push --force", "push -f",
  "reset --hard", "git clean -", "mkfs", "dd if=", "> /dev/",
];

function isDestructive(text: string): boolean {
  const low = text.toLowerCase();
  return DESTRUCTIVE_SIGS.some(sig => low.includes(sig));
}

// ===== is_cancel_option =====
const CANCEL_SIGS = [
  "取消", "放弃", "跳过", "稍后", "暂不", "退出", "以后再",
  "什么都不", "都不选", "不需要",
  "cancel", "skip", "abort", "quit", "go back",
  "none of", "do nothing", "nevermind", "never mind",
];

function isCancelOption(text: string): boolean {
  const low = text.toLowerCase();
  return CANCEL_SIGS.some(sig => low.includes(sig));
}
```

---

## 七、检测器（detector.rs → JS 写法）

```typescript
// ===== Terminal 检测器：扫 PTY 字节流 =====

const PROVIDER_ERROR_SIGS = [
  /429/i, /rate limit/i, /overloaded/i, /server error/i,
  /connection timed out/i, /network error/i,
];

const INJECTION_ECHO_QUEUE: string[] = [];  // 自回显保护

function detectTerminalSignal(ptyOutput: string): SessionSignal {
  // 跳过 IDMM 自己注入的 echo 行
  const lines = ptyOutput
    .split("\n")
    .filter(line => !INJECTION_ECHO_QUEUE.includes(line.trim()));

  for (const line of lines) {
    if (PROVIDER_ERROR_SIGS.some(re => re.test(line))) {
      return SessionSignal.ProviderError;
    }
    if (detectNumberedOptions(line)) {
      return SessionSignal.Decision;
    }
  }
  return SessionSignal.Working;
}

// ===== Chat 检测器：更保守，需要 ≥2 编号选项 + 选择意图 =====

function detectChatDecision(text: string): DecisionPrompt | null {
  const optionPattern = /(?:\d+[.)、）]|（\d+[/|]\d+）|［\d+-\d+］)/g;
  const matches = text.match(optionPattern);

  if (!matches || matches.length < 2) return null;

  if (!/选|choose|pick|select|which|option/i.test(text)) return null;

  const options = extractOptions(text, matches);
  return { kind: "options", text, options, recommended: undefined };
}

function detectChatOpenQuestion(text: string): DecisionPrompt | null {
  const hasQuestion = /[?？]/.test(text) || /怎么|如何|什么|which|how|what/i.test(text);
  const hasOptions = detectNumberedOptions(text);
  if (hasQuestion && !hasOptions) {
    return { kind: "open_question", text };
  }
  return null;
}

// ===== 中文编号兼容 =====
function isNumberedOption(text: string): boolean {
  return /^\d+[.)、）．]/.test(text)
    || /^（\d+/.test(text)
    || /^［\d+-\d+］/.test(text);
}
```

---

## 八、规则引擎（policy.rs → JS 写法）

```typescript
const BACKOFF_LADDER = [10, 30, 120, 300]; // 秒

interface PolicyState {
  retries: number;
  nudges: number;
  backoffStep: number;
  workInProgress: boolean;
  suppressedAfterCancel: boolean;
  lastSignal: SessionSignal;
  lastInterventionAt: number;
  interventionsThisHour: number;
}

// ===== 总入口 =====
function onStall(state: PolicyState, signal: SessionSignal, prompt?: DecisionPrompt): PolicyStep {
  if (state.suppressedAfterCancel) return { type: "benign" };

  if (state.interventionsThisHour >= MAX_PER_HOUR) {
    return { type: "halt", reason: "budget_exhausted" };
  }

  const isBlocking = signal === SessionSignal.Decision;
  if (!isBlocking && Date.now() - state.lastInterventionAt < MIN_INTERVAL_SECS * 1000) {
    return { type: "rule", action: { type: "wait", seconds: MIN_INTERVAL_SECS } };
  }

  switch (signal) {
    case SessionSignal.ProviderError:
    case SessionSignal.AgentError:
      return onFault(state, prompt);
    case SessionSignal.Idle:
      return onIdle(state);
    case SessionSignal.Decision:
      if (prompt?.kind === "open_question") return onOpenQuestion(state);
      return onDecision(state, prompt);
    default:
      return { type: "benign" };
  }
}

// ===== 故障规则 =====
function onFault(state: PolicyState, prompt?: DecisionPrompt): PolicyStep {
  if (prompt?.retryable === false) {
    return escalateOrHalt(StallClass.ProviderError, "non_retryable_fault");
  }

  if (state.retries <= MAX_RETRIES) {
    if (USE_FAILOVER_QUEUE) {
      return { type: "rule", action: { type: "failover" } };
    }
    const waitSecs = BACKOFF_LADDER[Math.min(state.backoffStep, BACKOFF_LADDER.length - 1)];
    return { type: "rule", action: { type: "retry" } };
  }

  return escalateOrHalt(StallClass.ProviderError, "provider_error_retries_exhausted");
}

// ===== 决策规则 =====
function onDecision(state: PolicyState, prompt?: DecisionPrompt): PolicyStep {
  if (!prompt || prompt.kind !== "options") {
    return escalateOrHalt(StallClass.Decision, "no_options_parsed");
  }

  // 工具权限：只读 → 自动批准，写/执行 → 升级或停
  if (prompt.permission) {
    if (prompt.safeValue) {
      return { type: "rule", action: { type: "confirm" } };
    }
    return escalateOrHalt(StallClass.Decision, "risky_permission");
  }

  // mode 不是 Auto → 不自动决策
  if (DECISION_MODE !== "auto") {
    return escalateOrHalt(StallClass.Decision, "mode_not_auto");
  }

  // 有推荐项 + 非危险 → 自动选推荐
  if (PREFER_RECOMMENDED && prompt.recommended !== undefined) {
    const opt = prompt.options[prompt.recommended];
    if (!isDestructive(opt)) {
      return { type: "rule", action: { type: "answer_choice", index: prompt.recommended } };
    }
  }

  // 允许无标记自动选择 + 非保守 → 选第一个安全项
  if (ALLOW_UNMARKED_PICK && TENDENCY !== "conservative") {
    const safeIdx = firstSafeOption(prompt.options);
    if (safeIdx !== undefined) {
      return { type: "rule", action: { type: "answer_choice", index: safeIdx } };
    }
  }

  return escalateOrHalt(StallClass.Decision, "no_safe_auto_pick");
}

function firstSafeOption(options: string[]): number | undefined {
  for (let i = 0; i < options.length; i++) {
    if (isCancelOption(options[i])) continue;
    if (isDestructive(options[i]) && NEVER_DESTRUCTIVE) continue;
    return i;
  }
  return undefined;
}

// ===== 开放问答规则 =====
function onOpenQuestion(): PolicyStep {
  // 规则层永远不回答开放问答
  if (ANSWER_OPEN_QUESTIONS) {
    return { type: "sidecar", class: StallClass.OpenQuestion };
  }
  return { type: "halt", reason: "open_question_no_sidecar" };
}

// ===== 空闲规则 =====
function onIdle(state: PolicyState): PolicyStep {
  if (!state.workInProgress) return { type: "benign" };

  if (state.nudges <= MAX_NUDGES) {
    return { type: "rule", action: { type: "send_text", text: "continue" } };
  }

  return escalateOrHalt(StallClass.Idle, "idle_nudges_exhausted");
}

// ===== 升级决策 =====
function escalateOrHalt(class_: StallClass, reason: string): PolicyStep {
  if (SIDECAR_AVAILABLE) return { type: "sidecar", class: class_ };
  return { type: "halt", reason };
}
```

---

## 九、旁路模型调用（sidecar.rs + prompt.rs → JS 写法）

```typescript
const SIDECAR_SYSTEM_PROMPT = `
你是一个决策助手。你必须严格返回 JSON：
{ "action": "answer_choice|send_text|confirm|retry|wait|stop",
  "text": "可选注入文本",
  "wait_secs": 30,
  "confidence": 0.8,
  "reason": "选择理由" }
`;

async function callSidecar(prompt: DecisionPrompt, sessionModel: string): Promise<SidecarOutcome> {
  const model = resolveBackupModel(sessionModel);
  if (!model) return { type: "provider_failed" };

  const userPrompt = prompt.kind === "open_question"
    ? buildOpenQuestionPrompt(prompt.text)
    : buildUserPrompt(prompt);

  try {
    const response = await llmCall(model, SIDECAR_SYSTEM_PROMPT, userPrompt);
    const parsed = parseDecision(response);
    if (parsed) return { type: "decision", action: parsed };
    return { type: "resolved" };
  } catch (e) {
    return { type: "provider_failed" };
  }
}
```

---

## 十、Supervisor 监督循环（supervisor.rs → JS 写法）

```typescript
class IdmmManager {
  private supervisors: Map<string, Supervisor> = new Map();

  startWatch(sessionId: string, probe: SessionProbe) {
    const supervisor = new Supervisor(sessionId, probe);
    this.supervisors.set(sessionId, supervisor);
    supervisor.run();
  }

  stopWatch(sessionId: string) {
    this.supervisors.get(sessionId)?.halt();
    this.supervisors.delete(sessionId);
  }
}

class Supervisor {
  private state: PolicyState = {
    retries: 0, nudges: 0, backoffStep: 0,
    workInProgress: false, suppressedAfterCancel: false,
    lastSignal: SessionSignal.Working,
    lastInterventionAt: 0, interventionsThisHour: 0,
  };
  private recentInjections: string[] = [];

  constructor(
    private sessionId: string,
    private probe: SessionProbe,
  ) {}

  async run() {
    while (true) {
      // 1. 拿信号
      const { signal, prompt } = this.probe.observe();
      this.updateState(signal);

      // 2. 需干预才走策略
      if (signal !== SessionSignal.Working && signal !== SessionSignal.Done) {
        const step = onStall(this.state, signal, prompt);

        switch (step.type) {
          case "rule":
            await this.probe.inject(step.action);
            this.recordIntervention(signal, step);
            break;

          case "sidecar":
            const outcome = await callSidecar(prompt!, this.probe.fallbackModel());
            if (outcome.type === "decision") {
              await this.probe.inject(outcome.action);
              this.recordIntervention(signal, step);
            } else if (outcome.type === "provider_failed") {
              await this.probe.inject({ type: "retry" });
            }
            break;

          case "halt":
            this.recordIntervention(signal, step);
            return;  // 退出循环

          case "benign":
            break;
        }
      }

      await sleep(CHECK_INTERVAL_MS);
    }
  }

  private updateState(signal: SessionSignal) {
    switch (signal) {
      case SessionSignal.Working:
        this.state.suppressedAfterCancel = false;
        this.state.backoffStep = 0;
        break;
      case SessionSignal.Done:
        this.state.retries = 0;
        this.state.nudges = 0;
        this.state.backoffStep = 0;
        this.state.suppressedAfterCancel = false;
        this.state.workInProgress = false;
        break;
      case SessionSignal.Cancelled:
        this.state.suppressedAfterCancel = true;
        break;
    }
    this.state.lastSignal = signal;
    if (signal !== SessionSignal.Working) {
      this.state.backoffStep = Math.min(
        this.state.backoffStep + 1,
        BACKOFF_LADDER.length - 1,
      );
    }
  }

  private async recordIntervention(signal: SessionSignal, step: PolicyStep) {
    try {
      await db.insert("idmm_interventions", {
        session_id: this.sessionId,
        signal, step,
        timestamp: new Date(),
      });
    } catch (e) {
      console.warn("审计记录写入失败", e);
    }
    this.state.interventionsThisHour++;
    this.state.lastInterventionAt = Date.now();
  }
}
```

---

## 十一、Probe 接口（probe.rs → JS 写法）

```typescript
interface SessionProbe {
  observe(): { signal: SessionSignal; prompt?: DecisionPrompt };
  inject(action: WakeAction): Promise<void>;
  snapshotContext(): string;
  isAlive(): boolean;
  describe(): string;
  fallbackModel(): string;
}

// Terminal Probe
class TerminalProbe implements SessionProbe {
  observe() {
    const output = this.pty.readRecentOutput();
    const signal = detectTerminalSignal(output);
    const prompt = signal === SessionSignal.Decision
      ? detectChatDecision(output) : undefined;
    return { signal, prompt };
  }

  async inject(action: WakeAction) {
    const text = formatActionForPty(action);
    this.pty.write(text + "\n");
    this.recentInjections.push(text);
  }

  fallbackModel() { return this.pty.config.backupModel; }
  isAlive() { return this.pty.isRunning(); }
}

// Conversation Probe
class ConversationProbe implements SessionProbe {
  observe() {
    if (isRoutedToHuman(this.conversation)) {
      return { signal: SessionSignal.Working };  // 远程路由不干预
    }
    const lastMsg = this.conversation.lastAssistantMessage();
    const prompt = detectChatDecision(lastMsg) ?? detectChatOpenQuestion(lastMsg);
    const signal = prompt ? SessionSignal.Decision : this.mapAgentEvent();
    return { signal, prompt };
  }

  async inject(action: WakeAction) {
    switch (action.type) {
      case "answer_choice":
        await this.conversation.sendMessage(String(action.index + 1));
        break;
      case "confirm":
        await this.conversation.sendMessage("y");
        break;
      case "send_text":
        await this.conversation.sendMessage(action.text);
        break;
    }
  }
}
```
