# nomi-compact

> 路径: `crates/agent/nomi-compact/`

## 功能

**文本输出压缩/精简工具库**，将终端输出（特别是 LLM 上下文中的命令执行结果）进行不同级别压缩以节省 token 消耗。

核心能力：
- ANSI 转义码清除
- 回车覆盖行折叠（处理 `\r` 进度条式输出）
- 连续空行合并
- 重复/相似行折叠为 `[... N similar lines]`
- JSON 紧凑化（4空格→2空格，短对象行内化）
- TOON 编码（Token-Oriented Object Notation 表格格式）

## 核心类型

- `CompactionLevel` 枚举: Off / Safe(默认) / Full
  - Off — 不压缩
  - Safe — 仅清洗：去 ANSI、折叠回车、合并空行、去行尾空白
  - Full — Safe + 重复行折叠 + JSON 紧凑化

## 公开 API

- `compact_output(text, level)` — 按级别压缩文本
- `compact_output_toon(text)` — 尝试 TOON 编码
- `toon_format_instructions()` — TOON 格式说明文本（可注入 LLM prompt）

## 路由

无。纯工具库。

## 依赖

**外部**: regex, serde, serde_json
**Workspace 内**: 无（叶子节点）

## 被依赖

被 3 个 crate 依赖: nomi-agent, nomi-config, nomi-cli
