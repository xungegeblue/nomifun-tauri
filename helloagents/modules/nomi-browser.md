# nomi-browser

> 路径: `crates/agent/nomi-browser/`

## 功能

**浏览器自动化门面层**，包裹进程内自研 CDP 引擎 (nomi-browser-engine)，对外暴露 BrowserTool。

核心能力：
- 浏览器动作调度：navigate / observe / screenshot / click / type / press_key / scroll / extract 等 20+ 种动作
- 安全红线门控 (redline)：yolo/companion 会话中 hard-deny 不可逆动作（支付/删除/发送/提交）
- 凭证拦截 (secret:NAME)：type/set_value 的 text 以 `secret:` 开头时，经 origin-bound vault 解析注入，明文不泄露
- 带外审批 (approval/takeover)：不可逆动作在 yolo 会话下的唯一放行路径
- LLM 结构化提取 (extract)：确定性页面表示通过 LLM 提取为结构化 JSON
- 视觉回退 (visual_fallback)：DOM/aria 锚点失效时的视觉模型定位，含 SoM 覆盖层
- 录制与回放 (recording/replay)：记录浏览器操作步骤，回放时重新经全部安全门
- 站点记忆 (site_memory)：跨会话记忆站点结构，按 eTLD+1 持久化元素描述符

## 核心类型

| 类型 | 说明 |
|------|------|
| `BrowserTool` | 主结构体，持有懒初始化引擎、配置、凭证 vault、审批闸、录制器 |
| `ApprovalTier` | 动作审批等级: Info / Edit / Exec / Irreversible |
| `BrowserApprovalGate` trait | 带外审批闸接口 |
| `TakeoverController` / `TakeoverHandle` | 人类接管控制器和句柄 |
| `ExtractModel` trait | LLM 调用 seam（结构化提取） |
| `RecordedStep` / `Recording` | 录制步骤和录制集合 |
| `SiteMemoryStore` / `SiteMemoryEntry` | 站点记忆存储和条目 |
| `VisualFallback` / `VisualLocator` trait | 视觉回退编排器和视觉模型定位 seam |
| `SomOverlayResult` / `SomLabel` | SoM (Set-of-Marks) 覆盖层类型 |

## 路由

无。纯库（facade），通过 Tool trait 的 execute(Value) 被上层调用。

## 依赖

**Workspace 内**: nomi-browser-engine, nomi-types, nomi-config, nomi-protocol, nomi-tools, nomifun-secret
**外部**: tracing, tokio, serde, serde_json, image, anyhow, thiserror, lru, chrono

## 被依赖

被 4 个 crate 可选依赖: nomi-agent(browser-use), nomifun-ai-agent(browser-use), nomifun-app(可选), nomifun-gateway(browser-use)
