# Gateway + MCP 架构详解

> 本文档解释 `caps_*.rs` 如何注册工具、`nomifun-public` 如何通过 MCP 协议把这些工具暴露给外部 AI Agent。

---

## 一句话概括

> `caps_*.rs` 注册工具到 `Registry`，`nomifun-public` 的 `RemoteMcpHandler` 实现 MCP 协议（`list_tools` + `call_tool`），让 AI Agent 能发现并调用这些工具。

---

## 核心概念

### 1. `caps_*.rs` — 工具适配器

所有 `caps_*.rs` 都是**工具适配器**，统一把各业务模块的能力包装成 `Capability` 格式，注册到 `Registry`。

| 文件 | 功能 |
|---|---|
| `caps_files.rs` | 文件操作工具（读/写/删/重命名/浏览目录） |
| `caps_agent.rs` | Agent 操作工具 |
| `caps_conversation.rs` | 对话操作工具 |
| `caps_memory.rs` | 记忆操作工具 |
| `caps_browser.rs` | 浏览器操作工具 |
| `caps_computer.rs` | 电脑控制工具 |
| `caps_knowledge.rs` | 知识库操作工具 |
| ... | ... |

**共同模式**：
1. 定义参数结构体（`Deserialize + JsonSchema`）
2. 写 Handler 函数（调真正 service）
3. `register()` 把 `Capability` 推进 `Registry`

---

### 所有注册工具完整清单（~154 个，按域分组）

#### files 域（8 个）

| 工具名 | 功能 | 危险等级 |
|---|---|---|
| `nomi_fs_read_file` | 读文件（UTF-8，上限 64KB） | Read |
| `nomi_fs_write_file` | 写文件（创建或覆盖） | Write |
| `nomi_fs_browse` | 列出目录下一层 | Read |
| `nomi_fs_list_workspace_files` | 递归列出工作区所有文件 | Read |
| `nomi_fs_get_metadata` | 获取文件元数据 | Read |
| `nomi_fs_remove` | 删除文件/目录（递归） | Destructive |
| `nomi_fs_rename` | 重命名文件/目录 | Write |
| `nomi_shell_open_external` | 用浏览器打开 URL | Write |

#### agent 域（16 个）

| 工具名 | 功能 | 危险等级 |
|---|---|---|
| `nomi_agent_list` | 列出所有 Agent | Read |
| `nomi_agent_health_check` | Agent 健康检查 | Read |
| `nomi_agent_provider_health_check` | Provider 健康检查 | Read |
| `nomi_agent_set_enabled` | 启用/禁用 Agent | Write |
| `nomi_agent_custom_create` | 创建自定义 Agent | Write |
| `nomi_agent_custom_update` | 更新自定义 Agent | Write |
| `nomi_agent_custom_delete` | 删除自定义 Agent | Destructive |
| `nomi_agent_custom_try_connect` | 测试自定义 Agent 连接 | Read |
| `nomi_remote_agent_list` | 列出远程 Agent | Read |
| `nomi_remote_agent_get` | 获取远程 Agent 详情 | Read |
| `nomi_remote_agent_create` | 创建远程 Agent | Write |
| `nomi_remote_agent_update` | 更新远程 Agent | Write |
| `nomi_remote_agent_delete` | 删除远程 Agent | Destructive |
| `nomi_remote_agent_test` | 测试远程 Agent | Read |
| `nomi_model_failover_get` | 获取模型故障转移配置 | Read |
| `nomi_model_failover_set` | 设置模型故障转移配置 | Write |

#### conversation 域（8 个）

| 工具名 | 功能 | 危险等级 |
|---|---|---|
| `nomi_list_conversations` | 列出所有对话 | Read |
| `nomi_conversation_status` | 获取对话状态 | Read |
| `nomi_send_to_conversation` | 发送消息到对话 | Write |
| `nomi_create_conversation` | 创建新对话 | Write |
| `nomi_update_conversation` | 更新对话 | Write |
| `nomi_delete_conversation` | 删除对话 | Destructive |
| `nomi_agent_run` | 运行 Agent | Write |
| `nomi_agent_result` | 获取 Agent 执行结果 | Read |

#### browser 域（4 个）

| 工具名 | 功能 | 危险等级 |
|---|---|---|
| `nomi_browser_navigate` | 加载 URL（可选新标签页） | Write |
| `nomi_browser_observe` | 读取页面无障碍树（只读） | Read |
| `nomi_browser_act` | 执行浏览器操作（点击/输入/截图等） | Write |
| `nomi_browser_confirm` | 解决待处理的浏览器操作审批 | Write |

#### computer 域（15 个）

| 工具名 | 功能 | 危险等级 |
|---|---|---|
| `nomi_computer_snapshot` | 获取屏幕快照 | Read |
| `nomi_computer_screenshot` | 截屏 | Read |
| `nomi_computer_click` | 鼠标点击 | Write |
| `nomi_computer_right_click` | 鼠标右键点击 | Write |
| `nomi_computer_double_click` | 鼠标双击 | Write |
| `nomi_computer_set_value` | 设置输入框值 | Write |
| `nomi_computer_click_xy` | 按坐标点击 | Write |
| `nomi_computer_type` | 键盘输入 | Write |
| `nomi_computer_key` | 按单个键 | Write |
| `nomi_computer_scroll` | 滚动 | Write |
| `nomi_computer_launch` | 启动应用 | Write |
| `nomi_computer_list_windows` | 列出窗口 | Read |
| `nomi_computer_cursor_position` | 获取光标位置 | Read |
| `nomi_computer_wait` | 等待 | Read |

#### knowledge 域（20 个）

| 工具名 | 功能 | 危险等级 |
|---|---|---|
| `nomi_knowledge_list_bases` | 列出知识库 | Read |
| `nomi_knowledge_create_base` | 创建知识库 | Write |
| `nomi_knowledge_write_file` | 写入知识库文件 | Write |
| `nomi_knowledge_autogen` | 自动生成知识库概述 | Write |
| `nomi_knowledge_fetch_url` | 服务端抓取 URL 内容 | Read |
| `nomi_knowledge_get_binding` | 获取知识绑定 | Read |
| `nomi_knowledge_set_binding` | 设置知识绑定 | Write |
| `nomi_knowledge_get_base` | 获取知识库详情 | Read |
| `nomi_knowledge_update_base` | 更新知识库 | Write |
| `nomi_knowledge_delete_base` | 删除知识库 | Destructive |
| `nomi_knowledge_list_files` | 列出知识库文件 | Read |
| `nomi_knowledge_read_file` | 读取知识库文件 | Read |
| `nomi_knowledge_delete_file` | 删除知识库文件 | Destructive |
| `nomi_knowledge_list_inbox` | 列出收件箱 | Read |
| `nomi_knowledge_merge_inbox` | 合并收件箱 | Write |
| `nomi_knowledge_discard_inbox` | 丢弃收件箱 | Write |
| `nomi_knowledge_search` | 搜索知识库 | Read |
| `nomi_knowledge_list_tags` | 列出标签 | Read |
| `nomi_knowledge_create_tag` | 创建标签 | Write |
| `nomi_knowledge_delete_tag` | 删除标签 | Destructive |

#### memory 域（4 个）

| 工具名 | 功能 | 危险等级 |
|---|---|---|
| `nomi_memory_list` | 列出记忆 | Read |
| `nomi_memory_save` | 保存记忆 | Write |
| `nomi_memory_update` | 更新记忆 | Write |
| `nomi_memory_delete` | 删除记忆 | Destructive |

#### system 域（10 个）

| 工具名 | 功能 | 危险等级 |
|---|---|---|
| `nomi_system_get_settings` | 获取系统设置 | Read |
| `nomi_system_update_settings` | 更新系统设置 | Write |
| `nomi_system_get_preferences` | 获取用户偏好 | Read |
| `nomi_system_update_preferences` | 更新用户偏好 | Write |
| `nomi_system_create_provider` | 创建 Provider | Write |
| `nomi_system_update_provider` | 更新 Provider | Write |
| `nomi_system_delete_provider` | 删除 Provider | Destructive |
| `nomi_system_fetch_models` | 获取可用模型列表 | Read |
| `nomi_system_get_info` | 获取系统信息 | Read |
| `nomi_list_providers` | 列出所有 Provider | Read |

#### terminal 域（9 个）

| 工具名 | 功能 | 危险等级 |
|---|---|---|
| `nomi_create_terminal` | 创建终端 | Write |
| `nomi_list_terminals` | 列出所有终端 | Read |
| `nomi_terminal_get` | 获取终端详情 | Read |
| `nomi_terminal_write_input` | 向终端写入输入 | Write |
| `nomi_terminal_kill` | 杀死终端进程 | Destructive |
| `nomi_terminal_delete` | 删除终端 | Destructive |
| `nomi_terminal_resize` | 调整终端大小 | Write |
| `nomi_terminal_relaunch` | 重新启动终端 | Write |
| `nomi_terminal_update` | 更新终端配置 | Write |

#### mcp/extensions 域（13 个）

| 工具名 | 功能 | 危险等级 |
|---|---|---|
| `nomi_mcp_list_servers` | 列出 MCP 服务器 | Read |
| `nomi_mcp_add_server` | 添加 MCP 服务器 | Write |
| `nomi_mcp_edit_server` | 编辑 MCP 服务器 | Write |
| `nomi_mcp_delete_server` | 删除 MCP 服务器 | Destructive |
| `nomi_mcp_toggle_server` | 启用/禁用 MCP 服务器 | Write |
| `nomi_extension_list` | 列出扩展 | Read |
| `nomi_extension_enable` | 启用扩展 | Write |
| `nomi_extension_disable` | 禁用扩展 | Write |
| `nomi_skill_list` | 列出技能 | Read |
| `nomi_skill_import` | 导入技能 | Write |
| `nomi_skill_delete` | 删除技能 | Destructive |
| `nomi_hub_list_extensions` | 列出市场扩展 | Read |
| `nomi_hub_install_extension` | 安装市场扩展 | Write |

#### companion 域（10 个）

| 工具名 | 功能 | 危险等级 |
|---|---|---|
| `nomi_companion_list` | 列出 Companion | Read |
| `nomi_companion_get` | 获取 Companion 详情 | Read |
| `nomi_companion_create` | 创建 Companion | Write |
| `nomi_companion_update` | 更新 Companion | Write |
| `nomi_companion_delete` | 删除 Companion | Destructive |
| `nomi_companion_status` | 获取 Companion 状态 | Read |
| `nomi_companion_get_config` | 获取 Companion 配置 | Read |
| `nomi_companion_update_config` | 更新 Companion 配置 | Write |
| `nomi_companion_list_suggestions` | 列出建议 | Read |
| `nomi_companion_decide_suggestion` | 处理建议 | Write |

#### channel 域（11 个）

| 工具名 | 功能 | 危险等级 |
|---|---|---|
| `nomi_channel_list_plugins` | 列出频道插件 | Read |
| `nomi_channel_enable_plugin` | 启用插件 | Write |
| `nomi_channel_disable_plugin` | 禁用插件 | Write |
| `nomi_channel_delete_plugin` | 删除插件 | Destructive |
| `nomi_channel_test_plugin` | 测试插件 | Read |
| `nomi_channel_list_pairings` | 列出配对 | Read |
| `nomi_channel_approve_pairing` | 批准配对 | Write |
| `nomi_channel_reject_pairing` | 拒绝配对 | Write |
| `nomi_channel_list_users` | 列出用户 | Read |
| `nomi_channel_revoke_user` | 撤销用户 | Destructive |
| `nomi_channel_set_companion` | 设置 Companion | Write |

#### requirement 域（4 个）

| 工具名 | 功能 | 危险等级 |
|---|---|---|
| `nomi_requirement_list` | 列出需求 | Read |
| `nomi_requirement_create` | 创建需求 | Write |
| `nomi_requirement_update` | 更新需求 | Write |
| `nomi_requirement_delete` | 删除需求 | Destructive |

#### autowork 域（2 个）

| 工具名 | 功能 | 危险等级 |
|---|---|---|
| `nomi_set_autowork` | 设置自动工作 | Write |
| `nomi_get_autowork` | 获取自动工作配置 | Read |

#### cron 域（4 个）

| 工具名 | 功能 | 危险等级 |
|---|---|---|
| `nomi_cron_list` | 列出定时任务 | Read |
| `nomi_cron_create` | 创建定时任务 | Write |
| `nomi_cron_update` | 更新定时任务 | Write |
| `nomi_cron_delete` | 删除定时任务 | Destructive |

#### scheduling_ext 域（12 个）

| 工具名 | 功能 | 危险等级 |
|---|---|---|
| `nomi_cron_get_job` | 获取定时任务详情 | Read |
| `nomi_cron_run_now` | 立即运行定时任务 | Write |
| `nomi_requirement_get` | 获取需求详情 | Read |
| `nomi_requirement_list_tags` | 列出需求标签 | Read |
| `nomi_requirement_get_board` | 获取需求看板 | Read |
| `nomi_requirement_resume_tag` | 恢复标签 | Write |
| `nomi_idmm_get_log` | 获取 IDMM 日志 | Read |
| `nomi_idmm_get_activity` | 获取 IDMM 活动 | Read |
| `nomi_idmm_intervene` | IDMM 干预 | Write |
| `nomi_idmm_get_settings` | 获取 IDMM 设置 | Read |
| `nomi_idmm_set_settings` | 设置 IDMM 配置 | Write |
| `nomi_idmm_clear_log` | 清除 IDMM 日志 | Destructive |

#### idmm 域（2 个）

| 工具名 | 功能 | 危险等级 |
|---|---|---|
| `nomi_set_idmm` | 设置 IDMM | Write |
| `nomi_get_idmm` | 获取 IDMM | Read |

#### confirmation 域（2 个）

| 工具名 | 功能 | 危险等级 |
|---|---|---|
| `nomi_list_confirmations` | 列出待确认操作 | Read |
| `nomi_resolve_confirmation` | 解决确认操作 | Write |

### 2. `Registry` — 全局能力表

`Registry` 是全局单例，进程启动时构建一次，存放所有 AI 可调用的工具（~150 个）。

```rust
Registry（全局单例）
  │
  ├── by_name: BTreeMap<&str, Capability>
  │     ├── "nomi_fs_read_file"     → Capability{handler, meta, schema}
  │     ├── "nomi_agent_run"        → Capability{...}
  │     ├── "nomi_conversation_send" → Capability{...}
  │     └── ... (~150 个)
  │
  ├── tool_specs(surface)  → 列出某个 surface 可见的工具
  └── dispatch_opt(...)    → 根据工具名找到 handler 执行
```

---

### 3. `nomifun-public` — MCP 协议暴露层

`nomifun-public` 的 `RemoteMcpHandler` 实现 `rmcp::ServerHandler` trait，把 `Registry` 转成 MCP 协议。

**MCP 协议两个核心方法**：
- `list_tools()` — AI 连上来第一件事，返回可用工具列表
- `call_tool()` — AI 要执行某个工具，调用这个方法

---

## 完整链路

```
┌─────────────────────────────────────────────────────────┐
│ Step 1: 工具注册（启动时）                             │
│                                                         │
│  caps_files.rs                                          │
│  caps_agent.rs                                          │
│  caps_conversation.rs                                   │
│  ...                                                    │
│     │                                                   │
│     │  register(&mut caps)                             │
│     ▼                                                   │
│  Registry（全局能力表）                                  │
│  ├── nomi_fs_read_file    → Capability{handler, ...}  │
│  ├── nomi_agent_run      → Capability{...}             │
│  └── ...  (~150 个)                                    │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Step 2: MCP 暴露（运行时）                              │
│                                                         │
│  AI Agent (Claude Code / Cursor)                        │
│     │                                                   │
│     │  HTTP POST /mcp                                   │
│     ▼                                                   │
│  RemoteMcpHandler（nomifun-public）                    │
│     │                                                   │
│     ├── list_tools()  → Registry::tool_specs()         │
│     │    返回 MCP 格式的 Tool 列表                       │
│     │                                                   │
│     └── call_tool()    → Registry::dispatch_opt()       │
│          执行工具，返回 MCP 格式的 Result                 │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Step 3: 工具执行                                       │
│                                                         │
│  Registry::dispatch_opt(name, args)                      │
│     │                                                   │
│     │  找到对应的 Capability                            │
│     │  检查权限（Surface + DangerTier）                │
│     ▼                                                   │
│  cap.handler(deps, ctx, args)                          │
│     │                                                   │
│     │  调 caps_*.rs 里的 Handler 函数                  │
│     ▼                                                   │
│  deps.xxx_service.xxx()  → 真正业务逻辑               │
└─────────────────────────────────────────────────────────┘
```

---

## 关键代码：MCP 协议体现

### `list_tools()` — 工具发现

```rust
// handler.rs — 实现 rmcp 的 ServerHandler trait
impl ServerHandler for RemoteMcpHandler {
    
    // AI 连上来第一件事：调 tools/list
    async fn list_tools(&self, ...) -> Result<ListToolsResult, ...> {
        // 从 Registry 读工具列表（过滤掉 Remote surface 不可见的）
        let specs = Registry::global().tool_specs(Surface::Remote);
        
        // 转成 MCP 的 Tool 格式
        let tools: Vec<Tool> = specs
            .into_iter()
            .map(|spec| Tool::new(spec.name, spec.description, spec.input_schema))
            .collect();
        
        Ok(ListToolsResult { tools, ... })
    }
}
```

### `call_tool()` — 工具执行

```rust
impl ServerHandler for RemoteMcpHandler {
    
    // AI 要执行某个工具：调 tools/call
    async fn call_tool(&self, request: CallToolRequestParams, ...) -> ... {
        // 从 Registry 分发执行
        let result = Registry::global()
            .dispatch_opt(self.deps.clone(), caller, &request.name, &args)
            .await;
        
        // 转成 MCP 的 CallToolResult 格式
        Ok(build_tool_result(result))
    }
}
```

---

## Surface 与权限控制

不同调用来源（Surface）看到的能力不同：

| Surface | 说明 | 信任度 |
|---|---|---|
| `Desktop` | 本地桌面会话 | 最高 |
| `Channel` | 外部 IM（企微/飞书等） | 中等 |
| `Remote` | 远程 LAN/Web（MCP 调用） | 最低 |

**权限矩阵**（自动决定能不能执行）：

| Surface | Read | Write | Destructive | Sensitive |
|---------|------|-------|-------------|-----------|
| Desktop | ✅ | ✅ | ⚠️需确认 | ⚠️需确认 |
| Channel | ✅ | ✅ | ❌拒绝 | ❌拒绝 |
| Remote | ✅ | ✅ | ⚠️需确认 | ❌拒绝 |

---

## 域过滤（Domain Scope）

可以限制外部 Agent 只能看到某些能力：

```
GET /v1/tools?profile=agent
# 只返回 agent, conversation, browser, computer, knowledge, files, memory 这些域

GET /v1/tools?domains=agent,files
# 自定义域列表
```

MCP 侧同理，连接在 `/mcp?profile=agent` 时只看到 agent profile 的工具。

---

## 一句话总结

> `caps_*.rs` 注册工具到 `Registry`，`nomifun-public` 的 `RemoteMcpHandler` 实现 MCP 协议（`list_tools` + `call_tool`），让 AI Agent 能发现并调用这些工具。
