# 第四章 远程协作与 GitHub

> 本章打通「本地 Git ↔ 远程仓库 ↔ GitHub 平台」的完整链路：远程仓库管理、SSH 配置、fork/PR 协作流程、GitHub Actions 自动化、GitHub Pages 建站等。看完就能独立完成从建仓库到发布上线的全流程。

---

## 4.1 远程仓库（Remote）管理

```bash
git remote -v                            # 查看远程仓库地址（-v 显示 URL）
git remote add origin <url>              # 添加远程仓库，命名 origin（惯例）
git remote remove origin                 # 移除远程仓库
git remote rename old new                # 重命名远程仓库
git remote set-url origin <new-url>      # 修改远程仓库地址（迁移仓库后常用）
git remote get-url origin                # 查看某个远程地址
```

### 远程分支与本地分支

```bash
git branch -r                            # 列出远程分支（如 origin/main）
git fetch origin                         # 只下载远程更新，不合并
git diff origin/main                     # 对比本地与远程 main 的差异
git log origin/main..HEAD                # 本地有而远程没有的提交
git checkout -b local-branch origin/main # 基于远程分支创建本地分支
git branch --track <name> origin/<name>  # 建立本地与远程的关联
```

## 4.2 fetch / pull / push 详解

### fetch（拉取，不合并）

```bash
git fetch origin                         # 下载 origin 的所有分支更新
git fetch --all                          # 下载所有远程
git fetch --prune                        # 同时清理已删除的远程分支引用
git fetch --tags                         # 连同标签一起拉取
```

### pull（拉取并合并 = fetch + merge）

```bash
git pull origin main                     # 拉取并合并远程 main
git pull --rebase                        # 拉取后用 rebase 方式合并（历史更干净）
git pull --autostash                     # 本地有未提交修改时自动 stash
```

> 若本地有未提交修改且与远程改动无冲突，`--autostash` 可避免「pull 报错」。
> 也可以全局设置 `git config --global pull.rebase true`，让 pull 默认 rebase。

### push（推送）

```bash
git push origin main                     # 推送本地 main 到远程
git push -u origin feature               # 推送并建立跟踪关系（首次推送用 -u）
git push --force                         # 强制推送（危险！会覆盖远程历史）
git push --force-with-lease              # 安全强推：仅当远程没被别人更新过才推
git push origin --delete <branch>        # 删除远程分支
git push origin :<branch>                # 另一种删除远程分支写法
git push --tags                          # 推送所有标签
```

### push 常见报错与解决

| 报错 | 原因 | 解决 |
| --- | --- | --- |
| `rejected (non-fast-forward)` | 远程有本地没有的提交 | `git pull --rebase` 后再 push |
| `Updates were rejected because the tip of your current branch is behind` | 同上 | 先同步远程 |
| `Permission denied (publickey)` | SSH 密钥未配置 | 见 4.3 |
| `Support for password authentication was removed` | GitHub 不再支持密码 push | 使用 Token / SSH |
| `fatal: remote origin already exists` | 重复添加远程 | `git remote set-url` 覆盖 |

## 4.3 SSH 密钥配置（GitHub 免密访问）

```bash
# 1. 生成密钥（一路回车即可）
ssh-keygen -t ed25519 -C "你的邮箱@example.com"

# 2. 查看公钥并复制
cat ~/.ssh/id_ed25519.pub

# 3. 打开 GitHub → Settings → SSH and GPG keys → New SSH key
#    粘贴公钥，保存

# 4. 测试连接
ssh -T git@github.com
# 输出 "Hi xxx! You've successfully authenticated..." 即成功

# 5. 之后 clone/push 都使用 SSH 地址（git@github.com:user/repo.git）
```

> Windows 注意：公钥文件一般在 `C:\Users\你的用户名\.ssh\id_ed25519.pub`。
> 多账号场景可配置 `~/.ssh/config` 指定不同 Host 用不同密钥。

## 4.4 GitHub 一条龙：从建仓库到发布

### 第一步：创建远程仓库

在 GitHub 网页点击 **New repository**，或命令行（需装 GitHub CLI）：

```bash
gh repo create my-project --public --source=. --push
```

### 第二步：本地初始化并推送（两种路线）

**路线 A：远程先建好（GitHub 上勾选了 README 等初始化文件）**

```bash
git clone git@github.com:用户名/仓库名.git
cd 仓库名
# 开始开发…
```

**路线 B：本地已有项目，推送到空仓库**

```bash
git init
git add .
git commit -m "chore: 初始提交"
git branch -M main                          # 默认分支改名为 main
git remote add origin git@github.com:用户名/仓库名.git
git push -u origin main
```

### 第三步：日常开发循环

```bash
git switch -c feature/xxx       # 1. 拉功能分支
# 开发代码…
git add . && git commit -m "feat: xxx"   # 2. 提交
git push -u origin feature/xxx  # 3. 推送
# 4. 到 GitHub 发起 Pull Request → 评审 → 合并
git switch main                 # 5. 回到主分支
git pull                        # 6. 拉取合并结果
```

### 第四步：发布版本

```bash
git tag -a v1.0.0 -m "发布 1.0.0"
git push origin v1.0.0
# 在 GitHub → Releases → 根据 tag 创建 Release（可附 changelog、二进制文件）
```

## 4.5 Pull Request（PR）完整流程

PR 是 GitHub 协作的核心，本质是「请求把某个分支的改动合并进目标分支」。

### 团队内协作流程

1. 从 `main` 拉分支 `feature/login`。
2. 本地提交、推送。
3. GitHub 仓库页面出现提示 → 点击 **Compare & pull request**。
4. 填写标题和描述（写清楚改了什么、为什么、怎么测试），关联 Issue（`#123`）。
5. 请求 Review，解决评论意见，补充提交（PR 会自动更新）。
6. 通过 CI 检查 + 至少 1 人 Approve 后合并（可选 Squash and merge）。
7. 合并后删除功能分支。

### Fork 流程（开源项目贡献）

```
原仓库 owner/repo
   │ fork（复制一份到你的账号）
   ▼
你的账号 repo
   │ clone 到本地，开发，push 到你的 fork
   ▼
发起 PR：你的 fork:feature → 原仓库:main
```

```bash
gh repo fork owner/repo --clone           # 用 GitHub CLI 一步到位
# 保持 fork 与上游同步：
git remote add upstream git@github.com:owner/repo.git
git fetch upstream
git checkout main
git merge upstream/main
```

### 好 PR 的要点

- 一次 PR 只做一件事，改动尽量小。
- 提交信息规范（Conventional Commits）。
- 描述模板：背景 / 改动内容 / 测试方法 / 截图。
- 不要把一个 WIP 的 PR 挂太久，用 Draft PR 标明。

## 4.6 Issue（问题管理）

```bash
gh issue create --title "登录接口 500" --body "复现步骤…"      # 命令行创建
gh issue list                                                 # 列出问题
gh issue close 12                                             # 关闭
gh issue view 12                                              # 查看详情
```

Issue 标签：`bug` / `feature` / `enhancement` / `help wanted` / `good first issue`（新手友好）。

## 4.7 GitHub Actions —— 自动化 CI/CD

在仓库根目录创建 `.github/workflows/ci.yml`：

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4          # 检出代码
      - uses: actions/setup-node@v4        # 设置 Node 环境
        with:
          node-version: 20
      - run: npm install                   # 安装依赖
      - run: npm test                      # 跑测试
      - run: npm run build                 # 构建
```

常用场景：

- **CI**：PR 时自动跑 lint / test / build。
- **CD**：merge 到 main 后自动部署（ssh 到服务器、上传 OSS、触发云函数等）。
- **定时任务**：`on: schedule: - cron: '0 8 * * *'`。
- **版本发布**：打 tag 时自动构建并创建 Release。

> 免费额度：公共仓库无限；私有仓库每月 2000 分钟（个人版）。

## 4.8 GitHub Pages —— 免费建站

把静态网站托管在 GitHub 上（个人主页 / 项目文档 / 博客）。

```bash
# 方式一：仓库设置
# Settings → Pages → Source: GitHub Actions / Deploy from a branch (main /docs 目录)

# 方式二：GitHub Actions 部署 VitePress 等
```

```yaml
# .github/workflows/deploy.yml
name: Deploy Pages
on:
  push:
    branches: [main]
permissions:
  contents: write
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci && npm run docs:build
      - uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./docs/.vitepress/dist
```

访问地址：`https://用户名.github.io/仓库名/`

## 4.9 GitHub CLI（gh）—— 终端一条龙

```bash
gh auth login                          # 登录（浏览器/Token）
gh repo create <name> --public --clone # 创建仓库并克隆
gh repo clone owner/repo               # 克隆
gh pr create --fill                    # 创建 PR
gh pr list / gh pr view 12             # 查看 PR
gh pr merge 12 --squash                # 合并 PR
gh issue create / gh issue list        # Issue 管理
gh release create v1.0.0 --generate-notes   # 创建 Release
gh run watch                           # 查看 Actions 运行状态
```

## 4.10 多人协作常见场景

### 场景 A：我的分支落后于 main，如何同步？

```bash
git switch feature
git fetch origin
git rebase origin/main       # 或 git merge origin/main
git push --force-with-lease  # rebase 后需要强推（仅限你自己的分支）
```

### 场景 B：误 push 了敏感信息（密码/密钥）

```bash
# 1. 立刻在对应平台（GitHub/云厂商）吊销该密钥
# 2. 移除敏感文件跟踪
git rm --cached .env && echo ".env" >> .gitignore
# 3. 提交并推送
git commit -m "chore: 移除敏感文件"
# 4. 历史中彻底清除（危险，见第五章 filter-repo）
# 5. 让所有同事轮换密钥
```

### 场景 C：本地分支太多想清理

```bash
git branch --merged | grep -v "\*" | xargs git branch -d   # 删除已合并分支
git remote prune origin                                     # 清理远程已删分支的本地引用
```

---

## ✅ 本章小结

- 远程管理：`remote` 增删改查 + `fetch/pull/push` 三件套。
- SSH 免密：`ssh-keygen` 生成 → GitHub 添加公钥 → `ssh -T git@github.com` 验证。
- 协作核心：PR 流程 + fork 流程 + 保护分支。
- 自动化：Actions（CI/CD）、Pages（建站）、gh CLI（终端操作）。

> 下一章：[05-高级技巧与效率提升.md](./05-高级技巧与效率提升.md)，学习隐藏的效率大招。