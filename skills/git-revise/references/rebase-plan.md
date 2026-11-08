# 合并多个提交

## 前提

- 只处理**本地未推送**的提交。已推送的提交需要改写时，必须先得到用户明确同意，并接受其他人需要 rebase 的后果。
- 合并前工作区必须干净，否则先 `git stash` 或提交。
- 合并前建备份引用：`git branch backup/<时间戳>`。

## 方式 A：交互式 rebase

```bash
git rebase -i HEAD~3
```

编辑器里把要保留的第一条写成 `pick`，其余改成：

- `squash`（s）：合并进上一条，保留提交信息供编辑
- `fixup`（f）：合并进上一条，丢弃本条信息
- `reword`（r）：只改信息
- `drop`（d）：删除

保存退出后按提示处理冲突。

## 方式 B：fixup + autosquash

适合"后续补丁要并回原提交"的场景：

```bash
# 为某个旧提交准备修复
git commit --fixup <目标提交>

# 自动把它们排到目标提交后面并标记 squash
git rebase -i --autosquash <目标提交>^
```

Windows PowerShell 下用非交互方式跳过编辑器：

```powershell
$env:GIT_SEQUENCE_EDITOR = "true"
git rebase -i --autosquash HEAD~3
Remove-Item Env:GIT_SEQUENCE_EDITOR
```

bash 下等价写法：

```bash
GIT_SEQUENCE_EDITOR=true git rebase -i --autosquash HEAD~3
```

## 冲突处理

```bash
git status              # 看哪些文件冲突
# 手动编辑，保留正确内容
git add <冲突文件>
git rebase --continue
```

放弃本次 rebase 并回到开始前：

```bash
git rebase --abort
```

## 回滚

`--abort` 只能在没有结束时使用。已经结束后想退回：

```bash
git reflog                    # 找到 rebase 前的 hash
git reset --hard <rebase 前的 hash>
```

或者直接：

```bash
git reset --hard ORIG_HEAD
```

`ORIG_HEAD` 记录的是 rebase 开始前的 HEAD，多数情况下够用。

## 合并后检查

```bash
git log --oneline -n 5
git range-diff <旧起点>..<旧终点> <新起点>..HEAD
```

`range-diff` 能确认"内容没丢，只是提交结构变了"。
