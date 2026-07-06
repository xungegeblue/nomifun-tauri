# nomifun-knowledge 模块详解

> 知识库平台（Knowledge Base）—— 让 AI 能读取和回写用户本地 Markdown 知识库的系统。

## 一、模块定位

`nomifun-knowledge` 是 nomifun 后端的核心知识管理模块，提供以下能力：

- **注册管理**：用户注册本地 Markdown 目录为知识库
- **挂载机制**：将知识库挂载到会话工作区（`.nomi/knowledge/`）
- **回写功能**：AI 会话可以把新知识写回知识库（支持审核流程）
- **外部数据源**：支持飞书文档、HTTP URL 抓取
- **MCP Server**：暴露知识检索能力给 AI

### 核心设计原则

> **目录是内容的事实来源**，数据库只存储元数据。用户可以随时手动添加/删除 `.md` 文件，文件列表/统计按需计算而非缓存。

---

## 二、模块结构

| 文件 | 职责 |
|------|------|
| `service.rs` | 核心服务：注册 CRUD、文件访问、挂载规划、搜索 |
| `mount.rs` | 平台级链接引擎（junction/symlink/递归拷贝） |
| `routes.rs` | HTTP `/api/knowledge/*` 路由层 |
| `state.rs` | 路由状态（共享 Service Arc） |
| `context.rs` | 上下文构建（给 AI 看的知识摘要 prompt） |
| `events.rs` | WebSocket 事件推送 |
| `mcp_server.rs` | MCP 协议暴露（knowledge_search / knowledge_read / knowledge_write） |
| `connector.rs` | 外部数据源连接器抽象 |
| `connector_feishu.rs` | 飞书文档连接器实现 |
| `source_url.rs` | HTTP URL 抓取 |
| `export.rs` | 导入/导出（zip 包） |
| `autogen.rs` | AI 自动生成 README 和描述 |
| `feishu_md.rs` | 飞书文档转 Markdown |
| `workpath.rs` | 工作路径规范化 |
| `testutil.rs` | 测试工具 |

---

## 三、HTTP 接口层

所有接口在 `/api/knowledge/*` 路径下，按功能分组：

### 3.1 知识库 CRUD

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/knowledge/bases` | 列出所有知识库 |
| POST | `/api/knowledge/bases` | 创建知识库 |
| GET | `/api/knowledge/bases/{id}` | 获取知识库详情 |
| PUT | `/api/knowledge/bases/{id}` | 更新知识库 |
| DELETE | `/api/knowledge/bases/{id}` | 删除知识库（可选 purge 物理删除） |

### 3.2 导入/导出

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/knowledge/bases/import` | 从 zip 导入知识库 |
| POST | `/api/knowledge/bases/{id}/export` | 导出为 zip |

### 3.3 AI 生成

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/knowledge/bases/{id}/autogen` | AI 生成 README 和描述 |
| POST | `/api/knowledge/description/generate` | 为目录生成描述（预览，不持久化） |
| POST | `/api/knowledge/description/polish` | 润色用户写的描述 |

### 3.4 文件操作

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/knowledge/bases/{id}/files` | 列出文件 |
| GET | `/api/knowledge/bases/{id}/file?path=xxx` | 读取文件内容 |
| PUT | `/api/knowledge/bases/{id}/file` | 写入/创建文件 |
| DELETE | `/api/knowledge/bases/{id}/file?path=xxx` | 删除文件 |

### 3.5 外部数据源

| 方法 | 路径 | 功能 |
|------|------|------|
| PUT | `/api/knowledge/bases/{id}/source` | 设置数据源（飞书/URL） |
| POST | `/api/knowledge/bases/{id}/refresh-source` | 刷新 URL 源 |
| POST | `/api/knowledge/bases/{id}/sync` | 同步飞书等连接器 |
| GET | `/api/knowledge/connectors/credentials` | 列出凭证 |
| POST | `/api/knowledge/connectors/credentials` | 创建凭证 |
| DELETE | `/api/knowledge/connectors/credentials/{id}` | 删除凭证 |
| POST | `/api/knowledge/connectors/credentials/{id}/test` | 测试连接 |

### 3.6 标签管理

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/knowledge/tags` | 列出标签 |
| POST | `/api/knowledge/tags` | 创建标签 |
| PUT | `/api/knowledge/tags/{key}` | 更新标签 |
| DELETE | `/api/knowledge/tags/{key}` | 删除标签 |

### 3.7 收件箱（Write-back 审核）

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/knowledge/bases/{id}/inbox` | 查看待审核内容 |
| GET | `/api/knowledge/inbox/pending-count` | 全部未审核数（红点信号） |
| GET | `/api/knowledge/bases/{id}/inbox/diff` | 对比变更 |
| POST | `/api/knowledge/bases/{id}/inbox/merge` | 采纳变更 |
| POST | `/api/knowledge/bases/{id}/inbox/discard` | 丢弃变更 |
| POST | `/api/knowledge/inbox/merge-all` | 批量采纳 |
| POST | `/api/knowledge/inbox/discard-all` | 批量丢弃 |

### 3.8 挂载绑定

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/knowledge/binding/{kind}/{target_id}` | 获取绑定状态 |
| POST | `/api/knowledge/binding/{kind}/{target_id}` | 设置绑定 |

`kind` 支持：`workpath`、`conversation`、`terminal`、`companion`

> **注意**：`target_id` 是单个路径段。Workpath 目标（规范化的绝对路径）会 percent-encode，前端调用 `encodeURIComponent(workpathKey)`，`/` 变成 `%2F`。

### 3.9 消费者 & 搜索

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/knowledge/bases/{id}/consumers` | 查看哪些会话正在使用 |
| POST | `/api/knowledge/search` | 跨库全文搜索 |

---

## 四、上下文构建（context.rs）

### 4.1 职责

给 AI 构建"知识库上下文"提示词，告诉 AI 知识库挂载情况和交互规则。

### 4.2 入口

```rust
build_knowledge_context(
    mounts: &[KnowledgeMountInfo],
    options: &KnowledgeContextOptions,
) -> Option<String>
```

- **输入**：当前会话挂载的知识库列表 + 输出格式/回写开关等配置
- **输出**：一段 markdown 文本，嵌入 AI 的 system prompt 或写成终端 README

### 4.3 两种输出格式

| 格式 | 用途 |
|------|------|
| `PromptSection` | 嵌入 AI 的 system prompt（`## Knowledge bases...`） |
| `TerminalReadme` | 写成 `{cwd}/.nomi/knowledge/README.md`（独立 H1 文档） |

### 4.4 检索协议

根据 `has_search_tool` 标志决定措辞：

- **有 MCP 工具**（`knowledge_search`）：引导 AI 先调用工具搜索，再读文档
- **无工具**（终端 PTY / 旧版 ACP）：引导用 Grep/Glob 手动查找

### 4.5 回写合约（Write-back Contract）

这是最关键的部分 —— 告诉 AI **能不能写、往哪写、怎么写**：

#### 开关：`writeback`
- `false` → 只读："Treat these directories as READ-ONLY"

#### 模式：`writeback_mode`
| 模式 | 行为 |
|------|------|
| `Staged`（默认） | 写到 `_inbox/{target_id}/`，用户审核后合并 |
| `Direct` | 直接写入选中的知识库 |

#### 回写意识：`writeback_eagerness`
| 意识 | 行为 |
|------|------|
| `Conservative`（默认） | "only persist durable, broadly reusable knowledge" |
| `Aggressive` | "anything plausibly relevant... prefer over-capturing" |

#### 工具暴露：`has_write_tool`
- **有工具**：告诉 AI 调用 `knowledge_write`（用 handle 更新，路径透明）
- **无工具**：告诉 AI 自己写文件路径（staged 模式要手动写 `_inbox/xxx/`）

### 4.6 TOC 预算（Token 优化）

知识库的目录可能有成千上万文件，直接塞进 prompt 会爆 Token：

```rust
TOC_PER_KB_MAX = 20      // 每个库最多 20 行
TOC_GLOBAL_MAX = 60      // 全局最多 60 行
```

超出的文件自动聚合为：`docs/ — 12 files (+5 more files)`

### 4.7 数据流

```
会话开始
   ↓
查询该会话绑定的知识库 (KnowledgeBinding)
   ↓
获取每个库的元数据：名称、描述、路径、文件列表(TOC)、摘要
   ↓
调用 build_knowledge_context( mounts, options )
   ↓
返回一段 markdown，注入到 AI 的 system prompt
   ↓
AI 在对话中知道"能用什么知识、从哪读、能否写回"
```

---

## 五、搜索逻辑

### 5.1 入口

```rust
POST /api/knowledge/search
{ "kb_ids": ["kb_1", "kb_2"], "query": "关键词", "limit": 20 }
```

### 5.2 流程

```
1. 收集知识库根目录
   - 根据 kb_ids 查 SQLite，获取每个库的 root_path

2. 遍历文件 + 评分 (spawn_blocking 阻塞任务)
   - WalkDir 遍历每个知识库的 .md 文件
   - 跳过 _inbox 目录（未审核内容不参与搜索）

3. 缓存机制
   - 基于 mtime + size 的 LRU 缓存（内存中）
   - 文件未变则复用上次解析的 heading + content
   - 缓存上限 10MB，超出后淘汰最老的

4. 评分算法 score_md（见下表）

5. 排序返回
   - 先按 score 降序，再按路径升序
   - 截断到 limit
```

### 5.3 评分算法

| 匹配位置 | 得分 |
|---------|------|
| 完整词在文件名/标题 | +8 |
| 完整词在正文 | +5 |
| 单词在文件名 | +4 |
| 单词在标题 | +3 |
| 单词在正文出现次数 | +min(出现次数, 5) |

- 评分 > 0 才返回结果
- 返回最佳 snippet（~200 字）

### 5.4 缓存参数

```rust
MAX_SEARCH_CACHE_FILE_BYTES = 1MB   // 单文件缓存上限
MAX_SEARCH_CACHE_BYTES = 10MB       // 全局缓存上限
```

### 5.5 过滤规则

- 只搜索 `.md` 文件
- 跳过 `_inbox/` 目录（未审核内容不参与搜索）
- 未知 kb_id 会被静默跳过（不是错误）

---

## 六、数据存储

### 6.1 双层存储

| 层 | 介质 | 内容 |
|----|------|------|
| 元数据 | SQLite | 知识库注册信息、绑定关系、标签、凭证 |
| 文件内容 | 文件系统 | `.md` 文档文件 |

### 6.2 SQLite 表结构

数据库文件位置：`{数据目录}/nomifun.db`

| 表名 | 用途 | 核心字段 |
|------|------|----------|
| `knowledge_bases` | 知识库注册表 | `id`, `name`, `description`, `root_path`, `managed`, `extra`, `tags` |
| `knowledge_bindings` | 会话-知识库绑定 | `target_kind`, `target_workpath/conv_id/term_id/companion_id`, `enabled`, `writeback`, `writeback_mode`, `writeback_eagerness` |
| `knowledge_binding_bases` | 绑定-知识库多对多关联 | `binding_id`, `kb_id` |
| `knowledge_tags` | 用户标签 | `key`, `label`, `color`, `sort_order` |
| `knowledge_credentials` | 外部连接器凭证 | 飞书等的 app_id/app_secret，加密存储 |

### 6.3 `knowledge_bases` 表字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | TEXT | 知识库 ID（`kb_` 前缀） |
| `name` | TEXT | 名称 |
| `description` | TEXT | 描述 |
| `root_path` | TEXT | 目录绝对路径 |
| `managed` | BOOL | 是否我们托管（托管可 purge 删除） |
| `extra` | TEXT | JSON 扩展字段（存数据源等） |
| `tags` | TEXT | JSON 数组，标签 key 列表 |
| `created_at` | INT | 创建时间戳 |
| `updated_at` | INT | 更新时间戳 |

### 6.4 `knowledge_bindings` 表设计

采用 surrogate key + 类型判别 nullable 列设计：

- `binding_id`: 自增主键
- `target_kind`: `workpath` / `conversation` / `terminal` / `companion`
- `target_workpath`: 规范化工作区路径（非实体，无 FK）
- `target_conv_id` / `target_term_id`: 真实 TEXT FK（CASCADE）
- `target_companion_id`: 文件系统 companion 实体（无 FK）
- CHECK 约束：恰好一个 target 列非空

---

## 七、常量参考

```rust
// 回写模式
pub const WRITEBACK_MODES: &[&str] = &["staged", "direct"];
pub const WRITEBACK_EAGERNESS: &[&str] = &["conservative", "aggressive"];

// 目录约定
pub const KB_INBOX_REL_DIR: &str = "_inbox";       // 暂存目录
pub const KB_MANAGED_REL_DIR: &str = "managed";     // 托管目录
pub const KB_MOUNT_REL_DIR: &str = ".nomi/knowledge"; // 挂载点

// 源抓取限制
pub const MAX_SOURCE_ENTRIES: usize = 16;           // 每库最多 16 个源条目
const SOURCE_FETCH_CONCURRENCY: usize = 4;          // 并发抓取数

// 搜索缓存
const MAX_SEARCH_CACHE_FILE_BYTES: usize = 1MB;     // 单文件缓存上限
const MAX_SEARCH_CACHE_BYTES: usize = 10MB;         // 全局缓存上限

// 上下文 TOC 预算
pub const TOC_PER_KB_MAX: usize = 20;               // 每库 TOC 最多 20 行
pub const TOC_GLOBAL_MAX: usize = 60;               // 全局 TOC 最多 60 行

// 绑定类型
pub const BINDING_KINDS: &[&str] = &["workpath", "conversation", "terminal", "companion"];
```

---

## 八、知识库如何注入到 Agent 的 Prompt

### Q：知识库搜索匹配后，结果是如何注入 prompt 给 agent 用的？

搜索结果**不是**被直接"注入"到 prompt 里的，而是通过**两条独立路径**协作完成的：

### 8.1 路径一：会话启动时，注入"说明书"到 system prompt（静态）

入口：`context.rs` 的 `build_knowledge_context()`

会话一启动就执行，生成一段 Markdown 文本塞进 agent 的 system prompt。但这里注入的**不是搜索结果，是"说明书"**——告诉 agent：

1. **有哪些知识库可用**（库名、路径、描述、目录概览 TOC）
2. **怎么搜**（调用 `knowledge_search` 工具）
3. **怎么读**（调用 `knowledge_read` 工具，用 handle）
4. **能不能写、写了放哪**（回写契约：staged/direct + conservative/aggressive）

相当于给 agent 发了一张"图书馆地图 + 借阅规则"，但不包含具体书的内容。

```
会话启动
  → build_knowledge_context(mounts, options)
    → 生成 5 层 Markdown 文本：
       1. Header（## Knowledge bases）
       2. 检索协议（有工具→调 knowledge_search / 无工具→Grep）
       3. 回写契约（READ-ONLY / staged+inbox / direct）
       4. 每个库的区块（名称、路径、描述、TOC）
       5. 实时源（URL 源列表）
    → 注入 system prompt 或写成 .nomi/knowledge/README.md
```

### 8.2 路径二：对话过程中，agent 主动调用 MCP 工具拿搜索结果（动态）

这才是"搜索结果到 agent"的真正路径。Agent 看了说明书知道有知识库可用后，**自己决定什么时候搜、搜什么**：

```
Agent: "用户问了 Rust async 的问题，让我搜一下知识库"
  → 调用 knowledge_search(query: "rust async")
  → MCP server 收到请求 → 调 service.search_bases()
  → 返回结果给 agent（作为 tool result，不是注入 prompt）
```

返回给 agent 的是一段结构化文本，每条结果包含：score、路径、标题、snippet（200 字摘要）、handle（不透明 token）。

Agent 看到 snippet 觉得有用但信息不够，拿 handle 调 `knowledge_read` 读完整内容：

```
Agent: "第1条看起来有用，读完整内容"
  → 调用 knowledge_read(handle: "xxx")
  → 返回完整 markdown 文本（作为 tool result）
```

拿到完整文本后，agent 用它来组织回答。

### 8.3 完整流程

```
会话启动
  → context.rs 生成"说明书" → 注入 system prompt
    （告诉 agent：你有这些库，用这些工具搜）

对话中
  → agent 需要知识 → 主动调 knowledge_search
    → 搜索结果作为 tool result 返回（不是注入 prompt）
  → agent 需要全文 → 主动调 knowledge_read(handle)
    → 完整文档作为 tool result 返回
  → agent 用拿到的内容组织回答
```

### 8.4 关键区分

| 维度 | 静态注入（context.rs） | 动态获取（MCP 工具） |
|------|----------------------|-------------------|
| **时机** | 会话启动时，一次性 | 对话过程中，按需调用 |
| **内容** | 库列表 + 检索协议 + 回写契约 + TOC 概览 | 搜索结果摘要 / 完整文档内容 |
| **载体** | 嵌入 system prompt | tool result（工具返回值） |
| **agent 角色** | 被动接收 | 主动调用 |
| **更新** | 会话期间不变（除非重新构建） | 每次调用都是实时搜索 |

> **一句话总结**：搜索结果不是被"注入"到 prompt 里的，而是 agent 通过 MCP 工具调用主动获取的，作为工具返回值进入 agent 上下文——跟 agent 调用其他任何工具（如 web_search）一样：工具调用 → 结果返回 → agent 消化。
