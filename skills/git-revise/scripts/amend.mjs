// 改写上一次提交：换提交信息、补入遗漏文件，或两者同时做。
// 默认 dry-run；已推送的提交需要 --allow-pushed 才允许改写。
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

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
    const options = {
        messageFile: null,
        add: [],
        execute: false,
        allowPushed: false,
        error: null,
    };

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        const next = () => argv[i + 1];

        if (arg === '--message-file') {
            options.messageFile = next();
            i += 1;
        } else if (arg === '--add') {
            options.add = (next() || '')
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean);
            i += 1;
        } else if (arg === '--execute') {
            options.execute = true;
        } else if (arg === '--allow-pushed') {
            options.allowPushed = true;
        } else {
            options.error = `未知参数：${arg}`;
            break;
        }
    }

    return options;
}

function detectInProgress(gitDirAbs) {
    if (
        fs.existsSync(path.join(gitDirAbs, 'rebase-merge')) ||
        fs.existsSync(path.join(gitDirAbs, 'rebase-apply'))
    ) {
        return 'rebase';
    }
    const markers = [
        ['MERGE_HEAD', 'merge'],
        ['CHERRY_PICK_HEAD', 'cherry-pick'],
        ['REVERT_HEAD', 'revert'],
    ];
    for (const [file, state] of markers) {
        if (fs.existsSync(path.join(gitDirAbs, file))) return state;
    }
    return null;
}

function isPushed(sha) {
    const contains = runGit(['branch', '-r', '--contains', sha]);
    if (!contains.ok) return { pushed: false, branches: [] };
    const branches = contains.stdout
        .split('\n')
        .map((line) => line.replace(/^\*?\s*/, '').trim())
        .filter((line) => line && !line.includes('->'));
    return { pushed: branches.length > 0, branches };
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

    if (!options.messageFile && options.add.length === 0) {
        return fail('MISSING_ARGUMENT', '至少需要 --message-file 或 --add 其中之一');
    }

    const headCheck = runGit(['rev-parse', '--verify', 'HEAD']);
    if (!headCheck.ok) {
        return fail('NO_COMMIT', '当前仓库还没有任何提交，无法 amend');
    }
    const sha = headCheck.stdout;

    const gitDir = runGit(['rev-parse', '--git-dir']).stdout;
    const gitDirAbs = path.resolve(process.cwd(), gitDir);

    const inProgress = detectInProgress(gitDirAbs);
    if (inProgress) {
        return fail('IN_PROGRESS', `当前处于 ${inProgress} 中间态，先结束它再改写提交`);
    }

    const pushed = isPushed(sha);
    if (pushed.pushed && !options.allowPushed) {
        return fail(
            'ALREADY_PUSHED',
            `上一次提交已推送到 ${pushed.branches.join(', ')}，改写会产生分叉；请改用新提交修正，或加 --allow-pushed 明确同意改写`,
        );
    }

    if (options.messageFile && !fs.existsSync(options.messageFile)) {
        return fail('MESSAGE_FILE_NOT_FOUND', `找不到提交信息文件：${options.messageFile}`);
    }

    const missing = options.add.filter((file) => !fs.existsSync(file));
    if (missing.length > 0) {
        return fail('ADD_FILE_NOT_FOUND', `以下文件不存在：${missing.join(', ')}`);
    }

    const plan = [];
    if (options.add.length > 0) {
        plan.push(['add', '--', ...options.add]);
    }
    plan.push([
        'commit',
        '--amend',
        ...(options.messageFile ? ['-F', options.messageFile] : ['--no-edit']),
    ]);

    const commands = plan.map(formatCommand);

    if (!options.execute) {
        return {
            code: 0,
            payload: {
                ok: true,
                dryRun: true,
                alreadyPushed: pushed.pushed,
                pushedTo: pushed.branches,
                commands,
            },
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

    return {
        code: 0,
        payload: { ok: true, dryRun: false, executed },
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
