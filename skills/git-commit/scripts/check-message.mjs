// 提交信息校验：纯函数 + 一层很薄的 CLI。
// 纯函数部分可单元测试，CLI 部分只负责读写与退出码。
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const TYPES = new Set([
    'feat',
    'fix',
    'docs',
    'style',
    'refactor',
    'test',
    'chore',
    'perf',
    'ci',
    'build',
    'revert',
]);

const MAX_SUBJECT = 50;
const MAX_HEADER = 72;

// 无法区分内容的表述，直接拒绝
const VAGUE_SUBJECTS = new Set(['update', 'updates', '修改', '修改代码', '提交', '提交一下', '改动', '更新']);

const HEADER_RE = /^([A-Za-z]+)(?:\(([^)]*)\))?(!)?: (.+)$/;

export const RULES = { TYPES: [...TYPES], MAX_SUBJECT, MAX_HEADER, VAGUE_SUBJECTS: [...VAGUE_SUBJECTS] };

export function checkMessage(text) {
    const errors = [];
    const push = (code, message, value) => {
        errors.push(value === undefined ? { code, message } : { code, message, value });
    };

    if (typeof text !== 'string' || !text.trim()) {
        push('EMPTY_MESSAGE', '提交信息为空');
        return { ok: false, errors };
    }

    // 兼容 Windows 下带 BOM 的文本文件
    const normalized = text
        .replace(/^\uFEFF/, '')
        .replace(/\r\n/g, '\n')
        .replace(/\n+$/, '');
    const lines = normalized.split('\n');
    const header = lines[0];
    const body = lines.length > 2 ? lines.slice(2).join('\n').trim() : '';

    // 首行与正文之间必须有空行
    if (lines.length > 1 && lines[1] !== '') {
        push('BODY_SEPARATOR', '首行与正文之间必须有一个空行');
    }

    if ([...header].length > MAX_HEADER) {
        push('HEADER_TOO_LONG', `首行长度 ${[...header].length} 超过 ${MAX_HEADER} 字符`, header);
    }

    const matched = header.match(HEADER_RE);
    if (!matched) {
        push('FORMAT_INVALID', '首行必须是 <type>(<scope>): <subject> 格式，且冒号后跟一个空格');
        return { ok: false, errors };
    }

    const [, type, scope, breaking, subject] = matched;

    if (type !== type.toLowerCase()) {
        push('TYPE_NOT_LOWERCASE', `type 必须小写，收到 "${type}"`, type);
    } else if (!TYPES.has(type)) {
        push('TYPE_NOT_ALLOWED', `type "${type}" 不在白名单：${[...TYPES].join(', ')}`, type);
    }

    if (scope !== undefined) {
        if (scope.trim() === '') {
            push('SCOPE_EMPTY', 'scope 不能为空，不需要 scope 时请写成 feat: ...');
        } else if (!/^[a-z0-9-]+$/.test(scope)) {
            push('SCOPE_INVALID', `scope "${scope}" 只能包含小写字母、数字和连字符`, scope);
        }
    }

    const subjectLength = [...subject].length;
    if (subjectLength > MAX_SUBJECT) {
        push('SUBJECT_TOO_LONG', `subject 长度 ${subjectLength} 超过 ${MAX_SUBJECT} 字符`, subject);
    }
    if (/[.。]$/.test(subject)) {
        push('SUBJECT_ENDS_WITH_PERIOD', 'subject 结尾不要加句号', subject);
    }
    if (VAGUE_SUBJECTS.has(subject.trim().toLowerCase())) {
        push('VAGUE_SUBJECT', `subject "${subject}" 无法区分改动内容，请具体描述做了什么`, subject);
    }

    return {
        ok: errors.length === 0,
        errors,
        parsed: {
            type,
            scope: scope === undefined ? null : scope,
            breaking: Boolean(breaking),
            subject,
            body,
        },
    };
}

function emit(result, exitCode) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = exitCode;
}

function runCli() {
    const args = process.argv.slice(2);
    const flagIndex = args.indexOf('--message-file');
    const file = flagIndex === -1 ? null : args[flagIndex + 1];

    if (!file) {
        emit(
            {
                ok: false,
                errors: [
                    { code: 'MISSING_ARGUMENT', message: '用法：node check-message.mjs --message-file <path>' },
                ],
            },
            1,
        );
        return;
    }

    let content;
    try {
        content = fs.readFileSync(file, 'utf8');
    } catch {
        emit({ ok: false, errors: [{ code: 'FILE_NOT_FOUND', message: `无法读取文件：${file}` }] }, 1);
        return;
    }

    const result = checkMessage(content);
    emit(result, result.ok ? 0 : 1);
}

const invoked = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === invoked) runCli();
