// 执行提交：先暂存指定文件，再按给定的提交信息创建提交。
// 默认 dry-run；执行前会再做一次格式校验，避免绕过 check-message。
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkMessage } from './check-message.mjs';

function runGit(args) {
    const res = spawnSync('git', ['-c', 'core.quotepath=false', ...args], {
        cwd: process.cwd(),
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
    });
    return {
        ok: res.status === 0,
        stderr: (res.stderr || '').trim(),
        stdout: (res.stdout || '').trim(),
    };
}

function quote(arg) {
    return /\s/.test(arg) ? `"${arg}"` : arg;
}

function formatCommand(args) {
    return `git ${args.map(quote).join(' ')}`;
}

function parseArgs(argv) {
    const options = { messageFile: null, files: [], execute: false, error: null };

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        const next = () => argv[i + 1];

        if (arg === '--message-file') {
            options.messageFile = next();
            i += 1;
        } else if (arg === '--files') {
            options.files = (next() || '')
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean);
            i += 1;
        } else if (arg === '--execute') {
            options.execute = true;
        } else {
            options.error = `未知参数：${arg}`;
            break;
        }
    }

    return options;
}

// 明显的敏感文件直接拒绝入库，模板文件除外
function isSensitive(file) {
    const base = path.basename(file).toLowerCase();
    if (base === '.env' || base.startsWith('.env.')) {
        return !/\.(example|sample|template)$/.test(base);
    }
    return /\.(pem|key|p12|pfx)$/.test(base) || base === 'id_rsa' || base.startsWith('id_rsa.');
}

function fail(code, message) {
    return { code: 1, payload: { ok: false, errors: [{ code, message }] } };
}

function main() {
    const inside = runGit(['rev-parse', '--is-inside-work-tree']);
    if (!inside.ok) {
        return {
            code: 2,
            payload: { ok: false, error: 'NOT_A_GIT_REPO', message: '当前目录不是 Git 工作区' },
        };
    }

    const options = parseArgs(process.argv.slice(2));
    if (options.error) return fail('INVALID_ARGUMENT', options.error);
    if (!options.messageFile) return fail('MISSING_ARGUMENT', '缺少 --message-file');

    if (!fs.existsSync(options.messageFile)) {
        return fail('MESSAGE_FILE_NOT_FOUND', `找不到提交信息文件：${options.messageFile}`);
    }

    const content = fs.readFileSync(options.messageFile, 'utf8');
    const checked = checkMessage(content);
    if (!checked.ok) {
        return { code: 1, payload: { ok: false, errors: checked.errors } };
    }

    const missing = options.files.filter((file) => !fs.existsSync(file));
    if (missing.length > 0) {
        return fail('FILE_NOT_FOUND', `以下文件不存在：${missing.join(', ')}`);
    }

    const sensitive = options.files.filter(isSensitive);
    if (sensitive.length > 0) {
        return fail('SENSITIVE_FILE', `拒绝提交敏感文件：${sensitive.join(', ')}；如确需提交请先与用户确认`);
    }

    const plan = [];
    if (options.files.length > 0) {
        plan.push(['add', '--', ...options.files]);
    }
    plan.push(['commit', '-F', options.messageFile]);

    const commands = plan.map(formatCommand);

    if (!options.execute) {
        return {
            code: 0,
            payload: { ok: true, dryRun: true, files: options.files, parsed: checked.parsed, commands },
        };
    }

    const executed = [];
    for (const command of plan) {
        const result = runGit(command);
        executed.push({ command: formatCommand(command), ok: result.ok, stderr: result.stderr });
        if (!result.ok) {
            return {
                code: 1,
                payload: {
                    ok: false,
                    dryRun: false,
                    errors: [
                        {
                            code: 'COMMAND_FAILED',
                            message: `${formatCommand(command)} 执行失败：${result.stderr}`,
                        },
                    ],
                    executed,
                },
            };
        }
    }

    const head = runGit(['rev-parse', '--short', 'HEAD']);
    return {
        code: 0,
        payload: {
            ok: true,
            dryRun: false,
            commit: head.ok ? head.stdout : null,
            executed,
        },
    };
}

function runCli() {
    try {
        const { code, payload } = main();
        process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
        process.exitCode = code;
    } catch (error) {
        process.stderr.write(`${JSON.stringify({ ok: false, error: 'UNEXPECTED', message: error.message })}\n`);
        process.exitCode = 1;
    }
}

const invoked = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === invoked) runCli();
