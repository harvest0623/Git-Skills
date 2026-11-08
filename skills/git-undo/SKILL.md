---
name: git-undo
description: 撤销或回退 Git 更改——还原工作区文件、取消暂存、回退本地提交、撤销已推送的提交、找回丢失的提交。当用户说「撤销刚才的提交」「代码改错了想还原」「推错了怎么办」「提交丢了能找回吗」时使用。不负责修改提交内容。
---

# git-undo

所有操作里风险最高的一类：**丢弃改动无法重来，改写已推送历史会影响他人**。因此本技能的每个动作都必须先拿到事实、再给方案、最后才执行。

修改已有提交的内容请转 `git-revise`。

## 前置检查

```bash
node scripts/assess-risk.mjs --target <commit-ish>
```

输出 JSON，包含：目标提交、**是否已被远程分支包含**、其后是否还有提交、当前分支与上游、以及 `recoverable`（能否通过 reflog 找回）。

`alreadyPushed` 和 `recoverable` 是决定用哪种方式的唯一依据，不要凭印象判断。

## 决策表

| 用户想要 | 条件 | 动作 | 级别 |
| --- | --- | --- | --- |
| 取消暂存，保留改动 | — | `git restore --staged <files>` | L2 |
| 丢弃某文件的工作区改动 | 未提交 | `git restore <files>` | L2 |
| 撤销最近提交，改动仍在暂存区 | 未推送 | `git reset --soft HEAD~1` | L2 |
| 撤销最近提交，改动留在工作区 | 未推送 | `git reset --mixed HEAD~1` | L2 |
| 彻底丢弃提交及其改动 | 未推送 | `git reset --hard HEAD~1` | L3 |
| 撤销已推送的提交 | 已推送 | `git revert <commit>` | L2 |
| 找回 reset 后丢失的提交 | — | `git reflog` 找到后 `git branch rescue <hash>` | L2 |

判断要点：

- **已经推送就一律 `revert`**，不要建议 `reset` + force push
- `reset` 遇到已推送的提交会被脚本直接拒绝，只有用户明确要求改写历史时才加 `--allow-pushed`
- `reset --hard` 前必须建备份引用：`git branch backup/<时间戳>`
- 找回丢失提交时先只读列出候选（`git reflog -n 20`），让用户确认是哪一条，**不要直接 reset 到某个 hash**

## 执行

```bash
# 默认 dry-run，只打印命令
node scripts/undo.mjs --action unstage --files src/a.js
node scripts/undo.mjs --action restore --files src/a.js
node scripts/undo.mjs --action reset --mode mixed --target HEAD~1
node scripts/undo.mjs --action revert --target <hash>
node scripts/undo.mjs --action recover --target <hash>

# 确认后统一加 --execute
node scripts/undo.mjs --action reset --mode hard --target HEAD~1 --execute
```

## 安全边界

- **L3 操作一律二次确认**：先展示将失去的内容（`git log --oneline <target>..HEAD` 与 `git diff`），再执行
- 不确定就停：宁可多问一句，也不要执行 `reset --hard`
- 不擅自 force push
- 不清理 `reflog`、不执行 `git gc --prune=now`

## 参考资料

- `references/recovery.md` — reflog 找回、误删分支、丢失 stash 的恢复手法
- `scripts/` — 风险评估与执行脚本
