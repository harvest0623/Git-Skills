# 提交信息规则

## 格式

```
<type>(<scope>)!: <subject>

<body>

<footer>
```

括号里的 `scope`、感叹号、`body`、`footer` 都是可选的。只有 `type` 和 `subject` 必填。

## type 白名单

| type | 用于 | 示例 |
| --- | --- | --- |
| `feat` | 新增功能 | `feat(login): 新增短信验证码登录` |
| `fix` | 修复缺陷 | `fix(cart): 修复结算金额精度问题` |
| `docs` | 只改文档 | `docs(readme): 补充安装步骤` |
| `style` | 格式化、空格、分号，不改逻辑 | `style: 统一缩进为 4 空格` |
| `refactor` | 重构，行为不变 | `refactor(api): 拆分用户服务` |
| `test` | 增删改测试 | `test: 补充 checkout 边界测试` |
| `chore` | 构建、依赖、配置等杂务 | `chore: 升级依赖版本` |
| `perf` | 性能优化 | `perf(query): 减少一次全表扫描` |
| `ci` | CI 配置 | `ci: 增加 Node 20 构建任务` |
| `build` | 构建系统、打包 | `build: 切换为 esbuild` |
| `revert` | 撤销某次提交 | `revert: 撤销 feat(login) 的改动` |

`type` 必须小写。不确定时按"改动的目的"选，而不是按"改了哪个文件"选。

## subject

- 不超过 **50 字符**，整行不超过 **72 字符**
- 结尾不加句号
- 说明做了什么，不写"更新""修改代码""提交一下"这类无法区分内容的话
- 中英文都可以，但要与仓库既有风格一致

## scope

- 写受影响的模块，例如 `login`、`cart`、`api`
- 不写文件名，不写路径
- 只用小写字母、数字、连字符

## body

只在需要解释**为什么**改时写。改了什么，diff 已经说明，不必复述。

```
fix(cart): 修复优惠券与积分同时使用时金额为负

两处折扣分别计算后未取最小值，叠加时会产生负数。
改为先合并折扣率再统一计算。
```

## footer

关联 issue 或说明破坏性变更：

```
feat(api)!: 移除 v1 用户查询接口

BREAKING CHANGE: /api/v1/user 已删除，请迁移到 /api/v2/users。
Closes #128
```
