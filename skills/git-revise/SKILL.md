---
name: git-revise
description: 改写已有的本地提交——修改提交信息、把遗漏文件补进上一次提交、合并多个提交。当用户说「改一下上次提交信息」「刚才漏了个文件」「这几个提交合成一个」时使用。不负责撤销或丢弃提交。
---

# git-revise

对**已经存在的提交**做修正，前提是这个提交仍然保留。撤销提交、丢弃改动属于 `git-undo`，不要在本技能里做。

## 前置检查

```bash
node scripts/inspect-last.mjs
```

输出 JSON，包含：HEAD 的 hash 与提交信息、作者与时间、**该提交是否已推送到远程**、工作区是否干净、是否处于 merge/rebase 中间态。

`alreadyPushed` 这个字段决定后续所有策略，必须先看清楚再动手。

## 分支决策

| 用户诉求 | 处理方式 | 级别 |
| --- | --- | --- |
| 只改提交信息 | `amend.mjs --message-file <文件>` | L2 |
| 把遗漏文件补进上一次提交 | `amend.mjs --add <文件列表>` | L2 |
| 合并最近几个提交 | 按 `references/rebase-plan.md` 生成计划并逐步执行 | L3 |

### 已推送的提交怎么处理

`alreadyPushed: true` 时，改写会产生分叉，必须 force push 才能同步，会影响其他协作者。此时**默认不建议改写**，而是提出两个选项让用户选：

1. **用新提交修正**（安全，追加一条 `fix: …`）
2. **改写 + force push**（需用户明确同意，并提示会让其他人 rebase）

不要在用户没明确表态时直接走方案 2。用户确认改写后，脚本仍需显式放行：

```bash
node scripts/amend.mjs --message-file <临时文件> --allow-pushed
```

没有 `--allow-pushed` 时，脚本会直接拒绝已推送的提交。

## 执行

```bash
# 改提交信息（默认 dry-run）
node scripts/amend.mjs --message-file <临时文件>

# 补文件进上一次提交（默认 dry-run）
node scripts/amend.mjs --add src/a.js,src/b.js

# 确认无误后统一加 --execute
node scripts/amend.mjs --message-file <临时文件> --execute
```

L3 操作（合并多个提交）执行前必须先建备份引用：

```bash
git branch backup/$(Get-Date -Format yyyyMMdd-HHmmss)
```

（bash 环境用 `git branch backup/$(date +%Y%m%d-%H%M%S)`，Windows PowerShell 用上面的写法。）

## 安全边界

- 不改写已推送到共享分支的历史，除非用户逐字确认
- 不在 `merge` / `rebase` 中间态执行 amend
- 不 `--no-verify`
- 操作失败时保留现场，不要擅自 `git rebase --abort` 或 `git checkout -- .`

## 参考资料

- `references/rebase-plan.md` — 合并多个提交的完整步骤与回滚方式
- `scripts/` — 诊断与 amend 执行脚本
