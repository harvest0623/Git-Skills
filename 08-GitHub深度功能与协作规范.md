# 第八章 GitHub 深度功能与协作规范

> 第四章讲了 GitHub 的「一条龙」基础流程，本章深入平台的**进阶功能**（Projects、Codespaces、Dependabot、Security、Discussions 等）和**团队协作规范**（提交信息规范、Code Review、贡献文档），让你的项目既专业又好维护。

---

## 8.1 仓库设置与品牌化

### 基础设置

```bash
# Settings → General
#  - Description / Website：一句话介绍 + 官网
#  - Topics：打标签，便于被搜索（如 git、tutorial）
#  - Visibility：Public / Private
#  - Default branch：默认分支名（建议 main）
#  - Features：是否开启 Wiki、Discussions、Projects
```

### README 规范

README 是仓库门面，建议结构：

```markdown
# 项目名
> 一句话定位 + 徽章（build / coverage / version）

## ✨ 特性
## 🚀 快速开始（安装 → 使用示例）
## 📖 文档链接
## 🧑‍🤝‍🧑 贡献指南（指向 CONTRIBUTING.md）
## 📄 License
```

徽章可直接引用 shields.io：

```markdown
![build](https://img.shields.io/github/actions/workflow/status/用户名/仓库名/ci.yml)
![version](https://img.shields.io/github/v/tag/用户名/仓库名)
```

### 必备文件

| 文件 | 作用 |
| --- | --- |
| `README.md` | 项目介绍与快速开始 |
| `LICENSE` | 开源协议（MIT / Apache-2.0 / GPL 等） |
| `CONTRIBUTING.md` | 贡献指南：如何提 issue、提 PR、开发环境 |
| `CODE_OF_CONDUCT.md` | 行为准则 |
| `.gitignore` | 忽略规则 |
| `.github/PULL_REQUEST_TEMPLATE.md` | PR 模板 |
| `.github/ISSUE_TEMPLATE/*.yml` | Issue 模板 |
| `.github/CODEOWNERS` | 文件所有权（谁必须 review 哪些文件） |
| `.github/dependabot.yml` | 依赖自动更新配置 |

## 8.2 Issue 高级管理

```bash
gh issue create -t "标题" -b "描述" -l bug -a @me -m "里程碑"
gh issue list --label "bug" --state open
gh issue edit 12 --add-label "priority:high"
gh issue close 12 --reason completed
```

**高级玩法**：

- **Labels**：`bug` / `feature` / `enhancement` / `good first issue` / `help wanted`，用颜色区分优先级。
- **Milestones**：把相关 Issue 归到某个版本，跟踪发布进度。
- **Templates**：让用户按模板提交 bug（复现步骤、期望结果、实际结果）。
- **自动关联**：PR 描述里写 `Closes #123`，合并时自动关闭 Issue。
- **Markdown 任务清单**：
  ```markdown
  - [ ] 实现登录接口
  - [x] 编写单元测试
  ```

## 8.3 Projects —— 项目看板（Projects v2）

GitHub 自带轻量项目管理，适合个人/小团队：

- 视图：Board（看板）/ Table（表格）/ Timeline（时间线）。
- 字段：Status（Todo / In Progress / Done）、Priority、Sprint、负责人。
- 自动化：PR/Issue 状态变化自动移动卡片。
- 用法：仓库顶部 **Projects** 标签 → New project → 选择模板。

```bash
gh project list                        # 查看项目
gh project view 1 --owner <用户名>      # 查看项目详情
gh project item-add 1 --owner <用户名> --url <issue-url>   # 添加 item
```

> 小团队替代方案：直接维护一个 Issue + 列表视图，开销更低。

## 8.4 Discussions —— 讨论区

适合「问答、想法、RFC、公告」这类非 bug 讨论（Issue 应留给明确任务）：

- **Announcements**：官方公告。
- **Q&A**：问题答疑，可标记已解答。
- **Ideas**：功能想法收集。
- **General**：自由讨论。

开启：Settings → Features → Discussions。

## 8.5 Wiki —— 项目知识库

每个仓库可启用独立 Wiki，用于放文档、FAQ、设计文档，支持 Markdown。

```bash
# 命令行操作 wiki 仓库（它是独立仓库）
git clone https://github.com/用户名/仓库名.wiki.git
```

## 8.6 Gists —— 代码片段

轻量级代码片段托管（可含多个文件），适合分享小工具、配置文件、示例代码。

```bash
gh gist create file.txt --public -d "说明"
gh gist list
gh gist edit <id>
```

## 8.7 Releases 与语义化版本

- 基于 Tag 创建 Release，可附带二进制产物和变更说明（Changelog）。
- 语义化版本 `MAJOR.MINOR.PATCH`：
  - `MAJOR`：不兼容的 API 变更
  - `MINOR`：向后兼容的新功能
  - `PATCH`：向后兼容的 bug 修复

```bash
gh release create v1.0.0 --title "v1.0.0" --generate-notes   # 自动生成变更日志
gh release create v1.0.0 dist/app.zip                         # 附带二进制文件
```

## 8.8 Codespaces —— 云端开发环境

- 浏览器里直接打开一个完整 VS Code 容器环境，无需本地配置。
- 仓库页面点 **Code → Codespaces → Create codespace**。
- 配置文件 `.devcontainer/devcontainer.json` 可定制环境（Node、Python、Docker 等）。
- 适用：团队统一开发环境、PR 代码审查、临时演示。

## 8.9 GitHub Copilot —— AI 编程助手

- **Copilot**：代码自动补全（付费）。
- **Copilot Chat**：对话式问答、解释代码、生成测试（付费）。
- 与 Git 结合：可以在 PR 页面让 Copilot 总结变更、生成 PR 描述。

## 8.10 Dependabot —— 依赖自动更新与安全

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "monthly"
```

- **Version updates**：定期自动发 PR 更新依赖。
- **Security updates**：依赖存在已知漏洞时自动发修复 PR。

## 8.11 Security 中心

仓库 **Security** 标签页：

| 能力 | 说明 |
| --- | --- |
| Dependabot alerts | 依赖漏洞告警 |
| Secret scanning | 检测误提交的密钥（Token/密钥），GitHub 免费为公共仓库扫描 |
| Code scanning | 用 CodeQL 静态分析代码漏洞 |
| Security advisories | 发布安全公告（CVE） |

**补充**：本地也可以在 push 前用钩子/工具（如 gitleaks）扫描敏感信息。

## 8.12 GitHub Actions 深入

### Workflow 关键语法

```yaml
name: CI
on:
  push:
    branches: [main]
    tags: ["v*"]                       # 打 tag 时触发
  pull_request:
    paths: ["src/**", "!docs/**"]      # 按路径过滤
  schedule:
    - cron: "0 3 * * *"                # 定时触发
  workflow_dispatch:                   # 手动触发

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:                          # 矩阵构建
        node: [18, 20]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
          cache: npm                   # 依赖缓存
      - run: npm ci
      - run: npm test
      - uses: actions/upload-artifact@v4  # 上传产物
        with:
          name: test-report
          path: coverage/

  deploy:
    needs: test                        # 依赖 job
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - run: echo "部署到生产"
        env:
          TOKEN: ${{ secrets.DEPLOY_TOKEN }}   # 敏感信息放 Secrets
```

### 关键概念

- **Secrets**：仓库 Settings → Secrets and variables → Actions，存放 Token/密码，运行时以 `${{ secrets.XXX }}` 引用。
- **缓存**：`actions/setup-node` 的 `cache` 或 `actions/cache` 可缓存 node_modules 等。
- **Artifacts**：job 之间/工作流结束后下载的文件产物。
- **Environments**：区分 dev/staging/prod，可加审批门禁。
- **价格**：公共仓库免费；私有仓库每月 2000 分钟（个人版）。

## 8.13 团队协作规范

### 提交信息规范（Conventional Commits）

```
<type>(<scope>): <subject>

<body>
<footer>
```

```bash
feat(login): 新增短信验证码登录
fix(cart): 修复结算金额精度问题
docs(readme): 补充安装步骤
refactor(api): 拆分用户服务
test: 补充 checkout 边界测试
chore: 升级依赖版本
```

类型：`feat` `fix` `docs` `style` `refactor` `test` `chore` `perf` `ci` `build` `revert`。

**工具链**：

```bash
# commitlint 校验格式 + husky 拦截
npm install -D @commitlint/cli @commitlint/config-conventional husky
# 配置 commitlint.config.js，pre-commit 钩子里跑 lint
```

### 分支命名规范

```bash
feature/登录模块          # 新功能
bugfix/修复空指针         # bug 修复
hotfix/紧急修复线上崩溃    # 线上紧急
release/1.2.0            # 发版
docs/更新README          # 文档
chore/升级依赖            # 杂务
```

### Code Review 规范

PR 描述建议包含：**背景 → 改动清单 → 测试方法 → 截图/演示**。

```markdown
## 背景
<!-- 为什么做这个改动 -->
## 改动
- [x] 新增登录接口
- [x] 补充单元测试
## 测试
- 本地 5000 端口起服务，curl 验证三种登录方式
## 截图
<!-- 有 UI 改动时附截图 -->
Closes #123
```

Review 检查清单：

- [ ] 改动范围是否符合 PR 主题（越小越好）
- [ ] 有无单元测试覆盖关键逻辑
- [ ] 有无敏感信息（密钥/路径泄漏）
- [ ] 命名与现有代码风格一致
- [ ] 是否破坏向后兼容

### 自动化门禁（配合 Actions）

- PR 必须通过 CI（lint + test + build）。
- 至少 1 人 Approve 才可合并。
- 合并方式统一（Squash and merge 最常用，历史干净）。
- main 开启保护分支，禁止直接 push。

---

## ✅ 本章小结

- **平台功能**：Projects 管任务、Discussions 管讨论、Wiki 管文档、Gists 管片段、Releases 管发布。
- **自动化**：Dependabot 管依赖、Actions 管 CI/CD、Security 管安全、Codespaces 管环境。
- **协作规范**：提交信息用 Conventional Commits、分支命名统一、PR 描述模板化、Review 清单化。

> 下一章：[09-实战场景演练与练习题.md](./09-实战场景演练与练习题.md)，动手把知识变成技能。