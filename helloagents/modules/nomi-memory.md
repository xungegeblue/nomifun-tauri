# nomi-memory

> 路径: `crates/agent/nomi-memory/`

## 功能

**跨会话长期记忆系统**，基于文件的持久化存储，保存用户偏好、反馈、项目上下文和外部引用。

核心能力：
- 记忆文件的读写、删除、扫描（Markdown + YAML frontmatter 格式）
- `MEMORY.md` 索引文件管理（追加、删除、截断）
- 记忆路径解析、验证和安全处理
- 记忆系统提示词构建（给 LLM 注入行为指令和索引内容）
- 会话后记忆蒸馏：将 LLM 蒸馏 JSON 转写为磁盘记忆文件
- 引用回流（citation reflow）：解析 LLM 输出中的记忆引用标签，更新 usage_count / last_used

## 核心类型

| 类型 | 说明 |
|------|------|
| `MemoryType` | 四种固定分类枚举: User / Feedback / Project / Reference |
| `MemoryFrontmatter` | YAML frontmatter: name, description, memory_type, usage_count, last_used |
| `MemoryHeader` | 轻量元数据（目录扫描用）: filename, file_path, mtime, description, memory_type |
| `MemoryEntry` | 完整记忆条目: frontmatter + content |
| `IndexTruncation` | 索引截断结果: content, line_count, byte_count, was_truncated |
| `DistillOutput` / `DistilledMemory` | 蒸馏输出：单条蒸馏记忆（type, name, description, content） |
| `MemoryError` | 错误枚举: Io / FrontmatterParse / PathValidation |

## 路由

无。纯库模块，只提供同步文件 I/O 和提示词构建逻辑。

## 依赖

**外部**: tracing, serde, serde_yaml, serde_json, chrono, thiserror
**Workspace 内**: nomi-config（app_config_dir 路径）

## 被依赖

被 4 个 crate 依赖: nomi-agent, nomi-cli, nomifun-ai-agent, nomifun-companion
