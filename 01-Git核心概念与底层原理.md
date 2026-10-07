# 第一章 Git 核心概念与底层原理

> 学 Git 首先要理解它的「数据模型」，而不是死记命令。本章带你打通工作区、暂存区、版本库的三大区域模型，并深入 Git 的对象存储原理。地基打牢了，后面的高阶操作就都能理解「为什么」了。

---

## 1.1 Git 是什么？为什么它比 SVN 强？

- **分布式**：每个开发者本地都有一份完整的仓库副本（含全部历史），离线也能提交、查历史，网络只是同步工具。
- **快照而非差异**：SVN 记录「每行的差异」，Git 记录「每个版本的完整快照」，只是用智能算法压缩存储。
- **强大的分支**：Git 的分支本质上只是一个「指针」，创建/切换分支极其廉价，鼓励分支开发。
- **数据完整性**：所有对象通过 SHA-1（新版已迁移 SHA-256 支持）哈希校验，内容被篡改可被检测。

## 1.2 三大区域模型（最重要，没有之一）

```
        git add                 git commit
  ┌────────────┐    ┌────────────┐    ┌────────────┐
  │  工作区     │ ──►│  暂存区     │ ──►│  版本库     │
  │ (Working   │    │ (Index/     │    │ (Repository│
  │  Directory)│    │  Staging)   │    │  .git)     │
  └────────────┘    └────────────┘    └────────────┘
        ▲                 ▲                  ▲
  git checkout .   git restore --staged   git reset --soft
```

| 区域 | 是什么 | 关键命令 |
| --- | --- | --- |
| 工作区 | 你正在编辑的文件夹 | `git status` 查看改动 |
| 暂存区（Index） | 临时存放「将要提交」的内容，快照的集合 | `git add` 放入，`git restore --staged` 取出 |
| 版本库 | `.git` 目录，存所有历史提交和对象 | `git commit` 生成永久快照 |

**记忆口诀**：`add` 把改动装进暂存区，`commit` 把暂存区快照固化进历史，`checkout/reset` 从历史/暂存区把内容取回工作区。

## 1.3 HEAD、分支、标签（Tag）

- **HEAD**：一个特殊的指针，指向「当前所在分支」的最新提交。HEAD 指向谁，你就在哪个版本上工作。
  ```bash
  git cat-file -p HEAD          # 查看 HEAD 指向的提交内容
  git rev-parse HEAD            # 输出 HEAD 对应的完整 40 位哈希
  ```
- **分支（branch）**：指向某个提交的可移动指针。创建分支只是新增一个指针，所以极快。
- **标签（tag）**：指向某个提交的「不可移动」指针，常用来标记发布版本（v1.0.0）。
- **分离头指针（Detached HEAD）**：当 HEAD 直接指向某个提交而非分支时（如 `git checkout <commit-id>`），处于分离状态，此时新提交不会被任何分支引用，容易丢失，需要小心。

## 1.4 Git 对象模型：blob / tree / commit / tag

Git 的核心是一个**内容寻址文件系统**，一切对象都以其内容的 SHA-1 哈希作为文件名存入 `.git/objects`。

### 四种对象

| 对象 | 含义 | 存储内容 |
| --- | --- | --- |
| `blob` | 文件内容 | 一个文件的内容（不含文件名） |
| `tree` | 目录快照 | 记录目录下有哪些文件名/权限，分别指向 blob 或子树 |
| `commit` | 一次提交 | 作者、提交者、时间、提交信息、指向一棵 tree 和父 commit 的指针 |
| `tag` | 轻量/附注标签 | 指向某个 commit（附注标签还可存标签信息） |

### 一次提交在底层长这样

```
commit 9f7a8b2c... (指向 HEAD)
  父提交: a1b2c3d4...
  作者: Alice <alice@example.com>
  提交信息: fix: 修复登录 bug
      │
      ▼
    tree 5e3d9f1a...   ← 项目根目录快照
      ├── src/
      │    └── app.js ──► blob (文件内容)
      ├── README.md ──► blob
      └── package.json ──► blob
```

### 手动查看对象

```bash
git cat-file -t <hash>      # 查看对象类型（blob/tree/commit）
git cat-file -p <hash>      # 查看对象内容
git ls-tree HEAD            # 查看 HEAD 对应的目录树
git ls-files                # 查看暂存区（Index）中的文件列表
```

## 1.5 `.git` 目录结构

```bash
.git/
├── HEAD              # 当前 HEAD 指向的分支（如 ref: refs/heads/main）
├── config            # 本仓库的配置（用户、远程、别名等）
├── index             # 暂存区（Index）的二进制文件
├── objects/          # 对象数据库（按哈希前两位分目录存放）
│   ├── 5e/3d9f1a...  # 实际对象文件
│   ├── info/
│   └── pack/         # 打包后的对象（减少体积）
├── refs/
│   ├── heads/        # 本地分支指针
│   ├── tags/         # 标签指针
│   └── remotes/      # 远程分支指针
└── logs/             # reflog 操作日志
```

## 1.6 配置管理（config）

Git 有三层配置，优先级从低到高：**系统级 < 用户级 < 仓库级**。

```bash
# 系统级（影响所有用户）
git config --system user.name "Alice"
# 用户级（影响当前用户所有仓库）—— 最常用
git config --global user.name "Alice"
git config --global user.email "alice@example.com"
# 仓库级（只影响当前仓库，优先级最高）
git config --local user.name "Alice"

# 查看配置
git config --list                     # 列出所有生效配置
git config --global --list            # 只看用户级
git config user.name                  # 查看某一项
```

### 推荐一劳永逸的全局配置

```bash
git config --global user.name "你的名字"
git config --global user.email "你的邮箱"
git config --global init.defaultBranch main          # 默认分支改为 main
git config --global core.autocrlf true               # Windows 换行符自动转换
git config --global pull.rebase false                # pull 默认用 merge
git config --global push.autoSetupRemote true        # 推送时自动建立关联
git config --global color.ui auto                    # 彩色输出
```

## 1.7 基础命令串一遍（进阶前的热身）

```bash
git init                          # 初始化仓库
git status                        # 查看状态（-s 简洁模式）
git add <file> / git add .        # 暂存指定/全部文件
git commit -m "feat: 描述"        # 提交
git diff                          # 工作区 vs 暂存区 的差异
git diff --cached                 # 暂存区 vs 上次提交 的差异
git diff HEAD                     # 工作区 vs 上次提交 的差异
git log --oneline                 # 简洁历史
git show <commit-id>              # 查看某次提交的完整改动
```

## 1.8 常见误区

1. **`git commit` 提交的是暂存区内容**，工作区里新增但没 `git add` 的改动不会被提交。
2. **`git pull` = `git fetch` + `git merge`**，它先下载远程更新，再合并到当前分支。
3. **`.gitignore` 只对未跟踪文件生效**，已被跟踪的文件改动不受 ignore 影响，需先 `git rm --cached <file>` 解除跟踪。
4. **删除文件要用 `git rm`** 或删除后 `git add -A`，直接删文件 Git 也会标记为 deleted。

---

## ✅ 本章小结

- 三大区域：工作区 →（add）→ 暂存区 →（commit）→ 版本库。
- 四种对象：blob（文件内容）、tree（目录）、commit（提交）、tag（标签）。
- 分支是指针、HEAD 是当前所在位置、reflog 是操作后悔药。
- 配置优先级：仓库级 > 用户级 > 系统级。

> 下一章：[02-分支管理与合并策略.md](./02-分支管理与合并策略.md)，学习分支的进阶玩法和团队工作流。