# nomi-browser-engine

> 路径: `crates/agent/nomi-browser-engine/`

## 功能

**进程内自研 Rust CDP 浏览器引擎**，仅支持 Chromium，不打包 Playwright/Node。

核心能力：
- Chrome 生命周期管理：解析/下载 Chrome for Testing (CfT) 或系统 Chrome/Edge，托管启动（随机端口 + 专属 user-data-dir + headless 自动降级）
- CDP 传输层：自建 WebSocket/pipe 连接，单条连接 + sessionId 多路复用，直接发裸 CDP 命令
- 页面操作 (observe + act)：基于注入的 Playwright InjectedScript（isolated world），实现 ARIA 快照、点击/输入/滚动/选择等全套浏览器动作，带 actionability 检查
- 出口防火墙：IP 封禁（SSRF 防护）、域名 allowlist/denylist（eTLD+1 PSL 归一）、跨域 POST-body 门控 + 审批通道接缝、DNS→IP SSRF 守卫
- 持久登录：cookie + localStorage 捕获/恢复，AES-256-GCM 加密落盘 vault，跨会话/重启持久登录
- evaluate 门控：默认 OFF，opt-in 全权模式，与持久登录互斥，强审计脱敏
- 安全特性：注入侧名称随机化（反检测）、序列化层脱敏、已知 secret 精确黑脱、下载/上传沙箱

## 核心类型

| 类型 | 说明 |
|------|------|
| `BrowserEngine` trait | 引擎主 trait: navigate / screenshot / observe / act / debug_snapshot / capture_storage_state 等 |
| `EngineConfig` | 引擎创建配置（data_dir / chrome_source / firewall / storage_state / egress_approver 等） |
| `ActSpec` | 动作枚举（30+ 变体: Click / Type / SetValue / Hover / PressKey / Scroll / Evaluate / UploadFile / Download / Tabs / SwitchFrame 等） |
| `ActResult` / `Effect` | 动作产物（message + effect{changed} + success） |
| `Observation` / `ElementEntry` | observe 产物（aria YAML + ref 表 + boxes） |
| `FirewallConfig` / `FirewallDecision` / `EgressApprover` trait | 出口防火墙全栈 |
| `StorageState` / `OriginStorage` | 登录态序列化（cookie + localStorage + IndexedDB） |
| `ChromeSource` | 浏览器来源: Managed(CfT) / System(Chrome/Edge) |
| `BrowserError` | 错误枚举: Unsupported / SessionLost / Blocked / NavFailed / Timeout / TargetCrashed 等 |

## 路由

无。纯引擎库，不启动 HTTP 服务器。通过 CDP 协议与 Chromium 通信。

## 依赖

**外部**: chromiumoxide, tokio, serde, serde_json, image, reqwest, tracing, thiserror, anyhow
**Workspace 内**: nomifun-net(下载CfT), nomifun-runtime(进程托管), nomifun-common(AES-GCM加密), nomifun-secret(PSL/eTLD+1), nomi-redact(脱敏)

## 被依赖

被 3 个 crate 依赖: nomi-browser(直接), nomifun-ai-agent(可选browser-use), nomifun-app(可选)
