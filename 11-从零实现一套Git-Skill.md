# 第十一章 从零实现一套 Git Skill

> 前十一章教你 Git 怎么用，这一章教你把 Git 知识封装成 AI 能可靠执行的工具。本章全部代码都在 [`skills/`](./skills/) 目录里，边读边改是最好的学习方式。

## 11.1 从"一个提交技能"到"一套技能"

最朴素的 Git 提交 Skill 只有一句话：读 `git diff`，让模型编一条提交信息。它能跑，但暴露了三个问题：

| 问题 | 具体表现 |
| --- | --- |
| 违背单一职责 | 把提交、改写、撤销塞进一个技能，description 必然含糊，触发准确率下降 |
| 上下文成本失控 | 技能一旦被加载就占用上下文，包揽全部 Git 操作要写几百行，每次只用得上一小段 |
| 风险等级错配 | `commit` 失败重来即可，`reset --hard` 会丢代码，两类操作不可能共用一套确认策略 |

所以本章交付的不是一个 Skill，而是三个职责互斥的技能：

| 技能 | 处理什么 | 最高风险 |
| --- | --- | --- |
| [`git-commit`](./skills/git-commit/SKILL.md) | 创建新提交 | L2 |
| [`git-revise`](./skills/git-revise/SKILL.md) | 改写已有提交 | L3 |
| [`git-undo`](./skills/git-undo/SKILL.md) | 撤销、回退、找回 | L3 |

## 11.2 拆分判据：意图边界、上下文成本、风险等级

不要按命令数量拆分，而要按下面三条判断。

### 判据一：意图边界

用户说一句话时，只应当命中一个技能。

- "帮我提交" → `commit`
- "改一下上次提交信息" → `revise`
- "撤销刚才的提交" → `undo`

`commit` 与 `undo` 都涉及提交，但一个是"创建"，一个是"取消"，互斥。而"分块暂存"虽然是一条独立命令，却是提交的前置步骤，并进 `commit` 不拆。

### 判据二：上下文成本

单个 `SKILL.md` 控制在 100 行内。超出的细节放进 `references/`，按需加载。

三份技能合计约 300 行；如果合成一个技能，就是 300 行全量加载，而每次实际用得上的可能只有 50 行。

### 判据三：风险等级

同等级才能进同一个技能。`commit` 与 `undo` 无论实现多相似都必须拆，因为确认强度不同。

## 11.3 目录约定与 frontmatter

三个技能采用完全同构的结构：

```
skills/git-commit/
├── SKILL.md              # 主入口
├── scripts/              # 确定性逻辑
├── references/           # 按需加载的知识
└── tests/                # 可测试性
```

`SKILL.md` 的 frontmatter 只有两个字段：

```yaml
---
name: git-commit
description: 根据当前仓库的改动生成符合 Conventional Commits 的提交信息并完成提交。当用户说「帮我提交代码」「写个 commit message」「这次改动该怎么提交」「把改动交上去」时使用。不负责修改已有提交。
---
```

`name` 必须与目录名一致——平台按目录加载，名字对不上会导致引用失效。`description` 是唯一的路由依据，下一节专门讲。

## 11.4 description 才是路由器

很多 Skill 不触发，根源在 description 写成了简介而不是触发条件。

```yaml
# 反例：介绍"我是什么"
description: 一个强大的 Git 提交辅助工具，支持多种提交规范。
```

模型在决定是否加载技能时，比对的是"用户这句话像不像 description 描述的场景"。上面这句没有场景，永远匹配不上。

```yaml
# 正例：写"什么时候用我"
description: 根据当前仓库的改动生成符合 Conventional Commits 的提交信息并完成提交。当用户说「帮我提交代码」「写个 commit message」时使用。
```

三个技能之间还要显式划界。`git-revise` 的结尾是"不负责撤销或丢弃提交"，`git-undo` 的结尾是"不负责修改提交内容"。这两句不是客套，是防止两个技能的触发范围互相侵占。

## 11.5 多技能共存时的触发冲突

技能越多，越容易出现"一句话同时像两个技能"。上线前必须跑测试矩阵：

| 用户输入 | 应命中 | 不应命中 |
| --- | --- | --- |
| 帮我提交代码 | `commit` | — |
| 这次改动该怎么提交 | `commit` | — |
| 改一下上次提交信息 | `revise` | `undo` |
| 把刚才漏的文件补到上一个提交里 | `revise` | `commit` |
| 撤销刚才的提交 | `undo` | `revise` |
| 推错了，怎么撤回远程 | `undo` | — |
| 提交丢了还能找回吗 | `undo` | — |
| 解释一下这段提交历史 | 三个都不触发 | — |
| 提交代码，顺便把上次的信息也改一下 | 提示拆分，不自行混做 | — |

最后两行最有价值：一行证明**能识别不该触发的场景**，一行证明**多意图请求的处理策略**。

## 11.6 渐进式披露与上下文预算

技能不是一次性全读进上下文的。真实加载分三层：

```
第一层：启动时只加载 name + description（几十 token）
   ↓ 命中后
第二层：加载 SKILL.md 正文（约 100 行）
   ↓ 需要细节时
第三层：按需读取 references/ 下的某个文件
```

对应到本项目：

- `SKILL.md` 只放流程、边界、决策表
- `references/message-rules.md` 放 type 白名单这类查表内容
- `references/recovery.md` 只在找回场景才读

如果把这些全部塞进 `SKILL.md`，每次提交都要为"找回丢失提交"的知识付费。

## 11.7 同构骨架：诊断 → 判断 → 执行

三个技能的流程完全一样：

```
用户请求
  ↓ description 路由
读取 SKILL.md
  ↓
诊断脚本（只读）→ 输出 JSON 事实
  ↓
模型判断（概率性）
  ↓
校验脚本（确定性）
  ↓
用户确认
  ↓
执行脚本（默认 dry-run）
```

这条链条里有两个关键分工：

- **脚本负责事实**：分支、是否已推送、diff 内容、格式是否合规
- **模型负责判断**：这次改动在做什么、该用哪个 type、是否该拆分

反过来做的典型失败：让模型自己跑 `git branch -r --contains` 判断是否已推送。模型可能记错参数，而脚本不会。

## 11.8 三级安全模型

| 级别 | 操作 | 策略 |
| --- | --- | --- |
| L1 只读 | `status` `log` `diff` `blame` | 直接执行，不询问 |
| L2 本地可逆 | `add` `commit` `amend`（未推送）`stash` | 展示完整命令 + 一次确认 |
| L3 破坏性或影响他人 | `reset --hard` `rebase` 改写已推送历史 | 备份引用 + 二次确认 |

L3 的备份不是提示词里的建议，而是写进脚本执行计划的第一步：

```js
if (options.mode === 'hard') {
    riskLevel = 'L3';
    const backupBranch = uniqueBranchName('backup');
    plan.push(['branch', backupBranch]);
}
plan.push(['reset', `--${options.mode}`, options.target]);
```

已推送的提交则直接拒绝：

```js
if (options.action === 'reset' && pushed.pushed && !options.allowPushed) {
    return fail('ALREADY_PUSHED', '目标提交已推送，请改用 revert；确需改写历史请加 --allow-pushed');
}
```

这类规则必须落在代码里。写在提示词里，模型仍有一半概率"忘记"。

## 11.9 脚本契约：结构化错误与退出码

模型消费脚本输出的方式很有限：看退出码、读 stdout。所以这两样必须稳定。

| 脚本 | 退出码 0 | 退出码 1 | 退出码 2 | 退出码 3 |
| --- | --- | --- | --- | --- |
| `collect-context.mjs` | 有变更 | 异常 | 非 Git 仓库 | 无任何变更 |
| `check-message.mjs` | 校验通过 | 校验失败 | — | — |
| `amend.mjs` | 成功或 dry-run | 被安全规则拦截 | 非 Git 仓库 | — |
| `undo.mjs` | 成功或 dry-run | 被安全规则拦截 | 非 Git 仓库 | — |

失败时统一输出：

```json
{
  "ok": false,
  "errors": [
    { "code": "ALREADY_PUSHED", "message": "目标提交已推送到 origin/main，请改用 revert" }
  ]
}
```

`code` 是给模型用来决定下一步的，`message` 是给人看的。只有 message 没有 code，模型就只能瞎猜。

## 11.10 三个脚本的关键实现

### 11.10.1 `collect-context.mjs`：预算内给足信息

diff 按文件分块累加，超预算的文件只记名字：

```js
const chunks = diff.split(/(?=diff --git )/).filter((chunk) => chunk.trim());
for (const chunk of chunks) {
    const name = chunk.match(/^diff --git a\/(.+?) /)?.[1] || 'unknown';
    if (used + chunk.length > MAX_DIFF_CHARS) {
        omitted.push(name);
        continue;
    }
    kept.push(chunk);
    used += chunk.length;
}
```

为什么不是简单截断？因为模型需要知道"还有哪些文件没看到"，否则会误判改动范围。

### 11.10.2 `check-message.mjs`：纯函数 + 薄 CLI

校验逻辑写成纯函数，CLI 只是外壳：

```js
export function checkMessage(text) { /* 返回 { ok, errors, parsed } */ }

const invoked = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === invoked) runCli();
```

好处是不启子进程就能单测。`tests/check-message.test.mjs` 里的 10 个用例全部直接调用纯函数。

`pathToFileURL` 这一行是 Windows 兼容的关键：直接用字符串比较 `file://` 路径会因为盘符大小写和斜杠方向而失配。

### 11.10.3 `assess-risk.mjs`：先给事实，再给建议

```js
const contains = git(['branch', '-r', '--contains', sha], { allowFail: true });
const pushedTo = parseRemoteBranches(contains.out);
const alreadyPushed = pushedTo.length > 0;
```

`-r` 不能漏。少了它查的只是本地分支，结论会完全反。

输出里的 `advice` 只是建议，真正的决策仍由 `SKILL.md` 里的决策表完成。

### 11.10.4 `undo.mjs`：计划与执行分离

所有动作先构建成 `plan` 数组，dry-run 直接打印，`--execute` 才逐步执行：

```js
const plan = [];
if (options.action === 'reset' && options.mode === 'hard') {
    plan.push(['branch', uniqueBranchName('backup')]);
}
plan.push(['reset', `--${options.mode}`, options.target]);
```

计划与执行分离带来两个好处：dry-run 的输出与真实执行完全一致；执行失败时能精确知道卡在哪一步。

## 11.11 自包含 vs 共享库

三个技能里都有几乎相同的 `isPushed` 实现，约 10 行，重复了三份：

```js
function isPushed(sha) {
    const contains = runGit(['branch', '-r', '--contains', sha]);
    if (!contains.ok) return { pushed: false, branches: [] };
    const branches = contains.stdout.split('\n')
        .map((line) => line.replace(/^\*?\s*/, '').trim())
        .filter((line) => line && !line.includes('->'));
    return { pushed: branches.length > 0, branches };
}
```

抽一个 `shared/git.mjs` 看起来更优雅，但会引入两个问题：

1. 多数平台按目录加载技能，跨目录 `import '../shared/git.mjs'` 在复制安装后会失效
2. 多了一层构建或路径解析，读者要花时间理解工程细节，而不是 Skill 原理

结论：**重复 10 行，换来自包含**。判断标准是"复制单个目录能否独立运行"，能就可以接受重复。

## 11.12 踩坑清单

| 坑 | 现象 | 正确做法 |
| --- | --- | --- |
| description 写成简介 | 技能从不触发 | 写用户会说的原话 |
| 脚本用相对路径 | 换个工作目录就找不到文件 | 执行前确认技能目录，或用绝对路径 |
| `node --test` 传目录 | Node 24 报 `Cannot find module` | 直接指定测试文件 |
| PowerShell 写文件带 BOM | 首行多出不可见字符，格式校验失败 | 脚本里剥离 `\uFEFF` |
| 校验只打印错误不设退出码 | 模型以为通过，继续提交 | 失败时 `process.exitCode = 1` |
| 用 `git branch --contains` | 只查本地分支，已推送判断错误 | 加 `-r` 查远程分支 |

BOM 那条在处理时写成：

```js
const normalized = text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n+$/, '');
```

## 11.13 安装与触发验证

把单个技能目录复制到平台的技能目录即可，目录名就是技能名：

```powershell
# Windows PowerShell
Copy-Item -Recurse skills\git-commit $HOME\.trae-cn\skills\
Copy-Item -Recurse skills\git-revise $HOME\.trae-cn\skills\
Copy-Item -Recurse skills\git-undo   $HOME\.trae-cn\skills\
```

```bash
# macOS / Linux
cp -r skills/git-commit skills/git-revise skills/git-undo ~/.trae-cn/skills/
```

复制后重启会话，再用 11.5 的测试矩阵逐条验证。先验证"不触发"的用例，再验证"触发"的用例——误触发的代价比不触发更高。

## 11.14 故意改坏的四个练习

先改坏，观察现象，再改回来。这比照着抄一遍有效。

### 练习一：让技能失效

把 `git-commit/SKILL.md` 的 description 改成：

```yaml
description: 一个强大的 Git 提交辅助工具。
```

预期：说"帮我提交代码"不再触发。思考：模型凭什么判断该不该加载它？

### 练习二：让上下文爆炸

把 `collect-context.mjs` 里的 `MAX_DIFF_CHARS` 改成 `1e9`，然后在一个大仓库里运行。

预期：脚本输出变得极大，模型开始漏看关键文件。思考：预算控制应该在脚本层还是提示词层？

### 练习三：让校验形同虚设

在 `check-message.mjs` 里把 `process.exitCode = 1` 改成 `console.log('校验失败')`。

预期：非法信息也会被提交。思考：为什么退出码比错误文案更重要？

### 练习四：拆掉安全护栏

删掉 `undo.mjs` 里 `alreadyPushed` 的拦截，对已推送的提交执行 `reset --hard`。

预期：本地历史与远程分叉，必须 force push 才能恢复。思考：这条规则为什么不能只写在 `SKILL.md` 里？

## 11.15 本章小结

一套可靠的 Git Skill，靠的不是更长的提示词，而是四件事：

1. **路由正确**：description 写场景，技能之间显式互斥
2. **事实先行**：只读脚本先给出 JSON，模型再判断
3. **确定性下沉**：校验、路径、退出码、安全拦截全部写成代码
4. **默认安全**：dry-run 先行，L3 备份，已推送直接拦截

把这四条迁移到你自己的领域，就是一套新的 Skill。
