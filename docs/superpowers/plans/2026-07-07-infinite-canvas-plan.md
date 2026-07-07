# 无限画布功能实现计划

## 概述

基于设计文档 `docs/superpowers/specs/2026-07-07-infinite-canvas-design.md`，将无限画布功能拆分为可独立实现的任务。目标：前后端功能全部开发好，编译失败不强求，专注写代码。

## 任务分解

### Phase 1: 后端 — 文本对话 API

**Task 1.1: 创建 TextAdapter trait 和 TextModelRegistry**
- 文件: `crates/backend/nomifun-image/src/text_adapters/mod.rs`
- 内容:
  - 定义 `TextAdapter` trait（model_name, model_label, chat）
  - 定义 `TextModelRegistry`（与 ImageAdapter/ModelRegistry 同构）
  - 参考 `crates/backend/nomifun-image/src/adapters/mod.rs` 的模式

**Task 1.2: 实现 DeepSeek 适配器（modelverse chat）**
- 文件: `crates/backend/nomifun-image/src/text_adapters/deepseek.rs`
- 内容:
  - 实现 `TextAdapter` trait
  - 调用 `POST https://api.modelverse.cn/v1/chat/completions`
  - 映射 `TextChatRequest` → modelverse 请求格式
  - 映射 modelverse 响应 → `TextChatResponse`
  - 支持 stream: false（v1 先做非流式）

**Task 1.3: 定义文本相关类型**
- 文件: `crates/backend/nomifun-image/src/text_models.rs`
- 内容:
  - `TextChatRequest` { model, api_key, messages, stream, temperature, max_tokens }
  - `ChatMessage` { role, content }
  - `TextChatResponse` { content, model, usage }
  - `TokenUsage` { prompt_tokens, completion_tokens, total_tokens }
  - `TextModelInfo` { name, label }
  - 参考 `crates/backend/nomifun-image/src/models.rs` 的 serde 命名风格

**Task 1.4: 实现 TextService**
- 文件: `crates/backend/nomifun-image/src/text_service.rs`
- 内容:
  - `TextService::new()` — 注册 DeepSeek 适配器
  - `list_models()` — 委托 registry
  - `chat(model, messages, api_key, ...)` — 委托对应 adapter
  - 与 `ImageService` 同构

**Task 1.5: 实现文本路由**
- 文件: `crates/backend/nomifun-image/src/text_routes.rs`
- 内容:
  - `GET /api/text/models` → list_text_models
  - `POST /api/text/chat` → text_chat
  - 与 `routes.rs` 同构（State, Extension, Json 模式）

**Task 1.6: 扩展 State 和 lib.rs**
- 文件修改:
  - `crates/backend/nomifun-image/src/state.rs` — 新增 `pub text_service: Arc<TextService>`
  - `crates/backend/nomifun-image/src/lib.rs` — 新增 `pub mod text_adapters; pub mod text_models; pub mod text_service; pub mod text_routes;` 和 re-export `TextService`, `TextRouterState`（state 改名为统一，保持 `ImageRouterState` 包含 text_service）
  - `crates/backend/nomifun-image/src/routes.rs` — 合并文本路由到 `image_routes()`，新增 `/api/text/models` 和 `/api/text/chat`

**Task 1.7: 更新 nomifun-app 集成**
- 文件修改:
  - `crates/backend/nomifun-app/src/router/state.rs` — `build_module_states` 中构造 TextService（如果 State 在 nomifun-image 内部扩展，这里可能只需更新 `ImageRouterState` 的构造）
  - 验证 `ImageRouterState` 构造处增加 `text_service: Arc::new(TextService::new())`
  - 如果路由已在 `image_routes()` 内合并，`routes.rs` 不需要额外修改

---

### Phase 2: 前端基础设施

**Task 2.1: 安装 Flowgram 依赖**
- 在 `ui/` 目录执行: `bun add @flowgram.ai/free-layout-editor styled-components @flowgram.ai/minimap-plugin @flowgram.ai/free-snap-plugin @flowgram.ai/form-materials`

**Task 2.2: 前端类型定义**
- 文件: `ui/src/common/types/canvas/canvasTypes.ts`（新建）
- 内容:
  - `TextNodeData` { content, modelConfig?, chatStatus?, chatError? }
  - `ImageNodeData` { image?, prompt?, generateParams?, generateStatus?, generateError? }
  - `CanvasData` { id, name, data, createdAt, updatedAt }

- 文件: `ui/src/common/types/canvas/textTypes.ts`（新建）
- 内容:
  - `ITextChatRequest` { model, apiKey, messages, stream?, temperature?, maxTokens? }
  - `ITextChatResponse` { content, model, usage? }
  - `ITextModelInfo` { name, label }
  - `IChatMessage` { role, content }
  - `ITokenUsage` { promptTokens, completionTokens, totalTokens }

**Task 2.3: ipcBridge 扩展**
- 文件: `ui/src/common/adapter/ipcBridge.ts`
- 修改: 在 video 部分之后新增 text 部分
  ```ts
  // ── Text generation ──
  export interface ITextModelInfo { name: string; label: string; }
  export interface ITextChatResponse { content: string; model: string; usage?: ITokenUsage; }
  export interface ITextChatRequest {
    model: string; apiKey: string; messages: IChatMessage[];
    stream?: boolean; temperature?: number; maxTokens?: number;
  }
  export interface IChatMessage { role: string; content: string; }
  export interface ITokenUsage { promptTokens: number; completionTokens: number; totalTokens: number; }

  export const text = {
    listModels: httpGet<ITextModelInfo[], void>('/api/text/models'),
    chat: httpPost<ITextChatResponse, ITextChatRequest>('/api/text/chat', (p) => p),
  };
  ```

**Task 2.4: 路由注册**
- 文件: `ui/src/renderer/components/layout/Router.tsx`
- 修改:
  - 新增 lazy import: `const CanvasPage = React.lazy(() => import('@renderer/pages/canvas'));`
  - 新增路由: `<Route path='/canvas' element={withRouteFallback(CanvasPage)} />`
  - 新增子路由: `<Route path='/canvas/:id' element={withRouteFallback(CanvasEditorPage)} />`

**Task 2.5: 侧边栏入口**
- 文件: `ui/src/renderer/components/layout/Sider/SiderNav/SiderCanvasEntry.tsx`（新建）
- 内容: 参照 `SiderImageGenerationEntry.tsx`，图标用 `@icon-park/react` 的 `Empty` 或 `GridFour`，i18n key `canvas.title`
- 修改 Sider 主文件添加该入口到 Enhancement Tools 分组

**Task 2.6: i18n 翻译**
- 在中文和英文 locale 文件中添加 `canvas` 相关翻译 key

---

### Phase 3: 前端画布核心

**Task 3.1: 画布存储服务**
- 文件: `ui/src/renderer/pages/canvas/services/canvasStorage.ts`（新建）
- 内容: saveCanvas, loadCanvas, listCanvases, deleteCanvas, generateCanvasId

**Task 3.2: 节点类型注册表**
- 文件: `ui/src/renderer/pages/canvas/components/nodes/registries.ts`（新建）
- 内容:
  - 定义 `CanvasNodeType` 常量: `text = 'text'`, `image = 'image'`, `video = 'video'`
  - `textNodeRegistry`: type 'text', output port, formMeta render TextNodeForm, onAdd 初始数据
  - `imageNodeRegistry`: type 'image', input+output ports, formMeta render ImageNodeForm, onAdd 初始数据
  - `videoNodeRegistry`: type 'video', meta deleteDisable
  - `nodeRegistries` 数组导出

**Task 3.3: 文本节点渲染组件**
- 文件: `ui/src/renderer/pages/canvas/components/nodes/TextNode.tsx`（新建）
- 内容:
  - 接收 `WorkflowNodeProps`
  - 使用 `useNodeRender()` 获取 form/data
  - 渲染: 文本图标 + 文本摘要（截断 40 字）+ "生成中" 状态指示
  - 使用 `WorkflowNodeRenderer` 包裹
  - 点击事件触发打开悬浮编辑面板

**Task 3.4: 图片节点渲染组件**
- 文件: `ui/src/renderer/pages/canvas/components/nodes/ImageNode.tsx`（新建）
- 内容:
  - 接收 `WorkflowNodeProps`
  - 使用 `useNodeRender()` 获取 form/data
  - 有图 → 渲染图片缩略图
  - 无图 → 渲染占位图标 + "上传图片" 提示
  - 生成中 → loading 覆盖层
  - 使用 `WorkflowNodeRenderer` 包裹
  - 点击事件触发打开悬浮编辑面板

**Task 3.5: 视频节点占位组件**
- 文件: `ui/src/renderer/pages/canvas/components/nodes/VideoNode.tsx`（新建）
- 内容: 灰显的占位节点，显示"即将推出"

**Task 3.6: 编辑器配置 Hook**
- 文件: `ui/src/renderer/pages/canvas/components/hooks/useEditorProps.ts`（新建）
- 内容:
  - 参考 Flowgram demo 的 `use-editor-props.tsx`
  - 接收 `initialData`, `canvasId`, `canvasName` 参数
  - 返回 `FreeLayoutProps` 配置:
    - `background: true`, `twoWayConnection: true`
    - `nodeEngine: { enable: true }`, `variableEngine: { enable: true }`
    - `history: { enable: true, enableChangeNode: true }`
    - `materials: { renderDefaultNode: CanvasBaseNode }`
    - `canAddLine` — 简化版：允许图片↔图片、文本→图片
    - `onContentChange` — 防抖自动保存
    - `onAllLayersRendered` — fitView
    - `scroll: { enableScrollLimit: false }`
  - 插件: minimap, snap, stack, lines, context-menu
  - 简化版，不包含 runtime/variable-panel 等工作流执行相关插件

**Task 3.7: FlowEditor 组件**
- 文件: `ui/src/renderer/pages/canvas/components/FlowEditor.tsx`（新建）
- 内容:
  - 接收 `canvasId`, `canvasName`, `initialData`
  - 使用 `useEditorProps` 获取配置
  - 渲染 `FreeLayoutEditorProvider` + `EditorRenderer`
  - React 19 polyfill: `unstableSetCreateRoot(createRoot)`

**Task 3.8: 获取关联图片工具**
- 文件: `ui/src/renderer/pages/canvas/components/shared/ConnectedImages.tsx`（新建）
- 内容:
  - `getConnectedImages(node)` — 遍历 inputNodes/outputNodes，过滤 image 类型，返回图片列表
  - `getConnectedTexts(node)` — 遍历 inputNodes，过滤 text 类型，返回文本内容列表

---

### Phase 4: 前端编辑面板与交互

**Task 4.1: 右侧节点工具栏**
- 文件: `ui/src/renderer/pages/canvas/components/panels/NodeToolbar.tsx`（新建）
- 内容:
  - 固定右侧，宽度 60px
  - 三个按钮: 文本、图片、视频（灰显）
  - 点击按钮 → 调用 `FlowOperationService.addFromNode()` 在画布中心添加节点
  - 使用 Arco Design Button + Tooltip

**Task 4.2: 顶部画布工具栏**
- 文件: `ui/src/renderer/pages/canvas/components/toolbar/CanvasToolbar.tsx`（新建）
- 内容:
  - 返回按钮（回到画布列表）
  - 画布名称显示
  - 保存按钮
  - 缩放控制（使用 `usePlaygroundTools()`）
  - 适应画布按钮
  - 撤销/重做（使用 `useClientContext().history`）

**Task 4.3: 文本节点悬浮编辑面板**
- 文件: `ui/src/renderer/pages/canvas/components/panels/TextEditPanel.tsx`（新建）
- 内容:
  - 使用 Arco Design Popover 或自定义浮动面板
  - 多行文本编辑区（TextArea）
  - 模型选择下拉（从 `/api/text/models` 获取列表）
  - 系统提示词输入（可选）
  - "生成提示词"按钮 → 调用 `ipcBridge.text.chat()`
  - 生成中状态 → loading + 按钮禁用
  - 生成完成 → 结果填入文本编辑区
  - 错误处理 → 显示错误信息 + 重试

**Task 4.4: 图片节点悬浮编辑面板**
- 文件: `ui/src/renderer/pages/canvas/components/panels/ImageEditPanel.tsx`（新建）
- 内容:
  - 使用 Arco Design Popover 或自定义浮动面板
  - 图片预览区（当前图片，点击可查看大图）
  - 上传按钮 → 文件选择器 → base64 编码 → 设置 data.image
  - 参考图列表（来自关联节点的图片缩略图）
  - 提示词输入框
  - 生图参数：尺寸下拉选择
  - "生成"按钮 → 调用 `ipcBridge.image.generate()`
  - 生图结果处理:
    - 当前无图 → 设置 data.image
    - 当前有图 → 创建新图片节点 + 连线
  - 生成中状态 / 错误处理

**Task 4.5: 节点选择与面板状态管理**
- 文件: `ui/src/renderer/pages/canvas/components/hooks/useNodeSelection.ts`（新建）
- 内容:
  - 管理当前选中节点和悬浮面板状态
  - `selectedNode`, `panelPosition`, `panelType`
  - `selectNode(node)` — 设置选中节点 + 面板位置
  - `deselectNode()` — 关闭面板
  - 同一时间只打开一个面板

---

### Phase 5: 前端页面集成

**Task 5.1: 画布列表页**
- 文件: `ui/src/renderer/pages/canvas/index.tsx`（新建）
- 内容:
  - 使用 `canvasStorage.listCanvases()` 获取画布列表
  - 网格布局展示画布卡片（名称、更新时间）
  - 新建画布按钮 → 弹出输入名称 → `canvasStorage.saveCanvas()` → 跳转编辑页
  - 删除画布 → 确认弹窗 → `canvasStorage.deleteCanvas()`
  - 空状态提示

**Task 5.2: 画布编辑页**
- 文件: `ui/src/renderer/pages/canvas/CanvasEditor.tsx`（新建）
- 内容:
  - 从 URL 参数获取 canvasId
  - 使用 `canvasStorage.loadCanvas()` 加载画布数据
  - 渲染: CanvasToolbar + FlowEditor + NodeToolbar
  - 选中节点时渲染对应的悬浮编辑面板（TextEditPanel / ImageEditPanel）
  - 处理画布数据加载失败情况

**Task 5.3: React 19 polyfill 入口**
- 文件: `ui/src/renderer/main.tsx`（修改）
- 在应用入口添加:
  ```ts
  import { createRoot } from 'react-dom/client';
  import { unstableSetCreateRoot } from '@flowgram.ai/form-materials';
  unstableSetCreateRoot(createRoot);
  ```

---

### Phase 6: 集成与完善

**Task 6.1: 生图服务封装**
- 文件: `ui/src/renderer/pages/canvas/services/imageGenerateService.ts`（新建）
- 内容:
  - `generateImage(params)` — 封装 `ipcBridge.image.generate()`
  - `uploadImage(file)` — 文件 → base64 转换
  - 错误处理包装

**Task 6.2: 文本生成服务封装**
- 文件: `ui/src/renderer/pages/canvas/services/textChatService.ts`（新建）
- 内容:
  - `generatePrompt(model, apiKey, messages)` — 封装 `ipcBridge.text.chat()`
  - 错误处理包装

**Task 6.3: 样式和 UI 打磨**
- 画布区域样式（全高、背景色）
- 节点卡片样式（圆角、阴影、hover 效果）
- 悬浮面板样式（宽度、z-index、动画）
- 右侧工具栏样式（背景、间距）
- 暗色模式适配

**Task 6.4: 错误处理完善**
- localStorage 容量满 → try/catch + 提示
- 画布数据损坏 → 加载失败提示
- API 调用失败 → 面板内错误信息 + 重试

## 执行顺序

```
Phase 1 (后端)  → Task 1.1 → 1.2 → 1.3 → 1.4 → 1.5 → 1.6 → 1.7
Phase 2 (前端基础) → Task 2.1 → 2.2 → 2.3 → 2.4 → 2.5 → 2.6
Phase 3 (画布核心) → Task 3.1 → 3.2 → 3.3/3.4/3.5(并行) → 3.6 → 3.7 → 3.8
Phase 4 (编辑面板) → Task 4.1 → 4.2 → 4.3/4.4(并行) → 4.5
Phase 5 (页面集成) → Task 5.1 → 5.2 → 5.3
Phase 6 (完善)   → Task 6.1/6.2(并行) → 6.3 → 6.4
```

## 关键依赖关系

- Phase 2 依赖 Phase 1（ipcBridge 需要 `/api/text/*` 端点存在）
- Phase 3 依赖 Phase 2（Flowgram 依赖、类型定义、路由）
- Phase 4 依赖 Phase 3（编辑面板需要节点组件和 FlowEditor）
- Phase 5 依赖 Phase 3 + 4（页面需要所有组件就绪）
- Phase 6 依赖 Phase 5（完善需要可运行的页面）

## 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| Flowgram React 19 兼容性问题 | unstableSetCreateRoot polyfill；如果 form-materials 不兼容，改用自定义 form 而非 Flowgram formMeta |
| Flowgram API 变更 | 以 wiki/flowgram-demo-and-doc 中的 demo 代码为准，它是最新的 |
| localStorage 容量限制 | base64 图片较大时可能超限；v1 先用，后续迁移到后端 |
| styled-components 冲突 | 项目已有 UnoCSS，styled-components 仅用于 Flowgram 内部，隔离使用 |
