# 丢失提交的找回

Git 几乎不会立刻删除提交对象。只要 reflog 还在、对象没被 `gc --prune` 清掉，就还有救。

## 第一步：看 reflog

```bash
git reflog -n 20
```

输出形如：

```
acdec64 HEAD@{0}: reset: moving to HEAD~1
93ef2ec HEAD@{1}: commit: fix: 完善章节的知识内容
```

`HEAD@{n}` 右边的描述就是操作历史。找到目标后，**先建分支**，不要直接 reset：

```bash
git branch rescue/20261106 acdec64
git log --oneline rescue/20261106 -n 5
```

确认内容正确，再决定是 `git checkout` 过去，还是 `git reset --hard rescue/20261106`。

## 场景对照

| 丢失原因 | 找回方式 |
| --- | --- |
| `git reset --hard` | `git reflog` 找旧 HEAD，建 rescue 分支 |
| 误删分支 | `git reflog` 找分支最后一次提交，建分支 |
| `git commit --amend` 覆盖 | `git reflog` 找 amend 前的 hash |
| `git rebase` 后不满意 | `git reflog` 或 `git reset --hard ORIG_HEAD` |
| `git stash drop` | `git fsck --lost-found` 找 dangling commit |
| 已执行 `gc --prune=now` | 概率很低，通常无法找回 |

## stash 被误删

```bash
git fsck --lost-found
git show <dangling-commit-hash>
git stash apply <dangling-commit-hash>
```

## 判断还能不能找回

```bash
git cat-file -e <hash>
```

退出码 0 表示对象还在。这也是 `assess-risk.mjs` 里 `recoverable` 字段的判定方式。

## 三条铁律

1. 丢东西之后**先别做任何写操作**，尤其别 `git gc`
2. 找回一律先建分支，再对比，最后才移动 HEAD
3. 不确定是哪条时，把 `git reflog` 的候选完整展示给用户，让他确认
