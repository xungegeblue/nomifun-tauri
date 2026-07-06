# nomifun-office

> 路径: `crates/backend/nomifun-office/`

## 功能

**Office 文档预览、格式转换、反向代理和快照管理**模块。

- 文档预览：启动 officecli watch 子进程，为 Word/Excel/PPT 建立本地预览
- 反向代理：转发前端请求到本地 officecli HTTP 服务
- 格式转换：Word→Markdown(pandoc)、Excel→JSON(calamine)、PPT→JSON
- 快照管理：保存/列出/读取预览历史，上限 50 条自动裁剪
- Star Office 检测：本地端口扫描发现 Star Office 服务

## 核心类型

| 类型 | 说明 |
|------|------|
| `DocType` | Word / Excel / Ppt |
| `OfficecliWatchManager` | 会话管理器（DashMap<key, WatchSession>） |
| `ConversionService` | 文档转换 |
| `ProxyService` | 反向代理 |
| `SnapshotService` | 快照持久化 |

## 路由

**预览**: POST /api/word-preview/start|stop, /api/excel-preview/start|stop, /api/ppt-preview/start|stop
**历史**: POST /api/preview-history/list|save|get-content
**其他**: POST /api/star-office/detect, /api/document/convert
**代理**: GET /api/ppt-proxy/{port}/*, /api/office-watch-proxy/{port}/*

## 依赖

**Workspace 内**: nomifun-common, nomifun-api-types, nomifun-realtime, nomifun-auth, nomifun-file, nomifun-runtime

## 被依赖

被 1 个 crate 依赖: nomifun-app
