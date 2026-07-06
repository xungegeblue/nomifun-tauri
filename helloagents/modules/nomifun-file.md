# nomifun-file

> 路径: `crates/backend/nomifun-file/`

## 功能

**文件系统操作核心后端模块**，提供：

- 文件读写（文本/二进制），带沙箱路径校验
- 目录浏览（树状/WebUI 浅层/工作区文件列表）
- 文件管理（复制、删除、重命名、创建临时文件、上传）
- 图片处理（本地 base64、远程下载白名单）
- ZIP 打包（可取消）
- 文件监控（单文件变更 + Office 文件新建，200ms 去抖）
- 工作区快照（基于 git，支持比对、暂存、丢弃、重置）
- 路径安全（路径遍历防护、沙箱根校验、PathAuthority 两级权限模型）

## 核心类型

| 类型 | 说明 |
|------|------|
| `FileService` | 核心文件操作服务 |
| `FileWatchService` | 文件监控服务 |
| `SnapshotService` | 工作区快照服务 |
| `PathAuthority` | 路径权限: Unrestricted / Confined |
| `DirOrFile` | 目录树节点 |
| `FileChangeInfo` / `CompareResult` | 快照变更记录 |
| `ZipEntry` | ZIP 条目（Text 内存 / Disk 磁盘） |

## 路由

前缀 `/api/fs/`：browse, dir, list, metadata, read, read-buffer, write, copy, remove, rename, temp, upload, image-base64, fetch-remote-image, zip, watch/*, office-watch/*, snapshot/*（init/info/compare/baseline/stage/unstage/discard/reset/branches/dispose）

## 依赖

**Workspace 内**: nomifun-api-types, nomifun-common, nomifun-realtime

## 被依赖

被 7 个 crate 依赖: nomifun-app, nomifun-gateway, nomifun-conversation, nomifun-terminal, nomifun-orchestrator, nomifun-office, nomifun-requirement
