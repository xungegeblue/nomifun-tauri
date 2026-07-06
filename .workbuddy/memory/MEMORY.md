# nomifun-tauri 项目笔记

## 项目背景
- fork 自上游 `nomifun/nomifun-tauri`，进行二次开发
- origin: `https://github.com/xungegeblue/nomifun-tauri.git`（自己的 fork）
- upstream: `https://github.com/nomifun/nomifun-tauri.git`（上游官方）

## Git 分支策略
- **main**: 只跟踪上游，保持纯净，不直接改代码
- **dev**: 二开主线，日常开发在此分支
- **feature/***: 短生命周期功能分支，从 dev 拉出，完成后合回 dev
- 同步上游流程: fetch upstream → merge into main → merge main into dev

## 二开文档
- Git 工作手册位于 `docs/wiki/git-workflow.md`
