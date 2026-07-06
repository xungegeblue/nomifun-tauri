# nomifun-companion

> 路径: `crates/backend/nomifun-companion/`

## 功能

**桌面伙伴（Companion）域核心**，多伙伴共享记忆中心体系。

核心能力：
- 伙伴注册表（registry）：多伙伴花名册，独立 profile，CRUD + 序号分配
- 事件采集（collector）：全局事件总线 → JSONL 事件文件，按天分区
- 记忆蒸馏（learner）：定时 LLM 学习循环，含去重/衰减
- 技能自进化（evolution）：挖掘重复工具序列，生成可审核技能草稿
- 伙伴聊天：独立 AI 对话线程，真实 nomi agent 引擎驱动
- 会话归档（archiver）：空闲窗口自动压缩为日摘要
- 形象系统（figure/figures）：DIY 自定义 + 共享形象库
- 游戏化（gamify）：经验值、等级系统
- 数据导入导出

## 核心类型

| 类型 | 说明 |
|------|------|
| `CompanionProfileConfig` | 每伙伴配置 |
| `CompanionRegistry` | 伙伴注册表（RwLock<HashMap> + 序号水印） |
| `CompanionStore` | SQLite 存储（独立 memory.db） |
| `CompanionMemory` | 6 类记忆条目（profile/preference/knowledge/episode/task/affective） |
| `CompanionService` | 门面服务，整合所有子模块 |

## 路由

前缀 `/api/companion/`：config, status, companions(CRUD+figure+status), memories/suggestions/skills, companion/threads, learn/run, events/stats, export/import, figures 公开图片

## 依赖

**Workspace 内**: nomifun-common, nomi-redact, nomi-memory, nomifun-db, nomifun-api-types, nomifun-realtime, nomifun-ai-agent, nomifun-extension, nomifun-auth, nomifun-conversation

## 被依赖

被 2 个 crate 依赖: nomifun-app, nomifun-gateway
