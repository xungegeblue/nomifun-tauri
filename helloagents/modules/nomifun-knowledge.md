# nomifun-knowledge

> 路径: `crates/backend/nomifun-knowledge/`

## 功能

**知识库(Knowledge Base)平台核心域模块**，负责：

- 知识库注册与 CRUD
- 会话挂载（junction/symlink/copy fallback 到 .nomi/knowledge/）
- 回写（staged `_inbox/` 或 direct 模式）
- AI 概览生成（autogen）
- URL 知识源（SSRF 防护 HTTP 抓取，HTML→Markdown）
- 外部连接器（飞书 Feishu 等）
- 导出/导入（zip 格式）
- MCP 服务器：暴露 knowledge_search/read/write 三个工具
- 搜索、标签系统、WS 事件推送

## 核心类型

| 类型 | 说明 |
|------|------|
| `KnowledgeService` | 核心服务 |
| `KnowledgeBinding` | 绑定配置 |
| `MountOutcome` / `MountSpec` | 挂载结果与规格 |
| `InboxEntry` / `InboxDiff` / `InboxMergeResult` | 回写暂存箱 |
| `WritebackMode` / `WritebackEagerness` | 回写模式/意愿度 |
| `KnowledgeMcpServer` | 进程内 MCP HTTP 服务器 |
| `FeishuConnector` | 飞书知识空间连接器 |
| `KnowledgeCompleter` trait | LLM 补全接口 |

## 路由

前缀 `/api/knowledge/`：bases CRUD, files/tree/folder, inbox/diff/merge/discard, autogen, sync, source, connectors/credentials, tags, binding, search, export/import 等

## 依赖

**Workspace 内**: nomifun-common, nomifun-db, nomifun-api-types, nomifun-realtime, nomifun-auth, nomifun-net

## 被依赖

被 5 个 crate 依赖: nomifun-app, nomifun-ai-agent, nomifun-conversation, nomifun-terminal, nomifun-gateway
