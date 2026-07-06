# nomi-agent

> 路径: `crates/agent/nomi-agent/`

## 功能

**核心 Agent 引擎**，负责 Agent 的完整执行循环和编排。

核心能力：
- Agent 执行循环：接收用户输入 → 调用 LLM → 解析回复 → 执行工具 → 反馈结果 → 循环直至结束
- Session 管理：创建、持久化、恢复、清理（文件系统 JSON 存储）
- 上下文压缩：多级管道——microcompact（轻量无 LLM）、autocompact（LLM 摘要）、emergency 上下文溢出检测
- 系统提示词组装：分层构建（intro → 工具引导 → 自定义 prompt → AGENTS.md → memory → plan mode → skills），带缓存
- 工具编排：并发/串行分区、确认、执行、hook 钩子、秘密脱敏、panic 恢复
- 子 Agent 派生：AgentSpawner 生成独立子 Agent，共享 Provider，支持并发上限和 token 预算
- 目标驱动继续：可选 goal-driven 自动继续机制
- 计划模式：限制为只读工具，规划完成后恢复全部工具
- 斜杠命令：/compact, /clear, /help, /quit
- 协作取消与转向：CancellationToken 优雅退出，steering_inbox 中途注入用户消息
- 运行时配置热更新：model、thinking、effort、compaction 动态修改

## 核心类型

| 类型 | 说明 |
|------|------|
| `AgentEngine` | 核心引擎结构体，持有 provider、工具注册表、消息历史、会话、压缩状态等 |
| `AgentResult` | run() 返回值：文本、停止原因、token 用量、turn 数 |
| `Session` / `SessionManager` | 会话数据和 CRUD、持久化、自动清理 |
| `OutputSink` trait | 输出抽象（文本 delta、思考、工具调用/结果、流开始/结束） |
| `CompactState` | 压缩运行时状态（水位线、熔断器） |
| `PlanState` | 计划模式状态 |
| `GoalRuntime` / `GoalSpec` / `GoalState` | 目标驱动继续运行时 |
| `AgentSpawner` / `TokenBudget` | 子 Agent 派生器和共享 token 预算 |
| `TaskBoard` | 多 Agent 协调任务板 |
| `StagnationGuard` | 停滞检测（相同工具调用重复 N 次触发纠正） |
| `CacheBreakDetector` | Prompt cache miss 检测与诊断 |
| `Cassette` / `Interaction` | HTTP 交互录制/回放（测试用） |

## 路由

无。纯引擎层，HTTP 服务由上层 nomifun-ai-agent 提供。

## 依赖

**必选 Workspace 内**: nomi-types, nomi-protocol, nomi-config, nomi-providers, nomi-tools, nomi-mcp, nomi-skills, nomi-memory, nomi-compact, nomi-redact
**可选 Workspace 内**: nomi-computer(computer-use feature), nomi-browser(browser-use feature)

## 被依赖

被 2 个 crate 依赖: nomi-cli(computer-use feature), nomifun-ai-agent(默认 + 转发 computer-use/browser-use)
