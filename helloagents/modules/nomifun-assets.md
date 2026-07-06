# nomifun-assets

> 路径: `crates/backend/nomifun-assets/`

## 功能

**后端静态 Logo 资产服务**。通过 rust-embed 编译期嵌入 assets/logos/ 目录，运行时通过 HTTP 提供。

支持 ETag 条件请求、强缓存头（1年 immutable）、路径遍历防护。

## 核心类型

| 类型 | 说明 |
|------|------|
| `AssetFile` | 解析后资产: bytes + content_type + etag |
| `AssetService` | 无状态服务: get_logo() / etag_matches() |

## 路由

GET /api/assets/logos/{*asset_path} — 获取嵌入的 Logo 文件

## 依赖

**Workspace 内**: nomifun-common

## 被依赖

被 1 个 crate 依赖: nomifun-app
