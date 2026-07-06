# Git 二开工作手册

## 仓库信息

| 远程名 | 地址 | 用途 |
|--------|------|------|
| origin | `https://github.com/xungegeblue/nomifun-tauri.git` | 你的 fork，push 代码到这里 |
| upstream | `https://github.com/nomifun/nomifun-tauri.git` | 上游官方仓库，只 fetch 不 push |

## 分支策略

| 分支 | 用途 | 来源 |
|------|------|------|
| main | 始终跟踪上游，保持纯净 | 只从 upstream 同步 |
| dev | 二开主线，所有改动在这里 | 从 main 创建，日常开发 |
| feature/* | 具体功能分支，短生命周期 | 从 dev 拉出，完成后合回 dev |

## 常用命令

### 切换分支

```bash
git checkout dev       # 切到二开分支
git checkout main      # 切回 main
git switch dev         # Git 2.23+ 新语法，效果一样
```

### 查看分支状态

```bash
git branch             # 查看本地分支
git branch -a          # 查看所有分支（含远程）
git remote -v          # 查看远程仓库配置
git remote show origin # 查看 origin 详情
git remote show upstream # 查看 upstream 详情（需网络）
```

### 同步上游更新

```bash
# 1. 拉取上游最新代码
git fetch upstream

# 2. 切到 main，同步上游
git checkout main
git merge upstream/main
git push origin main

# 3. 切回 dev，合并上游更新到二开分支
git checkout dev
git merge main
git push origin dev
```

> 如果想用 rebase 代替 merge（保持线性历史）：
> ```bash
> git checkout main
> git rebase upstream/main
> git push origin main
> git checkout dev
> git rebase main
> ```

### 开发新功能

```bash
# 从 dev 拉出 feature 分支
git checkout dev
git checkout -b feature/your-feature

# 开发完成后合回 dev
git checkout dev
git merge feature/your-feature
git branch -d feature/your-feature    # 删除已完成的 feature 分支
```

> 也可以用 rebase 保持历史整洁：
> ```bash
> git checkout dev
> git rebase feature/your-feature
> ```

### 推送代码

```bash
git push origin dev                  # 推送 dev 分支
git push origin main                 # 推送 main 分支
git push origin feature/xxx          # 推送 feature 分支
git push origin --all                # 推送所有分支
```

### 解决合并冲突

当 `git merge` 出现冲突时：

1. Git 会标记冲突文件，打开文件查看 `<<<<<<<` / `=======` / `>>>>>>>` 标记
2. 手动选择保留哪一侧的代码，删除标记符号
3. 保存文件后标记为已解决：
   ```bash
   git add <冲突文件>
   git commit
   ```

如果想放弃合并：

```bash
git merge --abort    # 取消本次合并，回到合并前状态
```

### 查看差异与历史

```bash
git log --oneline -10         # 最近 10 条提交摘要
git diff main dev             # 查看 main 和 dev 的差异
git diff upstream/main main   # 查看上游和本地的差异
git stash                     # 暂存当前未提交的改动
git stash pop                 # 恢复暂存的改动
```

### 回退操作

```bash
git checkout -- <file>        # 撤销某个文件的修改（未 commit）
git reset HEAD <file>         # 取消某个文件的暂存（已 add 未 commit）
git revert <commit-hash>      # 安全回退某次提交（生成新 commit）
```

## 避坑提醒

1. **永远不要在 main 上直接改代码**，main 只用来同步上游
2. **冲突不可避免** —— 上游改了和你二开重叠的文件时需手动解决
3. 如果上游太活跃，建议每周或每版本同步一次，别太频繁
4. 合并前先 `git stash` 暂存未完成的工作，避免意外冲突
5. 同步上游用 **merge**，自己 feature 合回 dev 用 **rebase** 更整洁
