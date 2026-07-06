# nomifun-extension — 扩展系统注册中心

## 1. 定位

nomifun-extension 是 NomiFun 的**扩展系统基础设施**，管"扩展包从生到死"的全流程：

安装 → 校验 → 权限审批 → 贡献挂载 → 启用/禁用 → 热重载 → 卸载

它是"中间人"——只依赖底层基础设施（common/api-types/db/realtime/runtime），被几乎所有业务模块依赖。其他模块通过它来"知道有什么能力可用"和"管理这些能力的开关"。

## 2. 与 Gateway / MCP 的三层架构

| 层 | 管什么 | 不管什么 |
|---|---|---|
| **Extension（治理层）** | 安装、权限、版本、卸载、热重载、生命周期 hooks | 运行时路由、协议暴露 |
| **Gateway（路由层）** | 运行时请求派发到对应服务 | 怎么装、能不能装、版本冲突 |
| **MCP（协议层）** | 给 agent 暴露可调用的工具列表 | 安装来源、权限审批、禁用管理 |

完整链路：

```
用户从 Hub 安装扩展
  → HubInstaller 下载解压
  → parse_manifest 解析 nomi-extension.json
  → 校验权限（RiskLevel → 用户确认）
  → Registry 初始化管线：加载→过滤→排序→贡献解析→持久化
  → MCP server 注册到 MCP subsystem，assistant 注册到 assistant subsystem
  → onInstall hook 执行
  → 广播事件通知 Gateway 更新路由表
  → 现在 agent 才能通过 MCP 发现新工具，Gateway 才能路由到新服务
```

## 3. 依赖拓扑

### 上游（Extension 依赖的）— 5 个纯基础设施

| 依赖 | 层级 | 说明 |
|---|---|---|
| nomifun-common | 最底层（0 内部依赖） | 通用错误/工具 |
| nomifun-api-types | 底层（仅依赖 common） | DTO 定义 |
| nomifun-db | 底层（仅依赖 common） | 数据库持久化 |
| nomifun-realtime | 底层（仅依赖 api-types） | 事件广播 |
| nomifun-runtime | 最底层（0 内部依赖） | 运行时路径 |

### 下游（依赖 Extension 的）— 7 个业务模块

| 模块 | 怎么用 Extension |
|---|---|
| nomifun-gateway | Registry + HubInstaller + SkillPaths；管理扩展启用/禁用、MCP 注册 |
| nomifun-ai-agent | SkillPaths → AcpSkillManager；首次消息注入技能索引 |
| nomifun-assistant | AssistantClassifier + AssistantRuleDispatcher（最轻量，4 个依赖） |
| nomifun-channel | Registry + ResolvedChannelPlugin |
| nomifun-conversation | SkillPaths → 技能解析/物化/workspace link |
| nomifun-companion | SkillPaths + skill_service（技能创建/更新） |
| nomifun-app | 启动入口：物化内置技能、构建 Registry、挂载 HTTP 路由 |

### 不依赖 Extension 的业务模块

knowledge、idmm、terminal、mcp、cron、team、requirement、webhook、auth、system、file、shell、office、public、assets、db — 这些模块"自己就能干活"，不需要问"有什么能力可用"。

## 4. Manifest 解析与校验

- 读取 `nomi-extension.json`，归一化字段名（驼峰/蛇形都兼容）
- 支持 `$file:` 引用：manifest 可指向外部文件内容，解析时自动展开替换
  - 路径遍历防护（不允许 `../` 跳出扩展根目录）
  - 循环引用检测（`$file:` 不能套娃引用）
- 校验 name（不能有保留前缀如 `nomifun-`）和 version（必须合法 semver）

## 5. 10 种贡献类型

| 类型 | 干啥 | 为什么需要挂载 |
|---|---|---|
| **MCP Server** | 给 agent 暴露可调用工具（搜索、读文件等） | Gateway 才能启动它，agent 才能发现并调用工具 |
| **ACP Adapter** | 对接外部 AI agent 服务的"翻译器" | ai-agent 才知道有此适配器可用，需要时启动对接外部 agent |
| **Assistant** | 有预定义人格 prompt + 绑定技能 + 指定模型 的对话角色 | 前端才能显示助手列表，用户才能选择创建对话 |
| **Agent** | 自主运行的代理（定时巡检、自动回复等） | 系统才知道有此代理可用，才能在自主执行场景下调度 |
| **Skill** | SKILL.md 定义的能力描述 + 脚本/模板 | agent 首次消息注入技能索引后才知道"会做什么" |
| **Theme** | CSS 样式覆盖默认外观 | 前端才能查到可选主题，用户切换后 CSS 生效 |
| **Channel Plugin** | 对接外部消息平台（Telegram、微信等） | channel 模块才能显示可用通道，用户配置后激活收发消息 |
| **WebUI** | 在前端注入自定义页面/路由 | 前端才能把扩展的 HTML/JS 页面嵌入主界面 |
| **Settings Tab** | 在系统设置里加入扩展的配置页 | 设置页面才知道要渲染新页签，用户才有配置入口 |
| **Model Provider** | 声明提供哪些 LLM 模型 | agent 选模型时能选到，idmm failover 时能切换到 |

挂载的本质 = 注册到全局服务发现表。不挂载 = 其他模块找不到 = 存在但没人知道 = 等于不存在。

每个 Resolved 类型比原始类型多一个 `extension_name` 字段，用于溯源——消费者知道此能力来自哪个扩展包，enable/disable 时精确移除。

## 6. 权限模型

```rust
ExtPermissions {
    storage: Option<bool>,       // 本地存储
    network: Option<NetworkPermission>,  // 网络（Unrestricted 或 Scoped 域名白名单）
    shell: Option<bool>,         // Shell 命令执行
    filesystem: Option<FilesystemScope>, // 文件系统（ExtensionOnly / Workspace / Full）
    clipboard: Option<bool>,     // 剪贴板
    active_user: Option<bool>,   // 获取当前用户信息
    events: Option<bool>,        // 监听系统事件
}
```

风险分级：
- **Safe**：无权限声明或仅 storage
- **Moderate**：需要 network(scoped) / filesystem(workspace) / clipboard
- **Dangerous**：需要 network(unrestricted) / shell / filesystem(full) / active_user

安装/激活时根据权限声明决定是否需要用户确认。

## 7. 注册中心（Registry）

- `ExtensionRegistry`：核心数据结构 `Arc<RwLock<RegistryInner>>`，全局唯一
- **初始化管线**（5 步）：加载所有 manifest → 过滤不合法 → 按依赖排序 → 合并状态 → 解析贡献 → 持久化
- 支持 enable/disable，广播事件通知其他模块
- 查询接口：按贡献类型查找、按名称查找、列出所有

## 8. 技能系统

三类技能来源：
- **内置技能**：`include_dir!` 编译时把 `builtin-skills/` 目录嵌入二进制，启动时物化到磁盘
- **用户技能**：从用户目录扫描
- **assistant 技能**：特定助手绑定的技能

`SkillPaths` 统一管理路径解析，还支持 cron 技能（定时任务型）。

## 9. Hub 安装器

`HubInstaller`：从扩展 Hub（类似 marketplace）安装/更新/卸载扩展。

流程：下载 → 解压 → 验证 manifest → 触发 hot_reload。更新时先备份旧版，失败可回滚。

## 10. 文件监听热重载

`ExtensionWatcher`：用 `notify` crate 监控扩展目录变化 → debounce 1000ms（防止批量写入频繁触发）→ 变化后调用 `hot_reload` 重新加载该扩展。

## 11. 生命周期 Hooks

扩展可声明 `lifecycle`：
- `onInstall` / `onUninstall`：安装/卸载时执行
- `onActivate` / `onDeactivate`：启用/禁用时执行

Registry 在对应时机调用这些 hook（目前主要是 shell 命令执行）。

## 12. 分类器

- `AssistantClassifier` trait：判断一个 assistant 来源属于哪个扩展
- `AssistantRuleDispatcher` trait：把规则/技能的读写路由到正确的来源（内置 vs 扩展 vs 用户）

## 13. Windows 特殊处理

用 `junction` crate 做 NTFS junction 代替 symlink——因为 Windows 创建 symlink 需要 `SeCreateSymbolicLinkPrivilege`，普通用户没有，junction 不需要这个权限。

## 14. 总结

Extension 是 NomiFun 的"服务发现 + 生命周期管理注册中心"：
- 没有它，Gateway 不知道有哪些 MCP server 可以路由
- 没有它，agent 不知道有哪些技能可以注入
- 没有它，assistant 不知道有哪些扩展助手可以调度
- 没有它，channel 不知道有哪些通道插件可以对接

它站在基础设施层之上、业务层之下，是项目依赖拓扑中**最关键的中间层**——位置干净（无反向依赖），职责明确（声明→解析→挂载→治理），轻量可消费（assistant 只需 4 个依赖就能用它）。
