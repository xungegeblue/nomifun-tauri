# NomiFun

NomiFun is a local-first AI workstation with one React frontend, one Rust
backend, and two host modes:

- `nomifun-desktop`: the Tauri desktop app. It embeds the backend in the same
  process, binds a private loopback port, and injects the local trust secret into
  the webview before the SPA starts.
- `nomifun-web`: the self-hosted web server. It boots the same backend in the
  same process and serves the built SPA, HTTP API, and WebSocket endpoint from
  one port.

There is no Electron shell, no Node web host, and no prebuilt backend handoff in
the current architecture. The product name is **NomiFun**; lowercase `nomifun`
is used only for code identifiers, crate names, environment variables, and
repository paths.

## Repository Map

```text
apps/
  desktop/      Tauri 2 shell and desktop-only commands
  web/          standalone web host for API + SPA
crates/
  agent/        15 nomi-* crates: engine, providers, tools, MCP, skills, memory,
                browser/computer use, and the standalone nomi CLI
  backend/      29 nomifun-* crates: app composition, auth, database, sessions,
                MCP, knowledge, requirements, terminal, companion, gateway, etc.
  shared/       2 cross-layer crates: nomifun-net and nomi-redact
ui/
  React 19 + Vite SPA shared by desktop and web
docs/
  current technical docs, user/operator guides, architecture notes, and
  historical specs/audits
packaging/
  Linux deployment support for the web host
```

The Cargo workspace membership is defined in [Cargo.toml](Cargo.toml). The
script catalog is defined in [package.json](package.json) and rendered below.

## Architecture

The important composition points are:

- [apps/desktop/src/main.rs](apps/desktop/src/main.rs): desktop process, tray,
  deep-link, updater, keep-awake, WebUI LAN listener, companion windows, and the
  embedded loopback backend.
- [apps/web/src/main.rs](apps/web/src/main.rs): standalone web host with
  authenticated-by-default browser access.
- [crates/backend/nomifun-app/src/services.rs](crates/backend/nomifun-app/src/services.rs):
  process-wide service graph and singleton state.
- [crates/backend/nomifun-app/src/router/state.rs](crates/backend/nomifun-app/src/router/state.rs):
  module router-state construction and late wiring.
- [crates/backend/nomifun-app/src/router/routes.rs](crates/backend/nomifun-app/src/router/routes.rs):
  global route tree, auth/trust/CSRF middleware, public MCP/REST front doors,
  and `/ws`.
- [ui/src/renderer/components/layout/Router.tsx](ui/src/renderer/components/layout/Router.tsx):
  frontend route map and legacy redirects.

Start with [docs/architecture/overview.md](docs/architecture/overview.md) for
the system map.

## Development

Install dependencies once:

```bash
bun install
```

Common commands:

```bash
bun run dev       # desktop app development
bun run dev:web   # web host + Vite development
bun run build:ui  # build the SPA
bun run check     # frontend typecheck + i18n + theme + script registry checks
bun run test      # Rust tests
```

For source-level work, prefer the scripted entry points. They include build-dir
pruning and consistency checks that plain `cargo`/`vite` commands do not run.

<!-- BEGIN GENERATED SCRIPTS (bun run help --readme) -->

| 脚本 | 说明 |
| --- | --- |
| **开发（热重载）** | |
| `bun run dev` | 启动桌面应用开发（tauri dev，热重载） |
| `bun run dev:web` | 启动 Web 全栈开发（后端 API + 前端 vite） |
| `bun run dev:ui` | 仅启动前端开发服务器（纯 vite，无后端） |
| **构建（出制品）** | |
| `bun run build` | 为当前操作系统打桌面安装包 |
| `bun run build:signed` | 打桌面包并签名+公证（仅 macOS） |
| `bun run build:updater` | 打桌面包并产出自更新 .sig 制品 |
| `bun run build:ui` | 前端生产构建 → ui/dist |
| **运行（组装好的应用）** | |
| `bun run serve:web` | 启动 Web 服务器，托管已构建的前端 |
| **测试** | |
| `bun run test` | 运行全部 Rust 测试（含 doctest） |
| `bun run test:fast` | 用 nextest 快速跑 Rust 测试（日常） |
| **静态检查 / 门禁** | |
| `bun run check` | 聚合静态门禁：typecheck + i18n + 主题契约 + 脚本登记 |
| `bun run typecheck` | 前端 TypeScript 类型检查（tsc --noEmit） |
| `bun run check:i18n` | 校验 i18n 类型与 locale 键是否一致 |
| `bun run check:theme` | 校验预设 CSS 主题契约 |
| **格式化** | |
| `bun run fmt` | 格式化 Rust 代码（cargo fmt） |
| `bun run fmt:check` | 校验 Rust 代码格式（cargo fmt --check） |
| **代码生成** | |
| `bun run gen:i18n` | 由 locale 重新生成 i18n 类型声明 |
| **维护 / 工具** | |
| `bun run clean` | 深度回收构建空间（debug 产物 + flycheck + 旧安装包） |
| `bun run seed:dev` | 用生产数据目录播种 dev 数据目录 |
| `bun run help` | 打印脚本目录（--check 校验登记 / --readme 生成 README 表） |

<!-- END GENERATED SCRIPTS -->

## Documentation

- [docs/README.md](docs/README.md): documentation index.
- [docs/getting-started/](docs/getting-started): installation and first run.
- [docs/guides/](docs/guides): current user/operator guides.
- [docs/architecture/](docs/architecture): current technical architecture.
- [docs/reference/](docs/reference): configuration, API overview, FAQ, and
  troubleshooting.
- [CONTRIBUTING.md](CONTRIBUTING.md): open-source contributor entry point.
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md): community behavior expectations.
- [SECURITY.md](SECURITY.md): vulnerability reporting and deployment security
  notes.
- [CHANGELOG.md](CHANGELOG.md) and [RELEASING.md](RELEASING.md): release notes
  and maintainer release checklist.

## License

[Apache-2.0](LICENSE) © 2025-2026 NomiFun. See [NOTICE](NOTICE) for third-party
attributions, including the AionUi upstream project that NomiFun originally
forked from before the current Tauri/Rust architecture.
