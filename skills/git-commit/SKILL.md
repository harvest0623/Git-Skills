---
name: git-commit
description: 根据当前仓库的改动生成符合 Conventional Commits 的提交信息并完成提交。当用户说「帮我提交代码」「写个 commit message」「这次改动该怎么提交」「把改动交上去」时使用。不负责修改已有提交。
---

# git-commit

把「工作区里的改动」变成一个意图清晰、格式合规的提交。模型只负责判断这次改动在做什么，其余步骤全部交给脚本。

## 前置检查

1. 确认在 Git 仓库内：`git rev-parse --is-inside-work-tree`
2. 运行诊断脚本，一次性拿到全部上下文：

```bash
node scripts/collect-context.mjs
```

输出为 JSON，包含：当前分支、变更文件清单与增删行数、已暂存的 diff（超出预算会截断并标注）、最近 10 条提交标题、是否处于 merge/rebase 中间态。

**只使用脚本输出，不要自己再读一遍完整 `git diff`**。大仓库的 diff 会直接耗尽上下文，这也是脚本存在的意义。

## 工作流程

### 步骤 1：判断意图

读完 diff 后回答一个问题：这些改动在做几件事？

- **只有一件事** → 进入步骤 2
- **有多件事**（例如同时改了功能代码、又顺手修了错别字）→ **不要提交**，先输出拆分方案：按文件或按 hunk 列出建议分组、每组的提交信息，等用户选择

拆分标准见 `references/splitting.md`。

### 步骤 2：生成提交信息

```
<type>(<scope>): <subject>

<body>
```

- `type` 必填，白名单见 `references/message-rules.md`
- `scope` 可选，写受影响的模块，不要写文件名
- `subject` 中英文均可（与仓库近期提交保持一致），不超过 50 字符，结尾不加句号
- `body` 可选，只在需要解释「为什么」时写；「改了什么」diff 已经说明，不必重复

**禁止使用**：`update`、`修改代码`、`提交一下` 这类无法区分内容的表述。

### 步骤 3：校验

```bash
node scripts/check-message.mjs --message-file <临时文件>
```

- 退出码 `0` → 进入步骤 4
- 退出码 `1` → 标准输出是包含 `errors` 数组的 JSON，逐条修正后重跑，**最多重试 3 次**
- 重试仍失败 → 把错误原样展示给用户，不要绕过校验直接提交

### 步骤 4：确认并执行

先把最终提交信息与待提交文件清单展示给用户，得到明确同意后再执行：

```bash
# 默认 dry-run：只打印将要执行的命令，不改动仓库
node scripts/commit.mjs --message-file <临时文件> --files a,b,c

# 用户确认后加 --execute 才真正提交
node scripts/commit.mjs --message-file <临时文件> --files a,b,c --execute
```

## 安全边界

- 不加 `--no-verify`；钩子失败就如实报告失败原因
- 不提交 `.env`、密钥、证书等敏感文件，发现即停下询问
- 不擅自 `git add .`，只提交清单里列出的文件
- 不修改用户的 Git 配置

## 参考资料

- `references/message-rules.md` — type 白名单与格式校验细则
- `references/splitting.md` — 何时该拆分提交、怎么分
- `scripts/` — 诊断、校验、执行三个脚本
