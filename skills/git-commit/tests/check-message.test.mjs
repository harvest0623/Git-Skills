// check-message.mjs 的单元测试：10 个用例，正样本与反样本各半。
// 运行：node --test skills/git-commit/tests/check-message.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkMessage } from '../scripts/check-message.mjs';

test('合法的 feat 带 scope 通过', () => {
    const result = checkMessage('feat(login): 新增短信验证码登录');
    assert.equal(result.ok, true);
    assert.equal(result.parsed.type, 'feat');
    assert.equal(result.parsed.scope, 'login');
});

test('合法的 fix 不带 scope 通过', () => {
    const result = checkMessage('fix: 修复结算金额精度问题');
    assert.equal(result.ok, true);
    assert.equal(result.parsed.scope, null);
});

test('合法的破坏性变更标记 ! 通过', () => {
    const result = checkMessage('feat(api)!: 移除旧的用户查询接口');
    assert.equal(result.ok, true);
    assert.equal(result.parsed.breaking, true);
});

test('未知 type 被拒绝', () => {
    const result = checkMessage('feature: 新增导出功能');
    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, 'TYPE_NOT_ALLOWED');
});

test('大写 type 被拒绝', () => {
    const result = checkMessage('Feat: 新增登录入口');
    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, 'TYPE_NOT_LOWERCASE');
});

test('subject 超过 50 字符被拒绝', () => {
    const result = checkMessage(`fix(cart): ${'修复结算金额精度问题'.repeat(6)}`);
    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, 'SUBJECT_TOO_LONG');
});

test('subject 以句号结尾被拒绝', () => {
    const result = checkMessage('fix: 修复结算金额精度问题。');
    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, 'SUBJECT_ENDS_WITH_PERIOD');
});

test('缺少冒号的格式错误被拒绝', () => {
    const result = checkMessage('feat 新增登录功能');
    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, 'FORMAT_INVALID');
});

test('首行与正文之间没有空行被拒绝', () => {
    const result = checkMessage('fix: 修复空指针\n第二行直接接了正文');
    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, 'BODY_SEPARATOR');
});

test('无信息量的 subject 被拒绝', () => {
    const result = checkMessage('chore: update');
    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, 'VAGUE_SUBJECT');
});
