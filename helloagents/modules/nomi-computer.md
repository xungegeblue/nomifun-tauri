# nomi-computer

> 路径: `crates/agent/nomi-computer/`

## 功能

**Computer Use 工具 crate**，为 AI Agent 提供本地桌面操控能力。

核心能力：
- 截屏捕获（xcap，缩放后 base64 PNG 传给 LLM）
- 输入合成（enigo 模拟鼠标/键盘/文本输入）
- 无障碍优先交互（a11y-first）：通过 `[ref]` 编号精确定位和操作 UI 元素
- OCR 融合：无障碍树元素稀少时补充 OCR 文字识别目标
- 窗口管理：枚举窗口、聚焦窗口
- 应用/URL/文件启动（Windows 含 Start Menu 解析）
- OS 权限诊断（macOS TCC 权限探测和提示）

支持的 action: observe, click_element, set_element_value, right_click_element, double_click_element, launch, screenshot, cursor_position, list_windows, left_click, right_click, middle_click, double_click, triple_click, mouse_move, left_click_drag, type, key, scroll, focus_window, wait

## 核心类型

| 类型 | 说明 |
|------|------|
| `ComputerTool` | 主入口结构体，实现 Tool trait，持有截屏几何、a11y引擎、快照缓存 |
| `CaptureGeometry` | 截屏几何信息：图像尺寸、逻辑尺寸、显示器原点 |
| `CapturedScreen` | 截屏结果：RGBA 图像 + 几何 + 物理像素尺寸 |
| `SnapshotCache` | 最近一次 observe 快照缓存 |
| `WindowInfo` | 窗口元数据：id、标题、应用名、位置/尺寸、是否聚焦 |
| `ScrollDirection` | 滚动方向枚举: Up/Down/Left/Right |
| `PermissionStatus` | 权限状态快照: accessibility / screen recording |

## 路由

无。纯工具库，通过 Tool trait 的 action 驱动 JSON-RPC 风格接口。

## 依赖

**外部**: xcap, enigo, image, open, windows(Win32), core-foundation(macOS TCC)
**Workspace 内**: nomi-types, nomi-protocol, nomi-config, nomi-tools, nomi-a11y

## 被依赖

被 3 个 crate 可选依赖: nomi-agent(computer-use feature), nomifun-gateway(computer-use feature), nomifun-app(mcp-computer-stdio feature)
