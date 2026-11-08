// 执行撤销动作。默认 dry-run，只打印命令；--execute 才真正改动仓库。
// 安全规则由脚本强制执行，不依赖模型自觉。
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ACTIONS = new Set(['restore', 'unstage', 'reset', 'revert', 'recover']);
const MODES = new Set(['soft', 'mixed', 'hard']);

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
        action: null,
        files: [],
        mode: 'mixed',
        target: 'HEAD',
        execute: false,
        allowPushed: false,
        error: null,
    };

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        const next = () => argv[i + 1];

        if (arg === '--action') {
            options.action = next();
            i += 1;
        } else if (arg === '--files') {
            options.files = (next() || '')
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean);
            i += 1;
        } else if (arg === '--mode') {
            options.mode = next();
            i += 1;
        } else if (arg === '--target') {
            options.target = next() || 'HEAD';
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

function stamp() {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, '0');
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(
        now.getHours(),
    )}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

// 生成不重名的安全分支名
function uniqueBranchName(prefix) {
    const base = `${prefix}/${stamp()}`;
    let name = base;
    let index = 2;
    while (runGit(['rev-parse', '--verify', '--quiet', `refs/heads/${name}`]).ok) {
        name = `${base}-${index}`;
        index += 1;
    }
    return name;
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
    if (!options.action) return fail('MISSING_ACTION', '缺少 --action');
    if (!ACTIONS.has(options.action)) {
        return fail('UNKNOWN_ACTION', `--action 必须是 ${[...ACTIONS].join(' / ')}`);
    }
    if ((options.action === 'restore' || options.action === 'unstage') && options.files.length === 0) {
        return fail('MISSING_FILES', `--action ${options.action} 需要 --files`);
    }
    if (!MODES.has(options.mode)) {
        return fail('INVALID_MODE', '--mode 必须是 soft / mixed / hard');
    }

    const needsTarget = options.action === 'reset' || options.action === 'revert' || options.action === 'recover';
    let targetSha = null;
    if (needsTarget) {
        const resolved = runGit(['rev-parse', '--verify', `${options.target}^{commit}`]);
        if (!resolved.ok) return fail('INVALID_TARGET', `无法解析目标提交：${options.target}`);
        targetSha = resolved.stdout;
    }

    const gitDir = runGit(['rev-parse', '--git-dir']).stdout;
    const gitDirAbs = path.resolve(process.cwd(), gitDir);

    // recover 只是新建分支，中间态下也允许
    if (options.action !== 'recover') {
        const inProgress = detectInProgress(gitDirAbs);
        if (inProgress) {
            return fail('IN_PROGRESS', `当前处于 ${inProgress} 中间态，先结束它再撤销`);
        }
    }

    const pushed = targetSha ? isPushed(targetSha) : { pushed: false, branches: [] };

    // 已推送的提交不允许 reset，必须走 revert，除非用户显式放行
    if (options.action === 'reset' && pushed.pushed && !options.allowPushed) {
        return fail(
            'ALREADY_PUSHED',
            `目标提交已推送到 ${pushed.branches.join(', ')}，请改用 --action revert；确需改写历史请加 --allow-pushed`,
        );
    }

    // revert 会在工作区创作反向修改，脏工作区会失败
    if (options.action === 'revert') {
        const status = runGit(['status', '--porcelain=v1']);
        if (status.ok && status.stdout.length > 0) {
            return fail('WORKTREE_DIRTY', '工作区有未提交改动，revert 会失败；请先提交或 stash');
        }
    }

    const plan = [];
    let riskLevel = 'L2';

    if (options.action === 'restore') {
        plan.push(['restore', '--', ...options.files]);
    } else if (options.action === 'unstage') {
        plan.push(['restore', '--staged', '--', ...options.files]);
    } else if (options.action === 'reset') {
        if (options.mode === 'hard') {
            riskLevel = 'L3';
            const backupBranch = uniqueBranchName('backup');
            plan.push(['branch', backupBranch]);
            options.backupBranch = backupBranch;
        }
        plan.push(['reset', `--${options.mode}`, options.target]);
    } else if (options.action === 'revert') {
        plan.push(['revert', '--no-edit', targetSha]);
    } else if (options.action === 'recover') {
        const rescueBranch = uniqueBranchName('rescue');
        plan.push(['branch', rescueBranch, targetSha]);
        options.rescueBranch = rescueBranch;
    }

    const willLose = [];
    if (options.action === 'reset' && options.mode === 'hard') {
        const log = runGit(['log', '--oneline', `${targetSha}..HEAD`]);
        if (log.ok && log.stdout) {
            willLose.push(...log.stdout.split('\n').filter(Boolean));
        }
    }

    const commands = plan.map(formatCommand);

    if (!options.execute) {
        return {
            code: 0,
            payload: {
                ok: true,
                dryRun: true,
                action: options.action,
                riskLevel,
                alreadyPushed: pushed.pushed,
                commands,
                ...(willLose.length > 0 ? { willLose } : {}),
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
                    action: options.action,
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
        payload: {
            ok: true,
            dryRun: false,
            action: options.action,
            riskLevel,
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
