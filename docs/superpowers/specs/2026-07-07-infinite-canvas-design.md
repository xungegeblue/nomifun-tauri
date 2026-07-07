# 无限画布功能设计

## 概述

基于 Flowgram Free Layout 构建无限画布功能，支持文本节点和图片节点（视频节点预留），节点间通过连线共享数据，图片节点可调用 Seedream 生图模型。画布数据前端 localStorage 存储，支持多画布管理。

## 技术选型

- **画布引擎**：`@flowgram.ai/free-layout-editor`（Free Layout 模式）
- **变量引擎**：Flowgram 内置 `variableEngine`（启用，用于节点间数据传递）
- **Form 引擎**：Flowgram 内置 `nodeEngine`（启用）
- **UI 组件库**：Arco Design（与项目现有一致）
- **生图 API**：复用后端 `/api/image/generate`（通过 ipcBridge / httpBridge）
- **持久化**：localStorage（JSON 格式，Flowgram `toJSON()` / `fromJSON()`）

### 依赖安装

```sh
bun add @flowgram.ai/free-layout-editor styled-components @flowgram.ai/minimap-plugin @flowgram.ai/free-snap-plugin @flowgram.ai/form-materials
```

### React 19 兼容

Flowgram form-materials 需要 React 18/19 polyfill：

```tsx
import { createRoot } from 'react-dom/client';
import { unstableSetCreateRoot } from '@flowgram.ai/form-materials';
unstableSetCreateRoot(createRoot);
```

## 路由与页面结构

### 路由

| 路由 | 页面 | 说明 |
|------|------|------|
| `/canvas` | 画布列表页 | 展示所有已保存画布，新建/删除画布 |
| `/canvas/:id` | 画布编辑页 | Flowgram 编辑器 + 工具栏 + 编辑面板 |

### 侧边栏入口

在 Enhancement Tools 分组中新增"画布"入口，与 Image Generation / Video Generation 并列。参照 `SiderImageGenerationEntry.tsx` 模式实现。

### 画布列表页

- 展示所有已保存的画布卡片（名称、缩略图、更新时间）
- 新建画布：输入名称 → 跳转编辑页
- 删除画布：确认后删除
- 数据存储：localStorage，key 格式 `nomifun_canvas_{id}`

### 画布编辑页布局

```
┌──────────────────────────────────────────────────┐
│  顶部工具栏（返回、画布名、保存、缩放控制）        │
├──────────────────────────────────┬───────────────┤
│                                  │  右侧节点面板  │
│    Flowgram 画布区域              │  ┌──────────┐ │
│    (FreeLayoutEditorProvider)    │  │ 文本节点  │ │
│                                  │  │ 图片节点  │ │
│                                  │  │ 视频节点  │ │
│                                  │  └──────────┘ │
│                                  │               │
├──────────────────────────────────┴───────────────┤
│  悬浮编辑面板（点击节点时弹出，覆盖在画布上方）      │
└──────────────────────────────────────────────────┘
```

## 节点类型与数据模型

### 文本节点 (text)

**用途**：编写提示词，后续可调用大模型生成提示词，供下游图片节点使用。

**数据模型**：

```typescript
interface TextNodeData {
  content: string;           // 文本内容 / 提示词
  modelConfig?: {            // 大模型配置（后续提供 API 时接入）
    provider?: string;
    model?: string;
  };
}
```

**节点渲染**：显示文本摘要（截断显示），有文本图标标识。

**端口**：
- 1 个 output port（右侧）— 输出文本内容

**编辑（悬浮面板）**：
- 多行文本编辑区
- "生成提示词"按钮（后续接入大模型 API）

---

### 图片节点 (image)

**用途**：持有一张图片，可调用 Seedream 生图，可获取关联图片作为参考。

**数据模型**：

```typescript
interface ImageNodeData {
  image?: string;            // base64 或 URL，每个节点最多一张
  prompt?: string;           // 生图提示词
  generateParams?: {         // 生图参数
    size?: string;           // 如 "2k", "4k", "2304x1728"
  };
  generateStatus?: 'idle' | 'generating' | 'done' | 'error';
  generateError?: string;
}
```

**节点渲染**：
- 有图片 → 显示图片缩略图
- 无图片 → 显示占位图标 + "上传图片" 提示
- 生成中 → 显示 loading 覆盖层

**端口**：
- 1 个 input port（左侧）— 接收参考图
- 1 个 output port（右侧）— 输出自己的图片

**连接规则**：
- `twoWayConnection: true`，不限制连接方向
- 图片节点获取所有相连图片节点的图片作为参考图列表
- 获取方式：通过 `node.lines.inputNodes` / `node.lines.outputNodes` 遍历相连图片节点

**编辑（悬浮面板）**：
- 图片预览区（当前图片）
- 上传按钮（本地上传 base64）
- 参考图列表（来自关联节点，缩略图展示）
- 提示词输入框
- 生图参数设置（尺寸选择）
- "生成"按钮

**生图结果处理**：
- 当前节点无图 → 生图结果设为当前节点图片
- 当前节点有图 → 创建新图片节点（`FlowOperationService.addFromNode()`），设为生成结果，自动连线 老→新

**上传图片逻辑**：
- 点击上传区域 → 文件选择器 → base64 编码 → 设置到 `data.image`
- 上传完成后节点自动显示图片

---

### 视频节点 (video)

本期不实现，仅预留 `video` 类型注册（空壳节点），右侧面板灰显。

---

### 节点注册表

```typescript
const nodeRegistries: FlowNodeRegistry[] = [
  {
    type: 'text',
    meta: {
      defaultPorts: [
        { type: 'output', portID: 'text-out', location: 'right' }
      ]
    },
    formMeta: { render: () => <TextNodeForm /> },
    onAdd: () => ({
      id: nanoid(),
      type: 'text',
      data: { content: '' }
    }),
  },
  {
    type: 'image',
    meta: {
      defaultPorts: [
        { type: 'input', portID: 'image-in', location: 'left' },
        { type: 'output', portID: 'image-out', location: 'right' },
      ]
    },
    formMeta: { render: () => <ImageNodeForm /> },
    onAdd: () => ({
      id: nanoid(),
      type: 'image',
      data: {}
    }),
  },
  {
    type: 'video',
    meta: { deleteDisable: true },  // 预留
  },
];
```

## 数据流与生图流程

### Flowgram 配置

```typescript
<FreeLayoutEditorProvider
  variableEngine={{ enable: true }}
  nodeEngine={{ enable: true }}
  history={{ enable: true, enableChangeNode: true }}
  twoWayConnection={true}
  background={true}
  ...
>
```

### 获取关联图片

以 Flowgram lines API 为主：

1. 获取当前节点所有 input/output 连接的节点
2. 过滤出 `type === 'image'` 的节点
3. 读取每个节点的 `data.image` 作为参考图

```typescript
function getConnectedImages(node: WorkflowNodeEntity): string[] {
  const inputNodes = node.lines.inputNodes || [];
  const outputNodes = node.lines.outputNodes || [];
  const allConnected = [...inputNodes, ...outputNodes];
  return allConnected
    .filter(n => n.flowNodeType === 'image')
    .map(n => n.getData(ImageNodeData).image)
    .filter(Boolean) as string[];
}
```

### 生图完整流程

```
1. 用户点击图片节点 → 弹出悬浮编辑面板
2. 面板显示：
   - 当前图片（如有）
   - 参考图列表（从相连图片节点获取）
   - 提示词输入
   - 尺寸选择
3. 用户填写提示词，可选参考图，点击"生成"
4. 前端组装请求：
   - prompt: 提示词
   - size: 选择的尺寸
   - images: 参考图的 URL/base64 列表
5. 调用后端 API: ipcBridge.image.generate.invoke() 或 httpBridge
6. 收到响应（image_url 或 base64）
7. 结果处理：
   - 当前节点无图 → 设置 data.image = 结果图片
   - 当前节点有图 →
     a. 调用 FlowOperationService.addFromNode() 创建新图片节点
     b. 设置新节点 data.image = 结果图片
     c. 创建连线：当前节点 output → 新节点 input
8. 更新画布渲染
```

### 文本节点流程

```
1. 用户点击文本节点 → 弹出悬浮编辑面板
2. 用户输入需求描述
3. 点击"生成提示词" → 调用大模型 API（后续提供）
4. 返回的提示词填入 content
5. 文本节点 content 可被下游图片节点引用
```

## 数据持久化

### 存储格式

```typescript
interface CanvasData {
  id: string;
  name: string;
  data: WorkflowJSON;      // Flowgram toJSON() 输出
  createdAt: number;
  updatedAt: number;
}
```

### 存储操作

```typescript
// 保存画布
const saveCanvas = (canvasId: string, data: CanvasData) => {
  localStorage.setItem(`nomifun_canvas_${canvasId}`, JSON.stringify(data));
};

// 加载画布
const loadCanvas = (canvasId: string): CanvasData | null => {
  const raw = localStorage.getItem(`nomifun_canvas_${canvasId}`);
  return raw ? JSON.parse(raw) : null;
};

// 列出所有画布
const listCanvases = (): CanvasData[] => {
  const canvases: CanvasData[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('nomifun_canvas_')) {
      const raw = localStorage.getItem(key);
      if (raw) canvases.push(JSON.parse(raw));
    }
  }
  return canvases.sort((a, b) => b.updatedAt - a.updatedAt);
};

// 删除画布
const deleteCanvas = (canvasId: string) => {
  localStorage.removeItem(`nomifun_canvas_${canvasId}`);
};
```

### 自动保存

监听 Flowgram 的 `onContentChange` 回调，防抖 1 秒后自动保存：

```typescript
onContentChange: debounce((ctx) => {
  saveCanvas(canvasId, {
    id: canvasId,
    name: canvasName,
    data: ctx.document.toJSON(),
    updatedAt: Date.now(),
  });
}, 1000),
```

## 组件结构与文件组织

### 目录结构

```
ui/src/renderer/pages/canvas/
├── index.tsx                           # 画布列表页（路由 /canvas）
├── CanvasEditor.tsx                    # 画布编辑页（路由 /canvas/:id）
├── components/
│   ├── FlowEditor.tsx                  # Flowgram 编辑器封装
│   ├── hooks/
│   │   └── useEditorProps.ts           # 编辑器配置 hook
│   ├── nodes/
│   │   ├── TextNode.tsx                # 文本节点渲染组件
│   │   ├── ImageNode.tsx              # 图片节点渲染组件
│   │   ├── VideoNode.tsx              # 视频节点占位组件
│   │   └── registries.ts              # 节点注册表
│   ├── panels/
│   │   ├── NodeToolbar.tsx            # 右侧节点工具栏
│   │   ├── TextEditPanel.tsx          # 文本节点悬浮编辑面板
│   │   └── ImageEditPanel.tsx         # 图片节点悬浮编辑面板
│   ├── toolbar/
│   │   └── CanvasToolbar.tsx          # 顶部画布工具栏（缩放、保存等）
│   └── shared/
│       └── ConnectedImages.tsx        # 获取关联图片的工具组件
├── services/
│   ├── canvasStorage.ts               # localStorage 画布 CRUD
│   └── imageGenerateService.ts        # 封装后端生图 API 调用
└── types.ts                            # 画布相关类型定义
```

### 关键组件职责

| 组件 | 职责 |
|------|------|
| `CanvasEditor` | 页面容器，加载画布数据，渲染 FlowEditor + 右侧面板 + 顶部工具栏 |
| `FlowEditor` | 封装 `FreeLayoutEditorProvider` + `EditorRenderer`，管理画布生命周期 |
| `useEditorProps` | 组装所有 Flowgram 配置（nodeRegistries, plugins, callbacks 等） |
| `TextNode` | 渲染文本节点卡片，显示文本摘要 |
| `ImageNode` | 渲染图片节点卡片，显示图片缩略图或占位 |
| `NodeToolbar` | 右侧面板，3 种节点按钮，点击调用 `FlowOperationService.addFromNode()` |
| `TextEditPanel` | 悬浮编辑面板：文本编辑 + 大模型调用 |
| `ImageEditPanel` | 悬浮编辑面板：图片预览 + 上传 + 参考图 + 提示词 + 参数 + 生成 |
| `canvasStorage` | localStorage 画布 CRUD 操作 |

### 与现有代码的复用

- **生图 API**：复用 `ipcBridge.image.generate.invoke()` 或 `httpBridge` 调用 `/api/image/generate`
- **图片处理**：复用 `imageGenCore.ts` 中的图片 URI 处理逻辑
- **类型定义**：复用 `ui/src/common/types/image/imageTypes.ts` 中的 `GenerateParams`, `GenerateResult`
- **侧边栏入口**：参照 `SiderImageGenerationEntry.tsx` 模式新建 `SiderCanvasEntry.tsx`

## UI 交互细节

### 右侧节点工具栏

- 固定在画布右侧，宽度约 60px
- 三个节点按钮：文本、图片、视频（灰显）
- 点击按钮 → 在画布中心位置添加对应节点
- 拖拽按钮到画布特定位置 → 在该位置添加节点

### 悬浮编辑面板

- 点击节点时弹出，定位在节点右侧或鼠标位置附近
- 点击画布空白处或按 Esc 关闭
- 同一时间只打开一个面板
- 使用 Arco Design 的 Popover 或自定义浮动面板实现

### 图片节点交互

- **上传图片**：点击上传区域 → 文件选择器 → base64 编码 → 设置 `data.image`
- **参考图展示**：编辑面板中显示所有相连图片节点的缩略图，点击可预览大图
- **生图参数**：尺寸下拉选择（复用后端 schema 返回的选项）
- **生成中状态**：按钮禁用 + loading 动画，节点上显示 loading 覆盖层
- **生成失败**：面板内显示错误信息，支持重试

### 连线交互

- 从节点 port 拖出连线到另一个节点 port 完成连接
- 双向连接，不限制方向
- `canAddLine` 校验：只允许合理连接（图片↔图片、文本→图片）
- 点击连线可选中，按 Delete 删除

### 画布操作

- 滚轮缩放
- 拖拽画布平移
- 框选多个节点
- Ctrl+Z / Ctrl+Y 撤销重做（启用 `history`）

## 错误处理

| 场景 | 处理方式 |
|------|----------|
| 生图 API 失败 | 面板显示错误信息 + 重试按钮，节点标记 `generateStatus: 'error'` |
| 图片上传过大 | 前端校验文件大小，超限提示 |
| localStorage 容量满 | 保存时 try/catch，提示用户清理 |
| 画布数据损坏 | 加载失败时提示，提供"新建画布"选项 |

## 后续扩展

- **视频节点**：接入视频生成 API（Seedance 2.0 / Kling）
- **大模型提示词生成**：文本节点接入大模型对话 API
- **后端持久化**：画布数据迁移到后端 SQLite 存储
- **画布分享**：导出/导入画布 JSON，支持分享
- **生图历史**：记录每次生图的参数和结果，支持回溯
