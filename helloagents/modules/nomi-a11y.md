# nomi-a11y

> 路径: `crates/agent/nomi-a11y/`

## 功能

**跨平台无障碍树 (Accessibility Tree) + Set-of-Marks 引擎**，为 computer-use 场景服务。

核心能力：
- 读取 OS 无障碍树（macOS AXUIElement / Windows UIA / Linux AT-SPI2），筛选可交互元素并编号
- Set-of-Marks 覆盖层：在截图上为可交互元素绘制带编号彩色方框标签，供 AI 模型识别定位
- 语义化操作：Press、Click、Focus、SetValue 等动作
- OCR 文字识别融合：无障碍树信息稀薄时（Electron/Canvas/游戏），使用系统 OCR 识别屏幕文字并融合
- Selector 选择器语法：跨快照持久化元素定位（如 `role:Button && name:Save`）

## 核心类型

| 类型 | 说明 |
|------|------|
| `A11yEngine` trait | 核心接口: capabilities() / observe() / invoke() / focus_window() |
| `SnapshotGen(u64)` | 快照单调递增版本号 |
| `ElementId` | 不透明元素句柄（generation + index） |
| `ElementEntry` | 暴露给模型的可交互元素：ref编号、role、name、value、states、bounds、source |
| `Snapshot` | 一次 observe 完整结果：entries + overlay图 + 文本渲染 + 窗口信息 |
| `Target` | 定位元素方式: Ref(u32) / Selector / Pixel{x,y} |
| `ElementAction` | 语义动作: Press / LeftClick / RightClick / DoubleClick / Focus / SetValue |
| `Selector` | 选择器 AST: Role / Name / Text / Nth / And / Or / Not |
| `UiNode` | 后端采集的原始无障碍节点树 |
| `Capabilities` | 会话能力报告: tree_read, screenshot, semantic_action, synthetic_input 等 |

## 路由

无。纯库 crate，通过 `A11yEngine` trait 对上层提供服务。

## 依赖

**外部**: tracing, thiserror, serde, serde_json, image, base64
**平台特定**: macOS(core-foundation/objc2/objc2-vision), Windows(uiautomation/windows), Linux(atspi/zbus/tokio)
**Workspace 内**: nomi-types（ToolImage 类型）

## 被依赖

被 1 个 crate 依赖: nomi-computer
