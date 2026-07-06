# nomifun 新模块开发指南 —— 以 AI 生图（imagegen）为例

> 记录从零到一在 nomifun 项目中新增一个前后端完整模块的全流程。
> 适合第一次接触该项目的新人阅读，避免重复踩坑。

---

## 一、开发流程总览

```
① 后端：创建新 crate → 写类型/路由/服务/adapter → cargo check 通过
         ↓
② 后端：注册到 nomifun-app（state + routes + Cargo.toml）
         ↓
③ 前端：写页面组件 + 场景配置
         ↓
④ 前端：注册 API（ipcBridge.ts）
         ↓
⑤ 前端：注册路由（Router.tsx）
         ↓
⑥ 前端：添加侧边栏入口 + 国际化文案
         ↓
⑦ 联调 → 修 bug → 收工 🎉
```

**核心原则**：先跑通后端（`cargo check`），再做前端；前后端分离，接口先行。

---

## 二、后端开发

### 2.1 创建新 crate

项目使用 Cargo workspace，每个功能模块是 `crates/backend/` 下的独立 crate。

```bash
# 目录结构
crates/backend/nomifun-imagegen/
├── Cargo.toml          # 依赖声明
└── src/
    ├── lib.rs           # 模块入口，声明 pub mod
    ├── types.rs         # 请求/响应数据结构 + 序列化测试
    ├── routes.rs        # Axum 路由定义（handler）
    ├── state.rs         # RouterState（共享给 Axum 的状态）
    ├── service.rs       # 业务逻辑层（策略分发）
    └── adapters/        # 策略模式：各模型适配器
        ├── mod.rs       # 声明子模块 + re-export
        ├── traits.rs    # ImageGenerator trait（策略接口）
        └── seedream.rs  # Seedream 适配器实现
```

### 2.2 各文件职责详解

| 文件 | 职责 | 关键点 |
|------|------|--------|
| `Cargo.toml` | 声明依赖（serde, reqwest, axum 等） | 能用 `workspace = true` 就用 workspace 版本 |
| `lib.rs` | `pub mod types; pub mod routes; ...` | 只声明模块 + re-export 公共 API |
| `types.rs` | 请求体 `ImageGenRequest`、响应体 `ImageGenResponse` | 含 `#[cfg(test)]` 序列化/反序列化测试 |
| `routes.rs` | `POST /api/imagegen/generate` 等路由 handler | 函数签名：`async fn handler(State(state): State<XxxRouterState>, Json(req): Json<XxxReq>)` |
| `state.rs` | `ImageGenRouterState { service: ImageGenService }` | 实现 `Clone` + `Default` |
| `service.rs` | `ImageGenService`，按 `req.model` 匹配适配器并调用 | 持有适配器注册表 |
| `adapters/mod.rs` | `pub mod traits; pub mod seedream;` | re-export 公共类型 |
| `adapters/traits.rs` | `ImageGenerator` trait + `ImageGenError` 枚举 | async trait 需 `#[async_trait]` |
| `adapters/seedream.rs` | 具体适配器：通用请求 → Seedream 请求 → 调用 API → 通用响应 | 含单元测试 |

### 2.3 ⚠️ 踩坑警告：Rust 关键字冲突

**问题**：本想命名 `adapters/trait.rs`，但 `trait` 是 Rust 关键字，编译器直接报错：

```
error[E0583]: file not found for module `trait_`
```

**解决**：参考项目中 `nomifun-file` crate 的做法，命名为 `traits.rs`（复数形式）。

> **教训**：Rust 文件命名要避开关键字（`trait`, `type`, `mod`, `impl`, `fn`, `struct`, `enum`, `match`, `loop`, `use`, `pub`, `self`, `super`, `crate` 等）。

### 2.4 ⚠️ 踩坑警告：serde 序列化字段名

**问题**：后端用 `#[serde(rename = "apiKey")]` 期望接收 camelCase，但前端 `httpPost` 发的是 snake_case `api_key`，导致 422：

```
POST /api/imagegen/generate → 422
missing field `apiKey` at line 1 column 96
```

**解决**：后端字段统一用 snake_case（Rust 默认），前端发送时保持一致。

> **教训**：后端 Rust 的 serde 默认序列化/反序列化都是 snake_case。前端 `ipcBridge.ts` 的 `httpPost` 不会自动转换命名风格，前后端字段名必须一致。

### 2.5 注册到 nomifun-app（三步走）

新 crate 写完后，需要在 `nomifun-app` 中注册才能生效。

#### Step 1: 根 `Cargo.toml` 添加 workspace 成员

```toml
# 根 Cargo.toml
[workspace]
members = [
  # ... 已有成员 ...
  "crates/backend/nomifun-imagegen",
]
```

#### Step 2: `nomifun-app/Cargo.toml` 添加依赖

```toml
[dependencies]
nomifun-imagegen = { workspace = true }
```

#### Step 3a: 注册 RouterState — `nomifun-app/src/router/state.rs`

```rust
use nomifun_imagegen::ImageGenRouterState;

pub struct ModuleStates {
    // ... 已有字段 ...
    pub imagegen: ImageGenRouterState,   // ← 新增
}
```

并在 `build_module_states()` 函数中初始化：
```rust
ModuleStates {
    // ...
    imagegen: ImageGenRouterState::new(),   // ← 新增
}
```

#### Step 3b: 注册路由 — `nomifun-app/src/router/routes.rs`

```rust
use nomifun_imagegen::imagegen_routes;

// 创建路由（加 auth 保护）
let imagegen_authenticated = imagegen_routes(states.imagegen)
    .route_layer(from_fn_with_state(auth_mw_state.clone(), auth_middleware));

// 合并到主路由
.merge(imagegen_authenticated)
```

### 2.6 编译验证

```bash
# 只检查新模块
cargo check -p nomifun-imagegen

# 检查整个 workspace
cargo check
```

---

## 三、前端开发

### 3.1 页面目录结构

```
ui/src/renderer/pages/imagegen/
├── index.ts              # 统一导出（如有需要）
├── ImageGenPage.tsx       # 主页面：组合 ScenarioSelector + ImageGenForm + ResultGallery
├── scenarios.ts           # 场景配置（自媒体/电商/设计）+ transform 策略
└── components/
    ├── ScenarioSelector.tsx  # 场景选择器（药片风格）
    ├── ImageGenForm.tsx      # 动态表单：根据场景渲染字段 + 调用 API
    └── ResultGallery.tsx     # 结果网格：悬停显示操作浮层
```

### 3.2 API 层注册 — `ipcBridge.ts`

**位置**：`ui/src/common/adapter/ipcBridge.ts`

这个文件是前端所有 HTTP API 的统一注册中心。定义了调用后端接口的函数签名。

```typescript
// ── 在文件末尾添加 ──

// 接口类型定义
export interface ImageGenRequest {
  model: string;
  api_key: string;
  prompt: string;
  images?: string[];
  width?: number;
  height?: number;
  num_images?: number;
  model_params?: Record<string, unknown>;
}

export interface ImageGenResponse {
  task_id: string;
  images: { url?: string; b64_json?: string }[];
  model: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  description: string;
}

// API 调用定义
export const imagegen = {
  generate: httpPost<ImageGenResponse, ImageGenRequest>('/api/imagegen/generate'),
  getModels: httpGet<ModelInfo[], void>('/api/imagegen/models'),
};
```

**⚠️ 重要**：`httpPost` / `httpGet` 返回的是 `ProviderLike` 对象，调用时必须 `.invoke()`：

```typescript
// ❌ 错误：直接当函数调用
const result = await imagegen.generate(params);

// ✅ 正确：调用 .invoke()
const result = await imagegen.generate.invoke(params);
```

### 3.3 路由注册 — `Router.tsx`

**位置**：`ui/src/renderer/components/layout/Router.tsx`

```tsx
// 1. lazy import（放在其他 lazy import 旁边）
const ImageGenPage = React.lazy(() => import('@renderer/pages/imagegen/ImageGenPage'));

// 2. 添加 Route（放在其他 Route 旁边）
<Route path='/imagegen' element={withRouteFallback(ImageGenPage)} />
```

### 3.4 系统样式引入（重要！）

**核心原则**：不要自己写自定义 CSS 搞特立独行，必须复用项目已有的样式体系。

本项目的样式体系是三件套：

| 层级 | 说明 | 例子 |
|------|------|------|
| **Arco Design** | UI 组件库（Button, Input, Select 等） | `<Input />`, `<Select />` |
| **UnoCSS** | 原子化 CSS class（类似 Tailwind） | `className="w-full flex gap-8px p-16px"` |
| **CSS 变量** | 主题色彩变量（自动适配亮/暗） | `color: var(--color-text-1)`, `background: var(--color-fill-2)` |

**引用 Arco 组件**：
```tsx
import { Button, Input, Select, Message } from '@arco-design/web-react';
```

**引用 IconPark 图标**：
```tsx
import { Pic } from '@icon-park/react';
// ⚠️ 注意：先确认 IconPark 是否有这个导出名！
// 比如 "Expand" 不存在，应该用 "FullScreen"
```

**现有样式参考**：当不确定怎么写样式时，直接参考其他页面（如 `knowledge/`、`assistant/`）的组件写法。

侧边栏入口组件尤其要参考 `SiderModelHubEntry.tsx`、`SiderMcpEntry.tsx` 等同级组件的结构和 class。

### 3.5 侧边栏入口注册（五步走）

#### Step 1: 新建入口组件

**位置**：`ui/src/renderer/components/layout/Sider/SiderNav/SiderImageGenEntry.tsx`

模板：复制 `SiderModelHubEntry.tsx`，修改：
- 图标：`Pic`（来自 `@icon-park/react`）
- 文案：`t('common.imagegen')`
- props 接口保持一致（`isMobile`, `isActive`, `collapsed`, `siderTooltipProps`, `onClick`）
- 折叠态/展开态都要有 Tooltip

#### Step 2: 导出入口组件

**位置**：`ui/src/renderer/components/layout/Sider/SiderNav/index.ts`

```typescript
export { default as SiderImageGenEntry } from './SiderImageGenEntry';
```

#### Step 3: 在侧边栏中渲染

**位置**：`ui/src/renderer/components/layout/Sider/index.tsx`

1. import 组件
2. 添加点击处理函数：`const handleImageGenClick = () => navTo('/imagegen')`
3. 在 JSX 中添加分区标题 + 入口组件：

```tsx
{/* AI工具 — AI-powered tools */}
<SiderSectionHeader label={t('common.siderSection.aiTools')} collapsed={collapsed} />
{/* AI生图 — AI image generation */}
<SiderImageGenEntry
  isMobile={isMobile}
  isActive={pathname.startsWith('/imagegen')}
  collapsed={collapsed}
  siderTooltipProps={siderTooltipProps}
  onClick={handleImageGenClick}
/>
```

#### Step 4: 添加国际化文案

**位置**：`ui/src/renderer/services/i18n/locales/zh-CN/common.json`

```json
{
  "siderSection": {
    "aiTools": "AI工具"
  },
  "imagegen": "AI生图"
}
```

**位置**：`ui/src/renderer/services/i18n/locales/en-US/common.json`

```json
{
  "siderSection": {
    "aiTools": "AI Tools"
  },
  "imagegen": "AI Image Gen"
}
```

#### Step 5: 添加 TypeScript 类型

**位置**：`ui/src/renderer/services/i18n/i18n-keys.d.ts`

在联合类型中添加：
```typescript
| 'common.siderSection.aiTools'
| 'common.imagegen'
```

---

## 四、设计模式

### 4.1 后端：策略模式（Strategy Pattern）

```
        ┌──────────────────┐
        │ ImageGenService   │  ← 根据 req.model 匹配适配器
        │ (策略上下文)       │
        └────────┬─────────┘
                 │ 调用
        ┌────────▼─────────┐
        │ ImageGenerator    │  ← trait（策略接口）
        │ (strategy trait)  │
        └────────┬─────────┘
          ┌──────┼──────┐
    ┌─────▼──┐ ┌▼───┐ ┌─▼──────┐
    │Seedream│ │豆包 │ │DALL-E  │  ← 具体策略实现（后期扩展）
    └────────┘ └────┘ └────────┘
```

**优势**：新增模型只需实现 `ImageGenerator` trait，不改现有代码（开闭原则）。

### 4.2 前端：配置驱动 + 策略模式

```
用户选择场景
     ↓
加载 ScenarioConfig（fields + transform）
     ↓
动态渲染表单（根据 fields）
     ↓
用户填写 → transform(formData) → 通用 ImageGenRequest
     ↓
调用 imagegen.generate.invoke(request)
```

每个场景配置包含：
- `fields`：表单字段定义（驱动动态表单渲染）
- `transform`：策略方法 — 场景特有表单数据 → 通用 API 请求参数

---

## 五、开发中的常见坑 🔥

| 序号 | 问题 | 原因 | 解决 |
|------|------|------|------|
| 1 | Rust 文件名不能用关键字 | `trait.rs` 撞 `trait` 关键字 | 改名为 `traits.rs` |
| 2 | `missing field apiKey` 422 | 前后端字段命名不一致（camelCase vs snake_case） | 统一用 snake_case |
| 3 | `imagegen.generate is not a function` | `httpPost` 返回 ProviderLike 对象，不是函数 | 改为 `.invoke(params)` |
| 4 | IconPark 导入不存在的图标名 | `Expand` 不在 IconPark 导出中 | 查 IconPark 文档或用 `FullScreen` |
| 5 | Cargo 编译缓存损坏 | 删除 `~/.cargo/registry/src/` 下的源文件 | `cargo clean` + 删 registry 缓存 |
| 6 | 端口被占用 | 上次 dev server 没关 | `netstat -ano \| grep :5173` → `taskkill //F //PID xxx` |
| 7 | 样式和项目其他页面不统一 | 手写自定义 CSS 而非复用系统样式 | 用 Arco Design + UnoCSS + CSS 变量 |
| 8 | `#[tokio::test)]` 语法错误 | 多了一个右括号 | `#[tokio::test]` |
| 9 | workspace uuid 没开 v4 feature | `uuid::Uuid::new_v4()` 编译失败 | 根 `Cargo.toml` 的 uuid features 加 `v4` |
| 10 | Seedream API 报图片尺寸太小 | Seedream 要求 ≥ 3686400 像素 | 传 `"2k"` 或 `"2048x2048"` 等更大尺寸 |

---

## 六、启动与调试

```bash
# 终端 1：启动后端（--insecure-no-auth 跳过登录）
cargo run -p nomifun-web -- --port 8787 --dist ui/dist --insecure-no-auth

# 终端 2：启动前端 dev server
cd ui && bun run dev:web

# 访问：http://localhost:5173/imagegen
```

**调试技巧**：
- 后端日志在终端 1 中查看
- 前端调 API 在浏览器 DevTools → Network 中看请求/响应
- 422 错误 = 请求参数不对，对比前端发的 JSON 和后端 struct 字段名

---

## 七、集成清单速查表

新增一个模块，需要修改的文件汇总：

| 文件 | 操作 |
|------|------|
| **根 `Cargo.toml`** | 添加 workspace member |
| **`nomifun-app/Cargo.toml`** | 添加 `nomifun-xxx = { workspace = true }` |
| **`nomifun-app/src/router/state.rs`** | `ModuleStates` 加字段 + 初始化 |
| **`nomifun-app/src/router/routes.rs`** | import + merge 路由 |
| **`ui/src/common/adapter/ipcBridge.ts`** | 加 API 类型 + `httpPost`/`httpGet` 定义 |
| **`ui/src/renderer/components/layout/Router.tsx`** | lazy import + `<Route path='...'>` |
| **`ui/src/renderer/components/layout/Sider/SiderNav/`** | 建 `SiderXxxEntry.tsx` |
| **`.../SiderNav/index.ts`** | 导出新入口组件 |
| **`.../layout/Sider/index.tsx`** | 渲染入口组件 |
| **`ui/.../i18n/locales/zh-CN/common.json`** | 中文文案 |
| **`ui/.../i18n/locales/en-US/common.json`** | 英文文案 |
| **`ui/.../i18n/i18n-keys.d.ts`** | TypeScript 类型联合 |

共 **11 个文件**需要修改。

---

> **编写日期**：2026-07-06  
> **编写人**：Lapo 🦞（根据 AI 生图模块实际开发过程复盘记录）
