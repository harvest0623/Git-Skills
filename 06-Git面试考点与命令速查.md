# 第六章 Git 面试考点与命令速查

> 本章分两部分：**高频面试题详解**（含答案要点和相关命令）与**按场景分类的命令速查表**。适合面试冲刺、日常快速翻查。

---

## 第一部分：高频面试题

### Q1. Git 和 SVN 有什么区别？

**答案要点**：
- Git 是**分布式**，每个本地仓库都是完整副本，可离线提交；SVN 是**集中式**，依赖中央服务器。
- Git 存**快照**（每次提交保存完整文件快照），SVN 存**差异**（每次只存改动）。
- Git 分支创建/切换极快（分支是指针），SVN 分支是目录拷贝，成本高。
- Git 通过哈希保证数据完整性，支持强大的本地历史操作（rebase、交互式操作）。

### Q2. merge 和 rebase 的区别？分别什么时候用？

**答案要点**：
- merge 保留分支分叉历史和合并节点，历史有「鱼骨图」，不重写提交；rebase 将提交重新「嫁接」成一条线性历史，**会改写提交哈希**。
- 使用场景：合并**共享分支**用 merge（安全）；整理**本地私有分支**、PR 前让历史更干净用 rebase。
- **黄金法则**：不要 rebase 已推送且可能被别人拉取的分支。

```bash
git merge feature          # 保留分叉
git rebase main            # 线性历史
```

### Q3. reset 的三种模式（soft / mixed / hard）有什么区别？

**答案要点**：三者都会把分支指针移到目标提交，区别在于对暂存区和工作区的影响：

| 模式 | 暂存区 | 工作区 | 典型场景 |
| --- | --- | --- | --- |
| `--soft` | 保留 | 保留 | 撤销 commit 想重新提交 |
| `--mixed`（默认） | 清空 | 保留 | 撤销 commit+add，保留改动 |
| `--hard` | 清空 | 清空 | 完全丢弃改动（危险） |

```bash
git reset --soft HEAD^
git reset --mixed HEAD^
git reset --hard HEAD^
```

### Q4. 如何撤销一个已经 push 到远程的提交？

**答案要点**：
- 首选 `git revert <commit-id>`：生成一个**反向提交**，不改写历史，不影响其他人。
- 不能用 reset 后直接 push，否则远程历史冲突；除非确认是个人分支，用 `git push --force-with-lease`。

```bash
git revert a1b2c3d
git push origin main
```

### Q5. 怎么找回误删的提交或误 reset 丢掉的代码？

**答案要点**：`git reflog` 记录所有 HEAD 移动历史，找到目标提交哈希后用 `git reset --hard <哈希>` 或新建分支接回来。

```bash
git reflog
git branch recover <哈希>
# 或 git reset --hard <哈希>
```

### Q6. 如何解决合并冲突？

**答案要点**：冲突文件中有 `<<<<<<< / ======= / >>>>>>>` 标记，手动选择保留内容，删除标记后 `git add` 标记已解决，再 `commit` / `--continue`；想放弃用 `--abort`。

```bash
# 编辑冲突文件 → 保留需要的内容
git add <冲突文件>
git commit                 # 或 git merge --continue
git merge --abort          # 放弃合并
```

### Q7. cherry-pick 是什么？什么时候用？

**答案要点**：把某个提交「复制」到当前分支（生成新哈希）。用于：修复提交打在了错误分支、把补丁应用到多个发布分支。

```bash
git cherry-pick <commit-id>
```

### Q8. git pull 和 git fetch 有什么区别？

**答案要点**：
- `fetch`：只下载远程更新到本地，**不改变工作区和当前分支**（更新远程追踪分支）。
- `pull` = `fetch` + `merge`（或 `--rebase` 时为 rebase），会改变当前分支。
- 想先看看远程改了再决定是否合并，就用 fetch。

```bash
git fetch origin
git log origin/main..HEAD    # 看差异
git pull --rebase origin main
```

### Q9. 什么是 detached HEAD？进入了怎么办？

**答案要点**：HEAD 直接指向某个提交而不是分支时即为分离状态，新提交不会归属于任何分支。处理：若只想看代码，`git switch <分支>` 回去即可；若想保留这里的提交，`git switch -c <新分支>` 把它接住。

```bash
git switch -c rescue         # 接住当前分离状态的提交
```

### Q10. 什么是 git stash？什么场景用？

**答案要点**：把工作区未提交的修改临时保存，恢复干净工作区，之后用 `pop`/`apply` 取回。用于：写到一半要紧急切分支修 bug、pull 前有本地改动怕冲突。

```bash
git stash -u
git switch fix-bug
# 修复并提交…
git switch -             # 回到原分支
git stash pop
```

### Q11. git rebase -i 能做什么？

**答案要点**：交互式整理提交历史，可对最近 N 条提交执行：`pick`（保留）、`squash`（合并进上一条）、`reword`（改信息）、`edit`（拆改）、`drop`（删除）、`fixup`（合并并丢弃信息）。

```bash
git rebase -i HEAD~3
```

### Q12. 如何让 git log 输出更好看？

**答案要点**：配合 `--oneline --graph --all --decorate`，建议配置成别名。

```bash
git log --oneline --graph --all --decorate
git config --global alias.lg "log --oneline --graph --all --decorate"
```

### Q13. 不小心提交了敏感文件（密码）怎么办？

**答案要点**：立即吊销/轮换密钥（这是最重要的）→ 从跟踪中移除（`git rm --cached` + `.gitignore`）→ 提交推送 → 用 `git filter-repo`（或 filter-branch）从**历史**中彻底清除 → 通知团队重新 clone。

```bash
git rm --cached .env
echo ".env" >> .gitignore
git commit -m "chore: 移除敏感文件"
git filter-repo --path .env --invert-paths
```

### Q14. Git 对象模型是什么？

**答案要点**：Git 是内容寻址文件系统，四种对象：
- `blob`：文件内容（不含文件名）
- `tree`：目录快照（文件名 → blob/子 tree）
- `commit`：指向一棵 tree + 父提交 + 作者/信息
- `tag`：指向提交的标签

```bash
git cat-file -p HEAD
git cat-file -t <hash>
```

### Q15. 什么是 .gitignore？什么时候无效？

**答案要点**：声明哪些文件/目录不被跟踪。**只对未跟踪文件生效**；已被跟踪的文件不受影响，需先 `git rm --cached` 解除跟踪。

```bash
echo "node_modules/" >> .gitignore
git rm -r --cached node_modules   # 若已跟踪，需移除
```

### Q16. 有哪些主流的 Git 工作流？

**答案要点**：Git Flow（main/develop/feature/release/hotfix）、GitHub Flow（只有 main + 短命功能分支 + PR）、Trunk-Based（主干开发 + 特性开关）、GitLab Flow（环境分支）。

### Q17. `--force` 和 `--force-with-lease` 的区别？

**答案要点**：`--force` 无条件覆盖远程历史；`--force-with-lease` 先检查远程分支是否被他人更新过，若变了则拒绝，**更安全**。个人分支 rebase 后强推用后者。

```bash
git push --force-with-lease
```

### Q18. 浅克隆是什么？有什么作用？

**答案要点**：`git clone --depth 1` 只拉取最近一次提交，大幅减少下载体积和时间；后续需要完整历史可用 `git fetch --unshallow` 补齐。

```bash
git clone --depth 1 <url>
git fetch --unshallow
```

### Q19. git reflog 和 git log 有什么区别？

**答案要点**：`git log` 展示的是**提交图**（可达的提交）；`git reflog` 展示的是**HEAD 的操作历史**（包括被 reset/rebase/删除的提交），是找回丢失提交的关键。reflog 仅本地、有 90 天默认期限。

### Q20. 什么是工作区、暂存区、版本库？

**答案要点**：工作区是正在编辑的目录；暂存区（Index）存放 `git add` 后的内容；版本库（`.git`）存放提交历史。`git commit` 提交的是**暂存区**内容。

---

## 第二部分：命令速查表（按场景分类）

### 初始化 / 配置

```bash
git init                                # 初始化仓库
git clone <url>                         # 克隆远程仓库
git config --global user.name "name"    # 配置用户名
git config --global user.email "email"  # 配置邮箱
git config --list                       # 查看所有配置
```

### 日常工作流

```bash
git status / git status -s              # 查看状态
git add <file> / git add .              # 暂存
git commit -m "msg"                     # 提交
git commit --amend -m "new"             # 修改最近提交
git diff                                # 工作区改动
git diff --cached                       # 暂存区改动
git show <commit-id>                    # 查看某次提交
```

### 分支与标签

```bash
git branch / git branch -a              # 列出分支
git switch -c <name>                    # 创建并切换
git switch <name>                       # 切换
git branch -d <name>                    # 删除分支
git merge <branch> / --no-ff / --squash # 合并
git rebase <branch>                     # 变基
git rebase -i HEAD~3                    # 交互式整理
git cherry-pick <commit-id>             # 搬运提交
git tag -a v1.0.0 -m "desc"             # 打标签
git push origin --tags                  # 推送标签
```

### 撤销与历史

```bash
git log --oneline --graph --all         # 提交图谱
git reflog                              # 操作历史
git reset --soft HEAD^                  # 撤销提交保留暂存
git reset --mixed HEAD^                 # 撤销提交保留工作区
git reset --hard HEAD^                  # 彻底回退
git revert <commit-id>                  # 安全撤销已推送提交
git restore <file>                      # 还原工作区文件
git restore --staged <file>             # 取消暂存
git clean -fd                           # 清理未跟踪文件
git blame <file>                        # 逐行追责
git bisect start ... reset              # 二分定位 bug
```

### 远程协作

```bash
git remote -v                           # 查看远程
git remote add origin <url>             # 添加远程
git remote set-url origin <url>         # 修改远程地址
git fetch origin                        # 拉取不合并
git pull --rebase                       # 拉取并变基
git push -u origin <branch>             # 首次推送
git push --force-with-lease             # 安全强推
git push origin --delete <branch>       # 删除远程分支
```

### 现场保存与恢复

```bash
git stash / git stash -u                # 暂存现场
git stash list                          # 查看
git stash pop                           # 恢复并删除
git stash apply stash@{0}               # 恢复保留
git stash drop stash@{0}                # 删除
```

### 高级功能

```bash
git worktree add ../dir <branch>        # 多工作区
git submodule add <url> <dir>           # 添加子模块
git sparse-checkout set <dir>           # 稀疏检出
git lfs track "*.zip"                   # 大文件管理
git bundle create repo.bundle --all     # 离线备份
git archive -o project.zip HEAD         # 导出当前版本
git grep "keyword"                      # 仓库内搜索
git shortlog -sn                        # 按作者统计
```

---

## ✅ 本章小结

- 面试高频概念：merge vs rebase、reset 三模式、revert vs reset、reflog 找提交、stash、detached HEAD、cherry-pick。
- 答题技巧：先给结论，再讲区别，最后补充一个命令示例，显得有实战经验。
- 速查表覆盖日常 90% 场景，建议存为书签随时翻阅。

> 回到 [README.md](../README.md) 查看全部章节。