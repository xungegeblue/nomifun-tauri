# nomifun-shell

> 路径: `crates/backend/nomifun-shell/`

## 功能

**OS Shell 集成 + 语音转文字 (STT)** 模块。

- OS Shell 集成：打开文件/文件夹/URL，检测工具安装状态
- STT：OpenAI Whisper 和 Deepgram 两个 provider，multipart 音频上传

## 核心类型

| 类型 | 说明 |
|------|------|
| `ShellService` | Shell 操作服务 |
| `ISystemOpener` trait | 系统打开操作抽象 |
| `SttService` | STT 服务（OpenAI/Deepgram） |

## 路由

POST /api/shell/open-file, /api/shell/show-item-in-folder, /api/shell/open-external, /api/shell/check-tool-installed, /api/shell/open-folder-with, /api/stt

## 依赖

**Workspace 内**: nomifun-common, nomifun-api-types, nomifun-net, nomifun-system, nomifun-runtime

## 被依赖

被 2 个 crate 依赖: nomifun-app, nomifun-gateway
