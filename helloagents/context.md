# 项目上下文

## 基本信息

- **项目名称**: Nomifun
- **版本**: 0.2.4
- **架构**: Rust workspace (monorepo)
- **前端**: Tauri (apps/desktop) + Web (apps/web)
- **后端**: Axum HTTP 服务
- **数据库**: SQLite (sqlx + rusqlite)
- **运行时**: Tokio async runtime

## 技术栈

- **语言**: Rust (edition 2024)
- **Web 框架**: Axum 0.8 + Tower
- **数据库**: SQLite (sqlx 0.8, rusqlite 0.32)
- **序列化**: serde + serde_json
- **异步**: tokio + futures
- **CLI**: clap 4
- **浏览器引擎**: chromiumoxide 0.9 (CDP)
- **认证**: JWT (jsonwebtoken), bcrypt, ed25519-dalek
- **加密**: aes-gcm
- **云服务**: AWS Bedrock SDK
- **OAuth**: oauth2 5.0.0-rc.1
- **终端**: portable-pty
- **Office**: calamine, rust_xlsxwriter
- **Nostr**: nostr 0.37

## 目录结构

```
nomifun-tauri/
├── crates/
│   ├── agent/       # Agent 层 (15 个 crate)
│   ├── backend/     # Backend 层 (30 个 crate)
│   └── shared/      # 共享层 (nomifun-net, nomi-redact)
├── apps/
│   ├── desktop/     # Tauri 桌面应用
│   └── web/         # Web 前端
├── packaging/       # 打包配置
├── docs/            # 文档
└── scripts/         # 构建脚本
```

## 模块依赖层级

### Agent 层依赖链

```
nomi-types (基础类型，无内部依赖)
  └── nomi-protocol (通信协议)
  └── nomi-compact (紧凑格式)
  └── nomi-config (配置管理)
  └── nomi-providers (LLM 提供商)
  └── nomi-tools (工具框架)
  └── nomi-mcp (MCP 协议)
  └── nomi-skills (技能系统)
  └── nomi-memory (记忆系统)
  └── nomi-agent (Agent 核心，依赖上述所有)
  └── nomi-computer (计算机控制)
  └── nomi-a11y (无障碍)
  └── nomi-browser-engine (浏览器引擎)
  └── nomi-browser (浏览器控制)
  └── nomi-cli (命令行入口)
```

### Backend 层依赖链

```
nomifun-common (公共工具，无内部依赖)
  └── nomifun-db (数据库)
  └── nomifun-api-types (API 类型)
  └── nomifun-assets (资源)
  └── nomifun-auth (认证)
  └── ... (各业务模块依赖 common/db/api-types)
  └── nomifun-app (应用入口，依赖所有)
  └── nomifun-gateway (网关，聚合路由)
  └── nomifun-orchestrator (编排器)
```
