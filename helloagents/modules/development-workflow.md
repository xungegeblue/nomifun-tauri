# nomifun-tauri 前后端开发流程指南

> 本文档基于 `nomifun-requirement` 和 `nomifun-knowledge` 两个业务后端模块及 `ui/src` 前端模块的代码实践提炼而成，具有普适性，可作为新增业务模块的参考标准。

---

## 一、整体架构概览

### 1.1 技术栈

| 层 | 技术 | 说明 |
|---|---|---|
| **后端** | Rust + Axum + SQLite (`sqlx`) | Tauri 应用内嵌后端 |
| **前端** | React 19 + Arco Design + UnoCSS + SWR | 渲染进程（Tauri WebView 或纯浏览器） |
| **通信** | REST API (`/api/*`) + WebSocket 事件 | `httpBridge.ts` 统一桥接层 |
| **AI 工具** | MCP Server (进程内 HTTP) | 供 ACP Agent 调用 |

### 1.2 功能拓扑图

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Tauri Application                            │
│                                                                     │
│  ┌──────────────────────────────┐  ┌──────────────────────────┐    │
│  │     Frontend (ui/src)        │  │    Backend (crates/)     │    │
│  │                              │  │                          │    │
│  │  ┌────────────────────────┐  │  │  ┌────────────────────┐  │    │
│  │  │   ipcBridge.ts         │──│──│──│   routes.rs         │  │    │
│  │  │   (API 注册中心)        │  │  │  │   (Axum 路由层)     │  │    │
│  │  └────────────────────────┘  │  │  └────────────────────┘  │    │
│  │           │                   │  │           │               │    │
│  │  ┌────────┴─────────────┐    │  │  ┌────────┴───────────┐  │    │
│  │  │  Pages / Hooks       │    │  │  │   service.rs        │  │    │
│  │  │  (业务逻辑消费层)      │    │  │  │   (核心业务层)       │  │    │
│  │  └──────────────────────┘    │  │  └────────────────────┘  │    │
│  │                              │  │           │               │    │
│  │  ┌────────────────────────┐  │  │  ┌────────┴───────────┐  │    │
│  │  │  Components / Styles   │  │  │  │  Repository Trait   │  │    │
│  │  │  (UI 基础设施)          │  │  │  │  (数据访问抽象)      │  │    │
│  │  └────────────────────────┘  │  │  └────────────────────┘  │    │
│  │                              │  │           │               │    │
│  │                              │  │  ┌────────┴───────────┐  │    │
│  │                              │  │  │   SQLite (sqlx)     │  │    │
│  │                              │  │  │   (数据存储)         │  │    │
│  │                              │  │  └────────────────────┘  │    │
│  └──────────────────────────────┘  └──────────────────────────┘    │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              MCP Server (进程内 HTTP)                          │   │
│  │   供 ACP Agent (Claude/Codex/Gemini) 通过 stdio 桥接调用      │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              WebSocket 事件 (nomifun-realtime)                 │   │
│  │   domain.camelCaseAction 格式，推送实时变更                    │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 二、后端开发规范

### 2.1 Crate 结构与文件命名规范

每个业务模块是一个独立 crate，位于 `crates/backend/nomifun-{domain}/`。

**标准文件结构：**

```
nomifun-{domain}/
├── Cargo.toml                # 依赖声明（含 nomifun-common, nomifun-db, nomifun-api-types 等）
├── src/
│   ├── lib.rs                # 模块入口 + 公共 re-export
│   ├── service.rs            # 核心业务逻辑（最核心文件，持有所有依赖）
│   ├── routes.rs             # Axum HTTP 路由定义
│   ├── state.rs              # 路由状态容器（Arc<{Domain}Service>）
│   ├── events.rs             # WebSocket 事件发射封装
│   ├── mcp_server.rs         # MCP 工具 HTTP 服务器（可选，供 ACP Agent 调用）
│   ├── convert.rs            # DTO 转换（DB 模型 → API 响应）（可选）
│   ├── context.rs            # 上下文/Prompt 构建（可选）
│   ├── {domain_specific}.rs  # 领域特定逻辑文件
│   └── hooks.rs              # 跨 crate 集成接口（可选）
└── tests/                    # 集成测试（按场景命名）
    ├── {scenario}_test.rs
    └── ...
```

**文件命名规则：**

| 规则 | 说明 | 示例 |
|---|---|---|
| 全小写 snake_case | Rust 惯例，每个文件对应一个清晰领域概念 | `service.rs`, `routes.rs`, `mcp_server.rs` |
| 单词简洁 | 避免冗长前缀，crate 名已包含域 | `export.rs` 而非 `knowledge_export.rs` |
| 连接器命名 | `{connector}_{platform}.rs` | `connector_feishu.rs` |
| 测试命名 | 按功能场景而非按文件 | `delete_owner_clearing.rs`, `notify.rs` |

### 2.2 lib.rs 模块组织

`lib.rs` 是 crate 入口，职责：

1. 声明所有子模块 (`mod xxx;`)
2. 公共 re-export 核心类型 (`pub use ...`)
3. 定义 crate 级常量

```rust
//! {Domain} Platform: {简要描述}

mod service;
mod routes;
mod state;
mod events;
// ...可选模块

pub use service::{DomainService, ...};
pub use routes::domain_routes;
pub use state::DomainRouterState;

// 路径常量
pub const DOMAIN_REL_DIR: &str = "{domain_path}";
```

### 2.3 Service 核心层模式

`service.rs` 是业务中枢，遵循 **Builder 注入模式**：

```rust
pub struct DomainService {
    repo: Arc<dyn I{Domain}Repository>,       // 数据仓储（trait object）
    emitter: DomainEventEmitter,               // WS 事件推送
    // ...可选依赖（延迟绑定）
}

impl DomainService {
    pub fn new(repo: Arc<dyn I{Domain}Repository>, emitter: DomainEventEmitter) -> Self {
        Self { repo, emitter, /* 其他字段为 None/默认值 */ }
    }

    // 链式注入可选依赖
    pub fn with_completer(self, completer: Arc<dyn DomainCompleter>) -> Self { ... }
    pub fn with_notifier(self, notifier: Arc<dyn CompletionNotifier>) -> Self { ... }
}
```

**关键设计原则：**

- **Trait 仓储模式**：服务层通过 `Arc<dyn I{Domain}Repository>` 与数据库解耦，测试用内存实现
- **延迟绑定**：可选依赖通过 `RwLock<Option<Arc<dyn ...>>>` 在服务构建后注入，避免循环依赖
- **方法分组**：CRUD → 状态管理 → 搜索 → 配置 → 集成钩子，按职责清晰分组

### 2.4 数据库规范

#### 2.4.1 迁移文件

迁移位于 `nomifun-db` crate 的 `migrations/` 目录，使用编号 SQL 文件：

```
nomifun-db/migrations/
├── 001_baseline.sql               # 基础 schema
├── 002_{feature_name}.sql         # 功能追加
├── ...
```

**命名规则：** `{序号}_{简短功能描述}.sql`，序号连续递增。

#### 2.4.2 表命名规范

| 规则 | 说明 | 示例 |
|---|---|---|
| snake_case + 复数 | 表名使用蛇形命名 + 复数形式 | `knowledge_bases`, `requirements`, `attachments` |
| 前缀一致性 | 同域表使用 `{domain}_` 前缀 | `knowledge_bases`, `knowledge_bindings`, `knowledge_binding_bases` |
| 关联表 | `{主表}_{副表}` 格式，复合主键 | `knowledge_binding_bases` |

#### 2.4.3 列命名规范

| 规则 | 说明 | 示例 |
|---|---|---|
| snake_case | 列名全部小写蛇形 | `target_kind`, `writeback_mode` |
| 时间戳 | `INTEGER` 存储 epoch 毫秒 | `created_at`, `updated_at` |
| JSON 存储 | `TEXT` 类型 + JSON 内容 | `extra` (JSON 对象), `tags` (JSON 数组) |
| 布尔 | `INTEGER` (0/1) | `enabled`, `managed` |
| 状态枚举 | `TEXT` + CHECK 约束 | `CHECK(writeback_mode IN ('staged', 'direct'))` |

#### 2.4.4 主键与 ID 规范

| 场景 | 方案 | 示例 |
|---|---|---|
| 业务实体 | `TEXT PRIMARY KEY` + 前缀 ID | `kb_{uuidv7}`, `att_{uuidv7}` |
| 关联表 | 复合主键 | `PRIMARY KEY (binding_id, kb_id)` |
| 内部/绑定 | `INTEGER PRIMARY KEY AUTOINCREMENT` | `binding_id` |

**ID 前缀规范：** 使用 `generate_prefixed_id("{prefix}")` 生成，前缀 2-4 字符缩写：
- `kb_` → knowledge base
- `att_` → attachment
- `kdoc_` → knowledge document handle (不透明句柄)

#### 2.4.5 外键规范

- **级联删除**：业务关联使用 `ON DELETE CASCADE`
- **无外键**：跨域引用（如 `owner_session_id` 引用 conversation/terminal）不建 FK，通过服务层 `clear_owner_for_session` 清理
- **双域判别**：跨域引用必须配对 `owner_kind` 字段使用，防止共享数字 ID 的跨域篡改

#### 2.4.6 CHECK 约束规范

用于两种场景：

1. **枚举值约束**：`CHECK(status IN ('pending', 'in_progress', 'done', 'failed', 'cancelled', 'needs_review'))`
2. **类型判别约束**：确保恰好一个 target 列非空

#### 2.4.7 状态枚举规范

状态使用 `TEXT` 类型存储，命名规则：

| 状态类型 | 值 | 说明 |
|---|---|---|
| 待处理 | `pending` | 初始状态 |
| 执行中 | `in_progress` | 正在处理 |
| 完成 | `done` | 终态（冻结） |
| 失败 | `failed` | 终态（冻结） |
| 取消 | `cancelled` | 终态（冻结） |
| 待审核 | `needs_review` | 非终态，可转为 done/failed |

### 2.5 API 接口规范

#### 2.5.1 路由定义模式

所有路由在 `routes.rs` 中通过 Axum 定义，统一注册函数：

```rust
pub fn domain_routes() -> Router {
    Router::new()
        .route("/api/{domain}", get(list).post(create))
        .route("/api/{domain}/tags", get(list_tags))
        .route("/api/{domain}/{id}", get(get).put(update).delete(delete))
        .route("/api/{domain}/{id}/status", post(update_status))
        // ...子操作路由
        .with_state(DomainRouterState::new(service))
}
```

#### 2.5.2 路径命名规范

| 规则 | 说明 | 示例 |
|---|---|---|
| 基路径 | `/api/{domain}` | `/api/requirements`, `/api/knowledge/bases` |
| 资源操作 | RESTful 风格，`{id}` 路径参数 | `/api/requirements/{id}` |
| 子操作 | `/{id}/action` 模式 | `/api/requirements/{id}/status`, `/api/requirements/{id}/complete` |
| 集合操作 | `-` 分隔的名词 | `/batch-delete`, `/tag-bindings` |
| 嵌套资源 | 路径参数级联 | `/api/knowledge/bases/{id}/files` |
| 查询参数 | 过滤/分页用 `?` 查询 | `?page=1&page_size=20&tag=xxx` |

#### 2.5.3 统一响应包装

所有端点返回 `Json<ApiResponse<T>>`：

```rust
// 成功（有数据）
Ok(Json(ApiResponse::ok(data)))

// 成功（创建）
Ok((StatusCode::CREATED, Json(ApiResponse::ok(data))))

// 成功（无数据）
Ok(Json(ApiResponse::success()))

// 错误
Err(AppError::NotFound("{domain} not found"))
```

#### 2.5.4 请求体反序列化

统一处理 `JsonRejection`：

```rust
async fn create_domain(
    State(state): State<DomainRouterState>,
    Extension(user): Extension<CurrentUser>,
    body: Result<Json<CreateRequest>, JsonRejection>,
) -> Result<Json<ApiResponse<DomainInfo>>, AppError> {
    let Json(req) = body.map_err(|e| AppError::BadRequest(e.to_string()))?;
    let result = state.service.create(req, &user).await?;
    Ok(Json(ApiResponse::ok(result)))
}
```

#### 2.5.5 认证模式

通过 `Extension<CurrentUser>` 注入当前用户（来自 `nomifun-auth`）：

```rust
Extension(user): Extension<CurrentUser>
```

所有权验证在 service 层完成。

#### 2.5.6 分页规范

查询参数：`page` (默认1), `page_size` (默认20, 上限200)

响应格式：`PaginatedResult<T>` 含 `items`, `total`, `has_more`

#### 2.5.7 MCP 工具接口规范

MCP Server 暴露独立 HTTP 端点，供 ACP Agent 调用：

```rust
pub struct DomainMcpServer {
    service: Arc<DomainService>,
    token: String,  // Bearer token（进程随机生成）
}
```

| 要素 | 规范 |
|---|---|
| 端点 | `POST /tool` |
| 认证 | Bearer token |
| 请求体 | `{"tool": "{domain}_{action}", "args": {...}}` |
| 工具命名 | `{domain}_{action}` | `requirement_complete`, `knowledge_search` |
| 安全 | 服务端决定作用域，模型无法扩大 |

#### 2.5.8 WebSocket 事件规范

事件命名格式：`{domain}.{camelCaseAction}`

```rust
// requirement 模块事件
"requirement.created"
"requirement.statusChanged"
"autowork.statusChanged"

// knowledge 模块事件
"knowledge.base-created"
"knowledge.binding-changed"
```

事件由 `EventEmitter` trait（来自 `nomifun-realtime`）封装发射。

---

## 三、前端开发规范

### 3.1 目录结构

```
ui/src/
├── common/                    # 共享代码（跨渲染/Web 模式）
│   ├── adapter/
│   │   ├── ipcBridge.ts       # ★ API 注册中心（核心文件）
│   │   ├── httpBridge.ts      # HTTP/WS 桥接工厂
│   │   └── bridge.ts          # 传输无关的 pub/sub 核心
│   │   └── ...
│   ├── api/                   # AI 提供商客户端
│   ├── config/                # 配置服务 + 常量 + i18n 基础
│   ├── types/                 # 共享 TypeScript 类型
│   └── utils/                 # 工具函数
├── platform/                  # 内部平台替代品
│   ├── bridge.ts              # 传输无关 pub/sub
│   ├── theme.ts               # 设计令牌
│   ├── storage.ts             # 命名空间存储
│   └── logger.ts              # 日志门面
└── renderer/                  # 渲染进程（React UI）
    ├── assets/                # SVG 图标、logo
    ├── components/            # 共享 UI 组件（按功能分组）
    ├── hooks/                 # Hooks（按功能分组）
    ├── pages/                 # 页面（每页一个目录）
    ├── services/              # 文件服务、i18n、抠图等
    ├── styles/                # 全局样式 + 主题
    ├── utils/                 # UI 工具函数
    ├── main.tsx               # React 入口
    └── types.d.ts             # 模块声明
```

### 3.2 API 注册与暴露规范

#### 3.2.1 核心架构

前端 API 层采用 **三层桥接** 模式：

```
ipcBridge.ts (业务级注册)
    ↓ 使用
httpBridge.ts (HTTP/WS 工厂)
    ↓ 依赖
bridge.ts (传输无关核心)
```

#### 3.2.2 注册新 API 的步骤

**步骤1：在 `ipcBridge.ts` 中注册**

每个业务域导出一个命名空间对象，方法映射到 REST 端点或 WS 事件：

```typescript
// ipcBridge.ts 中新增域
export const {domain} = {
    // REST 端点
    list: httpGet<{Domain}[], void>('/api/{domain}'),
    create: httpPost<{Domain}, Create{Domain}Request>('/api/{domain}'),
    get: httpGet<{Domain}, { id: string }>((p) => `/api/${domain}/${p.id}`),
    update: httpPut<{Domain}, Update{Domain}Request>((p) => `/api/${domain}/${p.id}`),
    delete: httpDelete<void, { id: string }>((p) => `/api/${domain}/${p.id}`),

    // 响应映射（API 形状 → UI 形状）
    getDetail: withResponseMap(
        httpGet<{Domain}, { id: string }>((p) => `/api/${domain}/${p.id}`),
        fromApi{Domain}  // 转换函数
    ),

    // WebSocket 事件
    listChanged: wsEmitter<I{Domain}ListChangedEvent>('{domain}.listChanged'),
    statusChanged: wsEmitter<I{Domain}StatusChangedEvent>('{domain}.statusChanged'),
};
```

**步骤2：在 `common/types/` 中定义类型**

```typescript
// types/{domain}.ts
export interface I{Domain} {
    id: string;
    name: string;
    status: '{Domain}Status';
    createdAt: number;
    updatedAt: number;
}

export interface Create{Domain}Request {
    name: string;
    description?: string;
}

export type {Domain}Status = 'pending' | 'in_progress' | 'done' | 'failed';
```

**步骤3：在页面/hooks 中消费**

```typescript
import { ipcBridge } from '@/common';

// REST 调用
const data = await ipcBridge.{domain}.list.invoke();

// WS 事件监听
const unsub = ipcBridge.{domain}.listChanged.on((event) => {
    mutate(); // 触发 SWR 重新验证
});
return unsub; // 清理时取消订阅

// SWR 缓存
const { data, isLoading } = useSWR('{domain}/list', () =>
    ipcBridge.{domain}.list.invoke()
);
```

#### 3.2.3 HTTP 桥接工厂方法

| 方法 | 签名 | 说明 |
|---|---|---|
| `httpGet<Data, Params>(path, opts?)` | `{ provider, invoke }` | GET 请求 |
| `httpPost<Data, Params>(path, mapBody?)` | `{ provider, invoke }` | POST 创建 |
| `httpPut<Data, Params>(path, mapBody?)` | `{ provider, invoke }` | PUT 更新 |
| `httpPatch<Data, Params>(path, mapBody?)` | `{ provider, invoke }` | PATCH 部分更新 |
| `httpDelete<Data, Params>(path)` | `{ provider, invoke }` | DELETE 删除 |
| `wsEmitter<Params>(eventName)` | `{ on, emit }` | WS 事件 |
| `withResponseMap<Raw, Mapped>(provider, mapper)` | `{ provider, invoke }` | 响应映射 |
| `stubProvider<Data, Params>(name, default)` | `{ provider, invoke }` | 开发中占位 |

#### 3.2.4 路径参数化

- **静态路径**：`'/api/{domain}'`
- **动态路径**：`(p) => `/api/${domain}/${p.id}``
- **查询参数**：由 Axum 端点自动处理，前端通过 `invoke(params)` 传递

### 3.3 Page 页面命名规范

#### 3.3.1 目录结构

```
renderer/pages/
└── {domain}/              # 每个页面一个目录
    ├── index.tsx           # 页面入口（React.FC + 默认导出）
    ├── components/         # 页面专属组件
    ├── hooks/              # 页面专属 hooks
    └── utils/              # 页面专属工具函数
```

#### 3.3.2 命名规则

| 规则 | 说明 | 示例 |
|---|---|---|
| 目录名 | 小写 camelCase | `modelHub`, `knowledge`, `requirements` |
| 入口文件 | `index.tsx` | 统一入口 |
| 路由路径 | kebab-case | `/knowledge`, `/model-hub`, `/requirements` |
| 页面组件名 | PascalCase + Page 后缀 | `KnowledgeListPage`, `RequirementDetailPage` |

#### 3.3.3 页面注册（路由）

在 `Router.tsx` 中使用 `React.lazy` 懒加载：

```typescript
const {Domain}Page = React.lazy(() => import('@renderer/pages/{domain}'));

// 路由注册
<Route path="/{domain}" element={<ProtectedLayout><{Domain}Page /></ProtectedLayout>} />
<Route path="/{domain}/:id" element={<ProtectedLayout><{Domain}DetailPage /></ProtectedLayout>} />
```

包裹 `withRouteFallback()` 提供 Suspense + ErrorBoundary。

#### 3.3.4 认证守卫

所有受保护路由在 `ProtectedLayout` 中，检查 `useAuth()` 后渲染。

### 3.4 组件规范

#### 3.4.1 组件分组

共享组件按功能域分组在 `renderer/components/` 下：

```
components/
├── base/               # 基础 UI 原语（NomiModal, NomiSelect, CopyButton 等）
├── layout/             # 布局壳（Layout, Sider, Titlebar 等）
├── chat/               # 聊天相关（SendBox, SlashCommandMenu 等）
├── agent/              # 代理相关（AcpModelSelector, AgentBadge 等）
├── media/              # 文件/媒体（FilePreview, UploadProgressBar 等）
├── settings/           # 设置模态框
├── Markdown/           # Markdown 渲染
├── capability/         # 能力图标
├── channels/           # 渠道配置
├── workspace/          # 工作区组件
└── IconParkHOC.tsx     # 图标包装 HOC
```

#### 3.4.2 组件命名规则

| 规则 | 说明 | 示例 |
|---|---|---|
| PascalCase | 组件名全大写驼峰 | `NomiModal`, `SegmentedTabs` |
| Nomi 前缀 | 自定义基础组件 | `NomiModal`, `NomiSelect`, `NomiScrollArea` |
| 多文件组件 | 目录 + `index.tsx` 入口 | `MobileActionSheet/index.ts` |
| 测试文件 | 紧邻源代码 | `*.test.ts`, `*.test.tsx` |

#### 3.4.3 组件文件组织

```
{ComponentName}/
├── index.tsx            # 组件实现
├── {ComponentName}.module.css  # CSS 模块（可选）
├── {sub-component}.tsx  # 子组件（可选）
└── {ComponentName}.test.tsx    # 测试（可选）
```

### 3.5 样式规范

#### 3.5.1 三层样式体系

项目采用 **三层样式架构**，确保统一性和可主题化：

```
第一层：UnoCSS（工具类）
    → className='bg-1 text-t-primary rounded-lg flex-center'

第二层：CSS 自定义属性（设计令牌）
    → --bg-base: #ffffff; --text-primary: #000000; --primary: #165dff;

第三层：全局样式 + Arco 覆盖
    → themes/base.css + arco-override.css + layout.css
```

#### 3.5.2 UnoCSS 工具类规范

使用 `uno.config.ts` 中定义的工具类，映射到 CSS 自定义属性：

| 类别 | 工具类 | CSS 变量映射 |
|---|---|---|
| 背景 | `bg-base`, `bg-1` ~ `bg-10` | `--bg-base`, `--bg-1` ~ `--bg-10` |
| 文本 | `text-t-primary`, `text-t-secondary`, `text-t-tertiary` | `--text-primary`, `--text-secondary` |
| 语义 | `bg-primary`, `text-danger`, `border-success` | `--primary`, `--danger`, `--success` |
| 品牌 | `bg-brand`, `text-brand-light` | `--brand`, `--brand-light` |
| 组件 | `bg-message-user`, `bg-terminal-surface` | `--message-user-bg`, `--terminal-surface` |

**规则：** 优先使用 UnoCSS 工具类，避免手写 `style` 属性或硬编码颜色值。

#### 3.5.3 CSS 自定义属性（设计令牌）

位于 `styles/themes/default-color-scheme.css`，支持亮色/暗色模式：

```css
/* 亮色模式 */
:root {
    --bg-base: #ffffff;
    --bg-1: #f9fafb;
    --text-primary: #000000;
    --primary: #165dff;
    /* ~75 个变量 */
}

/* 暗色模式 */
[data-color-scheme='default'][data-theme='dark'] {
    --bg-base: #0e0e0e;
    --bg-1: #1a1a1a;
    --text-primary: #ffffff;
    /* ... */
}
```

**规则：**
- 所有颜色值必须通过 CSS 变量引用，禁止硬编码
- 新增颜色必须同时定义亮色和暗色变体
- 变量命名遵循 `--{类别}-{语义}` 格式

#### 3.5.4 组件样式三种方式

| 方式 | 适用场景 | 文件格式 |
|---|---|---|
| **CSS 模块** | 需要作用域隔离的组件 | `*.module.css` → `import styles from './X.module.css'` |
| **普通 CSS** | 影响子组件/全局的样式 | `*.css` → 直接 import |
| **UnoCSS 工具类** | 快速布局/间距/颜色 | 直接在 className 中使用 |

**优先级：** UnoCSS 工具类 > CSS 模块 > 普通 CSS

#### 3.5.5 主题切换

通过 `ThemeContext` 管理三个独立轴：

```typescript
interface ThemeContextValue {
    theme: 'light' | 'dark';          // 亮色/暗色模式
    colorScheme: string;               // 配色方案
    fontScale: number;                 // 字体缩放
}
```

暗色模式通过 `data-theme='dark'` 属性 + `body[arco-theme='dark']` 选择器应用。

#### 3.5.6 全局样式文件

| 文件 | 用途 |
|---|---|
| `themes/base.css` | 主题无关基础样式（滚动条、动画、移动端安全区） |
| `themes/default-color-scheme.css` | 亮色/暗色设计令牌 |
| `themes/index.css` | 入口点（导入 base + color-scheme） |
| `arco-override.css` | Arco Design 组件自定义覆盖 |
| `layout.css` | 布局级别样式（侧边栏、消息定位、响应式） |

**规则：** 修改 Arco 组件样式必须在 `arco-override.css` 中，禁止在组件 CSS 中直接覆盖。

### 3.6 Hooks 规范

#### 3.6.1 目录组织

Hooks 按功能域分组：

```
hooks/
├── {domain}/              # 每个域一个目录
│   └── use{Feature}.ts    # 一个 hook 一个文件
├── context/               # React 上下文提供者
│   ├── AuthContext.tsx
│   ├── ThemeContext.tsx
│   ├── LayoutContext.tsx
│   └── ...
└── use{TopLevelFeature}.ts  # 跨域 hook（顶层文件）
```

#### 3.6.2 命名规则

| 规则 | 说明 | 示例 |
|---|---|---|
| `use` 前缀 | 所有 hooks 必须以 `use` 开头 | `useAgents`, `useAutoScroll` |
| 一个 hook 一个文件 | 避免大文件聚合 | `useSendBoxDraft.ts` |
| Context 文件 | `{Name}Context.tsx` | `AuthContext.tsx`, `ThemeContext.tsx` |

### 3.7 状态管理规范

项目 **不使用** 集中式状态管理（Redux/Zustand），采用 **三层替代**：

| 层 | 技术 | 适用场景 |
|---|---|---|
| 全局 UI 状态 | React Context | 认证、主题、布局等 |
| 服务器状态 | SWR (`useSWR`) | API 数据缓存 + 自动重新验证 |
| 持久配置 | `configService` | 用户偏好设置 + 订阅通知 |

**SWR 使用模式：**

```typescript
// 列表缓存
const { data, isLoading, mutate } = useSWR('{domain}/list', () =>
    ipcBridge.{domain}.list.invoke()
);

// 详情缓存
const { data } = useSWR(id ? `{domain}/${id}` : null, () =>
    ipcBridge.{domain}.get.invoke({ id })
);

// WS 事件触发重新验证
ipcBridge.{domain}.listChanged.on(() => mutate());
```

---

## 四、新增业务模块开发流程

### 4.1 后端开发步骤

```
1. 创建 crate 目录          → crates/backend/nomifun-{domain}/
2. 编写 Cargo.toml          → 声明依赖（nomifun-common, nomifun-db, nomifun-api-types 等）
3. 编写数据库迁移           → nomifun-db/migrations/{next}_{domain}.sql
4. 定义 Repository Trait    → 在 nomifun-db 中定义 I{Domain}Repository
5. 实现核心 service.rs      → Builder 注入模式，CRUD + 领域逻辑
6. 编写 routes.rs           → Axum 路由 + 统一响应包装
7. 编写 state.rs            → DomainRouterState(Arc<DomainService>)
8. 编写 events.rs           → WS 事件发射 {domain}.{camelCaseAction}
9. 编写 mcp_server.rs       → MCP 工具服务器（可选）
10. 编写 lib.rs             → 模块声明 + 公共 re-export
11. 编写集成测试            → tests/{scenario}.rs
12. 注册路由到 gateway      → 在 nomifun-gateway 中集成
```

### 4.2 前端开发步骤

```
1. 定义 TypeScript 类型     → common/types/{domain}.ts
2. 注册 API 端点            → common/adapter/ipcBridge.ts 中添加 {domain} 对象
3. 创建页面目录             → renderer/pages/{domain}/index.tsx
4. 编写页面专属 hooks       → renderer/pages/{domain}/hooks/
5. 编写页面专属组件         → renderer/pages/{domain}/components/
6. 注册路由                 → renderer/components/layout/Router.tsx
7. 使用 SWR 缓存           → useSWR('{domain}/xxx', () => ipcBridge.{domain}.xxx.invoke())
8. 监听 WS 事件             → ipcBridge.{domain}.xxxChanged.on(() => mutate())
9. 编写共享组件（可选）     → renderer/components/{domain}/
10. 添加 i18n 翻译          → renderer/services/i18n/locales/{lang}/{domain}.json
11. 测试验证               → 页面渲染 + API 联调 + WS 实时性
```

### 4.3 联调清单

| 检查项 | 说明 |
|---|---|
| 后端路由注册 | 确认路由已在 gateway 中挂载 |
| API 路径一致 | 前端 ipcBridge 的路径与后端 routes.rs 完全匹配 |
| 响应格式一致 | `ApiResponse<T>` 包装正确，前端 `withResponseMap` 映射正确 |
| WS 事件名一致 | 前端 `wsEmitter` 的 eventName 与后端 `events.rs` 一致 |
| 认证传递 | 前端请求携带用户信息，后端 `Extension<CurrentUser>` 注入 |
| 亮色/暗色兼容 | 新页面在两种主题下视觉正确 |
| 响应式布局 | 移动端与桌面端布局正常 |

---

## 五、关键依赖关系图

```
nomifun-gateway (主入口)
    ├── nomifun-auth          (认证)
    ├── nomifun-common        (共享类型 + AppError + ApiResponse)
    ├── nomifun-db            (SQLite + 迁移 + Repository Trait)
    ├── nomifun-api-types     (API DTO 定义)
    ├── nomifun-realtime      (WS 事件推送)
    ├── nomifun-requirement   (需求平台)
    ├── nomifun-knowledge     (知识库)
    ├── nomifun-conversation  (会话)
    ├── nomifun-terminal      (终端)
    ├── nomifun-ai-agent      (AI 代理)
    ├── nomifun-mcp           (MCP 管理)
    ├── nomifun-orchestrator  (任务编排)
    └── ...其他模块
```

每个业务 crate 依赖链：

```
nomifun-{domain}
    ├── nomifun-common (AppError, ApiResponse, trait 定义)
    ├── nomifun-db (I{Domain}Repository, Sqlite{Domain}Repository)
    ├── nomifun-api-types ({Domain}Request, {Domain}Response)
    ├── nomifun-realtime (EventEmitter)
    ├── nomifun-auth (CurrentUser)
    └── ...可选依赖
```

---

## 六、最佳实践与注意事项

### 6.1 后端

1. **Service 方法粒度**：每个方法对应一个清晰的业务操作，避免"上帝方法"
2. **错误类型**：使用 `AppError` 统一错误，禁止裸 `anyhow` 或字符串错误
3. **事务边界**：涉及多表操作时使用 `sqlx` 事务，失败时原子回滚
4. **Owner 双域安全**：所有 owner 相关操作必须配对 `owner_kind` 使用
5. **MCP 安全**：工具只提供操作语义，作用域由服务端强制决定

### 6.2 前端

1. **API 调用统一**：所有 API 调用必须通过 `ipcBridge`，禁止直接 `fetch`
2. **SWR Key 唯一**：`useSWR` 的 key 必须全局唯一，建议格式 `{domain}/{action}/{id}`
3. **颜色禁止硬编码**：必须使用 CSS 变量或 UnoCSS 工具类
4. **Arco 覆盖集中**：所有 Arco 组件样式覆盖集中在 `arco-override.css`
5. **懒加载**：所有页面必须使用 `React.lazy` + Suspense
6. **WS 取消订阅**：组件卸载时必须调用 `unsub()` 清理 WS 监听
7. **i18n 必做**：所有用户可见文本必须使用 `t('{domain}.xxx')`，禁止硬编码中文/英文

---

_文档版本: 1.0.0 | 基于代码分析生成 | 2026-07-06_
